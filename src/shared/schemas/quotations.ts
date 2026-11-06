import { z } from 'zod';
import { parseQuantityMilli } from '../money';

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

export const discountSchema = z.object({
  discountType: z.enum(['none', 'percent', 'amount']).default('none'),
  /** percent → basis points (1000 = 10%), amount → minor units. */
  discountValue: z.number().int().min(0).max(1e12).default(0),
});

export const quotationLineSchema = z
  .object({
    serviceId: id('svc').nullable().optional(),
    packageId: id('pkg').nullable().optional(),
    description: z.string().trim().min(1, 'Describe the item.').max(2000),
    /** Decimal string with up to 3 decimal places, e.g. "1", "2.5". */
    quantity: z
      .string()
      .trim()
      .refine((q) => {
        try {
          return parseQuantityMilli(q) > 0;
        } catch {
          return false;
        }
      }, 'Use a quantity above 0 with up to 3 decimal places.'),
    unitPriceMinor: z.number().int().min(0).max(1e12),
    taxRateId: id('tax').nullable().optional(),
    isRecurring: z.boolean().default(false),
    recurringInterval: z.enum(['month', 'year']).nullable().optional(),
  })
  .extend(discountSchema.shape)
  .strict()
  .superRefine((l, ctx) => {
    if (l.discountType === 'percent' && l.discountValue > 10_000)
      ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Use at most 100%.' });
    if (l.isRecurring && !l.recurringInterval)
      ctx.addIssue({ code: 'custom', path: ['recurringInterval'], message: 'Choose monthly or yearly.' });
  });
export type QuotationLineInput = z.output<typeof quotationLineSchema>;

export const quotationSchema = z
  .object({
    clientId: id('cli'),
    contactId: id('con').nullable().optional(),
    leadId: id('led').nullable().optional(),
    enquiryId: id('enq').nullable().optional(),
    title: z.string().trim().min(2, 'Give the quotation a title.').max(200),
    introHtml: z.string().max(50_000).default(''),
    currency: z.string().regex(/^[A-Z]{3}$/),
    validUntil: date,
    paymentTerms: optText(500),
    notes: optText(5000),
    terms: optText(5000),
    items: z.array(quotationLineSchema).min(1, 'Add at least one line.').max(100),
  })
  .extend(discountSchema.shape)
  .strict()
  .superRefine((q, ctx) => {
    if (q.discountType === 'percent' && q.discountValue > 10_000)
      ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Use at most 100%.' });
  });
export type QuotationInput = z.output<typeof quotationSchema>;

export const quotationListQuery = z
  .object({
    status: z.enum(['open', 'all', 'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'void']).optional(),
    clientId: id('cli').optional(),
    q: z.string().max(80).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
  })
  .strict();

export const sendQuotationSchema = z
  .object({ to: z.array(z.email()).max(5).optional(), message: optText(2000) })
  .strict();

export const respondSchema = z
  .object({
    decision: z.enum(['accept', 'reject']),
    name: z.string().trim().max(120).optional(),
    agree: z.boolean().optional(),
    reason: optText(1000),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.decision === 'accept') {
      if (!r.name || r.name.length < 2)
        ctx.addIssue({ code: 'custom', path: ['name'], message: 'Type your full name.' });
      if (r.agree !== true)
        ctx.addIssue({ code: 'custom', path: ['agree'], message: 'Tick the box to confirm you accept.' });
    }
  });

export const voidSchema = z.object({ reason: z.string().trim().min(3, 'Give a reason.').max(500) }).strict();
