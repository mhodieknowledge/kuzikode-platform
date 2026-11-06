/** Subscriptions & managed services islands (P4.20): editors and actions. The server validates and authorises all. */
import { useState, type FormEvent } from 'react';
import {
  apiFetch,
  Button,
  Checkbox,
  ConfirmDialog,
  DateInput,
  Dialog,
  Field,
  Input,
  MoneyInput,
  Select,
  Textarea,
} from '../ui';
import { Alert, useAction } from './actions';

export interface SubscriptionFormValues {
  id?: string;
  clientId: string;
  packageId: string | null;
  description: string;
  quantity: string;
  unitPriceMinor: number | null;
  currency: string;
  taxRateId: string | null;
  interval: 'month' | 'year';
  startDate: string;
  nextBillingDate: string | null;
  autoIssue: boolean;
}

export function SubscriptionForm({
  initial,
  clients,
  packages,
  currencies,
  taxRates,
  billed,
}: {
  initial: SubscriptionFormValues;
  clients: { id: string; name: string; currency: string }[];
  packages: {
    id: string;
    name: string;
    priceMinor: number | null;
    currency: string | null;
    interval: 'month' | 'year' | null;
  }[];
  currencies: string[];
  taxRates: { id: string; name: string }[];
  /** A period has been invoiced: client, currency, interval and start date are fixed. */
  billed: boolean;
}) {
  const a = useAction();
  const editing = !!initial.id;
  const [v, setV] = useState(initial);
  const [priceError, setPriceError] = useState<string | null>(null);
  const set = <K extends keyof SubscriptionFormValues>(k: K, val: SubscriptionFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (priceError) return;
    const { id: _id, ...body } = v;
    await a.run(async () => {
      if (editing) {
        await apiFetch(`/api/v1/admin/subscriptions/${initial.id}`, { method: 'PUT', body });
        window.location.assign(`/admin/subscriptions/${initial.id}?saved=1`);
      } else {
        const res = await apiFetch<{ data: { id: string } }>('/api/v1/admin/subscriptions', { body });
        window.location.assign(`/admin/subscriptions/${res.data.id}`);
      }
    });
  }
  const e = a.errors;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="s-what">
        <h2 id="s-what" className="font-sans text-base font-semibold">
          What is billed
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Client" required error={e['clientId']}>
            <Select
              value={v.clientId}
              disabled={billed}
              onChange={(ev) => {
                const c = clients.find((x) => x.id === ev.target.value);
                setV((p) => ({ ...p, clientId: ev.target.value, ...(c && !editing ? { currency: c.currency } : {}) }));
              }}
              placeholder="Choose a client"
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Package" hint="Optional: fills in the price and interval" error={e['packageId']}>
            <Select
              value={v.packageId ?? ''}
              onChange={(ev) => {
                const p = packages.find((x) => x.id === ev.target.value);
                setV((cur) => ({
                  ...cur,
                  packageId: ev.target.value || null,
                  ...(p && !editing
                    ? {
                        description: cur.description || p.name,
                        ...(p.priceMinor != null && p.currency === cur.currency
                          ? { unitPriceMinor: p.priceMinor }
                          : {}),
                        ...(p.interval ? { interval: p.interval } : {}),
                      }
                    : {}),
                }));
              }}
              options={[{ value: '', label: 'No package' }, ...packages.map((p) => ({ value: p.id, label: p.name }))]}
            />
          </Field>
          <Field
            label="Description"
            required
            hint='Shown on each invoice line, e.g. "Business Email, 10 mailboxes"'
            error={e['description']}
            className="sm:col-span-2"
          >
            <Input value={v.description} onChange={(ev) => set('description', ev.target.value)} maxLength={300} />
          </Field>
          <Field label="Quantity" required error={e['quantity']}>
            <Input value={v.quantity} onChange={(ev) => set('quantity', ev.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Currency" required error={e['currency']}>
            <Select
              value={v.currency}
              disabled={billed}
              onChange={(ev) => set('currency', ev.target.value)}
              options={currencies.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="Unit price" required error={priceError ?? e['unitPriceMinor']}>
            <MoneyInput
              valueMinor={v.unitPriceMinor}
              onChangeMinor={(m) => set('unitPriceMinor', m)}
              currency={v.currency}
              onParseError={setPriceError}
            />
          </Field>
          <Field label="Tax" error={e['taxRateId']}>
            <Select
              value={v.taxRateId ?? ''}
              onChange={(ev) => set('taxRateId', ev.target.value || null)}
              options={[{ value: '', label: 'No tax' }, ...taxRates.map((t) => ({ value: t.id, label: t.name }))]}
            />
          </Field>
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="s-when">
        <h2 id="s-when" className="font-sans text-base font-semibold">
          Billing
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Interval" required error={e['interval']}>
            <Select
              value={v.interval}
              disabled={billed}
              onChange={(ev) => set('interval', ev.target.value as 'month' | 'year')}
              options={[
                { value: 'month', label: 'Monthly' },
                { value: 'year', label: 'Yearly' },
              ]}
            />
          </Field>
          <Field label="Start date" required hint="Billing dates follow this day of the month" error={e['startDate']}>
            <DateInput value={v.startDate} disabled={billed} onChange={(ev) => set('startDate', ev.target.value)} />
          </Field>
          <Field
            label="Next billing date"
            hint="The period to invoice next. Defaults to the start date."
            error={e['nextBillingDate']}
          >
            <DateInput
              value={v.nextBillingDate ?? ''}
              onChange={(ev) => set('nextBillingDate', ev.target.value || null)}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Checkbox
            label="Issue and email invoices automatically (otherwise drafts are created for review)"
            checked={v.autoIssue}
            onCheckedChange={(c) => set('autoIssue', c)}
          />
        </div>
      </section>
      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={a.busy}>
          {editing ? 'Save subscription' : 'Create subscription'}
        </Button>
        <a
          href={editing ? `/admin/subscriptions/${initial.id}` : '/admin/subscriptions'}
          className="inline-flex h-12 items-center px-4 text-[15px] font-semibold text-ink-800"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

/** Pause, resume or cancel; which buttons show is decided on the server page from status + permission. */
export function SubscriptionActions({
  id,
  status,
}: {
  id: string;
  status: 'active' | 'at_risk' | 'paused' | 'cancelled' | 'ended';
}) {
  const a = useAction();
  const [confirm, setConfirm] = useState<'pause' | 'resume' | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [date, setDate] = useState('');
  const post = (path: string, body: unknown = {}) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/subscriptions/${id}/${path}`, { body });
      window.location.reload();
    });
  const billing = status === 'active' || status === 'at_risk';
  return (
    <div className="flex flex-col gap-3">
      <Alert message={cancelOpen ? null : a.error} />
      <div className="flex flex-wrap gap-2">
        <a
          href={`/admin/subscriptions/${id}/edit`}
          className="inline-flex h-10 items-center rounded-sm border border-line bg-surface px-4 text-sm font-semibold text-ink-950 hover:border-ink-400"
        >
          Edit
        </a>
        {billing ? (
          <Button variant="secondary" onClick={() => setConfirm('pause')}>
            Pause billing
          </Button>
        ) : null}
        {status === 'paused' ? (
          <Button variant="secondary" onClick={() => setConfirm('resume')}>
            Resume billing
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => setCancelOpen(true)}>
          Cancel subscription
        </Button>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'pause' ? 'Pause billing?' : 'Resume billing?'}
        description={
          confirm === 'pause'
            ? 'No invoices are created while paused. Nothing changes for the client’s services.'
            : 'Billing continues from the next scheduled date on or after today. Missed periods are not invoiced.'
        }
        confirmLabel={confirm === 'pause' ? 'Pause' : 'Resume'}
        onConfirm={() => post(confirm!)}
      />
      <Dialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this subscription?"
        description="No further invoices are created. Invoices already issued stay as they are."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={a.busy}
              onClick={() => void post('cancel', { reason, effectiveDate: date || null })}
            >
              Cancel subscription
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Alert message={a.error} />
          <Field label="Reason" required error={a.errors['reason']}>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
          <Field label="Effective date" hint="Defaults to today" error={a.errors['effectiveDate']}>
            <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------- managed services register

export interface AssetFormValues {
  id?: string;
  clientId: string;
  type: 'domain' | 'hosting' | 'email_tenant' | 'ssl' | 'app_store_account' | 'other';
  name: string;
  provider: string | null;
  subscriptionId: string | null;
  renewalDate: string | null;
  autoRenew: boolean;
  billableToClient: boolean;
  costNote: string | null;
  credentialsNote: string | null;
  status: 'active' | 'expired' | 'cancelled' | 'transferred';
}

export const ASSET_TYPE_OPTIONS = [
  { value: 'domain', label: 'Domain' },
  { value: 'hosting', label: 'Hosting' },
  { value: 'email_tenant', label: 'Email (tenant / mailboxes)' },
  { value: 'ssl', label: 'SSL certificate' },
  { value: 'app_store_account', label: 'App store account' },
  { value: 'other', label: 'Other' },
];

export function AssetForm({
  initial,
  clients,
  subscriptions,
}: {
  initial: AssetFormValues;
  clients: { id: string; name: string }[];
  subscriptions: { id: string; clientId: string; description: string }[];
}) {
  const a = useAction();
  const editing = !!initial.id;
  const [v, setV] = useState(initial);
  const [remove, setRemove] = useState(false);
  const set = <K extends keyof AssetFormValues>(k: K, val: AssetFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { id: _id, ...body } = v;
    await a.run(async () => {
      if (editing) await apiFetch(`/api/v1/admin/assets/${initial.id}`, { method: 'PUT', body });
      else await apiFetch('/api/v1/admin/assets', { body });
      window.location.assign('/admin/assets?saved=1');
    });
  }
  const e = a.errors;
  const opt = (k: 'provider' | 'costNote' | 'credentialsNote') => ({
    value: v[k] ?? '',
    onChange: (ev: { target: { value: string } }) => set(k, ev.target.value || null),
  });
  const subs = subscriptions.filter((s) => s.clientId === v.clientId);
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="a-what">
        <h2 id="a-what" className="font-sans text-base font-semibold">
          Service
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Client" required error={e['clientId']}>
            <Select
              value={v.clientId}
              onChange={(ev) => setV((p) => ({ ...p, clientId: ev.target.value, subscriptionId: null }))}
              placeholder="Choose a client"
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Type" required error={e['type']}>
            <Select
              value={v.type}
              onChange={(ev) => set('type', ev.target.value as AssetFormValues['type'])}
              options={ASSET_TYPE_OPTIONS}
            />
          </Field>
          <Field label="Name" required hint="e.g. baobab.co.zw" error={e['name']}>
            <Input value={v.name} onChange={(ev) => set('name', ev.target.value)} maxLength={200} />
          </Field>
          <Field label="Provider / registrar" error={e['provider']}>
            <Input {...opt('provider')} maxLength={120} />
          </Field>
          <Field label="Renewal date" error={e['renewalDate']}>
            <DateInput value={v.renewalDate ?? ''} onChange={(ev) => set('renewalDate', ev.target.value || null)} />
          </Field>
          <Field label="Status" required error={e['status']}>
            <Select
              value={v.status}
              onChange={(ev) => set('status', ev.target.value as AssetFormValues['status'])}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'expired', label: 'Expired' },
                { value: 'cancelled', label: 'Cancelled' },
                { value: 'transferred', label: 'Transferred away' },
              ]}
            />
          </Field>
          <Field label="Billed through subscription" error={e['subscriptionId']} className="sm:col-span-2">
            <Select
              value={v.subscriptionId ?? ''}
              onChange={(ev) => set('subscriptionId', ev.target.value || null)}
              options={[{ value: '', label: 'None' }, ...subs.map((s) => ({ value: s.id, label: s.description }))]}
            />
          </Field>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Checkbox label="Renews automatically" checked={v.autoRenew} onCheckedChange={(c) => set('autoRenew', c)} />
            <Checkbox
              label="Billable to the client (they get renewal reminders too)"
              checked={v.billableToClient}
              onCheckedChange={(c) => set('billableToClient', c)}
            />
          </div>
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="a-internal">
        <h2 id="a-internal" className="font-sans text-base font-semibold">
          Internal notes
        </h2>
        <p className="mt-1 text-sm text-ink-600">Never shown to the client.</p>
        <div className="mt-4 grid gap-4">
          <Field label="Cost note" error={e['costNote']}>
            <Textarea rows={2} {...opt('costNote')} maxLength={500} />
          </Field>
          <Field
            label="Where the credentials are kept"
            hint='Never type a password here. Write where it is kept, e.g. "in the owner’s password manager".'
            error={e['credentialsNote']}
          >
            <Input {...opt('credentialsNote')} maxLength={300} />
          </Field>
        </div>
      </section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-2">
          <Button type="submit" size="lg" loading={a.busy}>
            {editing ? 'Save' : 'Add to register'}
          </Button>
          <a href="/admin/assets" className="inline-flex h-12 items-center px-4 text-[15px] font-semibold text-ink-800">
            Cancel
          </a>
        </div>
        {editing ? (
          <Button variant="ghost" onClick={() => setRemove(true)}>
            Delete
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={remove}
        onOpenChange={setRemove}
        title={`Delete ${initial.name}?`}
        description="It leaves the register and gets no more reminders. Mark it cancelled or transferred instead to keep its history."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          a.run(async () => {
            await apiFetch(`/api/v1/admin/assets/${initial.id}`, { method: 'DELETE' });
            window.location.assign('/admin/assets');
          })
        }
      />
    </form>
  );
}
