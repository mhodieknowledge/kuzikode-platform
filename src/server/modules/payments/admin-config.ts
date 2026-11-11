/**
 * Gateway configuration (docs/06 §2, P6.3c): provider accounts and payment routes. Super Administrators only. Secrets
 * never pass through here: an account names a secret prefix and the page shows which secret names exist. Every change
 * is audited in the same batch.
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { conflict, forbidden, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { isSuperAdmin } from '../../lib/policies';
import type { PaymentAccountCreate, PaymentAccountUpdate, PaymentRouteInput } from '../../../shared/schemas/payments';
import { getProvider, providerAllowed, registeredProviders } from './providers';
import {
  APP_KEY,
  credentialStatus,
  getAccount,
  listAccounts,
  type CredentialStatus,
  type PaymentAccount,
} from './router';

function assertSuperAdmin(ctx: RequestContext) {
  if (!isSuperAdmin(ctx)) throw forbidden('Only a Super Administrator can change payment gateways.');
}

export interface AccountView extends PaymentAccount {
  providerName: string;
  /** Saved cards are on (the account option `tokenizationEnabled`). */
  tokenizationEnabled: boolean;
  /** False for an unknown provider, or the test gateway where it is switched off (always in production). */
  usable: boolean;
  credentials: CredentialStatus;
  /** What the gateway offers (the account can narrow it). */
  available: { currencies: string[]; methods: { code: string; name: string; flow: string }[] };
}

export interface RouteView {
  id: string;
  appKey: string;
  currency: string;
  methodCode: string;
  accountId: string;
  accountLabel: string;
  priority: number;
  enabled: boolean;
}

export async function paymentConfig(ctx: RequestContext): Promise<{
  accounts: AccountView[];
  routes: RouteView[];
  providers: { key: string; name: string }[];
  appKey: string;
}> {
  assertSuperAdmin(ctx);
  const accounts = (await listAccounts(ctx)).map((a): AccountView => {
    const p = getProvider(ctx, a.providerKey);
    const caps = p?.capabilities({ accountId: a.id, mode: a.mode, credentials: {}, options: a.options });
    return {
      ...a,
      providerName: p?.displayName ?? a.providerKey,
      tokenizationEnabled: a.options['tokenizationEnabled'] === true,
      usable: !!p && providerAllowed(ctx, a.providerKey),
      credentials: credentialStatus(ctx, a),
      available: {
        currencies: caps?.currencies ?? [],
        methods: (caps?.methods ?? []).map((m) => ({ code: m.code, name: m.name, flow: m.flow })),
      },
    };
  });
  const { results } = await ctx.db
    .prepare(
      `SELECT r.id, r.app_key, r.currency, r.method_code, r.account_id, r.priority, r.enabled, a.label
       FROM payment_routes r JOIN payment_provider_accounts a ON a.id = r.account_id
       ORDER BY r.app_key, (r.currency = '*'), r.currency, (r.method_code = '*'), r.method_code, r.priority`,
    )
    .all<{
      id: string;
      app_key: string;
      currency: string;
      method_code: string;
      account_id: string;
      priority: number;
      enabled: number;
      label: string;
    }>();
  return {
    accounts,
    routes: results.map((r) => ({
      id: r.id,
      appKey: r.app_key,
      currency: r.currency,
      methodCode: r.method_code,
      accountId: r.account_id,
      accountLabel: r.label,
      priority: r.priority,
      enabled: r.enabled === 1,
    })),
    providers: registeredProviders()
      .filter((k) => providerAllowed(ctx, k))
      .map((k) => ({ key: k, name: getProvider(ctx, k)!.displayName })),
    appKey: APP_KEY,
  };
}

async function activeCurrencies(ctx: RequestContext): Promise<string[]> {
  const { results } = await ctx.db.prepare('SELECT code FROM currencies WHERE active = 1').all<{ code: string }>();
  return results.map((r) => r.code);
}

/** Currencies and methods must be ones the gateway offers (and currencies ones we bill in). */
async function checkAccountFields(ctx: RequestContext, providerKey: string, input: PaymentAccountUpdate) {
  const p = getProvider(ctx, providerKey);
  if (!p) throw validationError({ providerKey: ['This gateway is not supported.'] });
  const caps = p.capabilities({ accountId: 'check', mode: input.mode, credentials: {} });
  const ours = await activeCurrencies(ctx);
  const badCurrency = input.currencies.filter((c) => !caps.currencies.includes(c) || !ours.includes(c));
  if (badCurrency.length)
    throw validationError({ currencies: [`Not available for ${p.displayName}: ${badCurrency.join(', ')}.`] });
  const codes = caps.methods.map((m) => m.code);
  const badMethod = input.enabledMethods.filter((m) => !codes.includes(m));
  if (badMethod.length)
    throw validationError({ enabledMethods: [`Not offered by ${p.displayName}: ${badMethod.join(', ')}.`] });
}

const accountSnapshot = (
  a: Pick<PaymentAccount, 'label' | 'mode' | 'currencies' | 'enabledMethods' | 'enabled' | 'statusNote'> & {
    tokenizationEnabled?: boolean;
  },
) => ({
  tokenizationEnabled: a.tokenizationEnabled ?? false,
  label: a.label,
  mode: a.mode,
  currencies: a.currencies,
  enabledMethods: a.enabledMethods,
  enabled: a.enabled,
  statusNote: a.statusNote,
});

export async function createPaymentAccount(ctx: RequestContext, input: PaymentAccountCreate): Promise<{ id: string }> {
  assertSuperAdmin(ctx);
  if (!providerAllowed(ctx, input.providerKey))
    throw validationError({ providerKey: ['This gateway is not available here.'] });
  await checkAccountFields(ctx, input.providerKey, input);
  const taken = await ctx.db
    .prepare('SELECT 1 AS x FROM payment_provider_accounts WHERE secret_prefix = ?')
    .bind(input.secretPrefix)
    .first();
  if (taken) throw validationError({ secretPrefix: ['Another account already uses this secret prefix.'] });
  const id = newId('ppa', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO payment_provider_accounts (id, provider_key, label, mode, secret_prefix, currencies, enabled_methods, options,
           enabled, status_note, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.providerKey,
        input.label,
        input.mode,
        input.secretPrefix,
        JSON.stringify(input.currencies),
        JSON.stringify(input.enabledMethods),
        JSON.stringify(input.tokenizationEnabled ? { tokenizationEnabled: true } : {}),
        input.enabled ? 1 : 0,
        input.statusNote,
        ctx.actor.userId,
        now,
        now,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'payment_account.created',
        entityType: 'payment_account',
        entityId: id,
        after: { providerKey: input.providerKey, secretPrefix: input.secretPrefix, ...accountSnapshot(input) },
      }),
    )
    .run();
  return { id };
}

export async function updatePaymentAccount(
  ctx: RequestContext,
  id: string,
  input: PaymentAccountUpdate,
): Promise<void> {
  assertSuperAdmin(ctx);
  const before = await getAccount(ctx, id);
  if (!before) throw notFound();
  await checkAccountFields(ctx, before.providerKey, input);
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE payment_provider_accounts SET label = ?, mode = ?, currencies = ?, enabled_methods = ?, enabled = ?, status_note = ?,
           options = ?, updated_by = ?, updated_at = ? WHERE id = ?`,
        input.label,
        input.mode,
        JSON.stringify(input.currencies),
        JSON.stringify(input.enabledMethods),
        input.enabled ? 1 : 0,
        input.statusNote,
        JSON.stringify({
          ...before.options,
          tokenizationEnabled: input.tokenizationEnabled ?? before.options['tokenizationEnabled'] === true,
        }),
        ctx.actor.userId,
        ctx.now().toISOString(),
        id,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'payment_account.updated',
        entityType: 'payment_account',
        entityId: id,
        before: accountSnapshot({ ...before, tokenizationEnabled: before.options['tokenizationEnabled'] === true }),
        after: accountSnapshot({
          ...input,
          tokenizationEnabled: input.tokenizationEnabled ?? before.options['tokenizationEnabled'] === true,
        }),
      }),
    )
    .run();
}

async function checkRoute(ctx: RequestContext, input: PaymentRouteInput) {
  const account = await getAccount(ctx, input.accountId);
  if (!account) throw validationError({ accountId: ['Choose an account.'] });
  if (input.currency !== '*' && !(await activeCurrencies(ctx)).includes(input.currency))
    throw validationError({ currency: ['Not a currency we bill in.'] });
  if (input.currency !== '*' && account.currencies.length && !account.currencies.includes(input.currency))
    throw validationError({ currency: [`${account.label} does not take ${input.currency}.`] });
  if (input.methodCode !== '*') {
    const caps = getProvider(ctx, account.providerKey)?.capabilities({
      accountId: account.id,
      mode: account.mode,
      credentials: {},
    });
    const offered = (caps?.methods ?? []).map((m) => m.code);
    if (
      !offered.includes(input.methodCode) ||
      (account.enabledMethods.length && !account.enabledMethods.includes(input.methodCode))
    )
      throw validationError({ methodCode: [`${account.label} does not offer this method.`] });
  }
  return account;
}

const routeSnapshot = (r: PaymentRouteInput) => ({ ...r });

export async function createPaymentRoute(ctx: RequestContext, input: PaymentRouteInput): Promise<{ id: string }> {
  assertSuperAdmin(ctx);
  await checkRoute(ctx, input);
  const id = newId('prt', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO payment_routes (id, app_key, currency, method_code, account_id, priority, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.appKey,
        input.currency,
        input.methodCode,
        input.accountId,
        input.priority,
        input.enabled ? 1 : 0,
        now,
        now,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'payment_route.created',
        entityType: 'payment_route',
        entityId: id,
        after: routeSnapshot(input),
      }),
    )
    .run();
  return { id };
}

async function loadRoute(ctx: RequestContext, id: string): Promise<PaymentRouteInput> {
  const r = await ctx.db
    .prepare('SELECT app_key, currency, method_code, account_id, priority, enabled FROM payment_routes WHERE id = ?')
    .bind(id)
    .first<{
      app_key: string;
      currency: string;
      method_code: string;
      account_id: string;
      priority: number;
      enabled: number;
    }>();
  if (!r) throw notFound();
  return {
    appKey: r.app_key,
    currency: r.currency,
    methodCode: r.method_code,
    accountId: r.account_id,
    priority: r.priority,
    enabled: r.enabled === 1,
  };
}

export async function updatePaymentRoute(ctx: RequestContext, id: string, input: PaymentRouteInput): Promise<void> {
  assertSuperAdmin(ctx);
  const before = await loadRoute(ctx, id);
  await checkRoute(ctx, input);
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE payment_routes SET app_key = ?, currency = ?, method_code = ?, account_id = ?, priority = ?, enabled = ?, updated_at = ?
         WHERE id = ?`,
        input.appKey,
        input.currency,
        input.methodCode,
        input.accountId,
        input.priority,
        input.enabled ? 1 : 0,
        ctx.now().toISOString(),
        id,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'payment_route.updated',
        entityType: 'payment_route',
        entityId: id,
        before: routeSnapshot(before),
        after: routeSnapshot(input),
      }),
    )
    .run();
}

/** Routes are configuration, not financial records: removing one is allowed (audited). */
export async function deletePaymentRoute(ctx: RequestContext, id: string): Promise<void> {
  assertSuperAdmin(ctx);
  const before = await loadRoute(ctx, id);
  const res = await new Batch(ctx.db)
    .add(stmt(ctx.db, 'DELETE FROM payment_routes WHERE id = ?', id), 'route')
    .add(
      auditStmt(ctx, {
        action: 'payment_route.deleted',
        entityType: 'payment_route',
        entityId: id,
        before: routeSnapshot(before),
      }),
    )
    .run();
  if (res.changes('route') !== 1) throw conflict('This route was already removed.');
}
