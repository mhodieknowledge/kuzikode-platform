import type { RequestContext } from '../../context';
import { formatMoney } from '../../../shared/money';
import { formatLongDate } from '../../../shared/service-display';

/**
 * Some email data is only known after the business batch commits (e.g. gap-free references assigned in SQL).
 * A resolver loads it at send time from the IDs in the payload.
 */
/** Thrown by a resolver when the email is no longer wanted (e.g. a reminder for an invoice paid since). */
export class SkipEmail extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SkipEmail';
  }
}

export type EmailResolver = (ctx: RequestContext, data: Record<string, unknown>) => Promise<Record<string, unknown>>;

const enquiryReference: EmailResolver = async (ctx, data) => {
  const row = await ctx.db
    .prepare('SELECT reference FROM enquiries WHERE id = ?')
    .bind(String(data['enquiryId'] ?? ''))
    .first<{ reference: string }>();
  if (!row) throw new Error('enquiry not found for email');
  return {
    ...data,
    reference: row.reference,
    link: new URL(`/admin/enquiries/${String(data['enquiryId'])}`, ctx.config.siteUrl).toString(),
  };
};

const applicationReference: EmailResolver = async (ctx, data) => {
  const row = await ctx.db
    .prepare('SELECT reference FROM job_applications WHERE id = ?')
    .bind(String(data['applicationId'] ?? ''))
    .first<{ reference: string }>();
  if (!row) throw new Error('application not found for email');
  const { applicationId: _id, ...rest } = data;
  return { ...rest, reference: row.reference };
};

const quotationDetails: EmailResolver = async (ctx, data) => {
  const row = await ctx.db
    .prepare('SELECT number, title, total_minor, currency, valid_until FROM quotations WHERE id = ?')
    .bind(String(data['quotationId'] ?? ''))
    .first<{
      number: string | null;
      title: string;
      total_minor: number;
      currency: string;
      valid_until: string | null;
    }>();
  if (!row?.number) throw new Error('quotation not found or not numbered for email');
  const { quotationId: _id, ...rest } = data;
  return {
    ...rest,
    number: row.number,
    title: row.title,
    total: formatMoney(row.total_minor, row.currency),
    validUntil: row.valid_until ? formatLongDate(row.valid_until) : '',
  };
};

const invoiceDetails: EmailResolver = async (ctx, data) => {
  const row = await ctx.db
    .prepare('SELECT number, total_minor, balance_minor, currency, due_date, status FROM invoices WHERE id = ?')
    .bind(String(data['invoiceId'] ?? ''))
    .first<{
      number: string | null;
      total_minor: number;
      balance_minor: number;
      currency: string;
      due_date: string | null;
      status: string;
    }>();
  if (!row?.number) throw new Error('invoice not found or not numbered for email');
  const { invoiceId: _id, ...rest } = data;
  return {
    ...rest,
    number: row.number,
    total: formatMoney(row.total_minor, row.currency),
    balance: formatMoney(row.balance_minor, row.currency),
    dueDate: row.due_date ? formatLongDate(row.due_date) : '',
  };
};

/** Reminders: details as of sending, and a reminder for an invoice paid in the meantime is dropped. */
const reminderDetails: EmailResolver = async (ctx, data) => {
  const d = await invoiceDetails(ctx, data);
  const row = await ctx.db
    .prepare('SELECT status, balance_minor FROM invoices WHERE id = ?')
    .bind(String(data['invoiceId'] ?? ''))
    .first<{ status: string; balance_minor: number }>();
  if (!row || !['issued', 'partially_paid', 'overdue'].includes(row.status) || row.balance_minor <= 0)
    throw new SkipEmail('invoice no longer has a balance');
  const { total: _t, ...rest } = d;
  return { ...rest, overdue: row.status === 'overdue' };
};

const receiptDetails: EmailResolver = async (ctx, data) => {
  const row = await ctx.db
    .prepare(
      `SELECT p.receipt_number, p.amount_minor, p.currency, p.received_at, i.number AS invoice_number, i.balance_minor,
         (SELECT COALESCE(SUM(amount_minor), 0) FROM client_credits WHERE source_type = 'overpayment' AND source_id = p.id) AS credit
       FROM payments p JOIN payment_allocations a ON a.payment_id = p.id JOIN invoices i ON i.id = a.invoice_id
       WHERE p.id = ? ORDER BY a.created_at LIMIT 1`,
    )
    .bind(String(data['paymentId'] ?? ''))
    .first<{
      receipt_number: string;
      amount_minor: number;
      currency: string;
      received_at: string;
      invoice_number: string;
      balance_minor: number;
      credit: number;
    }>();
  if (!row) throw new Error('payment not found for email');
  const { paymentId: _id, ...rest } = data;
  return {
    ...rest,
    receiptNumber: row.receipt_number,
    amount: formatMoney(row.amount_minor, row.currency),
    receivedOn: formatLongDate(row.received_at),
    invoiceNumber: row.invoice_number,
    balance: formatMoney(row.balance_minor, row.currency),
    credit: row.credit > 0 ? formatMoney(row.credit, row.currency) : null,
  };
};

export const EMAIL_RESOLVERS: Record<string, EmailResolver> = {
  quotation_sent: quotationDetails,
  invoice_issued: invoiceDetails,
  invoice_reminder: reminderDetails,
  payment_receipt: receiptDetails,
  application_acknowledgement: applicationReference,
  enquiry_acknowledgement: enquiryReference,
  enquiry_admin: enquiryReference,
};
