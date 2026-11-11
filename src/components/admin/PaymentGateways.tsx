/**
 * Payment gateways island (P6.3c): provider accounts (credentials found / missing by secret name, never values) and the
 * routes that choose an account per currency and method. Super Administrators only; the server enforces it.
 */
import { useState } from 'react';
import { apiFetch, Button, Checkbox, ConfirmDialog, Dialog, Field, Input, Select, Switch, Textarea } from '../ui';
import { Alert, useAction } from './actions';

interface Method {
  code: string;
  name: string;
  flow: string;
}
interface Account {
  id: string;
  providerKey: string;
  providerName: string;
  label: string;
  mode: 'test' | 'live';
  secretPrefix: string;
  currencies: string[];
  enabledMethods: string[];
  enabled: boolean;
  statusNote: string | null;
  tokenizationEnabled: boolean;
  usable: boolean;
  credentials: { fields: { name: string; present: boolean }[]; complete: boolean };
  available: { currencies: string[]; methods: Method[] };
}
interface Route {
  id: string;
  appKey: string;
  currency: string;
  methodCode: string;
  accountId: string;
  accountLabel: string;
  priority: number;
  enabled: boolean;
}
export interface GatewayConfig {
  accounts: Account[];
  routes: Route[];
  providers: { key: string; name: string }[];
  appKey: string;
}

const badge = (tone: 'ok' | 'warn' | 'off') =>
  `inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${
    tone === 'ok'
      ? 'bg-success-50 text-success-700'
      : tone === 'warn'
        ? 'bg-warning-50 text-warning-700'
        : 'bg-ink-950/5 text-ink-800'
  }`;

export function PaymentGateways({ initial, currencies }: { initial: GatewayConfig; currencies: string[] }) {
  const [config, setConfig] = useState(initial);
  const reload = async () => setConfig((await apiFetch<{ data: GatewayConfig }>('/api/v1/admin/payments/config')).data);
  const methodName = (code: string) =>
    code === '*'
      ? 'Any method'
      : (config.accounts.flatMap((a) => a.available.methods).find((m) => m.code === code)?.name ?? code);

  return (
    <div className="mt-6 flex min-w-0 flex-col gap-10">
      <section aria-labelledby="acc-h" className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="acc-h" className="text-lg font-semibold">
            Accounts
          </h2>
          <AccountDialog mode="create" config={config} currencies={currencies} onSaved={reload} />
        </div>
        <ul className="mt-4 grid gap-4 lg:grid-cols-2">
          {config.accounts.map((a) => (
            <li key={a.id} className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-ink-950">{a.label}</h3>
                  <p className="text-[13px] text-ink-600">
                    {a.providerName} · {a.mode === 'live' ? 'Live' : 'Test mode'} · prefix{' '}
                    <span className="font-mono whitespace-nowrap">{a.secretPrefix}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!a.enabled ? <span className={badge('off')}>Disabled</span> : null}
                  {!a.usable ? <span className={badge('off')}>Not available here</span> : null}
                  <span className={badge(a.credentials.complete ? 'ok' : 'warn')}>
                    {a.credentials.complete ? 'Credentials found' : 'Credentials missing'}
                  </span>
                </div>
              </div>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm [&_dd]:break-words">
                <dt className="text-ink-600">Currencies</dt>
                <dd>{(a.currencies.length ? a.currencies : a.available.currencies).join(', ')}</dd>
                <dt className="text-ink-600">Saved cards</dt>
                <dd>{a.tokenizationEnabled ? 'On' : 'Off'}</dd>
                <dt className="text-ink-600">Methods</dt>
                <dd>
                  {(a.enabledMethods.length
                    ? a.available.methods.filter((m) => a.enabledMethods.includes(m.code))
                    : a.available.methods
                  )
                    .map((m) => m.name)
                    .join(', ')}
                </dd>
                <dt className="text-ink-600">Secrets</dt>
                <dd className="flex flex-col">
                  {a.credentials.fields.map((f) => (
                    <span key={f.name} className="text-[12px]">
                      <span className="font-mono break-all">{f.name}</span>{' '}
                      <span className={f.present ? 'text-success-700' : 'text-warning-700'}>
                        {f.present ? '✓ set' : '✗ missing'}
                      </span>
                    </span>
                  ))}
                </dd>
              </dl>
              {a.statusNote ? <p className="text-[13px] text-ink-600">{a.statusNote}</p> : null}
              <div>
                <AccountDialog mode="edit" account={a} config={config} currencies={currencies} onSaved={reload} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="rt-h" className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="rt-h" className="text-lg font-semibold">
            Routes
          </h2>
          <RouteDialog config={config} currencies={currencies} onSaved={reload} />
        </div>
        <div className="relative mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Payment routes</caption>
            <thead className="bg-canvas text-[13px] text-ink-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  App
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Currency
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Method
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Account
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Priority
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {config.routes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-600">
                    No routes. Clients can't pay online until a route points to an account with credentials.
                  </td>
                </tr>
              ) : (
                config.routes.map((r) => (
                  <tr key={r.id} className={`border-t border-line ${r.enabled ? '' : 'text-ink-600'}`}>
                    <td className="px-4 py-3 font-mono text-[13px]">{r.appKey}</td>
                    <td className="px-4 py-3">{r.currency === '*' ? 'Any currency' : r.currency}</td>
                    <td className="px-4 py-3">{methodName(r.methodCode)}</td>
                    <td className="px-4 py-3">
                      {r.accountLabel}
                      {r.enabled ? null : <span className={`ml-2 ${badge('off')}`}>Off</span>}
                    </td>
                    <td className="tnum px-4 py-3">{r.priority}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <RouteDialog route={r} config={config} currencies={currencies} onSaved={reload} />
                        <DeleteRoute route={r} label={`${r.currency} · ${methodName(r.methodCode)}`} onDone={reload} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AccountDialog({
  mode,
  account,
  config,
  currencies,
  onSaved,
}: {
  mode: 'create' | 'edit';
  account?: Account;
  config: GatewayConfig;
  currencies: string[];
  onSaved: () => Promise<void>;
}) {
  const a = useAction();
  const [open, setOpen] = useState(false);
  const [providerKey, setProviderKey] = useState(account?.providerKey ?? config.providers[0]?.key ?? '');
  const [label, setLabel] = useState(account?.label ?? '');
  const [secretPrefix, setSecretPrefix] = useState(account?.secretPrefix ?? '');
  const [accMode, setAccMode] = useState<'test' | 'live'>(account?.mode ?? 'test');
  const [accCurrencies, setAccCurrencies] = useState<string[]>(account?.currencies ?? []);
  const [methods, setMethods] = useState<string[]>(account?.enabledMethods ?? []);
  const [enabled, setEnabled] = useState(account?.enabled ?? true);
  const [note, setNote] = useState(account?.statusNote ?? '');
  const [tokenization, setTokenization] = useState(account?.tokenizationEnabled ?? false);
  // What the chosen gateway offers (taken from any account of that gateway, or the account itself).
  const offer = account?.available ??
    config.accounts.find((x) => x.providerKey === providerKey)?.available ?? { currencies, methods: [] };
  const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));
  const save = () =>
    a.run(async () => {
      const body = {
        label,
        mode: accMode,
        currencies: accCurrencies,
        enabledMethods: methods,
        enabled,
        statusNote: note.trim() ? note.trim() : null,
        tokenizationEnabled: tokenization,
      };
      if (mode === 'create')
        await apiFetch('/api/v1/admin/payments/config/accounts', { body: { ...body, providerKey, secretPrefix } });
      else await apiFetch(`/api/v1/admin/payments/config/accounts/${account!.id}`, { method: 'PATCH', body });
      await onSaved();
      setOpen(false);
    });
  return (
    <>
      <Button variant={mode === 'create' ? 'primary' : 'secondary'} size="sm" onClick={() => setOpen(true)}>
        {mode === 'create' ? 'Add account' : `Edit ${account!.label}`}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={mode === 'create' ? 'Add a gateway account' : `Edit ${account!.label}`}
        description="Secrets are Worker secrets named <prefix>_<NAME>; they are never entered here."
      >
        <div className="flex flex-col gap-4">
          <Alert message={a.error} />
          {mode === 'create' ? (
            <>
              <Field label="Gateway" error={a.errors['providerKey']} required>
                <Select
                  value={providerKey}
                  onChange={(e) => setProviderKey(e.target.value)}
                  options={config.providers.map((p) => ({ value: p.key, label: p.name }))}
                />
              </Field>
              <Field
                label="Secret prefix"
                hint="e.g. PAYNOW_ZWG → secrets PAYNOW_ZWG_INTEGRATION_ID and PAYNOW_ZWG_INTEGRATION_KEY"
                error={a.errors['secretPrefix']}
                required
              >
                <Input value={secretPrefix} onChange={(e) => setSecretPrefix(e.target.value.toUpperCase())} />
              </Field>
            </>
          ) : null}
          <Field label="Name" error={a.errors['label']} required>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Mode" error={a.errors['mode']}>
            <Select
              value={accMode}
              onChange={(e) => setAccMode(e.target.value as 'test' | 'live')}
              options={[
                { value: 'test', label: 'Test mode (no real money; marked TEST PAYMENT)' },
                { value: 'live', label: 'Live' },
              ]}
            />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-ink-950">
              Currencies (none ticked = all the gateway offers)
            </legend>
            {offer.currencies
              .filter((c) => currencies.includes(c))
              .map((c) => (
                <Checkbox
                  key={c}
                  label={c}
                  checked={accCurrencies.includes(c)}
                  onCheckedChange={(v) => setAccCurrencies(toggle(accCurrencies, c, v))}
                />
              ))}
            {a.errors['currencies'] ? <p className="text-sm text-danger-700">{a.errors['currencies'][0]}</p> : null}
          </fieldset>
          {offer.methods.length ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-ink-950">Methods (none ticked = all)</legend>
              {offer.methods.map((m) => (
                <Checkbox
                  key={m.code}
                  label={m.name}
                  checked={methods.includes(m.code)}
                  onCheckedChange={(v) => setMethods(toggle(methods, m.code, v))}
                />
              ))}
              {a.errors['enabledMethods'] ? (
                <p className="text-sm text-danger-700">{a.errors['enabledMethods'][0]}</p>
              ) : null}
            </fieldset>
          ) : null}
          <Switch label="Enabled" checked={enabled} onCheckedChange={setEnabled} />
          <Switch label="Saved cards (card tokenization)" checked={tokenization} onCheckedChange={setTokenization} />
          <p className="-mt-2 text-[13px] text-ink-600">
            Switch on only after the gateway has approved card tokenization for this account. Clients can then save a
            card in the portal and pay with it on our checkout, and opt in to automatic charges for their plans.
          </p>
          <Field label="Note for the team" error={a.errors['statusNote']}>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={a.busy}>
              {mode === 'create' ? 'Add account' : 'Save changes'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function RouteDialog({
  route,
  config,
  currencies,
  onSaved,
}: {
  route?: Route;
  config: GatewayConfig;
  currencies: string[];
  onSaved: () => Promise<void>;
}) {
  const a = useAction();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(route?.accountId ?? config.accounts[0]?.id ?? '');
  const [currency, setCurrency] = useState(route?.currency ?? '*');
  const [methodCode, setMethodCode] = useState(route?.methodCode ?? '*');
  const [priority, setPriority] = useState(String(route?.priority ?? 100));
  const [enabled, setEnabled] = useState(route?.enabled ?? true);
  const account = config.accounts.find((x) => x.id === accountId);
  const save = () =>
    a.run(async () => {
      const body = { appKey: route?.appKey ?? config.appKey, currency, methodCode, accountId, priority, enabled };
      if (route) await apiFetch(`/api/v1/admin/payments/config/routes/${route.id}`, { method: 'PATCH', body });
      else await apiFetch('/api/v1/admin/payments/config/routes', { body });
      await onSaved();
      setOpen(false);
    });
  return (
    <>
      <Button variant={route ? 'ghost' : 'primary'} size="sm" onClick={() => setOpen(true)}>
        {route ? 'Edit' : 'Add route'}
        {route ? (
          <span className="sr-only">
            {' '}
            route {route.currency} {route.methodCode}
          </span>
        ) : null}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={route ? 'Edit route' : 'Add a route'}>
        <div className="flex flex-col gap-4">
          <Alert message={a.error} />
          <Field label="Account" error={a.errors['accountId']} required>
            <Select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              options={config.accounts.map((x) => ({ value: x.id, label: `${x.label} (${x.providerName})` }))}
            />
          </Field>
          <Field label="Currency" error={a.errors['currency']}>
            <Select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              options={[{ value: '*', label: 'Any currency' }, ...currencies.map((c) => ({ value: c, label: c }))]}
            />
          </Field>
          <Field label="Method" error={a.errors['methodCode']}>
            <Select
              value={methodCode}
              onChange={(e) => setMethodCode(e.target.value)}
              options={[
                { value: '*', label: 'Any method' },
                ...(account?.available.methods ?? []).map((m) => ({ value: m.code, label: m.name })),
              ]}
            />
          </Field>
          <Field label="Priority" hint="Lower wins when two routes match equally." error={a.errors['priority']}>
            <Input type="number" min={1} max={10000} value={priority} onChange={(e) => setPriority(e.target.value)} />
          </Field>
          <Switch label="Enabled" checked={enabled} onCheckedChange={setEnabled} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={a.busy}>
              {route ? 'Save route' : 'Add route'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function DeleteRoute({ route, label, onDone }: { route: Route; label: string; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Remove<span className="sr-only"> route {label}</span>
      </Button>
      <Alert message={error} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Remove this route?"
        description={`${label} → ${route.accountLabel}. Payments already started are not affected.`}
        confirmLabel="Remove route"
        destructive
        onConfirm={async () => {
          try {
            await apiFetch(`/api/v1/admin/payments/config/routes/${route.id}`, { method: 'DELETE' });
            await onDone();
          } catch {
            setError('The route could not be removed. Reload and try again.');
          }
        }}
      />
    </>
  );
}
