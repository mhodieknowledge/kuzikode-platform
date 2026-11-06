/** Notification types users can tune (PRD §4.2 J). Security notices are always emailed and cannot be turned off. */
export const NOTIFICATION_TYPES = [
  { type: 'enquiry.new', label: 'New enquiry', group: 'Sales' },
  { type: 'quotation.viewed', label: 'Quotation viewed', group: 'Sales' },
  { type: 'quotation.accepted', label: 'Quotation accepted', group: 'Sales' },
  { type: 'quotation.rejected', label: 'Quotation rejected', group: 'Sales' },
  { type: 'invoice.issued', label: 'Invoice issued', group: 'Finance' },
  { type: 'payment.received', label: 'Payment received', group: 'Finance' },
  { type: 'payment.failed', label: 'Payment failed', group: 'Finance' },
  { type: 'invoice.overdue', label: 'Invoice overdue', group: 'Finance' },
  { type: 'milestone.updated', label: 'Milestone updated', group: 'Delivery' },
  { type: 'support.created', label: 'Support request created', group: 'Delivery' },
  { type: 'support.replied', label: 'Support request replied', group: 'Delivery' },
  { type: 'client.registered', label: 'Client registered', group: 'Clients' },
  { type: 'application.new', label: 'New job application', group: 'Careers' },
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]['type'];
export const isNotificationType = (t: string): t is NotificationType => NOTIFICATION_TYPES.some((n) => n.type === t);
