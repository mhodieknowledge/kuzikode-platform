/** Invoice islands (P4.9): the draft editor and the actions on an invoice. The server validates and authorises all. */
import { useState, type FormEvent } from 'react';
import { formatMoney, formatQuantity, minorToDecimalString, parseQuantityMilli } from '../../shared/money';
import { CREDIT_APPLICATIONS, creditForQuantity, type CreditApplication } from '../../shared/credit-notes';
import { MANUAL_PAYMENT_METHODS } from '../../shared/invoices';
import type { DiscountType } from '../../shared/pricing';
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
import {
  LineItemEditor,
  newLine,
  toApiDiscount,
  toApiLines,
  type CatalogueOption,
  type EditorLine,
  type TaxOption,
} from './LineItemEditor';

export interface InvoiceEditorProps {
  id?: string;
  initial: {
    clientId: string;
    contactId: string | null;
    currency: string;
    issueDate: string | null;
    dueDate: string | null;
    paymentTermsDays: number | null;
    notes: string | null;
    terms: string | null;
    discountType: DiscountType;
    discountValue: number;
    lines: EditorLine[];
  };
  clients: { id: string; name: string; number: string; currency: string }[];
  contacts: { id: string; client_id: string; name: string; email: string | null }[];
  currencies: { code: string; minor_digits: number }[];
  taxRates: TaxOption[];
  catalogue: CatalogueOption[];
}

export function InvoiceEditor({ id, initial, clients, contacts, currencies, taxRates, catalogue }: InvoiceEditorProps) {
  const a = useAction();
  const [clientId, setClientId] = useState(initial.clientId);
  const [contactId, setContactId] = useState(initial.contactId ?? '');
  const [currency, setCurrency] = useState(initial.currency);
  const [lines, setLines] = useState<EditorLine[]>(initial.lines.length ? initial.lines : [newLine()]);
  const [docDiscount, setDocDiscount] = useState({
    type: initial.discountType,
    percent:
      initial.discountType === 'percent' ? minorToDecimalString(initial.discountValue, 2).replace(/\.?0+$/, '') : '',
    amountMinor: initial.discountType === 'amount' ? initial.discountValue : null,
  });
  const minorDigits = currencies.find((c) => c.code === currency)?.minor_digits ?? 2;
  const clientContacts = contacts.filter((c) => c.client_id === clientId);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const terms = String(f.get('paymentTermsDays') ?? '').trim();
    const body = {
      clientId,
      contactId: contactId || null,
      currency,
      issueDate: f.get('issueDate') || null,
      dueDate: f.get('dueDate') || null,
      paymentTermsDays: terms === '' ? null : Number(terms),
      notes: f.get('notes'),
      terms: f.get('terms'),
      ...toApiDiscount(docDiscount),
      items: toApiLines(lines),
    };
    await a.run(async () => {
      if (id) {
        await apiFetch(`/api/v1/admin/invoices/${id}`, { method: 'PUT', body });
        window.location.assign(`/admin/invoices/${id}`);
      } else {
        const res = await apiFetch<{ data: { id: string } }>('/api/v1/admin/invoices', { body });
        window.location.assign(`/admin/invoices/${res.data.id}`);
      }
    });
  }
  const e = a.errors;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="i-details">
        <h2 id="i-details" className="font-sans text-base font-semibold">
          Details
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Client" required error={e['clientId']}>
            <Select
              value={clientId}
              onChange={(ev) => {
                setClientId(ev.target.value);
                setContactId('');
                const c = clients.find((x) => x.id === ev.target.value);
                if (c && !lines.some((l) => l.unitPriceMinor)) setCurrency(c.currency);
              }}
              placeholder="Choose a client"
              options={clients.map((c) => ({ value: c.id, label: `${c.name} (${c.number})` }))}
            />
          </Field>
          <Field label="Send to" hint="Defaults to the client's main contact." error={e['contactId']}>
            <Select
              value={contactId}
              onChange={(ev) => setContactId(ev.target.value)}
              options={[
                { value: '', label: 'Main contact' },
                ...clientContacts.map((c) => ({ value: c.id, label: `${c.name}${c.email ? ` (${c.email})` : ''}` })),
              ]}
            />
          </Field>
          <Field label="Currency" required error={e['currency']}>
            <Select
              value={currency}
              onChange={(ev) => setCurrency(ev.target.value)}
              options={currencies.map((c) => ({ value: c.code, label: c.code }))}
            />
          </Field>
          <Field
            label="Payment terms (days)"
            hint="Leave empty for the client's default."
            error={e['paymentTermsDays']}
          >
            <Input
              name="paymentTermsDays"
              type="number"
              inputMode="numeric"
              min={0}
              max={365}
              defaultValue={initial.paymentTermsDays ?? ''}
            />
          </Field>
          <Field label="Issue date" hint="Leave empty to use the day it is issued." error={e['issueDate']}>
            <DateInput name="issueDate" defaultValue={initial.issueDate ?? ''} />
          </Field>
          <Field label="Due date" hint="Leave empty to use issue date + payment terms." error={e['dueDate']}>
            <DateInput name="dueDate" defaultValue={initial.dueDate ?? ''} />
          </Field>
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="i-lines">
        <h2 id="i-lines" className="mb-4 font-sans text-base font-semibold">
          Lines
        </h2>
        <LineItemEditor
          lines={lines}
          onChange={setLines}
          currency={currency}
          minorDigits={minorDigits}
          taxRates={taxRates}
          catalogue={catalogue}
          docDiscount={docDiscount}
          onDocDiscount={setDocDiscount}
          errors={e}
          allowRecurring={false}
        />
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="i-terms">
        <h2 id="i-terms" className="font-sans text-base font-semibold">
          Terms and notes
        </h2>
        <div className="mt-4 grid gap-4">
          <Field label="Notes to the client" error={e['notes']}>
            <Textarea name="notes" rows={3} defaultValue={initial.notes ?? ''} maxLength={5000} />
          </Field>
          <Field label="Terms" error={e['terms']}>
            <Textarea name="terms" rows={4} defaultValue={initial.terms ?? ''} maxLength={5000} />
          </Field>
        </div>
      </section>
      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={a.busy}>
          {id ? 'Save draft' : 'Create draft'}
        </Button>
        <a
          href={id ? `/admin/invoices/${id}` : '/admin/invoices'}
          className="inline-flex h-12 items-center px-4 text-[15px] font-semibold text-ink-800"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

const linkButton =
  'inline-flex h-10 items-center rounded-sm border border-line bg-surface px-4 text-sm font-semibold text-ink-950 hover:border-ink-400';

/** Actions for one invoice; which buttons show is decided on the server page from status + permissions. */
export function InvoiceActions({
  id,
  number,
  status,
  currency,
  minorDigits,
  balanceMinor,
  creditAvailableMinor,
  hasEmail,
  publicLink,
  today,
  creditOptions,
  can,
}: {
  id: string;
  number: string | null;
  status: string;
  currency: string;
  minorDigits: number;
  balanceMinor: number;
  creditAvailableMinor: number;
  hasEmail: boolean;
  publicLink: string | null;
  today: string;
  creditOptions: CreditOptions | null;
  can: {
    edit: boolean;
    issue: boolean;
    send: boolean;
    pay: boolean;
    credit: boolean;
    void: boolean;
    delete: boolean;
    creditNote: boolean;
  };
}) {
  const a = useAction();
  const [dialog, setDialog] = useState<null | 'issue' | 'send' | 'pay' | 'credit' | 'void' | 'delete' | 'creditNote'>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [emailOnIssue, setEmailOnIssue] = useState(hasEmail);
  const [amount, setAmount] = useState<number | null>(balanceMinor > 0 ? balanceMinor : null);
  const [creditAmount, setCreditAmount] = useState<number | null>(Math.min(balanceMinor, creditAvailableMinor) || null);
  const label = number ?? 'this draft';
  const money = (m: number) => formatMoney(m, currency, minorDigits);
  const post = (path: string, body: Record<string, unknown>) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/invoices/${id}${path}`, { body });
      window.location.reload();
    });
  const open = (d: typeof dialog) => () => setDialog(d);
  const close = (o: boolean) => !o && setDialog(null);
  const overpay = amount !== null && amount > balanceMinor ? amount - balanceMinor : 0;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {can.edit ? (
          <a href={`/admin/invoices/${id}/edit`} className={linkButton}>
            Edit
          </a>
        ) : null}
        {can.issue ? <Button onClick={open('issue')}>Issue invoice</Button> : null}
        {can.pay ? <Button onClick={open('pay')}>Record payment</Button> : null}
        {can.credit ? (
          <Button variant="secondary" onClick={open('credit')}>
            Apply credit
          </Button>
        ) : null}
        {can.send ? (
          <Button variant="secondary" onClick={open('send')}>
            Resend
          </Button>
        ) : null}
        <a
          href={`/api/v1/admin/documents/invoices/${id}/pdf${status === 'draft' ? '?inline=1' : ''}`}
          {...(status === 'draft' ? { target: '_blank', rel: 'noopener' } : { download: true })}
          className={linkButton}
        >
          {status === 'draft' ? 'Preview PDF' : 'Download PDF'}
        </a>
        {publicLink ? (
          <Button
            variant="ghost"
            onClick={() => {
              void navigator.clipboard?.writeText(publicLink).then(() => setCopied(true));
            }}
          >
            {copied ? 'Link copied' : 'Copy client link'}
          </Button>
        ) : null}
        {can.creditNote ? (
          <Button variant="secondary" onClick={open('creditNote')}>
            Credit note
          </Button>
        ) : null}
        {can.void ? (
          <Button variant="ghost" onClick={open('void')}>
            Void
          </Button>
        ) : null}
        {can.delete ? (
          <Button variant="ghost" onClick={open('delete')}>
            Delete draft
          </Button>
        ) : null}
      </div>
      <Alert message={dialog ? null : a.error} />

      <Dialog open={dialog === 'issue'} onOpenChange={close} title="Issue invoice">
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void post('/issue', { send: emailOnIssue, message: f.get('message') });
          }}
        >
          <p className="text-sm text-ink-800">
            Issuing gives the invoice its number, fixes the client and company details and locks the lines. Corrections
            after that need a credit note.
          </p>
          <Checkbox
            label="Email the invoice to the client"
            description={hasEmail ? undefined : 'The client has no email address on record.'}
            checked={emailOnIssue}
            onCheckedChange={setEmailOnIssue}
            disabled={!hasEmail}
          />
          {emailOnIssue ? (
            <Field label="Personal message" hint="Optional. Shown at the top of the email." error={a.errors['message']}>
              <Textarea name="message" rows={3} maxLength={2000} />
            </Field>
          ) : null}
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              Issue invoice
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={dialog === 'send'} onOpenChange={close} title={`Resend ${label}`}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void post('/send', { message: f.get('message') });
          }}
        >
          <p className="text-sm text-ink-800">The client receives the same link again.</p>
          <Field label="Personal message" hint="Optional." error={a.errors['message']}>
            <Textarea name="message" rows={3} maxLength={2000} />
          </Field>
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              Resend
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === 'pay'}
        onOpenChange={close}
        title={`Record a payment for ${label}`}
        description={`Balance due: ${money(balanceMinor)}`}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void post('/payments', {
              amountMinor: amount ?? 0,
              method: f.get('method'),
              receivedOn: f.get('receivedOn'),
              reference: f.get('reference'),
              notes: f.get('notes'),
            });
          }}
        >
          <Field label={`Amount received (${currency})`} required error={a.errors['amountMinor']}>
            <MoneyInput valueMinor={amount} onChangeMinor={setAmount} currency={currency} minorDigits={minorDigits} />
          </Field>
          {overpay > 0 ? (
            <p role="status" className="rounded-sm bg-info-50 px-3 py-2 text-sm text-info-700">
              {money(overpay)} more than the balance. It will be kept as credit on the client's account.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Method" required error={a.errors['method']}>
              <Select
                name="method"
                defaultValue="bank_transfer"
                options={MANUAL_PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
              />
            </Field>
            <Field label="Date received" required error={a.errors['receivedOn']}>
              <DateInput name="receivedOn" defaultValue={today} max={today} />
            </Field>
          </div>
          <Field
            label="Reference"
            hint="Bank reference, transaction ID or receipt book number."
            error={a.errors['reference']}
          >
            <Input name="reference" maxLength={120} autoComplete="off" />
          </Field>
          <Field label="Internal notes" hint="Optional. Not shown to the client." error={a.errors['notes']}>
            <Textarea name="notes" rows={2} maxLength={1000} />
          </Field>
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              Record payment
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === 'credit'}
        onOpenChange={close}
        title={`Apply credit to ${label}`}
        description={`Available credit: ${money(creditAvailableMinor)} · Balance due: ${money(balanceMinor)}`}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            void post('/apply-credit', { amountMinor: creditAmount ?? 0 });
          }}
        >
          <Field label={`Amount to apply (${currency})`} required error={a.errors['amountMinor']}>
            <MoneyInput
              valueMinor={creditAmount}
              onChangeMinor={setCreditAmount}
              currency={currency}
              minorDigits={minorDigits}
            />
          </Field>
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              Apply credit
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={dialog === 'void'} onOpenChange={close} title={`Void ${label}?`}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void post('/void', { reason: f.get('reason') });
          }}
        >
          <p className="text-sm text-ink-800">
            A void invoice keeps its number and stays on record, but is no longer payable.
          </p>
          <Field label="Reason" required error={a.errors['reason']}>
            <Textarea name="reason" rows={2} maxLength={500} />
          </Field>
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={a.busy}>
              Void invoice
            </Button>
          </div>
        </form>
      </Dialog>

      {creditOptions ? (
        <Dialog
          open={dialog === 'creditNote'}
          onOpenChange={close}
          size="lg"
          title={`Credit note for ${label}`}
          description="Credit notes correct an issued invoice. They are numbered, can't be edited and stay on record."
        >
          <CreditNoteForm
            options={creditOptions}
            currency={currency}
            minorDigits={minorDigits}
            busy={a.busy}
            errors={a.errors}
            error={a.error}
            onCancel={() => setDialog(null)}
            onSubmit={(body) => void post('/credit-notes', body)}
          />
        </Dialog>
      ) : null}

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={close}
        title="Delete this draft?"
        description="Drafts were never issued, so nothing is lost on the client's side. This can't be undone."
        confirmLabel="Delete draft"
        destructive
        onConfirm={() =>
          a.run(async () => {
            await apiFetch(`/api/v1/admin/invoices/${id}`, { method: 'DELETE' });
            window.location.assign('/admin/invoices');
          })
        }
      />
    </div>
  );
}

export interface CreditOptions {
  lines: {
    id: string;
    description: string;
    quantity_milli: number;
    remaining_milli: number;
    line_total_minor: number;
    line_tax_minor: number;
  }[];
  limits: Record<CreditApplication, number>;
}

const safeQty = (q: string) => {
  try {
    return q.trim() ? parseQuantityMilli(q) : 0;
  } catch {
    return null;
  }
};

function CreditNoteForm({
  options,
  currency,
  minorDigits,
  busy,
  errors,
  error,
  onCancel,
  onSubmit,
}: {
  options: CreditOptions;
  currency: string;
  minorDigits: number;
  busy: boolean;
  errors: Record<string, string[]>;
  error: string | null;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const available = CREDIT_APPLICATIONS.filter((c) => options.limits[c.value] > 0);
  const [appliedTo, setAppliedTo] = useState<CreditApplication>(available[0]?.value ?? 'invoice');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [adjustment, setAdjustment] = useState<number | null>(null);
  const [adjustmentText, setAdjustmentText] = useState('');
  const money = (m: number) => formatMoney(m, currency, minorDigits);
  const lines = options.lines.filter((l) => l.remaining_milli > 0);
  const total =
    lines.reduce((sum, l) => {
      const q = safeQty(qty[l.id] ?? '');
      return q && q > 0 && q <= l.remaining_milli ? sum + creditForQuantity(l, q).totalMinor : sum;
    }, 0) + (adjustment ?? 0);
  const limit = options.limits[appliedTo];
  if (!available.length)
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-800">
          Nothing is left to credit on this invoice: it has no balance, nothing was paid that could be given back, or
          earlier credit notes already cover its total.
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>
    );
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        const body = [
          ...lines
            .filter((l) => (safeQty(qty[l.id] ?? '') ?? 0) > 0)
            .map((l) => ({ invoiceItemId: l.id, quantity: (qty[l.id] ?? '').trim() })),
          ...(adjustment ? [{ description: adjustmentText, amountMinor: adjustment }] : []),
        ];
        onSubmit({ reason: f.get('reason'), appliedTo, lines: body });
      }}
    >
      <Field label="Apply the credit" required error={errors['appliedTo']}>
        <Select
          value={appliedTo}
          onChange={(e) => setAppliedTo(e.target.value as CreditApplication)}
          options={available.map((c) => ({
            value: c.value,
            label: `${c.label} (up to ${money(options.limits[c.value])})`,
          }))}
        />
      </Field>
      {lines.length ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink-950">Lines to credit</legend>
          {lines.map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_7rem] items-end gap-3">
              <p className="text-sm text-ink-800">
                {l.description}
                <span className="block text-[12px] text-ink-600">
                  {formatQuantity(l.remaining_milli)} of {formatQuantity(l.quantity_milli)} left ·{' '}
                  {money(l.line_total_minor)} for the full line
                </span>
              </p>
              <Input
                aria-label={`Quantity to credit: ${l.description}`}
                inputMode="decimal"
                placeholder="0"
                value={qty[l.id] ?? ''}
                onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setQty(Object.fromEntries(lines.map((l) => [l.id, formatQuantity(l.remaining_milli)])))}
          >
            Credit everything left
          </Button>
        </fieldset>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label="Other adjustment" hint="Optional, e.g. a goodwill discount. No tax." error={errors['lines']}>
          <Input value={adjustmentText} onChange={(e) => setAdjustmentText(e.target.value)} maxLength={500} />
        </Field>
        <Field label={`Amount (${currency})`}>
          <MoneyInput
            valueMinor={adjustment}
            onChangeMinor={setAdjustment}
            currency={currency}
            minorDigits={minorDigits}
          />
        </Field>
      </div>
      <Field label="Reason" required hint="Printed on the credit note." error={errors['reason']}>
        <Textarea name="reason" rows={2} maxLength={500} />
      </Field>
      <p
        className={`tnum text-sm font-semibold ${total > limit ? 'text-danger-700' : 'text-ink-950'}`}
        aria-live="polite"
      >
        Credit total: {money(total)}
        {total > limit ? ` (more than the ${money(limit)} allowed)` : ''}
      </p>
      <Alert message={error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={total <= 0 || total > limit}>
          Issue credit note
        </Button>
      </div>
    </form>
  );
}
