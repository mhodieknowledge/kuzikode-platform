import type { RequestContext } from '../../context';
import { formatMoney } from '../../../shared/money';
import { formatLongDate } from '../../../shared/service-display';

/**
 * Some email data is only known after the business batch commits (e.g. gap-free references assigned in SQL).
 * A resolver loads it at send time from the IDs in the payload.
 */
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

export const EMAIL_RESOLVERS: Record<string, EmailResolver> = {
  quotation_sent: quotationDetails,
  application_acknowledgement: applicationReference,
  enquiry_acknowledgement: enquiryReference,
  enquiry_admin: enquiryReference,
};
