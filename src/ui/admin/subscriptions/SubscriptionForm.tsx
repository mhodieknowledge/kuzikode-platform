/**
 * Create / edit a subscription (R6.2): what is billed and the billing schedule as form sections over the sticky save bar.
 * Labels are the e2e contract (Description, Quantity, Unit price, Create subscription).
 */
import { useState, type FormEvent } from 'react';
import { Field, MoneyInput, SelectField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { CheckItem, FormSection, SaveBar } from '../form';
import { useSubscriptionSave, type SubscriptionFormValues } from './useSubscriptions';

export type { SubscriptionFormValues };

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
  const a = useSubscriptionSave(initial.id);
  const editing = !!initial.id;
  const [v, setV] = useState(initial);
  const [priceError, setPriceError] = useState<string | null>(null);
  const set = <K extends keyof SubscriptionFormValues>(k: K, val: SubscriptionFormValues[K]) =>
    setV((p) => ({ ...p, [k]: val }));
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (priceError) return;
    void a.save(v);
  }
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection id="s-what" title="What is billed" description="Shown on every invoice this subscription creates.">
        <SelectField
          label="Client"
          value={v.clientId}
          disabled={billed}
          onChange={(ev) => {
            const c = clients.find((x) => x.id === ev.target.value);
            setV((p) => ({ ...p, clientId: ev.target.value, ...(c && !editing ? { currency: c.currency } : {}) }));
          }}
          error={a.err('clientId')}
        >
          <option value="">Choose a client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Package"
          hint="Optional: fills in the price and interval"
          value={v.packageId ?? ''}
          onChange={(ev) => {
            const p = packages.find((x) => x.id === ev.target.value);
            setV((cur) => ({
              ...cur,
              packageId: ev.target.value || null,
              ...(p && !editing
                ? {
                    description: cur.description || p.name,
                    ...(p.priceMinor != null && p.currency === cur.currency ? { unitPriceMinor: p.priceMinor } : {}),
                    ...(p.interval ? { interval: p.interval } : {}),
                  }
                : {}),
            }));
          }}
          error={a.err('packageId')}
        >
          <option value="">No package</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Description"
          hint='Shown on each invoice line, e.g. "Business Email, 10 mailboxes"'
          value={v.description}
          onChange={(ev) => set('description', ev.target.value)}
          maxLength={300}
          error={a.err('description')}
          className="kz-span-2"
        />
        <TextField
          label="Quantity"
          value={v.quantity}
          onChange={(ev) => set('quantity', ev.target.value)}
          inputMode="decimal"
          error={a.err('quantity')}
        />
        <SelectField
          label="Currency"
          value={v.currency}
          disabled={billed}
          onChange={(ev) => set('currency', ev.target.value)}
          error={a.err('currency')}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <Field label="Unit price" error={priceError ?? a.err('unitPriceMinor')}>
          {(p) => (
            <MoneyInput
              {...p}
              valueMinor={v.unitPriceMinor}
              onChangeMinor={(m) => set('unitPriceMinor', m)}
              currency={v.currency}
              onParseError={setPriceError}
            />
          )}
        </Field>
        <SelectField
          label="Tax"
          value={v.taxRateId ?? ''}
          onChange={(ev) => set('taxRateId', ev.target.value || null)}
          error={a.err('taxRateId')}
        >
          <option value="">No tax</option>
          {taxRates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
      </FormSection>
      <FormSection
        id="s-when"
        title="Billing"
        description="How often, from when, and whether invoices go out on their own."
      >
        <SelectField
          label="Interval"
          value={v.interval}
          disabled={billed}
          onChange={(ev) => set('interval', ev.target.value as 'month' | 'year')}
          error={a.err('interval')}
        >
          <option value="month">Monthly</option>
          <option value="year">Yearly</option>
        </SelectField>
        <TextField
          label="Start date"
          hint="Billing dates follow this day of the month"
          type="date"
          value={v.startDate}
          disabled={billed}
          onChange={(ev) => set('startDate', ev.target.value)}
          error={a.err('startDate')}
        />
        <TextField
          label="Next billing date"
          hint="The period to invoice next. Defaults to the start date."
          type="date"
          value={v.nextBillingDate ?? ''}
          onChange={(ev) => set('nextBillingDate', ev.target.value || null)}
          error={a.err('nextBillingDate')}
        />
        <CheckItem checked={v.autoIssue} onChange={(ev) => set('autoIssue', ev.target.checked)} className="kz-span-2">
          Issue and email invoices automatically (otherwise drafts are created for review)
        </CheckItem>
      </FormSection>
      <SaveBar error={a.error} hint="Invoices for each period are created before its billing date.">
        <a
          href={editing ? `/admin/subscriptions/${initial.id}` : '/admin/subscriptions'}
          className="kz-btn kz-btn--secondary"
        >
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          {editing ? 'Save subscription' : 'Create subscription'}
        </Button>
      </SaveBar>
    </form>
  );
}
