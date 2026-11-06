import { z } from 'zod';

const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9_]+$`));
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-12-31.');
const blank = (v: unknown) => (v === '' ? undefined : v);

export const EXPENSE_PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'ecocash', label: 'EcoCash' },
  { value: 'onemoney', label: 'OneMoney' },
  { value: 'innbucks', label: 'InnBucks' },
  { value: 'other', label: 'Other' },
] as const;
type Method = (typeof EXPENSE_PAYMENT_METHODS)[number]['value'];

export const expenseSchema = z
  .object({
    categoryId: id('exc'),
    expenseDate: date,
    vendor: optText(200),
    description: z.string().trim().min(2, 'Describe the expense.').max(500),
    amountMinor: z.number().int().min(1, 'Enter the amount.').max(1e12),
    currency: z.string().regex(/^[A-Z]{3}$/),
    paymentMethod: z
      .enum(EXPENSE_PAYMENT_METHODS.map((m) => m.value) as [Method, ...Method[]])
      .nullable()
      .optional(),
    reference: optText(120),
    projectId: id('prj').nullable().optional(),
    clientId: id('cli').nullable().optional(),
    notes: optText(2000),
  })
  .strict();
export type ExpenseInput = z.output<typeof expenseSchema>;

export const expenseListQuery = z
  .object({
    status: z.preprocess(blank, z.enum(['recorded', 'void', 'all']).optional()),
    categoryId: z.preprocess(blank, id('exc').optional()),
    currency: z.preprocess(
      blank,
      z
        .string()
        .regex(/^[A-Z]{3}$/)
        .optional(),
    ),
    projectId: z.preprocess(blank, id('prj').optional()),
    clientId: z.preprocess(blank, id('cli').optional()),
    from: z.preprocess(blank, date.optional()),
    to: z.preprocess(blank, date.optional()),
    q: z.string().max(80).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
  })
  .strict();
export type ExpenseListQuery = z.output<typeof expenseListQuery>;

export const expenseReportQuery = z
  .object({ from: z.preprocess(blank, date.optional()), to: z.preprocess(blank, date.optional()) })
  .strict();

export const expenseVoidSchema = z.object({ reason: z.string().trim().min(3, 'Give a reason.').max(500) }).strict();

export const categorySchema = z
  .object({
    name: z.string().trim().min(2, 'Name the category.').max(80),
    description: optText(300),
    active: z.boolean().default(true),
  })
  .strict();
