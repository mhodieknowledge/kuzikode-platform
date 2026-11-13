/** Payment logic (R6.2), unchanged from the pre-R6.2 PaymentsAdmin island: recording a refund and "Check now" on an attempt. */
import { useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { reload, useAdminAction } from '../action';
import { attemptStatus } from '../finance/labels';

/** An online payment attempt as `/api/v1/admin/payments/attempts` returns it. */
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

export function useRefund(paymentId: string) {
  const a = useAdminAction();
  const refund = (body: Record<string, unknown>) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/payments/${paymentId}/refunds`, { body });
      reload();
    });
  return { ...a, refund };
}

export function useAttempts(initial: AttemptItem[]) {
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
        setMessage(`Updated: ${attemptStatus(next.status).label}. Refreshing…`);
        reload();
        return;
      }
      setItems((list) => list.map((x) => (x.id === a.id ? { ...x, ...next, methodLabel: x.methodLabel } : x)));
      setMessage(`Checked with the gateway: no change (${attemptStatus(next.status).label}).`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The check did not complete. Please try again.');
    } finally {
      setBusyId(null);
    }
  };
  return { items, busyId, message, error, check };
}
