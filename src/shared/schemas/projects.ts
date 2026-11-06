import { z } from 'zod';
import { MILESTONE_STATUSES, PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES } from '../projects';

const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9_]+$`));
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-12-31.')
  .nullable()
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? v : null));

export const projectSchema = z
  .object({
    clientId: id('cli'),
    name: z.string().trim().min(2, 'Name the project.').max(200),
    description: optText(5000),
    status: z.enum(PROJECT_STATUSES).default('planning'),
    startDate: date,
    targetDate: date,
    budgetMinor: z.number().int().min(0).max(1e12).nullable().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .optional(),
    leadId: id('usr').nullable().optional(),
    memberIds: z.array(id('usr')).max(50).default([]),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.startDate && p.targetDate && p.targetDate < p.startDate)
      ctx.addIssue({ code: 'custom', path: ['targetDate'], message: 'The target date is before the start date.' });
    if (p.budgetMinor != null && !p.currency)
      ctx.addIssue({ code: 'custom', path: ['currency'], message: 'Choose the budget currency.' });
  });
export type ProjectInput = z.output<typeof projectSchema>;

export const projectSettingsSchema = z
  .object({
    progressMode: z.enum(['auto', 'manual']),
    progressPct: z.number().int().min(0).max(100).optional(),
    internalNotes: optText(10_000),
  })
  .strict();

export const projectListQuery = z
  .object({
    status: z.enum(['open', 'all', ...PROJECT_STATUSES]).optional(),
    clientId: id('cli').optional(),
    q: z.string().max(80).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
  })
  .strict();

export const milestoneSchema = z
  .object({
    title: z.string().trim().min(2, 'Give the milestone a title.').max(200),
    description: optText(2000),
    dueDate: date,
    status: z.enum(MILESTONE_STATUSES).default('pending'),
    clientVisible: z.boolean().default(true),
    invoiceId: id('inv').nullable().optional(),
  })
  .strict();

export const taskSchema = z
  .object({
    title: z.string().trim().min(2, 'Give the task a title.').max(200),
    description: optText(5000),
    milestoneId: id('mil').nullable().optional(),
    assigneeId: id('usr').nullable().optional(),
    status: z.enum(TASK_STATUSES).default('todo'),
    priority: z.enum(TASK_PRIORITIES).default('normal'),
    dueDate: date,
  })
  .strict();

export const taskMoveSchema = z.object({ status: z.enum(TASK_STATUSES) }).strict();

export const updateSchema = z
  .object({
    body: z.string().trim().min(2, 'Write the update.').max(5000),
    visibility: z.enum(['internal', 'client']),
  })
  .strict();

export const messageSchema = z.object({ body: z.string().trim().min(1, 'Write a message.').max(5000) }).strict();

export const fileMetaSchema = z
  .object({
    label: z.string().trim().min(1, 'Label the file.').max(200),
    kind: z.enum(['deliverable', 'attachment', 'internal']),
    clientVisible: z.boolean(),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (f.kind === 'internal' && f.clientVisible)
      ctx.addIssue({
        code: 'custom',
        path: ['clientVisible'],
        message: 'Internal files are never shown to the client.',
      });
  });
