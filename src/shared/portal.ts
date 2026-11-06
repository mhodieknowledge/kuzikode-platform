/** Client-facing wording for document statuses in the portal (staff screens use their own labels). */
import type { QuotationStatus } from './quotations';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function portalQuotationStatus(status: QuotationStatus, open: boolean): { label: string; tone: Tone } {
  if (open) return { label: 'Waiting for your answer', tone: 'info' };
  switch (status) {
    case 'accepted':
      return { label: 'Accepted', tone: 'success' };
    case 'rejected':
      return { label: 'Declined', tone: 'neutral' };
    case 'void':
      return { label: 'Withdrawn', tone: 'neutral' };
    default:
      return { label: 'Expired', tone: 'warning' };
  }
}

export function portalInvoiceStatus(status: string, overdue: boolean): { label: string; tone: Tone } {
  if (status === 'void') return { label: 'Cancelled', tone: 'neutral' };
  if (status === 'paid') return { label: 'Paid', tone: 'success' };
  if (overdue) return { label: 'Overdue', tone: 'danger' };
  if (status === 'partially_paid') return { label: 'Part paid', tone: 'warning' };
  return { label: 'Due', tone: 'info' };
}

export const CREDIT_APPLIED_LABEL: Record<'invoice' | 'client_credit' | 'refund', string> = {
  invoice: 'Taken off the invoice',
  client_credit: 'Kept as credit for future invoices',
  refund: 'Refunded',
};
