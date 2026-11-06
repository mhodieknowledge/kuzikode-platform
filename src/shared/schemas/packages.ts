/** Admin → Packages & pricing (P4.19, docs/12 §A). */
import { z } from 'zod';

const text = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max);
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
const money = z.number().int().min(0).max(1e12);
const optMoney = money
  .nullable()
  .optional()
  .transform((v) => v ?? null);
const slug = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters.')
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens.');
const currency = z.string().regex(/^[A-Z]{3}$/, 'Choose a currency.');
const key = z
  .string()
  .trim()
  .max(60)
  .regex(/^[a-z0-9_]*$/, 'Use lowercase letters, numbers and underscores.')
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

export const PACKAGE_TABS = ['websites', 'care', 'email', 'other'] as const;
export const ADDON_UNITS = ['each', 'page', 'mailbox', 'month', 'year', 'hour'] as const;

export const packageFeatureSchema = z
  .object({
    label: text(1, 120, 'Name the feature.'),
    value: z.enum(['included', 'not_included', 'text']),
    text: opt(120),
    tooltip: opt(300),
    /** Rows with the same key line up in the /pricing comparison table. */
    key,
  })
  .strict()
  .superRefine((f, ctx) => {
    if (f.value === 'text' && !f.text) ctx.addIssue({ code: 'custom', path: ['text'], message: 'Enter the value.' });
  });

export const packageSchema = z
  .object({
    serviceId: z.string().regex(/^svc_[A-Za-z0-9_]+$/, 'Choose a service.'),
    slug,
    name: text(2, 120, 'Enter a name.'),
    tagline: opt(200),
    billingType: z.enum(['one_off', 'recurring']),
    interval: z
      .enum(['month', 'year'])
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    priceType: z.enum(['fixed', 'starting_from', 'custom_quote']),
    priceMinor: optMoney,
    currency: currency
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    priceUnit: opt(40),
    altPriceZwgMinor: optMoney,
    annualPriceMinor: optMoney,
    minQuantity: z.number().int().min(1).max(10_000).default(1),
    deliveryTime: opt(60),
    revisionRounds: opt(60),
    supportPeriod: opt(60),
    mostPopular: z.boolean().default(false),
    tab: z.enum(PACKAGE_TABS),
    status: z.enum(['active', 'coming_soon', 'inactive']),
    costNote: opt(1000),
    features: z.array(packageFeatureSchema).max(40).default([]),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.priceType !== 'custom_quote') {
      if (p.priceMinor == null) ctx.addIssue({ code: 'custom', path: ['priceMinor'], message: 'Enter a price.' });
      if (!p.currency) ctx.addIssue({ code: 'custom', path: ['currency'], message: 'Choose a currency.' });
    }
    if (p.billingType === 'recurring' && !p.interval)
      ctx.addIssue({ code: 'custom', path: ['interval'], message: 'Choose monthly or yearly.' });
    if (p.annualPriceMinor != null && !(p.billingType === 'recurring' && p.interval === 'month'))
      ctx.addIssue({
        code: 'custom',
        path: ['annualPriceMinor'],
        message: 'An annual price only applies to monthly plans.',
      });
  })
  .transform((p) => ({
    ...p,
    interval: p.billingType === 'recurring' ? p.interval : null,
    priceMinor: p.priceType === 'custom_quote' ? null : p.priceMinor,
    currency: p.priceType === 'custom_quote' ? null : p.currency,
    altPriceZwgMinor: p.priceType === 'custom_quote' ? null : p.altPriceZwgMinor,
  }));
export type PackageInput = z.output<typeof packageSchema>;
export type PackageFeatureInput = z.output<typeof packageFeatureSchema>;

export const addonSchema = z
  .object({
    /** null = a global add-on offered with every package. */
    packageId: z
      .string()
      .regex(/^pkg_[A-Za-z0-9_]+$/)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    name: text(2, 120, 'Enter a name.'),
    description: opt(300),
    priceMinor: money,
    currency,
    unit: z.enum(ADDON_UNITS),
    billingType: z.enum(['one_off', 'recurring']),
    active: z.boolean().default(true),
  })
  .strict();
export type AddonInput = z.output<typeof addonSchema>;

export const packageOrderSchema = z
  .object({ tab: z.enum(PACKAGE_TABS), ids: z.array(z.string().regex(/^pkg_[A-Za-z0-9_]+$/)).max(200) })
  .strict();

/** "Add package" in the quotation editor: which add-ons, how many, in which currency. */
export const packageLinesSchema = z
  .object({
    currency,
    quantity: z.number().int().min(1).max(10_000).optional(),
    addons: z
      .array(
        z
          .object({ id: z.string().regex(/^pad_[A-Za-z0-9_]+$/), quantity: z.number().int().min(1).max(10_000) })
          .strict(),
      )
      .max(20)
      .default([]),
  })
  .strict();
export type PackageLinesInput = z.output<typeof packageLinesSchema>;
