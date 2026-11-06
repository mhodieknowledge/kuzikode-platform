import { z } from 'zod';
import { linkHref } from './cms';

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
const mediaId = z.string().regex(/^med_[A-Za-z0-9_]+$/);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
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

export const pageMetaSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    seoTitle: optText(70),
    seoDescription: optText(170),
    ogImageId: mediaId
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  })
  .strict();

export const sectionDraftSchema = z.object({ content: z.record(z.string(), z.unknown()) }).strict();
export const sectionVisibleSchema = z.object({ visible: z.boolean() }).strict();
export const sectionMoveSchema = z.object({ direction: z.enum(['up', 'down']) }).strict();

export const portfolioSchema = z
  .object({
    slug,
    name: z.string().trim().min(2).max(120),
    clientName: optText(120),
    showClientName: z.boolean().default(false),
    category: z.string().trim().min(2).max(60),
    summary: z.string().trim().min(10, 'Write a short summary.').max(300),
    description: optText(20_000),
    challenge: optText(20_000),
    solution: optText(20_000),
    technologies: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    completionDate: date,
    externalUrl: z
      .string()
      .trim()
      .regex(/^https:\/\/[^\s<>"']+$/, 'Use a full https:// address.')
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? v : null)),
    coverMediaId: mediaId
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    galleryMediaIds: z.array(mediaId).max(20).default([]),
    featured: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    seoTitle: optText(70),
    seoDescription: optText(170),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.showClientName && !p.clientName)
      ctx.addIssue({ code: 'custom', path: ['clientName'], message: 'Enter the client name to show it.' });
  });

export const productSchema = z
  .object({
    slug,
    name: z.string().trim().min(2).max(80),
    tagline: optText(160),
    description: z.string().trim().min(10).max(5000),
    status: z.enum(['in_development', 'beta', 'available']),
    interestFormEnabled: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    published: z.boolean().default(false),
  })
  .strict();

export const announcementSchema = z
  .object({
    message: z.string().trim().min(3).max(240),
    linkUrl: linkHref
      .nullable()
      .optional()
      .or(z.literal(''))
      .transform((v) => (v ? v : null)),
    linkLabel: optText(40),
    level: z.enum(['info', 'important']).default('info'),
    startsAt: dateTime,
    endsAt: dateTime,
    active: z.boolean().default(true),
  })
  .strict();

export const mediaMetaSchema = z
  .object({
    altText: z.string().trim().min(3, 'Describe the image for people who cannot see it.').max(300),
    caption: optText(300),
    folder: optText(60),
  })
  .strict();
