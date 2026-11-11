import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-12-31.');
const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);

export const PAYMENT_STATUSES = ['completed', 'partially_refunded', 'refunded', 'reversed'] as const;

export const paymentListQuery = z
  .object({
    status: z.preprocess(blankToUndefined, z.enum(PAYMENT_STATUSES).optional()),
    provider: z.preprocess(
      blankToUndefined,
      z
        .string()
        .regex(/^[a-z_]{2,30}$/)
        .optional(),
    ),
    method: z.preprocess(
      blankToUndefined,
      z
        .string()
        .regex(/^[a-z_]{2,30}$/)
        .optional(),
    ),
    currency: z.preprocess(
      blankToUndefined,
      z
        .string()
        .regex(/^[A-Z]{3}$/)
        .optional(),
    ),
    clientId: z.preprocess(
      blankToUndefined,
      z
        .string()
        .regex(/^cli_[A-Za-z0-9_]+$/)
        .optional(),
    ),
    from: z.preprocess(blankToUndefined, date.optional()),
    to: z.preprocess(blankToUndefined, date.optional()),
    q: z.string().max(80).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
  })
  .strict();
export type PaymentListQuery = z.output<typeof paymentListQuery>;

export const refundSchema = z
  .object({
    amountMinor: z.number().int().min(1, 'Enter the amount refunded.').max(1e12),
    reason: z.string().trim().min(3, 'Give a reason.').max(500),
    /** What covers the refund in the books: a credit note "to be refunded", or the client's account credit. */
    source: z.enum(['credit_note', 'account_credit']),
    creditNoteId: z
      .string()
      .regex(/^crn_[A-Za-z0-9_]+$/)
      .nullable()
      .optional(),
    reference: z
      .string()
      .trim()
      .max(120)
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.source === 'credit_note' && !r.creditNoteId)
      ctx.addIssue({ code: 'custom', path: ['creditNoteId'], message: 'Choose the credit note this refund settles.' });
  });
export type RefundInput = z.output<typeof refundSchema>;

/** Starting an online payment (portal and public invoice link). */
export const payInvoiceSchema = z
  .object({
    methodCode: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/, 'Choose a payment method.'),
    phone: z.string().trim().max(24).optional(),
  })
  .strict();
export type PayInvoiceInput = z.infer<typeof payInvoiceSchema>;

/** The public invoice link also needs the Turnstile check (docs/06 §3b). */
export const publicPayInvoiceSchema = payInvoiceSchema.extend({ turnstileToken: z.string().min(1).max(2048) }).strict();

export const attemptOtpSchema = z
  .object({ otp: z.string().regex(/^\d{4,8}$/, 'Enter the code from your phone.') })
  .strict();

/** One per click, so a double-tap never starts two payments. */
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;
