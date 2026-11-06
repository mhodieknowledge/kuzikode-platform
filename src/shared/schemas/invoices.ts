import { z } from 'zod';
import { MANUAL_PAYMENT_METHODS, type ManualPaymentMethod } from '../invoices';
import { discountSchema, quotationLineSchema } from './quotations';

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
  .transform((v) => (v ? v : null));

export const invoiceSchema = z
  .object({
    clientId: id('cli'),
    contactId: id('con').nullable().optional(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    /** Empty: set to the issue date when the invoice is issued. */
    issueDate: date,
    /** Empty: issue date + payment terms. */
    dueDate: date,
    paymentTermsDays: z.number().int().min(0).max(365).nullable().optional(),
    notes: optText(5000),
    terms: optText(5000),
    items: z.array(quotationLineSchema).min(1, 'Add at least one line.').max(100),
  })
  .extend(discountSchema.shape)
  .strict()
  .superRefine((v, ctx) => {
    if (v.discountType === 'percent' && v.discountValue > 10_000)
      ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Use at most 100%.' });
    if (v.issueDate && v.dueDate && v.dueDate < v.issueDate)
      ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'The due date is before the issue date.' });
    v.items.forEach((l, i) => {
      if (l.isRecurring)
        ctx.addIssue({
          code: 'custom',
          path: ['items', i, 'recurringInterval'],
          message: 'Invoices bill once. Set up recurring billing as a subscription.',
        });
    });
  });
export type InvoiceInput = z.output<typeof invoiceSchema>;

export const invoiceListQuery = z
  .object({
    status: z.enum(['open', 'all', 'draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void']).optional(),
    clientId: id('cli').optional(),
    q: z.string().max(80).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
  })
  .strict();

export const sendInvoiceSchema = z.object({ message: optText(2000) }).strict();

export const invoiceVoidSchema = z.object({ reason: z.string().trim().min(3, 'Give a reason.').max(500) }).strict();

export const manualPaymentSchema = z
  .object({
    amountMinor: z.number().int().min(1, 'Enter the amount received.').max(1e12),
    method: z.enum(MANUAL_PAYMENT_METHODS.map((m) => m.value) as [ManualPaymentMethod, ...ManualPaymentMethod[]]),
    receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-12-31.'),
    reference: optText(120),
    notes: optText(1000),
  })
  .strict();
export type ManualPaymentInput = z.output<typeof manualPaymentSchema>;

export const applyCreditSchema = z.object({ amountMinor: z.number().int().min(1).max(1e12) }).strict();

const quantity = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,3})?$/, 'Use a quantity with up to 3 decimal places.');

export const creditNoteSchema = z
  .object({
    reason: z.string().trim().min(3, 'Give a reason.').max(500),
    appliedTo: z.enum(['invoice', 'client_credit', 'refund']),
    lines: z
      .array(
        z.union([
          z.object({ invoiceItemId: id('iit'), quantity }).strict(),
          z
            .object({
              description: z.string().trim().min(2, 'Describe the adjustment.').max(500),
              amountMinor: z.number().int().min(1).max(1e12),
            })
            .strict(),
        ]),
      )
      .min(1, 'Choose what to credit.')
      .max(100),
  })
  .strict();
export type CreditNoteInput = z.output<typeof creditNoteSchema>;
