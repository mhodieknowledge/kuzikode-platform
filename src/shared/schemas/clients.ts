import { z } from 'zod';

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .optional()
    .transform((v) => (v ? v : undefined));
const optEmail = opt(254).refine((v) => !v || z.email().safeParse(v).success, 'Enter a valid email address.');
const optPhone = opt(40).refine((v) => !v || /^[+\d][\d\s()-]{6,}$/.test(v), 'Enter a valid phone number.');

export const addressSchema = z
  .object({
    line1: opt(160),
    line2: opt(160),
    city: opt(80),
    region: opt(80),
    postalCode: opt(20),
    country: opt(80),
  })
  .strict();
export type Address = z.output<typeof addressSchema>;

export const clientSchema = z
  .object({
    type: z.enum(['individual', 'business']),
    displayName: z.string().trim().min(1, 'Enter a name.').max(200),
    legalName: opt(200),
    email: optEmail,
    phone: optPhone,
    website: opt(300).refine((v) => !v || /^https?:\/\/\S+\.\S+$/.test(v), 'Use a full web address.'),
    taxNumber: opt(60),
    billingAddress: addressSchema.optional(),
    physicalAddress: addressSchema.optional(),
    defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
    paymentTermsDays: z.coerce.number().int().min(0).max(365),
    notes: opt(5000),
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(30)
          .regex(/^[\p{L}\p{N} &_-]+$/u, 'Tags use letters, numbers, spaces, & _ -.'),
      )
      .max(10)
      .default([]),
  })
  .strict();
export type ClientInput = z.input<typeof clientSchema>;

export const contactSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name.').max(120),
    email: optEmail,
    phone: optPhone,
    jobTitle: opt(120),
    isPrimary: z.boolean().default(false),
    isBilling: z.boolean().default(false),
  })
  .strict();

export const noteSchema = z.object({ body: z.string().trim().min(1, 'Write a note.').max(5000) }).strict();

export const portalInviteSchema = z
  .object({
    contactId: z.string().regex(/^con_[A-Za-z0-9]+$/),
    role: z.enum(['owner', 'member', 'billing']).default('member'),
  })
  .strict();

export const clientListQuery = z
  .object({
    q: z.string().max(80).optional(),
    status: z.enum(['active', 'archived', 'all']).default('active'),
    tag: z.string().max(30).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
  })
  .strict();
