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
