import { z } from 'zod';

/** Internal path (`/contact`) or absolute http(s) URL. */
export const linkHref = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) =>
      (v.startsWith('/') && !v.startsWith('//')) ||
      /^https?:\/\//.test(v) ||
      v.startsWith('mailto:') ||
      v.startsWith('#'),
    'Use a site path like /contact or a full https:// address.',
  );

export const ctaSchema = z.object({ label: z.string().min(1).max(60), href: linkHref }).strict();

const text = (max: number) => z.string().trim().max(max);

export const SECTION_SCHEMAS = {
  hero: z
    .object({
      eyebrow: text(80).optional(),
      title: text(120).min(1),
      body: text(400),
      primaryCta: ctaSchema,
      secondaryCta: ctaSchema.optional(),
    })
    .strict(),
  services_grid: z.object({ title: text(120).min(1), intro: text(400).optional() }).strict(),
  features: z
    .object({
      title: text(120).min(1),
      intro: text(400).optional(),
      items: z.array(z.object({ icon: text(40).optional(), title: text(80).min(1), body: text(300) }).strict()).max(8),
    })
    .strict(),
  work_grid: z.object({ title: text(120).min(1), intro: text(400).optional() }).strict(),
  process: z
    .object({
      title: text(120).min(1),
      steps: z
        .array(z.object({ title: text(60).min(1), body: text(240) }).strict())
        .min(1)
        .max(8),
      link: ctaSchema.optional(),
    })
    .strict(),
  values: z
    .object({
      title: text(120).min(1),
      items: z.array(z.object({ title: text(60).min(1), body: text(400) }).strict()).max(10),
      link: ctaSchema.optional(),
    })
    .strict(),
  products_grid: z.object({ title: text(120).min(1), intro: text(400).optional() }).strict(),
  cta: z
    .object({
      title: text(120).min(1),
      body: text(400).optional(),
      primaryCta: ctaSchema,
      secondaryCta: ctaSchema.optional(),
    })
    .strict(),
  rich_text: z.object({ title: text(120).optional(), html: z.string().max(100_000) }).strict(),
  statement: z.object({ title: text(120).min(1), body: text(600).min(1) }).strict(),
  list: z.object({ title: text(120).min(1), items: z.array(text(300).min(1)).max(20) }).strict(),
} as const;

export type SectionType = keyof typeof SECTION_SCHEMAS;
export type SectionContent<T extends SectionType> = z.infer<(typeof SECTION_SCHEMAS)[T]>;

export interface Section<T extends SectionType = SectionType> {
  key: string;
  type: T;
  content: SectionContent<T>;
}
