import type { RequestContext } from '../../context';

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

export const EMAIL_RESOLVERS: Record<string, EmailResolver> = {
  application_acknowledgement: applicationReference,
  enquiry_acknowledgement: enquiryReference,
  enquiry_admin: enquiryReference,
};
