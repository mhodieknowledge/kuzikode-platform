import { z } from 'zod';
import { CMS_ICONS } from '../icons';

const text = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max);
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));
const slug = z
  .string()
  .trim()
  .min(2, 'Use at least 2 characters.')
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens.');
const status = z.enum(['active', 'coming_soon', 'inactive']);

export const categorySchema = z
  .object({
    slug,
    name: text(2, 120, 'Enter a name.'),
    summary: text(10, 300, 'Write a short summary (at least 10 characters).'),
    description: z.string().max(50_000).default(''),
    benefits: z
      .array(
        z.object({ title: text(1, 120, 'Give the benefit a title.'), body: text(1, 400, 'Describe it.') }).strict(),
      )
      .max(12)
      .default([]),
    deliverables: z
      .array(text(1, 200, 'Enter the deliverable.'))
      .max(20)
      .default([]),
    faq: z
      .array(z.object({ q: text(3, 200, 'Enter the question.'), a: text(3, 2000, 'Enter the answer.') }).strict())
      .max(20)
      .default([]),
    icon: z
      .enum(CMS_ICONS)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    status,
    featured: z.boolean().default(false),
    seoTitle: opt(70),
    seoDescription: opt(170),
  })
  .strict();
export type CategoryInput = z.output<typeof categorySchema>;

export const serviceSchema = z
  .object({
    categoryId: z.string().regex(/^scat_[A-Za-z0-9_]+$/, 'Choose a division.'),
    slug,
    name: text(2, 120, 'Enter a name.'),
    summary: text(10, 300, 'Write a short summary (at least 10 characters).'),
    description: z.string().max(50_000).default(''),
    pricingModel: z.enum(['fixed', 'hourly', 'starting_from', 'custom_quote']),
    priceMinor: z.number().int().min(0).max(1e12).nullable().optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable()
      .optional(),
    status,
    featured: z.boolean().default(false),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.pricingModel !== 'custom_quote') {
      if (v.priceMinor == null) ctx.addIssue({ code: 'custom', path: ['priceMinor'], message: 'Enter a price.' });
      if (!v.currency) ctx.addIssue({ code: 'custom', path: ['currency'], message: 'Choose a currency.' });
    }
  });
export type ServiceInput = z.output<typeof serviceSchema>;

export const reorderSchema = z
  .object({
    ids: z
      .array(z.string().regex(/^[a-z]{3,4}_[A-Za-z0-9_]+$/))
      .min(1)
      .max(200),
  })
  .strict();
