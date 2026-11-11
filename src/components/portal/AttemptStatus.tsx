/**
 * Live status of an online payment attempt (P5.5). While the attempt is waiting it re-reads the portal API every few
 * seconds (up to ~3 minutes), then shows the outcome with links to the receipt or back to the invoice. Used by the portal
 * and by the public gateway return page (`/pay/return`), which passes `links` that work without a session.
 */
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiFetch } from '../ui';
import { formatMoney } from '../../shared/money';
import { paymentMethodLabel } from '../../shared/payment-methods';

export interface AttemptView {
  id: string;
  phase: 'waiting' | 'succeeded' | 'failed';
  message: string;
  method: string | null;
  payerPhone: string | null;
  currency: string;
  amountMinor: number;
  invoice: { id: string; number: string };
  payment: { id: string; receiptNumber: string } | null;
  /** Public return page only: signed status/receipt endpoints and the public invoice page. */
  links?: { status: string; invoice: string; receipt: string | null };
}

const portalLinks = (a: AttemptView) => ({
  status: `/api/v1/portal/payment-attempts/${encodeURIComponent(a.id)}`,
  invoice: `/portal/invoices/${a.invoice.id}`,
  receipt: a.payment ? `/api/v1/portal/payments/${a.payment.id}/receipt` : null,
});

const POLL_MS = 4000;
const MAX_POLLS = 45;

export function AttemptStatus({ initial }: { initial: AttemptView }) {
  const [a, setA] = useState(initial);
  const [polls, setPolls] = useState(0);
  const waiting = a.phase === 'waiting';
  const gaveUp = waiting && polls >= MAX_POLLS;
  const links = a.links ?? portalLinks(a);

  useEffect(() => {
    if (!waiting || polls >= MAX_POLLS) return;
    const t = window.setTimeout(() => {
      apiFetch<{ data: AttemptView }>(links.status)
        .then((res) => setA(res.data))
        .catch(() => undefined)
        .finally(() => setPolls((n) => n + 1));
    }, POLL_MS);
    return () => window.clearTimeout(t);
  }, [waiting, polls, links.status]);

  const Icon = a.phase === 'succeeded' ? CheckCircle2 : a.phase === 'failed' ? XCircle : Clock;
  const tone =
    a.phase === 'succeeded' ? 'text-success-600' : a.phase === 'failed' ? 'text-danger-600' : 'text-brand-600';
  return (
    <div className="flex flex-col gap-4">
      <div role="status" aria-live="polite" className="flex items-start gap-3">
        <Icon size={28} aria-hidden="true" className={`mt-0.5 shrink-0 ${tone}`} />
        <div>
          <h2 className="text-xl font-bold tracking-display">
            {a.phase === 'succeeded'
              ? 'Payment received'
              : a.phase === 'failed'
                ? 'Payment not completed'
                : 'Waiting for confirmation'}
          </h2>
          <p className="mt-1 text-[15px] text-ink-600">
            {gaveUp
              ? 'This is taking longer than usual. You can leave this page; the invoice updates as soon as the payment is confirmed.'
              : a.message}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 rounded-md bg-canvas px-4 py-3 text-sm">
        <dt className="text-ink-600">Amount</dt>
        <dd className="font-mono font-semibold tabular-nums text-ink-950">{formatMoney(a.amountMinor, a.currency)}</dd>
        <dt className="text-ink-600">Invoice</dt>
        <dd className="font-mono text-ink-950">{a.invoice.number}</dd>
        <dt className="text-ink-600">Method</dt>
        <dd className="text-ink-950">
          {paymentMethodLabel(a.method)}
          {a.payerPhone ? ` · ${a.payerPhone}` : ''}
        </dd>
        {a.payment ? (
          <>
            <dt className="text-ink-600">Receipt</dt>
            <dd className="font-mono text-ink-950">{a.payment.receiptNumber}</dd>
          </>
        ) : null}
      </dl>
      <p className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {links.receipt ? (
          <a href={links.receipt} download className="font-semibold text-brand-600 underline underline-offset-2">
            Download receipt
          </a>
        ) : null}
        <a href={links.invoice} className="font-semibold text-brand-600 underline underline-offset-2">
          Back to invoice {a.invoice.number}
        </a>
      </p>
    </div>
  );
}
