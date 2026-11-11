/** Payments islands (P4.11, P6.4): recording a refund; online payment attempts with "Check now". The server validates the amounts and the covering credit. */
import { useState } from 'react';
import { formatMoney } from '../../shared/money';
import {
  ApiError,
  apiFetch,
  Badge,
  Button,
  Dialog,
  Field,
  Input,
  MoneyInput,
  Select,
  Textarea,
  type Tone,
} from '../ui';
import { Alert, useAction } from './actions';

export function RefundAction({
  paymentId,
  receiptNumber,
  currency,
  minorDigits,
  refundableMinor,
  accountCreditMinor,
  creditNotes,
}: {
  paymentId: string;
  receiptNumber: string;
  currency: string;
  minorDigits: number;
  refundableMinor: number;
  accountCreditMinor: number;
  creditNotes: { id: string; number: string; remaining_minor: number }[];
}) {
  const a = useAction();
  const [open, setOpen] = useState(false);
  const money = (m: number) => formatMoney(m, currency, minorDigits);
  const sources = [
    ...(creditNotes.length ? [{ value: 'credit_note', label: 'A credit note to be refunded' }] : []),
    ...(accountCreditMinor > 0
      ? [{ value: 'account_credit', label: `Account credit (${money(accountCreditMinor)})` }]
      : []),
  ];
  const [source, setSource] = useState(sources[0]?.value ?? 'credit_note');
  const [noteId, setNoteId] = useState(creditNotes[0]?.id ?? '');
  const cover =
    source === 'credit_note' ? (creditNotes.find((n) => n.id === noteId)?.remaining_minor ?? 0) : accountCreditMinor;
  const [amount, setAmount] = useState<number | null>(Math.min(refundableMinor, cover) || null);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Record refund
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Record a refund of ${receiptNumber}`}
        description={`Up to ${money(refundableMinor)} of this payment can still be refunded.`}
      >
        {sources.length === 0 ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-800">
              A refund needs something in the books to cover it. Issue a credit note "to be refunded" on the client's
              invoice first (or the client needs account credit), then record the refund here.
            </p>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              const f = new FormData(ev.currentTarget);
              void a.run(async () => {
                await apiFetch(`/api/v1/admin/payments/${paymentId}/refunds`, {
                  body: {
                    amountMinor: amount ?? 0,
                    reason: f.get('reason'),
                    source,
                    creditNoteId: source === 'credit_note' ? noteId : null,
                    reference: f.get('reference'),
                  },
                });
                window.location.reload();
              });
            }}
          >
            <p className="rounded-sm bg-info-50 px-3 py-2 text-sm text-info-700">
              Pay the money back first (bank transfer, cash, or in the gateway's merchant dashboard), then record it
              here. Online gateways don't offer refunds through their API.
            </p>
            <Field label="Covered by" required error={a.errors['source']}>
              <Select value={source} onChange={(e) => setSource(e.target.value)} options={sources} />
            </Field>
            {source === 'credit_note' ? (
              <Field label="Credit note" required error={a.errors['creditNoteId']}>
                <Select
                  value={noteId}
                  onChange={(e) => setNoteId(e.target.value)}
                  options={creditNotes.map((n) => ({
                    value: n.id,
                    label: `${n.number} (${money(n.remaining_minor)} left)`,
                  }))}
                />
              </Field>
            ) : null}
            <Field label={`Amount refunded (${currency})`} required error={a.errors['amountMinor']}>
              <MoneyInput valueMinor={amount} onChangeMinor={setAmount} currency={currency} minorDigits={minorDigits} />
            </Field>
            <Field label="Reference" hint="Bank or gateway reference of the refund." error={a.errors['reference']}>
              <Input name="reference" maxLength={120} autoComplete="off" />
            </Field>
            <Field label="Reason" required error={a.errors['reason']}>
              <Textarea name="reason" rows={2} maxLength={500} />
            </Field>
            <Alert message={a.error} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={a.busy}>
                Record refund
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

/** An online payment attempt as `/api/v1/admin/payments/attempts` returns it (P6.4). */
export interface AttemptItem {
  id: string;
  methodCode: string | null;
  methodLabel: string;
  accountLabel: string | null;
  testMode: boolean;
  payerPhoneMasked: string | null;
  amount: string;
  status: string;
  failureReason: string | null;
  merchantReference: string;
  checkCount: number;
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  createdAt: string;
  paymentId: string | null;
}

const ATTEMPT_STATUS: Record<string, [label: string, tone: Tone]> = {
  created: ['Starting', 'neutral'],
  initiated: ['Waiting', 'info'],
  pending: ['Waiting', 'info'],
  partially_paid: ['Part paid', 'warning'],
  succeeded: ['Paid', 'success'],
  disputed: ['Disputed', 'warning'],
  refunded: ['Refunded', 'neutral'],
  reversed: ['Reversed', 'danger'],
  failed: ['Failed', 'danger'],
  cancelled: ['Cancelled', 'neutral'],
  expired: ['Expired', 'neutral'],
  error: ['Error', 'danger'],
};

const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Harare' }).format(
        new Date(iso),
      )
    : '';

/**
 * The invoice's online payment attempts with a "Check now" per attempt: asks the gateway at once and applies the
 * verified result (reconciliation runs on its own every few minutes; this is for finance when a client calls).
 */
export function PaymentAttempts({ initial }: { initial: AttemptItem[] }) {
  const [items, setItems] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const check = async (a: AttemptItem) => {
    setBusyId(a.id);
    setMessage(null);
    setError(null);
    try {
      const { data: next } = await apiFetch<{ data: Omit<AttemptItem, 'methodLabel'> }>(
        `/api/v1/admin/payments/attempts/${a.id}/check`,
        { body: {} },
      );
      if (next.status !== a.status) {
        // The invoice's balance and payments may have changed: show the page as it is now.
        setMessage(`Updated: ${ATTEMPT_STATUS[next.status]?.[0] ?? next.status}. Refreshing…`);
        window.location.reload();
        return;
      }
      setItems((list) => list.map((x) => (x.id === a.id ? { ...x, ...next, methodLabel: x.methodLabel } : x)));
      setMessage(`Checked with the gateway: no change (${ATTEMPT_STATUS[next.status]?.[0] ?? next.status}).`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The check did not complete. Please try again.');
    } finally {
      setBusyId(null);
    }
  };
  return (
    <div className="mt-3 flex flex-col gap-3">
      <p aria-live="polite" className="text-[13px] text-ink-800 empty:hidden">
        {message}
      </p>
      <Alert message={error} />
      <ul className="flex flex-col gap-4 text-sm">
        {items.map((a) => {
          const [label, tone] = ATTEMPT_STATUS[a.status] ?? [a.status, 'neutral' as Tone];
          return (
            <li key={a.id} className="flex flex-col gap-1">
              <div className="tnum flex flex-wrap items-center justify-between gap-2 font-medium text-ink-950">
                <span>
                  {a.methodLabel}
                  {a.payerPhoneMasked ? (
                    <span className="font-normal text-ink-600"> · {a.payerPhoneMasked}</span>
                  ) : null}
                </span>
                <span>{a.amount}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={tone}>{label}</Badge>
                {a.testMode ? <Badge tone="warning">Test</Badge> : null}
                {a.paymentId ? (
                  <a href={`/admin/payments/${a.paymentId}`} className="text-[12px] text-brand-600 underline">
                    View payment
                  </a>
                ) : null}
              </div>
              <p className="text-[12px] text-ink-600">
                Started {when(a.createdAt)}
                {a.accountLabel ? ` · ${a.accountLabel}` : ''} ·{' '}
                <span className="font-mono">{a.merchantReference}</span>
              </p>
              <p className="text-[12px] text-ink-600">
                {a.checkCount === 0
                  ? 'Not checked with the gateway yet'
                  : `Checked ${a.checkCount} ${a.checkCount === 1 ? 'time' : 'times'}, last ${when(a.lastCheckedAt)}`}
                {a.nextCheckAt ? ` · next automatic check ${when(a.nextCheckAt)}` : ''}
              </p>
              {a.failureReason ? <p className="text-[12px] text-ink-800">{a.failureReason}</p> : null}
              {a.status !== 'created' ? (
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId !== null}
                    aria-label={`Check now with the gateway: ${a.methodLabel} ${a.amount}, ${a.merchantReference}`}
                    onClick={() => void check(a)}
                  >
                    {busyId === a.id ? 'Checking…' : 'Check now'}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
