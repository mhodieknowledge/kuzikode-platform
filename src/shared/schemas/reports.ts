/** Reports, audit log viewer and data export (P4.18, PRD §4.2 K/L). */
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const REPORT_KEYS = [
  'revenue_month',
  'revenue_client',
  'revenue_service',
  'ageing',
  'conversion',
  'expenses',
  'profit',
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export const reportRangeQuery = z.object({
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
});

export const reportExportQuery = reportRangeQuery.extend({ report: z.enum(REPORT_KEYS) });

export const auditQuery = z.object({
  actor: z
    .string()
    .regex(/^usr_[A-Za-z0-9_]+$/)
    .optional()
    .catch(undefined),
  entityType: z
    .string()
    .regex(/^[a-z_]{2,40}$/)
    .optional()
    .catch(undefined),
  entityId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{2,80}$/)
    .optional()
    .catch(undefined),
  action: z
    .string()
    .regex(/^[a-z_.]{2,60}$/)
    .optional()
    .catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
export type AuditQuery = z.infer<typeof auditQuery>;

export const AGEING_BUCKETS = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'] as const;
export type AgeingBucket = (typeof AGEING_BUCKETS)[number];
export const AGEING_LABEL: Record<AgeingBucket, string> = {
  current: 'Not yet due',
  d1_30: '1–30 days overdue',
  d31_60: '31–60 days',
  d61_90: '61–90 days',
  d90_plus: 'Over 90 days',
};
