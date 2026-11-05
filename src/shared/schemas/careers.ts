import { z } from 'zod';
import { enquirySchema } from './enquiries';

export const EMPLOYMENT_TYPES = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  attachment: 'Industrial attachment',
} as const;
export const WORKPLACES = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' } as const;
export type EmploymentType = keyof typeof EMPLOYMENT_TYPES;
export type Workplace = keyof typeof WORKPLACES;

/** A posting's custom question (docs/12 §B.1): up to 5 per posting. */
export const customQuestionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]{1,40}$/),
    label: z.string().trim().min(1).max(200),
    type: z.enum(['short_text', 'long_text', 'yes_no', 'select']),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  })
  .strict();
export type CustomQuestion = z.output<typeof customQuestionSchema>;

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(v), 'Enter a full https:// address.');
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Application form (sent as the `data` field of a multipart form with `cv` and optional `coverLetterFile`). */
export const applicationSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name.').max(120),
    email: enquirySchema.shape.email,
    phone: enquirySchema.shape.phone,
    location: optionalText(120),
    linkedinUrl: optionalUrl,
    portfolioUrl: optionalUrl,
    coverLetter: optionalText(8000),
    answers: z.record(z.string().regex(/^[a-z0-9_]{1,40}$/), z.string().trim().max(4000)).default({}),
    noticePeriod: optionalText(120),
    salaryExpectation: optionalText(120),
    consent: z.literal(true, { error: 'Please agree to the privacy notice so we can consider your application.' }),
    turnstileToken: enquirySchema.shape.turnstileToken,
    website: enquirySchema.shape.website,
  })
  .strict();
export type ApplicationInput = z.input<typeof applicationSchema>;
