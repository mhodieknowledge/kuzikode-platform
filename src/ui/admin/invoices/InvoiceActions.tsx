/**
 * Actions for one invoice (R6.2); which ones show is decided on the server page from status + permissions. The main action
 * (issue, record payment) is the filled plate; the rest are outlined. Forms open in sheets. Labels are the e2e contract.
 */
import { useState } from 'react';
import type { CreditApplication } from '../../../shared/credit-notes';
import { MANUAL_PAYMENT_METHODS } from '../../../shared/invoices';
import { formatMoney, formatQuantity } from '../../../shared/money';
import { FormAlert } from '../../auth/FormAlert';
import { Field, MoneyInput, SelectField, TextareaField, TextField } from '../../primitives';
import { Button, LinkButton } from '../../primitives/button';
import { ConfirmSheet } from '../../primitives/sheet';
import { CheckItem, FormSheet } from '../form';
import {
  availableApplications,
  creditNoteBody,
  creditTotal,
  useInvoiceActions,
  type CreditOptions,
} from './useInvoices';

export interface InvoiceCan {
  edit: boolean;
  issue: boolean;
  send: boolean;
  pay: boolean;
  credit: boolean;
  void: boolean;
  delete: boolean;
  creditNote: boolean;
}

type Dialog = null | 'issue' | 'send' | 'pay' | 'credit' | 'void' | 'delete' | 'creditNote';

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
  can: InvoiceCan;
}) {
  const a = useInvoiceActions(id);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [copied, setCopied] = useState(false);
  const [emailOnIssue, setEmailOnIssue] = useState(hasEmail);
  const [amount, setAmount] = useState<number | null>(balanceMinor > 0 ? balanceMinor : null);
  const [creditAmount, setCreditAmount] = useState<number | null>(Math.min(balanceMinor, creditAvailableMinor) || null);
  const label = number ?? 'this draft';
  const money = (m: number) => formatMoney(m, currency, minorDigits);
  const close = () => setDialog(null);
  const draft = status === 'draft';
  const overpay = amount !== null && amount > balanceMinor ? amount - balanceMinor : 0;
  return (
    <div className="kz-aacts">
      <div className="kz-ahead__acts">
        {can.issue ? (
          <Button lead="send" onClick={() => setDialog('issue')}>
            Issue invoice
          </Button>
        ) : null}
        {can.pay ? (
          <Button lead="payments" onClick={() => setDialog('pay')}>
            Record payment
          </Button>
        ) : null}
        {can.edit ? (
          <LinkButton variant="secondary" lead="edit" href={`/admin/invoices/${id}/edit`}>
            Edit
          </LinkButton>
        ) : null}
        {can.credit ? (
          <Button variant="secondary" onClick={() => setDialog('credit')}>
            Apply credit
          </Button>
        ) : null}
        {can.send ? (
          <Button variant="secondary" lead="send" onClick={() => setDialog('send')}>
            Resend
          </Button>
        ) : null}
        <LinkButton
          variant="secondary"
          lead={draft ? 'view' : 'download'}
          href={`/api/v1/admin/documents/invoices/${id}/pdf${draft ? '?inline=1' : ''}`}
          {...(draft ? { target: '_blank', rel: 'noopener' } : { download: true })}
        >
          {draft ? 'Preview PDF' : 'Download PDF'}
        </LinkButton>
        {publicLink ? (
          <Button
            variant="secondary"
            lead={copied ? 'check' : 'copy'}
            onClick={() => {
              void navigator.clipboard?.writeText(publicLink).then(() => setCopied(true));
            }}
          >
            {copied ? 'Link copied' : 'Copy client link'}
          </Button>
        ) : null}
        {can.creditNote ? (
          <Button variant="secondary" onClick={() => setDialog('creditNote')}>
            Credit note
          </Button>
        ) : null}
        {can.void ? (
          <Button variant="secondary" onClick={() => setDialog('void')}>
            Void
          </Button>
        ) : null}
        {can.delete ? (
          <Button variant="secondary" lead="delete" onClick={() => setDialog('delete')}>
            Delete draft
          </Button>
        ) : null}
      </div>
      {dialog ? null : <FormAlert message={a.error} />}

      <FormSheet
        open={dialog === 'issue'}
        onClose={close}
        title="Issue invoice"
        formId="inv-issue"
        submitLabel="Issue invoice"
        busy={a.busy}
        error={a.error}
        onSubmit={(f) => void a.issue(emailOnIssue, f.get('message'))}
      >
        <p className="kz-adlg__desc">
          Issuing gives the invoice its number, fixes the client and company details and locks the lines. Corrections
          after that need a credit note.
        </p>
        <CheckItem checked={emailOnIssue} onChange={(e) => setEmailOnIssue(e.target.checked)} disabled={!hasEmail}>
          Email the invoice to the client
          {hasEmail ? null : <span className="kz-hint"> The client has no email address on record.</span>}
        </CheckItem>
        {emailOnIssue ? (
          <TextareaField
            label="Personal message"
            hint="Optional. Shown at the top of the email."
            name="message"
            rows={3}
            maxLength={2000}
            error={a.err('message')}
          />
        ) : null}
      </FormSheet>

      <FormSheet
        open={dialog === 'send'}
        onClose={close}
        title={`Resend ${label}`}
        formId="inv-send"
        submitLabel="Resend"
        busy={a.busy}
        error={a.error}
        onSubmit={(f) => void a.resend(f.get('message'))}
      >
        <p className="kz-adlg__desc">The client receives the same link again.</p>
        <TextareaField
          label="Personal message"
          hint="Optional."
          name="message"
          rows={3}
          maxLength={2000}
          error={a.err('message')}
        />
      </FormSheet>

      <FormSheet
        open={dialog === 'pay'}
        onClose={close}
        title={`Record a payment for ${label}`}
        formId="inv-pay"
        submitLabel="Record payment"
        busy={a.busy}
        error={a.error}
        onSubmit={(f) =>
          void a.recordPayment({
            amountMinor: amount ?? 0,
            method: f.get('method'),
            receivedOn: f.get('receivedOn'),
            reference: f.get('reference'),
            notes: f.get('notes'),
          })
        }
      >
        {dialog === 'pay' ? (
          <p className="kz-adlg__desc">
            Balance due: <span className="kz-amono">{money(balanceMinor)}</span>
          </p>
        ) : null}
        <Field label={`Amount received (${currency})`} error={a.err('amountMinor')}>
          {(p) => (
            <MoneyInput
              {...p}
              valueMinor={amount}
              onChangeMinor={setAmount}
              currency={currency}
              minorDigits={minorDigits}
            />
          )}
        </Field>
        {overpay > 0 ? (
          <p role="status" className="kz-anotice kz-anotice--info">
            {money(overpay)} more than the balance. It will be kept as credit on the client&apos;s account.
          </p>
        ) : null}
        <SelectField label="Method" name="method" defaultValue="bank_transfer" error={a.err('method')}>
          {MANUAL_PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Date received"
          type="date"
          name="receivedOn"
          defaultValue={today}
          max={today}
          error={a.err('receivedOn')}
        />
        <TextField
          label="Reference"
          hint="Bank reference, transaction ID or receipt book number."
          name="reference"
          maxLength={120}
          autoComplete="off"
          error={a.err('reference')}
        />
        <TextareaField
          label="Internal notes"
          hint="Optional. Not shown to the client."
          name="notes"
          rows={2}
          maxLength={1000}
          error={a.err('notes')}
        />
      </FormSheet>

      <FormSheet
        open={dialog === 'credit'}
        onClose={close}
        title={`Apply credit to ${label}`}
        formId="inv-credit"
        submitLabel="Apply credit"
        busy={a.busy}
        error={a.error}
        onSubmit={() => void a.applyCredit(creditAmount ?? 0)}
      >
        {dialog === 'credit' ? (
          <p className="kz-adlg__desc">
            Available credit: <span className="kz-amono">{money(creditAvailableMinor)}</span> · Balance due:{' '}
            <span className="kz-amono">{money(balanceMinor)}</span>
          </p>
        ) : null}
        <Field label={`Amount to apply (${currency})`} error={a.err('amountMinor')}>
          {(p) => (
            <MoneyInput
              {...p}
              valueMinor={creditAmount}
              onChangeMinor={setCreditAmount}
              currency={currency}
              minorDigits={minorDigits}
            />
          )}
        </Field>
      </FormSheet>

      <FormSheet
        open={dialog === 'void'}
        onClose={close}
        title={`Void ${label}?`}
        formId="inv-void"
        submitLabel="Void invoice"
        danger
        busy={a.busy}
        error={a.error}
        onSubmit={(f) => void a.voidIt(f.get('reason'))}
      >
        <p className="kz-adlg__desc">A void invoice keeps its number and stays on record, but is no longer payable.</p>
        <TextareaField label="Reason" name="reason" rows={2} maxLength={500} error={a.err('reason')} />
      </FormSheet>

      {creditOptions && dialog === 'creditNote' ? (
        <CreditNoteSheet
          open
          onClose={close}
          label={label}
          options={creditOptions}
          currency={currency}
          minorDigits={minorDigits}
          busy={a.busy}
          errors={a.errors}
          error={a.error}
          onSubmit={(body) => void a.creditNote(body)}
        />
      ) : null}

      <ConfirmSheet
        open={dialog === 'delete'}
        onClose={close}
        title="Delete this draft?"
        confirmLabel="Delete draft"
        danger
        onConfirm={() => a.remove()}
      >
        Drafts were never issued, so nothing is lost on the client&apos;s side. This can&apos;t be undone.
      </ConfirmSheet>
    </div>
  );
}

function CreditNoteSheet({
  open,
  onClose,
  label,
  options,
  currency,
  minorDigits,
  busy,
  errors,
  error,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  options: CreditOptions;
  currency: string;
  minorDigits: number;
  busy: boolean;
  errors: Record<string, string[]>;
  error: string | null;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const available = availableApplications(options);
  const [appliedTo, setAppliedTo] = useState<CreditApplication>(available[0]?.value ?? 'invoice');
  const [qty, setQty] = useState<Record<string, string>>({});
  const [adjustment, setAdjustment] = useState<number | null>(null);
  const [adjustmentText, setAdjustmentText] = useState('');
  const money = (m: number) => formatMoney(m, currency, minorDigits);
  const lines = options.lines.filter((l) => l.remaining_milli > 0);
  const total = creditTotal(lines, qty, adjustment);
  const limit = options.limits[appliedTo];
  const title = `Credit note for ${label}`;
  if (!available.length)
    return (
      <FormSheet
        open={open}
        onClose={onClose}
        title={title}
        formId="inv-cn"
        submitLabel="Close"
        disabled
        onSubmit={onClose}
      >
        <p className="kz-adlg__desc">
          Nothing is left to credit on this invoice: it has no balance, nothing was paid that could be given back, or
          earlier credit notes already cover its total.
        </p>
      </FormSheet>
    );
  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={title}
      formId="inv-cn"
      submitLabel="Issue credit note"
      busy={busy}
      error={error}
      disabled={total <= 0 || total > limit}
      onSubmit={(f) =>
        onSubmit(creditNoteBody(lines, qty, { minor: adjustment, text: adjustmentText }, appliedTo, f.get('reason')))
      }
    >
      <p className="kz-adlg__desc">
        Credit notes correct an issued invoice. They are numbered, can&apos;t be edited and stay on record.
      </p>
      <SelectField
        label="Apply the credit"
        value={appliedTo}
        onChange={(e) => setAppliedTo(e.target.value as CreditApplication)}
        error={errors['appliedTo']?.[0]}
      >
        {available.map((c) => (
          <option key={c.value} value={c.value}>
            {`${c.label} (up to ${money(options.limits[c.value])})`}
          </option>
        ))}
      </SelectField>
      {lines.length ? (
        <fieldset className="kz-acn">
          <legend className="kz-label">Lines to credit</legend>
          {lines.map((l) => (
            <div key={l.id} className="kz-acn__row">
              <p className="kz-acn__t">
                {l.description}
                <span className="kz-acn__m">
                  {formatQuantity(l.remaining_milli)} of {formatQuantity(l.quantity_milli)} left ·{' '}
                  {money(l.line_total_minor)} for the full line
                </span>
              </p>
              <input
                className="kz-input kz-input--num"
                aria-label={`Quantity to credit: ${l.description}`}
                inputMode="decimal"
                placeholder="0"
                value={qty[l.id] ?? ''}
                onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })}
              />
            </div>
          ))}
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setQty(Object.fromEntries(lines.map((l) => [l.id, formatQuantity(l.remaining_milli)])))}
            >
              Credit everything left
            </Button>
          </div>
        </fieldset>
      ) : null}
      <TextField
        label="Other adjustment"
        hint="Optional, e.g. a goodwill discount. No tax."
        value={adjustmentText}
        onChange={(e) => setAdjustmentText(e.target.value)}
        maxLength={500}
        error={errors['lines']?.[0]}
      />
      <Field label={`Amount (${currency})`}>
        {(p) => (
          <MoneyInput
            {...p}
            valueMinor={adjustment}
            onChangeMinor={setAdjustment}
            currency={currency}
            minorDigits={minorDigits}
          />
        )}
      </Field>
      <TextareaField
        label="Reason"
        hint="Printed on the credit note."
        name="reason"
        rows={2}
        maxLength={500}
        error={errors['reason']?.[0]}
      />
      <p className={total > limit ? 'kz-acn__total is-over' : 'kz-acn__total'} aria-live="polite">
        Credit total: {money(total)}
        {total > limit ? ` (more than the ${money(limit)} allowed)` : ''}
      </p>
    </FormSheet>
  );
}
