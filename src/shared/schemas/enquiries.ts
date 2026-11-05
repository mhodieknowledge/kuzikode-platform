import { z } from 'zod';

export const GENERAL_CATEGORIES = [
  { value: 'general', label: 'General question' },
  { value: 'project_quotation', label: 'Project quotation' },
  { value: 'support', label: 'Support' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'product_interest', label: 'Product interest' },
  { value: 'consultation', label: 'Consultation request' },
] as const;

export const BUDGET_RANGES = [
  'Under $500',
  '$500 – $1,500',
  '$1,500 – $5,000',
  '$5,000 – $15,000',
  'Over $15,000',
  'Not sure yet',
] as const;

const slug = z
  .string()
  .trim()
  .max(80)
  .regex(/^[a-z0-9-]+$/);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const enquirySchema = z
  .object({
    kind: z.enum(['contact', 'product_interest', 'consultation']).default('contact'),
    name: z.string().trim().min(2, 'Enter your name.').max(120),
    email: z
      .string()
      .trim()
      .max(254)
      .pipe(z.email('Enter a valid email address.'))
      .transform((e) => e.toLowerCase()),
    phone: optionalText(40).refine((v) => !v || /^[+\d][\d\s()-]{6,}$/.test(v), 'Enter a valid phone number.'),
    organisation: optionalText(160),
    category: z
      .string()
      .trim()
      .min(1, 'Choose a category.')
      .max(80)
      .regex(/^[a-z0-9_-]+$/),
    service: slug.optional().or(z.literal('').transform(() => undefined)),
    product: slug.optional().or(z.literal('').transform(() => undefined)),
    budgetRange: z
      .enum(BUDGET_RANGES)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    preferredTimes: z.array(z.string().trim().max(80)).max(3).optional(),
    message: z.string().trim().min(10, 'Tell us a little more (at least 10 characters).').max(5000),
    consent: z.literal(true, { error: 'Please agree to the privacy policy so we can reply.' }),
    turnstileToken: z.string().max(2048).optional(),
    /** Honeypot: humans never see or fill this field. */
    website: z.string().max(500).optional(),
  })
  .strict();
export type EnquiryInput = z.input<typeof enquirySchema>;
