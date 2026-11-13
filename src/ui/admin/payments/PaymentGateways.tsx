/**
 * Payment gateways (R6.2): provider accounts (credentials found / missing by secret name, never values) and the routes that
 * choose an account per currency and method. Super Administrators only; the server enforces it. Labels, headings and the
 * "NAME ✗ missing" text are the e2e contract.
 */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { StatusPill } from '../../primitives/display';
import { ConfirmSheet } from '../../primitives/sheet';
import { CheckItem, FormSheet } from '../form';
import {
  deleteRoute,
  toggleIn,
  useGatewayConfig,
  useSaveAccount,
  useSaveRoute,
  type GatewayAccount,
  type GatewayConfig,
  type GatewayRoute,
} from './useGateways';

export type { GatewayConfig };

export function PaymentGateways({ initial, currencies }: { initial: GatewayConfig; currencies: string[] }) {
  const { config, refresh, methodName } = useGatewayConfig(initial);
  return (
    <div className="kz-astack">
      <section className="kz-apane" aria-labelledby="acc-h">
        <div className="kz-apane__head">
          <h2 className="kz-apane__title" id="acc-h">
            Accounts
          </h2>
          <div className="kz-apane__acts">
            <AccountSheet config={config} currencies={currencies} onSaved={refresh} />
          </div>
        </div>
        <div className="kz-apane__body">
          <ul className="kz-gw">
            {config.accounts.map((a) => (
              <li key={a.id} className="kz-gw__card">
                <div className="kz-gw__head">
                  <div>
                    <h3 className="kz-gw__title">{a.label}</h3>
                    <p className="kz-gw__sub">
                      {a.providerName} · {a.mode === 'live' ? 'Live' : 'Test mode'} · prefix{' '}
                      <span className="kz-amono">{a.secretPrefix}</span>
                    </p>
                  </div>
                  <div className="kz-dt__tags">
                    {!a.enabled ? <StatusPill>Disabled</StatusPill> : null}
                    {!a.usable ? <StatusPill>Not available here</StatusPill> : null}
                    <StatusPill tone={a.credentials.complete ? 'ok' : 'warn'}>
                      {a.credentials.complete ? 'Credentials found' : 'Credentials missing'}
                    </StatusPill>
                  </div>
                </div>
                <dl className="kz-adl kz-adl--rows">
                  <div className="kz-adl__i">
                    <dt>Currencies</dt>
                    <dd>{(a.currencies.length ? a.currencies : a.available.currencies).join(', ')}</dd>
                  </div>
                  <div className="kz-adl__i">
                    <dt>Saved cards</dt>
                    <dd>{a.tokenizationEnabled ? 'On' : 'Off'}</dd>
                  </div>
                  <div className="kz-adl__i">
                    <dt>Methods</dt>
                    <dd>
                      {(a.enabledMethods.length
                        ? a.available.methods.filter((m) => a.enabledMethods.includes(m.code))
                        : a.available.methods
                      )
                        .map((m) => m.name)
                        .join(', ')}
                    </dd>
                  </div>
                </dl>
                <ul className="kz-gw__secrets" aria-label={`Secrets for ${a.label}`}>
                  {a.credentials.fields.map((f) => (
                    <li key={f.name}>
                      <span className="kz-amono">{f.name}</span>{' '}
                      <span className={f.present ? 'kz-gw__ok' : 'kz-gw__bad'}>
                        {f.present ? '✓ set' : '✗ missing'}
                      </span>
                    </li>
                  ))}
                </ul>
                {a.statusNote ? <p className="kz-gw__sub">{a.statusNote}</p> : null}
                <div>
                  <AccountSheet account={a} config={config} currencies={currencies} onSaved={refresh} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="kz-apane" aria-labelledby="rt-h">
        <div className="kz-apane__head">
          <h2 className="kz-apane__title" id="rt-h">
            Routes
          </h2>
          <div className="kz-apane__acts">
            <RouteSheet config={config} currencies={currencies} onSaved={refresh} />
          </div>
        </div>
        <div className="kz-apane__body is-flush">
          {config.routes.length === 0 ? (
            <p className="kz-anone">
              <span className="kz-anone__code">0 routes</span>No routes. Clients can&apos;t pay online until a route
              points to an account with credentials.
            </p>
          ) : (
            <div className="kz-dt kz-dt--react">
              <div className="kz-dt__scroll">
                <table className="kz-dt__t">
                  <caption className="sr-only">Payment routes</caption>
                  <thead>
                    <tr>
                      <th scope="col">App</th>
                      <th scope="col">Currency</th>
                      <th scope="col">Method</th>
                      <th scope="col">Account</th>
                      <th scope="col" className="is-num">
                        Priority
                      </th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.routes.map((r) => (
                      <tr key={r.id}>
                        <td className="kz-dt__td" data-m="meta">
                          <span className="kz-amono">{r.appKey}</span>
                        </td>
                        <td className="kz-dt__td" data-m="main">
                          <span className="kz-dt__strong">{r.currency === '*' ? 'Any currency' : r.currency}</span>
                          <span className="kz-dt__sub is-text">{methodName(r.methodCode)}</span>
                        </td>
                        <td className="kz-dt__td">{methodName(r.methodCode)}</td>
                        <td className="kz-dt__td" data-m="status">
                          {r.accountLabel}
                          {r.enabled ? null : <StatusPill className="kz-pill--xs">Off</StatusPill>}
                        </td>
                        <td className="kz-dt__td is-num">{r.priority}</td>
                        <td className="kz-dt__td kz-dt__acts" data-m="acts">
                          <div className="kz-arow-acts">
                            <RouteSheet route={r} config={config} currencies={currencies} onSaved={refresh} />
                            <RemoveRoute
                              route={r}
                              label={`${r.currency} · ${methodName(r.methodCode)}`}
                              onDone={refresh}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function AccountSheet({
  account,
  config,
  currencies,
  onSaved,
}: {
  account?: GatewayAccount;
  config: GatewayConfig;
  currencies: string[];
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const a = useSaveAccount(async () => {
    await onSaved();
    setOpen(false);
  });
  const [providerKey, setProviderKey] = useState(account?.providerKey ?? config.providers[0]?.key ?? '');
  const [label, setLabel] = useState(account?.label ?? '');
  const [secretPrefix, setSecretPrefix] = useState(account?.secretPrefix ?? '');
  const [mode, setMode] = useState<'test' | 'live'>(account?.mode ?? 'test');
  const [accCurrencies, setAccCurrencies] = useState<string[]>(account?.currencies ?? []);
  const [methods, setMethods] = useState<string[]>(account?.enabledMethods ?? []);
  const [enabled, setEnabled] = useState(account?.enabled ?? true);
  const [note, setNote] = useState(account?.statusNote ?? '');
  const [tokenization, setTokenization] = useState(account?.tokenizationEnabled ?? false);
  const offer = account?.available ??
    config.accounts.find((x) => x.providerKey === providerKey)?.available ?? { currencies, methods: [] };
  const title = account ? `Edit ${account.label}` : 'Add a gateway account';
  return (
    <>
      <Button variant={account ? 'secondary' : 'primary'} size="sm" onClick={() => setOpen(true)}>
        {account ? `Edit ${account.label}` : 'Add account'}
      </Button>
      <FormSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        formId={`gw-acc-${account?.id ?? 'new'}`}
        submitLabel={account ? 'Save changes' : 'Add account'}
        busy={a.busy}
        error={a.error}
        onSubmit={() =>
          void a.save(
            account,
            {
              label,
              mode,
              currencies: accCurrencies,
              enabledMethods: methods,
              enabled,
              statusNote: note.trim() ? note.trim() : null,
              tokenizationEnabled: tokenization,
            },
            { providerKey, secretPrefix },
          )
        }
      >
        <p className="kz-adlg__desc">
          Secrets are Worker secrets named &lt;prefix&gt;_&lt;NAME&gt;; they are never entered here.
        </p>
        {account ? null : (
          <>
            <SelectField
              label="Gateway"
              value={providerKey}
              onChange={(e) => setProviderKey(e.target.value)}
              error={a.err('providerKey')}
            >
              {config.providers.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Secret prefix"
              hint="e.g. PAYNOW_ZWG → secrets PAYNOW_ZWG_INTEGRATION_ID and PAYNOW_ZWG_INTEGRATION_KEY"
              value={secretPrefix}
              onChange={(e) => setSecretPrefix(e.target.value.toUpperCase())}
              error={a.err('secretPrefix')}
            />
          </>
        )}
        <TextField
          label="Name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={80}
          error={a.err('label')}
        />
        <SelectField
          label="Mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as 'test' | 'live')}
          error={a.err('mode')}
        >
          <option value="test">Test mode (no real money; marked TEST PAYMENT)</option>
          <option value="live">Live</option>
        </SelectField>
        <fieldset className="kz-acheckgrid">
          <legend className="kz-label">Currencies (none ticked = all the gateway offers)</legend>
          {offer.currencies
            .filter((c) => currencies.includes(c))
            .map((c) => (
              <CheckItem
                key={c}
                checked={accCurrencies.includes(c)}
                onChange={(e) => setAccCurrencies(toggleIn(accCurrencies, c, e.target.checked))}
              >
                {c}
              </CheckItem>
            ))}
          {a.err('currencies') ? <p className="kz-error">{a.err('currencies')}</p> : null}
        </fieldset>
        {offer.methods.length ? (
          <fieldset className="kz-acheckgrid">
            <legend className="kz-label">Methods (none ticked = all)</legend>
            {offer.methods.map((m) => (
              <CheckItem
                key={m.code}
                checked={methods.includes(m.code)}
                onChange={(e) => setMethods(toggleIn(methods, m.code, e.target.checked))}
              >
                {m.name}
              </CheckItem>
            ))}
            {a.err('enabledMethods') ? <p className="kz-error">{a.err('enabledMethods')}</p> : null}
          </fieldset>
        ) : null}
        <CheckItem checked={enabled} onChange={(e) => setEnabled(e.target.checked)}>
          Enabled
        </CheckItem>
        <CheckItem checked={tokenization} onChange={(e) => setTokenization(e.target.checked)}>
          Saved cards (card tokenization)
        </CheckItem>
        <p className="kz-hint">
          Switch on only after the gateway has approved card tokenization for this account. Clients can then save a card
          in the portal and pay with it on our checkout, and opt in to automatic charges for their plans.
        </p>
        <TextareaField
          label="Note for the team"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={300}
          error={a.err('statusNote')}
        />
      </FormSheet>
    </>
  );
}

function RouteSheet({
  route,
  config,
  currencies,
  onSaved,
}: {
  route?: GatewayRoute;
  config: GatewayConfig;
  currencies: string[];
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const a = useSaveRoute(async () => {
    await onSaved();
    setOpen(false);
  });
  const [accountId, setAccountId] = useState(route?.accountId ?? config.accounts[0]?.id ?? '');
  const [currency, setCurrency] = useState(route?.currency ?? '*');
  const [methodCode, setMethodCode] = useState(route?.methodCode ?? '*');
  const [priority, setPriority] = useState(String(route?.priority ?? 100));
  const [enabled, setEnabled] = useState(route?.enabled ?? true);
  const account = config.accounts.find((x) => x.id === accountId);
  return (
    <>
      <Button variant={route ? 'secondary' : 'primary'} size="sm" onClick={() => setOpen(true)}>
        {route ? 'Edit' : 'Add route'}
        {route ? (
          <span className="sr-only">
            {' '}
            route {route.currency} {route.methodCode}
          </span>
        ) : null}
      </Button>
      <FormSheet
        open={open}
        onClose={() => setOpen(false)}
        title={route ? 'Edit route' : 'Add a route'}
        formId={`gw-route-${route?.id ?? 'new'}`}
        submitLabel={route ? 'Save route' : 'Add route'}
        busy={a.busy}
        error={a.error}
        onSubmit={() =>
          void a.save(route, {
            appKey: route?.appKey ?? config.appKey,
            currency,
            methodCode,
            accountId,
            priority,
            enabled,
          })
        }
      >
        <SelectField
          label="Account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          error={a.err('accountId')}
        >
          {config.accounts.map((x) => (
            <option key={x.id} value={x.id}>
              {`${x.label} (${x.providerName})`}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          error={a.err('currency')}
        >
          <option value="*">Any currency</option>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Method"
          value={methodCode}
          onChange={(e) => setMethodCode(e.target.value)}
          error={a.err('methodCode')}
        >
          <option value="*">Any method</option>
          {(account?.available.methods ?? []).map((m) => (
            <option key={m.code} value={m.code}>
              {m.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Priority"
          hint="Lower wins when two routes match equally."
          type="number"
          min={1}
          max={10000}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          error={a.err('priority')}
        />
        <CheckItem checked={enabled} onChange={(e) => setEnabled(e.target.checked)}>
          Enabled
        </CheckItem>
      </FormSheet>
    </>
  );
}

function RemoveRoute({ route, label, onDone }: { route: GatewayRoute; label: string; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Remove<span className="sr-only"> route {label}</span>
      </Button>
      <FormAlert message={error} />
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Remove this route?"
        confirmLabel="Remove route"
        danger
        onConfirm={async () => {
          try {
            await deleteRoute(route.id);
            await onDone();
          } catch {
            setError('The route could not be removed. Reload and try again.');
          }
        }}
      >
        {`${label} → ${route.accountLabel}. Payments already started are not affected.`}
      </ConfirmSheet>
    </>
  );
}
