/**
 * Notification types (PRD §4.2 J). `staff` types appear in the admin preferences page; `client` types are portal-only
 * (the matching client email is sent by the business flow itself). Security notices are always on: they can't be tuned.
 */
export const NOTIFICATION_TYPES = [
  { type: 'enquiry.new', label: 'New enquiry', group: 'Sales' },
  { type: 'lead.assigned', label: 'Lead assigned to you', group: 'Sales' },
  { type: 'lead.follow_up', label: 'Lead follow-up due', group: 'Sales' },
  { type: 'quotation.viewed', label: 'Quotation viewed', group: 'Sales' },
  { type: 'quotation.accepted', label: 'Quotation accepted', group: 'Sales' },
  { type: 'quotation.rejected', label: 'Quotation rejected', group: 'Sales' },
  { type: 'invoice.issued', label: 'Invoice issued', group: 'Finance' },
  { type: 'payment.received', label: 'Payment received', group: 'Finance' },
  { type: 'payment.failed', label: 'Payment failed', group: 'Finance' },
  { type: 'payment.reported', label: 'Client reports a bank transfer', group: 'Finance' },
  { type: 'invoice.overdue', label: 'Invoice overdue', group: 'Finance' },
  { type: 'subscription.alert', label: 'Subscription at risk or not billed', group: 'Finance' },
  { type: 'renewal.upcoming', label: 'Domain, hosting or service renewal coming up', group: 'Finance' },
  { type: 'milestone.updated', label: 'Milestone updated', group: 'Delivery' },
  { type: 'project.message', label: 'Project message from a client', group: 'Delivery' },
  { type: 'support.created', label: 'Support request created', group: 'Delivery' },
  { type: 'support.replied', label: 'Support request replied', group: 'Delivery' },
  { type: 'client.registered', label: 'Client registered', group: 'Clients' },
  { type: 'application.new', label: 'New job application', group: 'Careers' },
  { type: 'system.job_failed', label: 'Background job failed', group: 'System' },
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]['type'] | 'security.alert';
export const isNotificationType = (t: string): t is (typeof NOTIFICATION_TYPES)[number]['type'] =>
  NOTIFICATION_TYPES.some((n) => n.type === t);

/** Not tunable: shown in-app always; the email goes out from the auth flow itself (security_alert template). */
export const SECURITY_TYPE = 'security.alert';

export const notificationLabel = (type: string): string =>
  type === SECURITY_TYPE
    ? 'Security alert'
    : (NOTIFICATION_TYPES.find((n) => n.type === type)?.label ?? 'Notification');
