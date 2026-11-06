/** Admin → Content (P4.22, docs/12 §C.3/§C.4/§C.6/§C.7/§C.11): insights, industries, FAQ, testimonials, technologies. */
import { z } from 'zod';
import { CMS_ICONS } from '../icons';

const optText = (max: number) =>
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
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens, like online-shop.');
const optId = (prefix: string) =>
  z
    .string()
    .regex(new RegExp(`^(?:${prefix})_[A-Za-z0-9_]+$`))
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : null));
const dateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z?$/, 'Use a date and time.')
  .nullable()
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? (v.endsWith('Z') ? v : `${v.length === 16 ? `${v}:00` : v}Z`) : null));
const sortOrder = z.number().int().min(0).max(10_000).default(0);

export const POST_STATUSES = ['draft', 'scheduled', 'published'] as const;

export const postSchema = z
  .object({
    slug,
    title: z.string().trim().min(3).max(140),
    excerpt: z.string().trim().min(10).max(300),
    body: z.string().trim().min(1, 'Write the article.').max(100_000),
    coverMediaId: optId('med'),
    categoryId: optId('pct|pcat'),
    tags: z.array(z.string().trim().min(2).max(40)).max(10).default([]),
    authorDisplayName: z.string().trim().min(2).max(80),
    status: z.enum(POST_STATUSES),
    publishAt: dateTime,
    seoTitle: optText(70),
    seoDescription: optText(170),
  })
  .strict();
export type PostInput = z.infer<typeof postSchema>;

export const postCategorySchema = z.object({ slug, name: z.string().trim().min(2).max(60), sortOrder }).strict();
export type PostCategoryInput = z.infer<typeof postCategorySchema>;

export const industrySchema = z
  .object({
    slug,
    name: z.string().trim().min(2).max(80),
    summary: z.string().trim().min(10).max(300),
    challenges: z
      .array(z.object({ title: z.string().trim().min(2).max(100), body: z.string().trim().min(5).max(400) }).strict())
      .max(8)
      .default([]),
    body: optText(20_000),
    icon: z
      .enum(CMS_ICONS)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    status: z.enum(['draft', 'published']),
    sortOrder,
    serviceIds: z
      .array(z.string().regex(/^svc_[A-Za-z0-9_]+$/))
      .max(40)
      .default([]),
    seoTitle: optText(70),
    seoDescription: optText(170),
  })
  .strict();
export type IndustryInput = z.infer<typeof industrySchema>;

export const FAQ_CATEGORY_KEYS = ['general', 'pricing', 'projects', 'support', 'careers'] as const;

export const faqSchema = z
  .object({
    category: z.enum(FAQ_CATEGORY_KEYS),
    question: z.string().trim().min(5).max(200),
    answer: z.string().trim().min(5).max(2000),
    serviceId: optId('svc'),
    sortOrder,
    published: z.boolean().default(true),
  })
  .strict();
export type FaqInput = z.infer<typeof faqSchema>;

/** Testimonials must be real: linked to a client record, with recorded consent and its date (docs/12 §C.7). */
export const testimonialSchema = z
  .object({
    clientId: z.string().regex(/^cli_[A-Za-z0-9_]+$/, 'Choose the client this testimonial came from.'),
    projectId: optId('prj'),
    authorName: z.string().trim().min(2).max(100),
    authorRole: optText(100),
    quote: z.string().trim().min(10).max(800),
    consentObtained: z.literal(true, { message: 'Record that the client agreed to publication.' }),
    consentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date consent was given.'),
    published: z.boolean().default(false),
    sortOrder,
  })
  .strict();
export type TestimonialInput = z.infer<typeof testimonialSchema>;

export const technologySchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    category: z.string().trim().min(2).max(40),
    logoSvgPath: z
      .string()
      .trim()
      .regex(/^\/[a-z0-9/_.-]+\.svg$/i, 'Use a site path to an SVG file, like /tech/react.svg.')
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? v : null)),
    sortOrder,
    published: z.boolean().default(true),
  })
  .strict();
export type TechnologyInput = z.infer<typeof technologySchema>;

export const NEWSLETTER_STATUSES = ['pending', 'confirmed', 'unsubscribed'] as const;
export const newsletterFilterSchema = z.object({
  status: z.enum(NEWSLETTER_STATUSES).optional().catch(undefined),
  q: z.string().trim().max(120).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
export type NewsletterFilter = z.infer<typeof newsletterFilterSchema>;
