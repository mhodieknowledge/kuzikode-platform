/** Admin → Careers (P4.21, docs/12 §B.2): postings, the applicant pipeline and candidate email templates. */
import { z } from 'zod';
import { customQuestionSchema, EMPLOYMENT_TYPES, WORKPLACES } from './careers';

const text = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max);
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
const list = (max: number) => z.array(z.string().trim().min(1).max(300)).max(max).default([]);
/** ISO date-time or empty. */
const when = z.iso
  .datetime({ offset: true })
  .nullable()
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? new Date(v).toISOString() : null));

export const APPLICATION_STATUSES = [
  'new',
  'screening',
  'interview',
  'offer',
  'hired',
  'rejected',
  'withdrawn',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: 'New',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const postingSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2, 'Use at least 2 characters.')
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens.'),
    title: text(2, 120, 'Enter a job title.'),
    department: text(2, 80, 'Enter a department.'),
    location: text(2, 120, 'Enter a location.'),
    employmentType: z.enum(
      Object.keys(EMPLOYMENT_TYPES) as [keyof typeof EMPLOYMENT_TYPES, ...(keyof typeof EMPLOYMENT_TYPES)[]],
    ),
    workplace: z.enum(Object.keys(WORKPLACES) as [keyof typeof WORKPLACES, ...(keyof typeof WORKPLACES)[]]),
    salaryMinMinor: z
      .number()
      .int()
      .min(0)
      .max(1e12)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    salaryMaxMinor: z
      .number()
      .int()
      .min(0)
      .max(1e12)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    salaryCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    salaryPeriod: z
      .enum(['hour', 'month', 'year'])
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    showSalary: z.boolean().default(false),
    summary: text(10, 400, 'Write a short summary (at least 10 characters).'),
    description: z.string().max(50_000).default(''),
    responsibilities: list(20),
    requirements: list(20),
    niceToHaves: list(20),
    offer: list(20),
    howToApply: opt(2000),
    questions: z.array(customQuestionSchema).max(5, 'Ask at most 5 questions.').default([]),
    opensAt: when,
    closesAt: when,
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.salaryMinMinor != null && p.salaryMaxMinor != null && p.salaryMinMinor > p.salaryMaxMinor)
      ctx.addIssue({ code: 'custom', path: ['salaryMaxMinor'], message: 'The maximum is below the minimum.' });
    if ((p.salaryMinMinor != null || p.salaryMaxMinor != null) && (!p.salaryCurrency || !p.salaryPeriod))
      ctx.addIssue({
        code: 'custom',
        path: ['salaryCurrency'],
        message: 'Choose the currency and period for the salary.',
      });
    if (p.showSalary && p.salaryMinMinor == null && p.salaryMaxMinor == null)
      ctx.addIssue({ code: 'custom', path: ['showSalary'], message: 'Enter a salary range to show it.' });
    if (p.opensAt && p.closesAt && p.closesAt <= p.opensAt)
      ctx.addIssue({ code: 'custom', path: ['closesAt'], message: 'The closing date is before the opening date.' });
    const ids = p.questions.map((q) => q.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', path: ['questions'], message: 'Each question needs its own id.' });
    p.questions.forEach((q, i) => {
      if (q.type === 'select' && (!q.options || q.options.length < 2))
        ctx.addIssue({ code: 'custom', path: ['questions', i, 'options'], message: 'Give at least two choices.' });
    });
  });
export type PostingInput = z.output<typeof postingSchema>;

export const postingStatusSchema = z.object({ status: z.enum(['draft', 'open', 'closed', 'archived']) }).strict();

export const applicationListQuery = z.object({
  postingId: z
    .string()
    .regex(/^(job_[A-Za-z0-9_]+|general)$/)
    .optional(),
  status: z.enum([...APPLICATION_STATUSES, 'active', 'all']).optional(),
  assignee: z.string().max(60).optional(),
  tag: z.string().trim().max(40).optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type ApplicationListQuery = z.output<typeof applicationListQuery>;

export const applicationUpdateSchema = z
  .object({
    status: z.enum(APPLICATION_STATUSES).optional(),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    assignedTo: z
      .string()
      .regex(/^usr_[A-Za-z0-9_]+$/)
      .nullable()
      .optional(),
  })
  .strict();
export type ApplicationUpdate = z.output<typeof applicationUpdateSchema>;

export const applicationNoteSchema = z.object({ body: text(1, 4000, 'Write a note.') }).strict();

export const CANDIDATE_TEMPLATES = ['received', 'interview', 'regret', 'offer'] as const;
export type CandidateTemplate = (typeof CANDIDATE_TEMPLATES)[number];
export const CANDIDATE_TEMPLATE_LABELS: Record<CandidateTemplate, string> = {
  received: 'Application received',
  interview: 'Interview invitation',
  regret: 'Regret (not progressing)',
  offer: 'Offer',
};

export const candidateTemplateSchema = z
  .object({
    subject: text(3, 200, 'Enter a subject.'),
    body: text(10, 6000, 'Write the message.'),
  })
  .strict();
export const candidateTemplatesSchema = z
  .object(
    Object.fromEntries(CANDIDATE_TEMPLATES.map((k) => [k, candidateTemplateSchema])) as Record<
      CandidateTemplate,
      typeof candidateTemplateSchema
    >,
  )
  .strict();
export type CandidateTemplates = z.output<typeof candidateTemplatesSchema>;

/** Email one applicant: a template, optionally edited for this message. */
export const emailApplicantSchema = z
  .object({
    template: z.enum(CANDIDATE_TEMPLATES),
    subject: text(3, 200, 'Enter a subject.'),
    body: text(10, 6000, 'Write the message.'),
  })
  .strict();

export const bulkRejectSchema = z
  .object({
    ids: z
      .array(z.string().regex(/^app_[A-Za-z0-9_]+$/))
      .min(1, 'Choose at least one applicant.')
      .max(100),
    sendRegret: z.boolean().default(true),
  })
  .strict();
