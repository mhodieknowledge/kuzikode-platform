/**
 * Editable application settings (P4.3): one registry drives validation on the server and the generic settings form
 * in the browser. Keys not listed here (content_version, numbering.*, invoice.reminder_schedule…) are edited elsewhere
 * or not at all. Blank text means "not set": the public site hides it.
 */
import { z } from 'zod';

export type SettingType = 'text' | 'textarea' | 'email' | 'url' | 'tel' | 'bool' | 'int' | 'color';

export interface SettingField {
  key: string;
  label: string;
  type: SettingType;
  help?: string;
  max?: number;
  min?: number;
  /** Extra format rule for text fields (blank always allowed). */
  pattern?: { regex: string; message: string };
}

export interface SettingSection {
  id: string;
  title: string;
  description: string;
  page: 'general' | 'billing' | 'website';
  fields: SettingField[];
}

export const SETTING_SECTIONS: SettingSection[] = [
  {
    id: 'company',
    title: 'Company',
    description: 'Shown on the website footer, documents and emails.',
    page: 'general',
    fields: [
      { key: 'company.name', label: 'Trading name', type: 'text', max: 120 },
      {
        key: 'company.legal_name',
        label: 'Registered name',
        type: 'text',
        max: 160,
        help: 'Only once the company is registered.',
      },
      { key: 'company.registration_number', label: 'Registration number', type: 'text', max: 60 },
      { key: 'company.tax_number', label: 'Tax / VAT number', type: 'text', max: 60 },
      { key: 'company.tagline', label: 'Tagline', type: 'text', max: 160 },
      {
        key: 'company.blurb',
        label: 'Short description',
        type: 'textarea',
        max: 400,
        help: 'Used in the website footer.',
      },
    ],
  },
  {
    id: 'contact',
    title: 'Contact details',
    description: 'Blank fields are hidden on the website.',
    page: 'general',
    fields: [
      {
        key: 'contact.email',
        label: 'Public email',
        type: 'email',
        max: 254,
        help: 'Also receives new enquiry notifications.',
      },
      { key: 'contact.billing_email', label: 'Billing email', type: 'email', max: 254 },
      { key: 'contact.phone', label: 'Phone', type: 'tel', max: 40 },
      {
        key: 'contact.whatsapp_number',
        label: 'WhatsApp number',
        type: 'tel',
        max: 40,
        help: 'Shows the floating WhatsApp button when set, e.g. +263 77 123 4567.',
      },
      { key: 'contact.whatsapp_message', label: 'Default WhatsApp message', type: 'text', max: 200 },
      { key: 'contact.location', label: 'Location', type: 'text', max: 120 },
      { key: 'contact.address', label: 'Postal / street address', type: 'textarea', max: 300 },
      { key: 'contact.hours', label: 'Office hours', type: 'text', max: 120 },
    ],
  },
  {
    id: 'social',
    title: 'Social media',
    description: 'Full https:// links. Blank links are hidden.',
    page: 'general',
    fields: [
      { key: 'social.linkedin', label: 'LinkedIn', type: 'url', max: 300 },
      { key: 'social.facebook', label: 'Facebook', type: 'url', max: 300 },
      { key: 'social.x', label: 'X', type: 'url', max: 300 },
      { key: 'social.instagram', label: 'Instagram', type: 'url', max: 300 },
      { key: 'social.github', label: 'GitHub', type: 'url', max: 300 },
      { key: 'social.youtube', label: 'YouTube', type: 'url', max: 300 },
    ],
  },
  {
    id: 'documents',
    title: 'Documents',
    description: 'Printed on quotations, invoices and receipts.',
    page: 'billing',
    fields: [
      { key: 'branding.accent_colour', label: 'Document accent colour', type: 'color' },
      { key: 'documents.footer_text', label: 'Footer text', type: 'text', max: 200 },
      {
        key: 'documents.bank_details',
        label: 'Bank transfer details',
        type: 'textarea',
        max: 600,
        help: 'Shown on invoices when set.',
      },
    ],
  },
  {
    id: 'invoicing',
    title: 'Invoices & quotations',
    description: 'Defaults for new documents. Existing documents keep their own terms.',
    page: 'billing',
    fields: [
      { key: 'invoice.default_terms_days', label: 'Invoice payment terms (days)', type: 'int', min: 0, max: 120 },
      { key: 'invoice.default_terms_text', label: 'Invoice terms text', type: 'textarea', max: 1000 },
      {
        key: 'invoice.reminder_schedule',
        label: 'Payment reminder schedule',
        type: 'text',
        max: 60,
        help: 'Days relative to the due date, separated by commas: -3 means three days before, 0 on the day, 7 a week after. Leave blank for -3, 0, 7, 14.',
        pattern: {
          regex: '^-?\\d{1,2}(\\s*,\\s*-?\\d{1,2}){0,7}$',
          message: 'Use whole days separated by commas, like -3, 0, 7, 14.',
        },
      },
      { key: 'quotation.default_validity_days', label: 'Quotation validity (days)', type: 'int', min: 1, max: 365 },
      { key: 'quotation.default_terms_text', label: 'Quotation terms text', type: 'textarea', max: 1000 },
      { key: 'payments.allow_partial', label: 'Allow clients to pay part of an invoice online', type: 'bool' },
      {
        key: 'subscriptions.lead_days',
        label: 'Subscription invoices: days before the billing date',
        type: 'int',
        min: 0,
        max: 60,
        help: 'Invoices for the next period are created this many days early (default 7).',
      },
      {
        key: 'subscriptions.at_risk_days',
        label: 'Flag a subscription "at risk" after (days overdue)',
        type: 'int',
        min: 1,
        max: 180,
        help: 'Default 30. Staff are notified; client services are never suspended automatically.',
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing page',
    description: 'Packages and prices on the public website.',
    page: 'website',
    fields: [
      {
        key: 'pricing.show_prices',
        label: 'Show prices on the website',
        type: 'bool',
        help: 'Turn on once the package prices have been confirmed.',
      },
      { key: 'pricing.vat_note', label: 'Pricing note', type: 'textarea', max: 300 },
    ],
  },
  {
    id: 'engagement',
    title: 'Bookings',
    description: 'Consultation booking.',
    page: 'website',
    fields: [
      {
        key: 'booking.cal_url',
        label: 'Booking calendar link',
        type: 'url',
        max: 300,
        help: 'e.g. a Cal.com link. When blank, the site shows a request form.',
      },
    ],
  },
  {
    id: 'careers',
    title: 'Careers',
    description: 'Careers pages and applicant data.',
    page: 'website',
    fields: [
      { key: 'careers.intro', label: 'Careers introduction', type: 'textarea', max: 800 },
      { key: 'careers.general_applications', label: 'Accept general applications ("Send us your CV")', type: 'bool' },
      {
        key: 'careers.show_in_nav_when_open',
        label: 'Show Careers in the main menu while a role is open',
        type: 'bool',
      },
      {
        key: 'careers.retention_months',
        label: 'Keep applications for (months after closing)',
        type: 'int',
        min: 1,
        max: 60,
      },
    ],
  },
];

export const SETTING_FIELDS: SettingField[] = SETTING_SECTIONS.flatMap((s) => s.fields);

function fieldSchema(f: SettingField): z.ZodType {
  const text = (max = 500) => z.string().trim().max(max, `Use at most ${max} characters.`);
  switch (f.type) {
    case 'bool':
      return z.boolean();
    case 'int':
      return z.coerce
        .number()
        .int('Enter a whole number.')
        .min(f.min ?? 0, `Use at least ${f.min ?? 0}.`)
        .max(f.max ?? 1_000_000, `Use at most ${f.max ?? 1_000_000}.`);
    case 'color':
      return z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #2747E8.');
    case 'email':
      return text(f.max).refine((v) => v === '' || z.email().safeParse(v).success, 'Enter a valid email address.');
    case 'url':
      return text(f.max).refine(
        (v) => v === '' || /^https:\/\/[^\s<>"']+\.[^\s<>"']+$/.test(v),
        'Use a full https:// link.',
      );
    case 'tel':
      return text(f.max).refine((v) => v === '' || /^[+\d][\d\s()-]{6,}$/.test(v), 'Enter a valid phone number.');
    default: {
      const p = f.pattern;
      return p ? text(f.max).refine((v) => v === '' || new RegExp(p.regex).test(v), p.message) : text(f.max);
    }
  }
}

/** Validates a partial update for one section: only that section's keys are accepted. */
export function sectionSchema(sectionId: string) {
  const section = SETTING_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return null;
  return z.object(Object.fromEntries(section.fields.map((f) => [f.key, fieldSchema(f).optional()]))).strict();
}

/** Document kinds whose numbers can be formatted (docs/01 PRD §8). */
export const NUMBERING_KINDS = [
  { kind: 'quotation', label: 'Quotations' },
  { kind: 'invoice', label: 'Invoices' },
  { kind: 'credit_note', label: 'Credit notes' },
  { kind: 'receipt', label: 'Receipts' },
  { kind: 'project', label: 'Projects' },
  { kind: 'enquiry', label: 'Enquiries' },
  { kind: 'support', label: 'Support requests' },
  { kind: 'application', label: 'Job applications' },
  { kind: 'client', label: 'Clients' },
] as const;
export type NumberingKind = (typeof NUMBERING_KINDS)[number]['kind'];
