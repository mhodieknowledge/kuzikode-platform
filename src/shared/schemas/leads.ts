import { z } from 'zod';

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-30.')
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

export const leadSchema = z
  .object({
    title: z.string().trim().min(2, 'Give the lead a title.').max(160),
    source: z.enum(['website', 'referral', 'manual', 'social', 'other']),
    status: z.enum(['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost']),
    contactName: opt(120),
    email: opt(254).refine((v) => !v || z.email().safeParse(v).success, 'Enter a valid email address.'),
    phone: opt(40).refine((v) => !v || /^[+\d][\d\s()-]{6,}$/.test(v), 'Enter a valid phone number.'),
    organisation: opt(160),
    assignedTo: z
      .string()
      .regex(/^usr_[A-Za-z0-9_]+$/)
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
    estimatedValueMinor: z.number().int().min(0).max(1e12).nullable().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .optional(),
    nextFollowUpOn: date,
    lostReason: opt(300),
    notes: opt(5000),
    serviceIds: z
      .array(z.string().regex(/^svc_[A-Za-z0-9_]+$/))
      .max(20)
      .default([]),
  })
  .strict();

export const activitySchema = z
  .object({
    type: z.enum(['note', 'call', 'email', 'meeting', 'follow_up']),
    body: z.string().trim().min(1, 'Write something.').max(5000),
    dueOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();

export const enquiryListQuery = z
  .object({
    status: z.enum(['new', 'triaged', 'spam', 'closed', 'all']).optional(),
    kind: z.enum(['contact', 'wizard', 'consultation', 'product_interest']).optional(),
    q: z.string().max(80).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
  })
  .strict();

export const leadListQuery = z
  .object({
    status: z.enum(['open', 'all', 'new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost']).optional(),
    assigned: z.enum(['me', 'none', 'any']).optional(),
    q: z.string().max(80).optional(),
    due: z.enum(['1']).optional(),
    view: z.enum(['list', 'board']).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
  })
  .strict();
