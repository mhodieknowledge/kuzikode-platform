/**
 * Live status of one online payment attempt (P5.5), logic extracted unchanged from the old AttemptStatus island (BRIEF B.0).
 * While the attempt is waiting it re-reads the status endpoint every 4 s (up to ~3 minutes). The public return pages pass
 * signed `links` that work without a session; otherwise the portal endpoints are used.
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

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

export function useAttemptStatus(initial: AttemptView) {
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

  return { attempt: a, gaveUp, links };
}
