/**
 * Email templates: one function per template → { subject, html, text }. Data is validated with Zod so a bad payload
 * fails the job permanently instead of sending a broken email.
 */
import { z } from 'zod';
import { renderEmail, type Brand, type Rendered } from './layout';

const url = z.url();

const defs = {
  security_alert: {
    schema: z.object({
      name: z.string(),
      event: z.enum(['password_changed', 'password_reset', 'new_login', 'mfa_changed']),
      at: z.string(),
      ip: z.string().optional(),
    }),
    render: (b: Brand, d: { name: string; event: string; at: string; ip?: string | undefined }) => {
      const what = {
        password_changed: 'Your password was changed',
        password_reset: 'Your password was reset',
        new_login: 'New sign-in to your account',
        mfa_changed: 'Two-factor authentication settings changed',
      }[d.event]!;
      return renderEmail(b, {
        subject: `${what} · Kuzikode`,
        preheader: `${what}. If this wasn't you, reset your password now.`,
        heading: what,
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          { kind: 'p', text: `${what}. Your other sessions have been signed out where relevant.` },
          {
            kind: 'kv',
            rows: [
              ['When', new Date(d.at).toUTCString()],
              ...(d.ip ? ([['IP address', d.ip]] as [string, string][]) : []),
            ],
          },
          { kind: 'note', text: 'If this was not you, reset your password straight away and contact us.' },
        ],
      });
    },
  },
  password_reset: {
    schema: z.object({ name: z.string(), link: url, expiresInMinutes: z.number().int().positive() }),
    render: (b: Brand, d: { name: string; link: string; expiresInMinutes: number }) =>
      renderEmail(b, {
        subject: 'Reset your Kuzikode password',
        preheader: `Use this link within ${d.expiresInMinutes} minutes.`,
        heading: 'Reset your password',
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          {
            kind: 'p',
            text: 'We received a request to reset your password. Use the button below to choose a new one.',
          },
          { kind: 'button', text: 'Choose a new password', href: d.link },
          {
            kind: 'small',
            text: `The link works once and expires in ${d.expiresInMinutes} minutes. If you didn't ask for this, you can ignore this email.`,
          },
        ],
      }),
  },
  email_verification: {
    schema: z.object({ name: z.string(), link: url }),
    render: (b: Brand, d: { name: string; link: string }) =>
      renderEmail(b, {
        subject: 'Confirm your email address',
        preheader: 'One click to confirm your email address.',
        heading: 'Confirm your email address',
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          { kind: 'p', text: 'Please confirm that this is your email address.' },
          { kind: 'button', text: 'Confirm email address', href: d.link },
          { kind: 'small', text: 'The link expires in 24 hours.' },
        ],
      }),
  },
  staff_invitation: {
    schema: z.object({ name: z.string(), link: url, expiresInDays: z.number().int().positive() }),
    render: (b: Brand, d: { name: string; link: string; expiresInDays: number }) =>
      renderEmail(b, {
        subject: 'You have been invited to the Kuzikode admin',
        preheader: 'Set your password to get started.',
        heading: 'Welcome to the team workspace',
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          {
            kind: 'p',
            text: 'You have been invited to the Kuzikode admin portal. Set a password to activate your account.',
          },
          { kind: 'button', text: 'Set your password', href: d.link },
          { kind: 'small', text: `This invitation works once and expires in ${d.expiresInDays} days.` },
        ],
      }),
  },
  client_invitation: {
    schema: z.object({ name: z.string(), link: url, expiresInDays: z.number().int().positive() }),
    render: (b: Brand, d: { name: string; link: string; expiresInDays: number }) =>
      renderEmail(b, {
        subject: 'Your Kuzikode client portal account',
        preheader: 'See quotations, invoices and project updates in one place.',
        heading: 'Welcome to your client portal',
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          {
            kind: 'p',
            text: 'Kuzikode has created a client portal account for you. In the portal you can view and accept quotations, pay invoices, follow project progress and contact us.',
          },
          { kind: 'button', text: 'Set up your account', href: d.link },
          { kind: 'small', text: `This invitation works once and expires in ${d.expiresInDays} days.` },
        ],
      }),
  },
  enquiry_acknowledgement: {
    schema: z.object({
      name: z.string(),
      reference: z.string(),
      kind: z.enum(['contact', 'product_interest', 'consultation', 'wizard']),
    }),
    render: (b: Brand, d: { name: string; reference: string; kind: string }) =>
      renderEmail(b, {
        subject: `We received your message (${d.reference})`,
        preheader: 'Thank you for contacting Kuzikode. We will reply soon.',
        heading: 'Thank you for getting in touch',
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          {
            kind: 'p',
            text:
              d.kind === 'consultation'
                ? 'Thank you for requesting a consultation. We will confirm a time with you shortly.'
                : d.kind === 'product_interest'
                  ? 'Thank you for your interest. We will let you know when there is news to share.'
                  : 'Thank you for your message. A member of our team will reply, usually within one business day.',
          },
          { kind: 'kv', rows: [['Your reference', d.reference]] },
          {
            kind: 'small',
            text: 'Reply to this email if you want to add anything. Please keep the reference in the subject.',
          },
        ],
      }),
  },
  enquiry_admin: {
    schema: z.object({
      reference: z.string(),
      name: z.string(),
      email: z.string(),
      category: z.string(),
      message: z.string(),
      kind: z.string(),
      link: url,
    }),
    render: (
      b: Brand,
      d: {
        reference: string;
        name: string;
        email: string;
        category: string;
        message: string;
        kind: string;
        link: string;
      },
    ) =>
      renderEmail(b, {
        subject: `New ${d.kind === 'contact' ? 'enquiry' : d.kind.replace('_', ' ')} ${d.reference} from ${d.name}`,
        preheader: d.message.slice(0, 90),
        heading: `New ${d.kind === 'contact' ? 'enquiry' : d.kind.replace('_', ' ')}`,
        blocks: [
          {
            kind: 'kv',
            rows: [
              ['Reference', d.reference],
              ['From', `${d.name} (${d.email})`],
              ['Category', d.category],
            ],
          },
          { kind: 'note', text: d.message },
          { kind: 'button', text: 'Open in admin', href: d.link },
        ],
      }),
  },
  application_acknowledgement: {
    schema: z.object({ name: z.string(), reference: z.string(), position: z.string() }),
    render: (b: Brand, d: { name: string; reference: string; position: string }) =>
      renderEmail(b, {
        subject: `We received your application (${d.reference})`,
        preheader: `Thank you for applying: ${d.position}.`,
        heading: 'Thank you for applying',
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          {
            kind: 'p',
            text: `We have received your application for ${d.position}. We read every application and will contact you if we would like to take it further.`,
          },
          {
            kind: 'kv',
            rows: [
              ['Your reference', d.reference],
              ['Position', d.position],
            ],
          },
          {
            kind: 'small',
            text: 'We keep applications for 12 months after the position closes and then delete your CV. To withdraw your application or ask us to delete your data sooner, reply to this email.',
          },
        ],
      }),
  },
  system_test: {
    schema: z.object({ name: z.string(), at: z.string() }),
    render: (b: Brand, d: { name: string; at: string }) =>
      renderEmail(b, {
        subject: `Test email from ${b.companyName}`,
        preheader: 'Your email settings are working.',
        heading: 'Email is working',
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          {
            kind: 'p',
            text: 'This is a test sent from the admin settings. If you can read it, outgoing email is set up correctly.',
          },
          { kind: 'small', text: `Sent ${d.at}.` },
        ],
      }),
  },
  quotation_sent: {
    schema: z.object({
      name: z.string(),
      number: z.string(),
      title: z.string(),
      total: z.string(),
      validUntil: z.string(),
      link: url,
      message: z.string().nullable().optional(),
    }),
    render: (
      b: Brand,
      d: {
        name: string;
        number: string;
        title: string;
        total: string;
        validUntil: string;
        link: string;
        message?: string | null | undefined;
      },
    ) =>
      renderEmail(b, {
        subject: `Quotation ${d.number}: ${d.title}`,
        preheader: `Your quotation from ${b.companyName} (${d.total}).`,
        heading: 'Your quotation',
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          ...(d.message ? [{ kind: 'p' as const, text: d.message }] : []),
          {
            kind: 'p',
            text: `Please find our quotation for ${d.title}. You can read it online, download it and accept or decline it from the link below.`,
          },
          {
            kind: 'kv',
            rows: [
              ['Quotation', d.number],
              ['Total', d.total],
              ['Valid until', d.validUntil],
            ],
          },
          { kind: 'button', text: 'View quotation', href: d.link },
          { kind: 'small', text: 'If you have questions, reply to this email and we will get back to you.' },
        ],
      }),
  },
  newsletter_confirmation: {
    schema: z.object({ link: url }),
    render: (b: Brand, d: { link: string }) =>
      renderEmail(b, {
        subject: 'Confirm your newsletter subscription',
        preheader: 'One click to confirm your subscription.',
        heading: 'Confirm your subscription',
        blocks: [
          {
            kind: 'p',
            text: `Please confirm that you would like to receive occasional updates and articles from ${b.companyName}.`,
          },
          { kind: 'button', text: 'Confirm subscription', href: d.link },
          {
            kind: 'small',
            text: 'The link expires in 7 days. If you did not sign up, ignore this email and you will not be subscribed. Every newsletter includes an unsubscribe link.',
          },
        ],
      }),
  },
  invoice_issued: {
    schema: z.object({
      name: z.string(),
      number: z.string(),
      total: z.string(),
      dueDate: z.string(),
      link: url,
      message: z.string().nullable().optional(),
    }),
    render: (
      b: Brand,
      d: {
        name: string;
        number: string;
        total: string;
        dueDate: string;
        link: string;
        message?: string | null | undefined;
      },
    ) =>
      renderEmail(b, {
        subject: `Invoice ${d.number} from ${b.companyName}`,
        preheader: `Invoice ${d.number} for ${d.total}, due ${d.dueDate}.`,
        heading: 'Your invoice',
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          ...(d.message ? [{ kind: 'p' as const, text: d.message }] : []),
          {
            kind: 'p',
            text: 'Please find your invoice below. You can view it online and download a PDF copy from the link.',
          },
          {
            kind: 'kv',
            rows: [
              ['Invoice', d.number],
              ['Amount due', d.total],
              ['Due date', d.dueDate],
            ],
          },
          { kind: 'button', text: 'View invoice', href: d.link },
          {
            kind: 'small',
            text: 'Please quote the invoice number with your payment. Reply to this email with any questions.',
          },
        ],
      }),
  },
  invoice_reminder: {
    schema: z.object({
      name: z.string(),
      number: z.string(),
      balance: z.string(),
      dueDate: z.string(),
      overdue: z.boolean(),
      link: url,
    }),
    render: (
      b: Brand,
      d: { name: string; number: string; balance: string; dueDate: string; overdue: boolean; link: string },
    ) =>
      renderEmail(b, {
        subject: d.overdue
          ? `Reminder: invoice ${d.number} is overdue`
          : `Reminder: invoice ${d.number} is due ${d.dueDate}`,
        preheader: `${d.balance} outstanding on invoice ${d.number}.`,
        heading: d.overdue ? 'Your invoice is overdue' : 'A friendly payment reminder',
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          {
            kind: 'p',
            text: d.overdue
              ? `Our records show that invoice ${d.number} was due on ${d.dueDate} and still has a balance outstanding.`
              : `This is a reminder that invoice ${d.number} is due on ${d.dueDate}.`,
          },
          {
            kind: 'kv',
            rows: [
              ['Invoice', d.number],
              ['Balance due', d.balance],
              ['Due date', d.dueDate],
            ],
          },
          { kind: 'button', text: 'View invoice', href: d.link },
          {
            kind: 'small',
            text: 'If you have already paid, thank you, and please ignore this reminder. Reply to this email if anything is unclear.',
          },
        ],
      }),
  },
  payment_receipt: {
    schema: z.object({
      name: z.string(),
      receiptNumber: z.string(),
      amount: z.string(),
      receivedOn: z.string(),
      invoiceNumber: z.string(),
      balance: z.string(),
      credit: z.string().nullable(),
      link: url,
    }),
    render: (
      b: Brand,
      d: {
        name: string;
        receiptNumber: string;
        amount: string;
        receivedOn: string;
        invoiceNumber: string;
        balance: string;
        credit: string | null;
        link: string;
      },
    ) =>
      renderEmail(b, {
        subject: `Payment received: receipt ${d.receiptNumber}`,
        preheader: `Thank you. We received ${d.amount} for invoice ${d.invoiceNumber}.`,
        heading: 'Thank you for your payment',
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          { kind: 'p', text: `We have received your payment of ${d.amount}. Your receipt details are below.` },
          {
            kind: 'kv',
            rows: [
              ['Receipt', d.receiptNumber],
              ['Date received', d.receivedOn],
              ['Invoice', d.invoiceNumber],
              ['Balance remaining', d.balance],
              ...(d.credit ? ([['Held as account credit', d.credit]] as [string, string][]) : []),
            ],
          },
          { kind: 'button', text: 'View invoice', href: d.link },
          { kind: 'small', text: 'Keep this email for your records.' },
        ],
      }),
  },
  project_update: {
    schema: z.object({ name: z.string(), project: z.string(), reference: z.string(), body: z.string() }),
    render: (b: Brand, d: { name: string; project: string; reference: string; body: string }) =>
      renderEmail(b, {
        subject: `Update on ${d.project} (${d.reference})`,
        preheader: d.body.slice(0, 120),
        heading: `An update on ${d.project}`,
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          { kind: 'p', text: d.body },
          { kind: 'small', text: `Project ${d.reference}. Reply to this email with any questions.` },
        ],
      }),
  },
  notification: {
    schema: z.object({
      name: z.string(),
      label: z.string(),
      title: z.string(),
      body: z.string().optional(),
      link: url.optional(),
    }),
    render: (
      b: Brand,
      d: { name: string; label: string; title: string; body?: string | undefined; link?: string | undefined },
    ) =>
      renderEmail(b, {
        subject: `${d.title} · ${b.companyName}`,
        preheader: d.body ? d.body.slice(0, 120) : d.label,
        heading: d.title,
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          ...(d.body ? [{ kind: 'p' as const, text: d.body }] : []),
          ...(d.link ? [{ kind: 'button' as const, text: 'Open in admin', href: d.link }] : []),
          {
            kind: 'small',
            text: `You get this email because "${d.label}" emails are on. Change it under Account → Notification preferences.`,
          },
        ],
      }),
  },
  renewal_reminder: {
    schema: z.object({
      name: z.string(),
      item: z.string(),
      renewalDate: z.string(),
      days: z.number().int().min(0),
      autoRenew: z.boolean(),
    }),
    render: (b: Brand, d: { name: string; item: string; renewalDate: string; days: number; autoRenew: boolean }) =>
      renderEmail(b, {
        subject: `Renewal coming up: ${d.item}`,
        preheader: `Renews on ${d.renewalDate}.`,
        heading: 'A renewal is coming up',
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          {
            kind: 'p',
            text: d.autoRenew
              ? `${d.item} renews automatically on ${d.renewalDate} (in ${d.days} ${d.days === 1 ? 'day' : 'days'}). You don't need to do anything.`
              : `${d.item} is due for renewal on ${d.renewalDate} (in ${d.days} ${d.days === 1 ? 'day' : 'days'}). Reply to this email to confirm you'd like to keep it, or if anything should change.`,
          },
          {
            kind: 'kv',
            rows: [
              ['Service', d.item],
              ['Renewal date', d.renewalDate],
            ],
          },
          { kind: 'small', text: 'We send this reminder 30, 14 and 7 days before each renewal.' },
        ],
      }),
  },
  candidate_message: {
    schema: z.object({ subject: z.string().min(1).max(200), body: z.string().min(1).max(6000), reference: z.string() }),
    render: (b: Brand, d: { subject: string; body: string; reference: string }) => {
      const paras = d.body
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);
      return renderEmail(b, {
        subject: d.subject,
        preheader: (paras[1] ?? paras[0] ?? '').slice(0, 120),
        heading: d.subject,
        blocks: [
          ...paras.map((text) => ({ kind: 'p' as const, text })),
          { kind: 'small', text: `Application reference ${d.reference}. Reply to this email to reach us.` },
        ],
      });
    },
  },
  support_reply: {
    schema: z.object({ name: z.string(), reference: z.string(), subject: z.string(), body: z.string() }),
    render: (b: Brand, d: { name: string; reference: string; subject: string; body: string }) =>
      renderEmail(b, {
        subject: `Re: ${d.subject} [${d.reference}]`,
        preheader: d.body.slice(0, 120),
        heading: 'A reply to your support request',
        blocks: [
          { kind: 'p', text: `Hi ${d.name},` },
          { kind: 'p', text: d.body },
          { kind: 'kv', rows: [['Request', `${d.reference}: ${d.subject}`]] },
          { kind: 'small', text: 'Reply to this email and we will add your message to the request.' },
        ],
      }),
  },
} as const;

export type TemplateName = keyof typeof defs;
export const TEMPLATE_NAMES = Object.keys(defs) as TemplateName[];

export function isTemplate(name: string): name is TemplateName {
  return Object.hasOwn(defs, name);
}

/** Validates data and renders. Throws z.ZodError for bad data. */
export function renderTemplate(name: TemplateName, brand: Brand, data: unknown): Rendered {
  const def = defs[name];
  const parsed = def.schema.parse(data);
  return (def.render as (b: Brand, d: unknown) => Rendered)(brand, parsed);
}
