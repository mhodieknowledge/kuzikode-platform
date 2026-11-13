/** Record a refund against a payment (R6.2). The server validates the amount and the covering credit. */
import { useState } from 'react';
import { formatMoney } from '../../../shared/money';
import { Field, MoneyInput, SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { Sheet } from '../../primitives/sheet';
import { FormSheet } from '../form';
import { useRefund } from './usePayments';

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
  const a = useRefund(paymentId);
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
  const title = `Record a refund of ${receiptNumber}`;
  const close = () => setOpen(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Record refund
      </Button>
      {sources.length === 0 ? (
        <Sheet
          open={open}
          onClose={close}
          title={title}
          className="kz-adlg"
          footer={
            <Button variant="secondary" onClick={close}>
              Close
            </Button>
          }
        >
          <p className="kz-adlg__desc">
            A refund needs something in the books to cover it. Issue a credit note &quot;to be refunded&quot; on the
            client&apos;s invoice first (or the client needs account credit), then record the refund here.
          </p>
        </Sheet>
      ) : (
        <FormSheet
          open={open}
          onClose={close}
          title={title}
          formId="pay-refund"
          submitLabel="Record refund"
          busy={a.busy}
          error={a.error}
          onSubmit={(f) =>
            void a.refund({
              amountMinor: amount ?? 0,
              reason: f.get('reason'),
              source,
              creditNoteId: source === 'credit_note' ? noteId : null,
              reference: f.get('reference'),
            })
          }
        >
          <p className="kz-adlg__desc">Up to {money(refundableMinor)} of this payment can still be refunded.</p>
          <p className="kz-anotice kz-anotice--info">
            Pay the money back first (bank transfer, cash, or in the gateway&apos;s merchant dashboard), then record it
            here. Online gateways don&apos;t offer refunds through their API.
          </p>
          <SelectField
            label="Covered by"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            error={a.err('source')}
          >
            {sources.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </SelectField>
          {source === 'credit_note' ? (
            <SelectField
              label="Credit note"
              value={noteId}
              onChange={(e) => setNoteId(e.target.value)}
              error={a.err('creditNoteId')}
            >
              {creditNotes.map((n) => (
                <option key={n.id} value={n.id}>
                  {`${n.number} (${money(n.remaining_minor)} left)`}
                </option>
              ))}
            </SelectField>
          ) : null}
          <Field label={`Amount refunded (${currency})`} error={a.err('amountMinor')}>
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
          <TextField
            label="Reference"
            hint="Bank or gateway reference of the refund."
            name="reference"
            maxLength={120}
            autoComplete="off"
            error={a.err('reference')}
          />
          <TextareaField label="Reason" name="reason" rows={2} maxLength={500} error={a.err('reason')} />
        </FormSheet>
      )}
    </>
  );
}
