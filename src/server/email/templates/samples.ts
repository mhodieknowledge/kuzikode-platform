/**
 * Sample data for every email template (P6.6): the unit snapshot tests and the development preview page (`/dev/emails`)
 * render from here. Typed per template name, so a new template without a sample fails the typecheck.
 */
import type { TemplateName } from './index';

export const EMAIL_SAMPLES: Record<TemplateName, Record<string, unknown>> = {
  security_alert: { name: 'Ann', event: 'password_changed', at: '2026-11-05T10:00:00Z', ip: '1.2.3.4' },
  password_reset: {
    name: 'Ann',
    link: 'https://kuzikode.example/admin/reset-password?token=abc',
    expiresInMinutes: 60,
  },
  email_verification: { name: 'Ann', link: 'https://kuzikode.example/portal/verify-email?token=abc' },
  staff_invitation: { name: 'Ann', link: 'https://kuzikode.example/admin/accept-invite?token=abc', expiresInDays: 7 },
  client_invitation: {
    name: 'Ann',
    link: 'https://kuzikode.example/portal/accept-invite?token=abc',
    expiresInDays: 7,
  },
  enquiry_acknowledgement: { name: 'Ann', reference: 'ENQ-2026-0001', kind: 'contact' },
  enquiry_admin: {
    reference: 'ENQ-2026-0001',
    name: 'Ann',
    email: 'ann@example.com',
    category: 'web-development',
    message: 'We need a website.',
    kind: 'contact',
    link: 'https://kuzikode.example/admin/enquiries/enq_1',
  },
  application_acknowledgement: { name: 'Ann', reference: 'APP-2026-0001', position: 'Junior Web Developer' },
  system_test: { name: 'Ann', at: '2026-11-06T10:00:00.000Z' },
  quotation_sent: {
    name: 'Ann',
    number: 'QUO-2026-0001',
    title: 'Website redesign',
    total: 'US$1,200.00',
    validUntil: '6 December 2026',
    link: 'https://example.com/q/abc',
    message: null,
  },
  newsletter_confirmation: { link: 'https://kuzikode.example/newsletter/confirm?token=abc' },
  support_reply: {
    name: 'Ann',
    reference: 'SUP-2026-0001',
    subject: 'Email not syncing',
    body: 'We reset the mailbox password; please try again.',
  },
  support_ack: {
    name: 'Ann',
    reference: 'SUP-2026-0002',
    subject: 'Website is down',
    link: 'https://kuzikode.example/portal/support/sup_1',
  },
  candidate_message: {
    subject: 'Interview invitation: Junior Developer',
    body: 'Hi Tino,\n\nWe would like to invite you to an interview.\n\nKind regards,\nKuzikode Technologies',
    reference: 'APP-2026-0001',
  },
  renewal_reminder: {
    name: 'Ann',
    item: 'Domain: baobab.co.zw',
    renewalDate: '6 December 2026',
    days: 30,
    autoRenew: false,
  },
  notification: {
    name: 'Tendai',
    label: 'New enquiry',
    title: 'New enquiry from Ann Moyo',
    body: 'Website for a bakery, budget USD 1,000–2,500.',
    link: 'https://kuzikode.example/admin/enquiries/enq_1',
  },
  project_update: {
    name: 'Ann',
    project: 'Online ordering website',
    reference: 'PRJ-2026-0001',
    body: 'The design is approved. Build starts on Monday.',
  },
  invoice_issued: {
    name: 'Ann',
    number: 'INV-2026-00001',
    total: '$500.00',
    dueDate: '13 November 2026',
    link: 'https://example.com/i/abc',
    portalLink: 'https://kuzikode.example/portal/invoices/inv_1',
    message: null,
  },
  invoice_reminder: {
    name: 'Ann',
    number: 'INV-2026-00001',
    balance: '$250.00',
    dueDate: '13 November 2026',
    overdue: true,
    link: 'https://example.com/i/abc',
  },
  card_charge_failed: {
    name: 'Ann Moyo Bakery',
    number: 'INV-2026-00007',
    amount: '$25.00',
    link: 'https://example.com/pay/abc',
  },
  payment_receipt: {
    name: 'Ann',
    receiptNumber: 'RCT-2026-00001',
    amount: '$600.00',
    receivedOn: '6 November 2026',
    invoiceNumber: 'INV-2026-00001',
    balance: '$0.00',
    credit: '$100.00',
    link: 'https://example.com/i/abc',
  },
  quotation_accepted: {
    name: 'Tendai',
    label: 'Quotation accepted',
    number: 'QUO-2026-0001',
    title: 'Website redesign',
    client: 'Baobab Foods',
    total: 'US$1,200.00',
    acceptedBy: 'Ann Moyo',
    acceptedOn: '11 November 2026',
    byStaff: false,
    link: 'https://kuzikode.example/admin/quotations/quo_1',
  },
};

/** Extra variants worth previewing and snapshotting (same template, different wording). */
export const EMAIL_VARIANTS: { name: TemplateName; variant: string; data: Record<string, unknown> }[] = [
  {
    name: 'invoice_reminder',
    variant: 'before due',
    data: { ...EMAIL_SAMPLES.invoice_reminder, overdue: false, dueToday: false },
  },
  {
    name: 'invoice_reminder',
    variant: 'due today',
    data: { ...EMAIL_SAMPLES.invoice_reminder, overdue: false, dueToday: true },
  },
  {
    name: 'quotation_accepted',
    variant: 'recorded by staff',
    data: { ...EMAIL_SAMPLES.quotation_accepted, byStaff: true, acceptedBy: 'Ann Moyo' },
  },
  { name: 'security_alert', variant: 'new sign-in', data: { ...EMAIL_SAMPLES.security_alert, event: 'new_login' } },
  {
    name: 'enquiry_acknowledgement',
    variant: 'project wizard',
    data: { ...EMAIL_SAMPLES.enquiry_acknowledgement, kind: 'wizard' },
  },
  {
    name: 'renewal_reminder',
    variant: 'auto-renew',
    data: { ...EMAIL_SAMPLES.renewal_reminder, autoRenew: true, days: 7 },
  },
];
