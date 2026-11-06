/** Support requests (PRD §4.2): statuses, priorities and categories shared by server and UI. */
export const SUPPORT_STATUSES = ['open', 'awaiting_client', 'resolved', 'closed'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];
export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  open: 'Open',
  awaiting_client: 'Waiting for the client',
  resolved: 'Resolved',
  closed: 'Closed',
};
export const SUPPORT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];
export const SUPPORT_PRIORITY_LABEL: Record<SupportPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};
export const SUPPORT_CATEGORIES = [
  { value: 'general', label: 'General question' },
  { value: 'website', label: 'Website' },
  { value: 'hosting', label: 'Hosting and email' },
  { value: 'software', label: 'Software or app' },
  { value: 'billing', label: 'Billing' },
  { value: 'other', label: 'Something else' },
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]['value'];

/** Portal wording: "waiting for the client" reads as "waiting for your reply" to the client. */
export function portalSupportStatus(s: SupportStatus): string {
  return s === 'awaiting_client' ? 'Waiting for your reply' : SUPPORT_STATUS_LABEL[s];
}
export const SUPPORT_STATUS_TONE: Record<SupportStatus, 'neutral' | 'info' | 'success' | 'warning'> = {
  open: 'info',
  awaiting_client: 'warning',
  resolved: 'success',
  closed: 'neutral',
};
