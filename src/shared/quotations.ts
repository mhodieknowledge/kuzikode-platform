/** Quotation lifecycle (PRD §4.2 D). Shared by the server (enforcement) and the admin UI (which actions to show). */
export const QUOTATION_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'void'] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  void: 'Void',
};

/** Allowed status changes. `sent → sent` is a resend. */
export const QUOTATION_TRANSITIONS: Record<QuotationStatus, readonly QuotationStatus[]> = {
  draft: ['sent', 'void'],
  sent: ['sent', 'viewed', 'accepted', 'rejected', 'expired', 'void'],
  viewed: ['sent', 'accepted', 'rejected', 'expired', 'void'],
  accepted: ['void'],
  rejected: ['void'],
  expired: ['void'],
  void: [],
};

export function canTransition(from: QuotationStatus, to: QuotationStatus): boolean {
  return QUOTATION_TRANSITIONS[from].includes(to);
}

/** A newer version can be made from a sent quotation that has not been accepted, or from a rejected/expired one. */
export const REVISABLE: readonly QuotationStatus[] = ['sent', 'viewed', 'rejected', 'expired'];
/** The client (or staff on their behalf) can still respond. */
export const OPEN_FOR_RESPONSE: readonly QuotationStatus[] = ['sent', 'viewed'];
