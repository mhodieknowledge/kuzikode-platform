/**
 * Invoice logic (R6.2), carried over unchanged from the pre-R6.2 InvoicesAdmin island: saving a draft, the actions on an
 * invoice (issue, resend, record a payment, apply credit, void, credit note, delete) and the credit-note total preview.
 */
import { CREDIT_APPLICATIONS, creditForQuantity, type CreditApplication } from '../../../shared/credit-notes';
import { formatMoney, parseQuantityMilli } from '../../../shared/money';
import { apiFetch } from '../../lib/api';
import { reload, useAdminAction } from '../action';

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

export function useInvoiceSave(id: string | undefined) {
  const a = useAdminAction();
  const save = (body: Record<string, unknown>) =>
    a.run(async () => {
      if (id) {
        await apiFetch(`/api/v1/admin/invoices/${id}`, { method: 'PUT', body });
        window.location.assign(`/admin/invoices/${id}`);
      } else {
        const res = await apiFetch<{ data: { id: string } }>('/api/v1/admin/invoices', { body });
        window.location.assign(`/admin/invoices/${res.data.id}`);
      }
    });
  return { ...a, save };
}

export function useInvoiceActions(id: string) {
  const a = useAdminAction();
  const post = (path: string, body: Record<string, unknown>) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/invoices/${id}${path}`, { body });
      reload();
    });
  return {
    ...a,
    issue: (send: boolean, message: FormDataEntryValue | null) => post('/issue', { send, message }),
    resend: (message: FormDataEntryValue | null) => post('/send', { message }),
    recordPayment: (body: Record<string, unknown>) => post('/payments', body),
    applyCredit: (amountMinor: number) => post('/apply-credit', { amountMinor }),
    voidIt: (reason: FormDataEntryValue | null) => post('/void', { reason }),
    creditNote: (body: Record<string, unknown>) => post('/credit-notes', body),
    remove: () =>
      a.run(async () => {
        await apiFetch(`/api/v1/admin/invoices/${id}`, { method: 'DELETE' });
        window.location.assign('/admin/invoices');
      }),
  };
}

/** Quantity text → milli-units: 0 for empty, null when it doesn't parse. */
export const safeQty = (q: string): number | null => {
  try {
    return q.trim() ? parseQuantityMilli(q) : 0;
  } catch {
    return null;
  }
};

/** The applications a credit note may use (limit above zero). */
export const availableApplications = (options: CreditOptions) =>
  CREDIT_APPLICATIONS.filter((c) => options.limits[c.value] > 0);

/** Credit total for the entered per-line quantities plus the free adjustment, in minor units. */
export function creditTotal(
  lines: CreditOptions['lines'],
  qty: Record<string, string>,
  adjustmentMinor: number | null,
) {
  return (
    lines.reduce((sum, l) => {
      const q = safeQty(qty[l.id] ?? '');
      return q && q > 0 && q <= l.remaining_milli ? sum + creditForQuantity(l, q).totalMinor : sum;
    }, 0) + (adjustmentMinor ?? 0)
  );
}

/** Body of the credit-note request. */
export function creditNoteBody(
  lines: CreditOptions['lines'],
  qty: Record<string, string>,
  adjustment: { minor: number | null; text: string },
  appliedTo: CreditApplication,
  reason: FormDataEntryValue | null,
) {
  return {
    reason,
    appliedTo,
    lines: [
      ...lines
        .filter((l) => (safeQty(qty[l.id] ?? '') ?? 0) > 0)
        .map((l) => ({ invoiceItemId: l.id, quantity: (qty[l.id] ?? '').trim() })),
      ...(adjustment.minor ? [{ description: adjustment.text, amountMinor: adjustment.minor }] : []),
    ],
  };
}

export const money = (minor: number, currency: string, digits: number) => formatMoney(minor, currency, digits);
