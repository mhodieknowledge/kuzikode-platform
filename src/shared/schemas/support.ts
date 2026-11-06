import { z } from 'zod';
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, SUPPORT_STATUSES, type SupportCategory } from '../support';

const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9_]+$`));
const blank = (v: unknown) => (v === '' ? undefined : v);

export const newSupportSchema = z
  .object({
    clientId: id('cli'),
    subject: z.string().trim().min(3, 'Give the request a subject.').max(200),
    category: z
      .enum(SUPPORT_CATEGORIES.map((c) => c.value) as [SupportCategory, ...SupportCategory[]])
      .default('general'),
    priority: z.enum(SUPPORT_PRIORITIES).default('normal'),
    projectId: id('prj').nullable().optional(),
    assignedTo: id('usr').nullable().optional(),
    body: z.string().trim().min(2, 'Describe the request.').max(10_000),
  })
  .strict();
export type NewSupportInput = z.output<typeof newSupportSchema>;

export const supportReplySchema = z
  .object({
    body: z.string().trim().min(1, 'Write a reply.').max(10_000),
    internal: z.boolean().default(false),
    /** Status after the reply; a client-facing reply defaults to "waiting for the client". */
    status: z.enum(SUPPORT_STATUSES).optional(),
  })
  .strict();
export type SupportReplyInput = z.output<typeof supportReplySchema>;

export const supportUpdateSchema = z
  .object({
    status: z.enum(SUPPORT_STATUSES).optional(),
    priority: z.enum(SUPPORT_PRIORITIES).optional(),
    assignedTo: id('usr').nullable().optional(),
  })
  .strict();

export const supportListQuery = z
  .object({
    status: z.preprocess(blank, z.enum(['active', 'all', ...SUPPORT_STATUSES]).optional()),
    priority: z.preprocess(blank, z.enum(SUPPORT_PRIORITIES).optional()),
    assignee: z.preprocess(blank, z.union([z.literal('me'), z.literal('none'), id('usr')]).optional()),
    clientId: z.preprocess(blank, id('cli').optional()),
    q: z.string().max(80).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
  })
  .strict();
export type SupportListQuery = z.output<typeof supportListQuery>;
