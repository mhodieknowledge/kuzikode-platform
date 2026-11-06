/** Subscriptions & the managed-services register (P4.20, docs/12 §A.3–A.4). */
import { z } from 'zod';
import { parseQuantityMilli } from '../money';

const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9_]+$`));
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-12-31.');
const optDate = date
  .nullable()
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? v : null));

export const SUBSCRIPTION_STATUSES = ['active', 'at_risk', 'paused', 'cancelled', 'ended'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const subscriptionSchema = z
  .object({
    clientId: id('cli'),
    packageId: id('pkg')
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    description: z.string().trim().min(2, 'Describe what is billed.').max(300),
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
    currency: z.string().regex(/^[A-Z]{3}$/, 'Choose a currency.'),
    taxRateId: id('tax')
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    interval: z.enum(['month', 'year']),
    startDate: date,
    /** The first period this subscription bills. Defaults to the start date. */
    nextBillingDate: optDate,
    autoIssue: z.boolean().default(false),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.nextBillingDate && v.nextBillingDate < v.startDate)
      ctx.addIssue({ code: 'custom', path: ['nextBillingDate'], message: 'Use a date on or after the start date.' });
  });
export type SubscriptionInput = z.output<typeof subscriptionSchema>;

export const subscriptionListQuery = z.object({
  status: z.enum([...SUBSCRIPTION_STATUSES, 'open', 'all']).optional(),
  clientId: id('cli').optional(),
  /** Next billing on or before this date. */
  dueBy: date.optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type SubscriptionListQuery = z.output<typeof subscriptionListQuery>;

export const cancelSubscriptionSchema = z
  .object({
    reason: z.string().trim().min(3, 'Give a reason.').max(500),
    /** Cancel from this date (default today). Periods starting on or after it are not billed. */
    effectiveDate: optDate,
  })
  .strict();

export const ASSET_TYPES = ['domain', 'hosting', 'email_tenant', 'ssl', 'app_store_account', 'other'] as const;
export const ASSET_STATUSES = ['active', 'expired', 'cancelled', 'transferred'] as const;

export const assetSchema = z
  .object({
    clientId: id('cli'),
    type: z.enum(ASSET_TYPES),
    name: z.string().trim().min(2, 'Enter a name, e.g. example.co.zw.').max(200),
    provider: opt(120),
    subscriptionId: id('sub')
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    renewalDate: optDate,
    autoRenew: z.boolean().default(false),
    billableToClient: z.boolean().default(true),
    costNote: opt(500),
    /** Where credentials live. Never a password itself. */
    credentialsNote: opt(300),
    status: z.enum(ASSET_STATUSES).default('active'),
  })
  .strict()
  .superRefine((v, ctx) => {
    // A last line of defence against pasted secrets: the note says WHERE credentials are kept, never what they are.
    if (v.credentialsNote && /(pass(word)?|pwd|pin)\s*[:=]\s*\S+/i.test(v.credentialsNote))
      ctx.addIssue({
        code: 'custom',
        path: ['credentialsNote'],
        message: 'Never store passwords here. Say where they are kept, e.g. "in the owner\'s password manager".',
      });
  });
export type AssetInput = z.output<typeof assetSchema>;

export const assetListQuery = z.object({
  type: z.enum(ASSET_TYPES).optional(),
  status: z.enum([...ASSET_STATUSES, 'all']).optional(),
  clientId: id('cli').optional(),
  /** Renewal on or before this date. */
  renewBy: date.optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type AssetListQuery = z.output<typeof assetListQuery>;
