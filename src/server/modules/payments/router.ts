/**
 * Payment router (docs/06 §2): picks a provider ACCOUNT for (app, currency, method) from `payment_routes`, and builds the
 * adapter config from the account plus its Worker secrets. Switching gateway is a data change here, never a code change.
 * The mock gateway is never selectable in production (config.mockPaymentsEnabled is false there whatever the flag says).
 */
import {
  type PaymentMethodInfo,
  type PaymentProvider,
  type ProviderCapabilities,
  type ProviderConfig,
} from '@kuzikode/payments';
import type { RequestContext } from '../../context';
import { getProvider, providerAllowed } from './providers';

export const APP_KEY = 'kuzikode-platform';

export interface PaymentAccount {
  id: string;
  providerKey: string;
  label: string;
  mode: 'test' | 'live';
  secretPrefix: string;
  currencies: string[];
  enabledMethods: string[];
  options: Record<string, unknown>;
  enabled: boolean;
  statusNote: string | null;
}

interface AccountRow {
  id: string;
  provider_key: string;
  label: string;
  mode: 'test' | 'live';
  secret_prefix: string;
  currencies: string;
  enabled_methods: string;
  options: string;
  enabled: number;
  status_note: string | null;
}

const parseList = (s: string): string[] => {
  try {
    const v: unknown = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const parseObject = (s: string): Record<string, unknown> => {
  try {
    const v: unknown = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const toAccount = (r: AccountRow): PaymentAccount => ({
  id: r.id,
  providerKey: r.provider_key,
  label: r.label,
  mode: r.mode,
  secretPrefix: r.secret_prefix,
  currencies: parseList(r.currencies),
  enabledMethods: parseList(r.enabled_methods),
  options: parseObject(r.options),
  enabled: r.enabled === 1,
  statusNote: r.status_note,
});

export async function listAccounts(ctx: RequestContext): Promise<PaymentAccount[]> {
  const { results } = await ctx.db.prepare('SELECT * FROM payment_provider_accounts ORDER BY label').all<AccountRow>();
  return results.map(toAccount);
}

export async function getAccount(ctx: RequestContext, id: string): Promise<PaymentAccount | null> {
  const r = await ctx.db.prepare('SELECT * FROM payment_provider_accounts WHERE id = ?').bind(id).first<AccountRow>();
  return r ? toAccount(r) : null;
}

export interface CredentialStatus {
  /** Secret names (never values) and whether each is set. */
  fields: { name: string; present: boolean }[];
  complete: boolean;
}

/** Adapter dev defaults (the mock's signing key) apply only in local development; staging needs real secrets. */
const devDefaults = (ctx: RequestContext) => ctx.config.appEnv === 'development';

function secretValue(ctx: RequestContext, name: string): string | undefined {
  const v = (ctx.env as unknown as Record<string, unknown>)[name];
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

/** Which of the account's secrets exist (for the admin "credentials found / missing" view). */
export function credentialStatus(ctx: RequestContext, account: PaymentAccount): CredentialStatus {
  const provider = getProvider(ctx, account.providerKey);
  if (!provider) return { fields: [], complete: false };
  const fields = provider.credentialFields.map((f) => {
    const name = `${account.secretPrefix}_${f.env}`;
    return { name, present: !!secretValue(ctx, name) || (devDefaults(ctx) && !!f.devDefault) };
  });
  return { fields, complete: fields.every((f) => f.present) };
}

/**
 * The adapter config for an account, or null when it can't be used: provider unknown or not allowed here (mock in
 * production), account disabled, or a secret missing. Secrets go into the config only; never logged or returned.
 */
export function accountConfig(
  ctx: RequestContext,
  account: PaymentAccount,
): { provider: PaymentProvider; config: ProviderConfig } | null {
  if (!account.enabled || !providerAllowed(ctx, account.providerKey)) return null;
  const provider = getProvider(ctx, account.providerKey);
  if (!provider) return null;
  const credentials: Record<string, string> = {};
  for (const f of provider.credentialFields) {
    const v = secretValue(ctx, `${account.secretPrefix}_${f.env}`) ?? (devDefaults(ctx) ? f.devDefault : undefined);
    if (!v) return null;
    credentials[f.key] = v;
  }
  const options: Record<string, unknown> = { ...account.options };
  // Account options may name a secret holding a value that must not sit in the database (e.g. Paynow's test auth e-mail).
  for (const [k, v] of Object.entries(account.options)) {
    if (k.endsWith('Secret') && typeof v === 'string') {
      const value = secretValue(ctx, v);
      delete options[k];
      if (value) options[k.slice(0, -'Secret'.length)] = value;
    }
  }
  options['checkoutBaseUrl'] = `${ctx.config.siteOrigin}/dev/mock-checkout`;
  return { provider, config: { accountId: account.id, mode: account.mode, credentials, options } };
}

/** The methods an account offers: the adapter's capabilities, narrowed by the account's `enabled_methods` (empty = all). */
export function accountMethods(account: PaymentAccount, caps: ProviderCapabilities): PaymentMethodInfo[] {
  return account.enabledMethods.length
    ? caps.methods.filter((m) => account.enabledMethods.includes(m.code))
    : caps.methods;
}

export interface ResolvedRoute {
  routeId: string;
  account: PaymentAccount;
  provider: PaymentProvider;
  config: ProviderConfig;
  methods: PaymentMethodInfo[];
}

interface RouteRow {
  id: string;
  currency: string;
  method_code: string;
  account_id: string;
  priority: number;
}

async function candidateRoutes(ctx: RequestContext, appKey: string, currency: string) {
  const { results } = await ctx.db
    .prepare(
      `SELECT r.id, r.currency, r.method_code, r.account_id, r.priority, a.* , r.id AS route_id
       FROM payment_routes r JOIN payment_provider_accounts a ON a.id = r.account_id
       WHERE r.enabled = 1 AND r.app_key = ? AND (r.currency = ? OR r.currency = '*')
       ORDER BY (r.currency <> '*') DESC, (r.method_code <> '*') DESC, r.priority ASC, r.id ASC`,
    )
    .bind(appKey, currency)
    .all<RouteRow & AccountRow & { route_id: string }>();
  return results.map((r) => ({
    routeId: r.route_id,
    currency: r.currency,
    methodCode: r.method_code,
    priority: r.priority,
    account: toAccount({ ...r, id: r.account_id }),
  }));
}

function usable(ctx: RequestContext, account: PaymentAccount, currency: string) {
  const built = accountConfig(ctx, account);
  if (!built) return null;
  const caps = built.provider.capabilities(built.config);
  if (!caps.currencies.includes(currency)) return null;
  if (account.currencies.length && !account.currencies.includes(currency)) return null;
  return { ...built, methods: accountMethods(account, caps) };
}

/**
 * The account to use for one payment. Most specific route wins (exact currency over `*`, then exact method over `*`),
 * then the lowest priority; routes whose account is disabled, not allowed here, missing secrets, or that can't take the
 * currency/method are skipped. Null = no way to pay online (the app hides "Pay now" and alerts admins).
 */
export async function resolveRoute(
  ctx: RequestContext,
  q: { currency: string; methodCode?: string; appKey?: string },
): Promise<ResolvedRoute | null> {
  for (const r of await candidateRoutes(ctx, q.appKey ?? APP_KEY, q.currency)) {
    if (q.methodCode ? r.methodCode !== '*' && r.methodCode !== q.methodCode : r.methodCode !== '*') continue;
    const u = usable(ctx, r.account, q.currency);
    if (!u) continue;
    if (q.methodCode && !u.methods.some((m) => m.code === q.methodCode)) continue;
    return { routeId: r.routeId, account: r.account, ...u };
  }
  return null;
}

export interface MethodOption extends PaymentMethodInfo {
  accountId: string;
  testMode: boolean;
}

/**
 * Every method a customer can use for this currency, each with the account that would take it (what the checkout
 * page renders). A method-specific route overrides the wildcard route for that method only.
 */
export async function paymentMethodOptions(
  ctx: RequestContext,
  q: { currency: string; appKey?: string },
): Promise<MethodOption[]> {
  const routes = await candidateRoutes(ctx, q.appKey ?? APP_KEY, q.currency);
  const codes = new Set<string>();
  for (const r of routes) {
    if (r.methodCode !== '*') codes.add(r.methodCode);
    else for (const m of usable(ctx, r.account, q.currency)?.methods ?? []) codes.add(m.code);
  }
  const out: MethodOption[] = [];
  for (const code of codes) {
    const route = await resolveRoute(ctx, { ...q, methodCode: code });
    const method = route?.methods.find((m) => m.code === code);
    if (route && method) out.push({ ...method, accountId: route.account.id, testMode: route.account.mode === 'test' });
  }
  return out;
}
