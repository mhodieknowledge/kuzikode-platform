/** Payments islands (P4.11): recording a refund. The server validates the amounts and the covering credit. */
import { useState } from 'react';
import { formatMoney } from '../../shared/money';
import { apiFetch, Button, Dialog, Field, Input, MoneyInput, Select, Textarea } from '../ui';
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
