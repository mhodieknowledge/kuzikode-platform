/**
 * Priced packages (docs/12 §A.2). Market-informed SUGGESTIONS for the Zimbabwe SME market, seeded with
 * price_review_required = 1; production hides prices until the owner confirms them (BLOCKERS.md).
 * Amounts are integer US cents.
 */

type V = 'included' | 'not_included' | string;
export interface PackageSeed {
  slug: string;
  service: string; // `${divisionSlug}/${serviceSlug}`
  name: string;
  tagline: string;
  tab: 'websites' | 'care' | 'email' | 'other';
  billing: 'one_off' | 'recurring';
  interval?: 'month' | 'year';
  priceType: 'fixed' | 'starting_from' | 'custom_quote';
  price?: number;
  annual?: number;
  unit?: string;
  minQuantity?: number;
  delivery?: string;
  revisions?: string;
  support?: string;
  popular?: boolean;
  costNote?: string;
  features: [key: string, label: string, value: V][];
}

const inc: V = 'included';
const no: V = 'not_included';

const website = (pages: V, cms: V, domain: V, hosting: V, mailboxes: V, blog: V, seo: V, gbp: V, analytics: V, payments: V, catalogue: V, revisions: V, support: V, training: V, delivery: V) =>
  [
    ['pages', 'Pages', pages],
    ['responsive', 'Mobile-responsive design', inc],
    ['cms', 'Content editing (CMS)', cms],
    ['domain', 'Domain (.com or .co.zw), year 1', domain],
    ['hosting', 'Hosting + SSL, year 1', hosting],
    ['mailboxes', 'Business email mailboxes, year 1', mailboxes],
    ['contact', 'Contact form + WhatsApp chat button', inc],
    ['blog', 'Blog / news section', blog],
    ['seo', 'On-page SEO + Google Search Console', seo],
    ['gbp', 'Google Business Profile setup', gbp],
    ['analytics', 'Analytics dashboard', analytics],
    ['payments', 'Online payments (EcoCash, OneMoney, cards via Paynow)', payments],
    ['catalogue', 'Products / catalogue', catalogue],
    ['revisions', 'Revision rounds', revisions],
    ['support', 'Post-launch support', support],
    ['training', 'Training session', training],
    ['delivery', 'Typical delivery', delivery],
  ] as [string, string, V][];

const care = (edits: V, report: V, seo: V, response: V) =>
  [
    ['hosting', 'Hosting, SSL, daily backups, uptime monitoring', inc],
    ['updates', 'Security & software updates', inc],
    ['edits', 'Content edits included', edits],
    ['report', 'Monthly performance report', report],
    ['seo', 'SEO monitoring & quarterly improvements', seo],
    ['response', 'Support response target', response],
  ] as [string, string, V][];

export const PACKAGES: PackageSeed[] = [
  {
    slug: 'starter-website',
    service: 'web-development/business-websites',
    name: 'Starter Website',
    tagline: 'A professional presence for a new or small business.',
    tab: 'websites',
    billing: 'one_off',
    priceType: 'fixed',
    price: 35000,
    delivery: '1–2 weeks',
    revisions: '1 round',
    support: '2 weeks',
    costNote: 'Includes ~$15 domain + ~$24 for 2 Zoho Mail Lite mailboxes (year 1) + hosting.',
    features: website('Up to 5', no, inc, inc, '2', no, 'Basic', inc, no, no, no, '1', '2 weeks', no, '1–2 weeks'),
  },
  {
    slug: 'business-website',
    service: 'web-development/business-websites',
    name: 'Business Website',
    tagline: 'The complete website most growing businesses need.',
    tab: 'websites',
    billing: 'one_off',
    priceType: 'fixed',
    price: 75000,
    delivery: '3–4 weeks',
    revisions: '3 rounds',
    support: '1 month',
    popular: true,
    costNote: 'Includes ~$15 domain + ~$120 for 10 Zoho Mail Lite mailboxes (year 1) + hosting.',
    features: website('Up to 12', inc, inc, inc, '10', inc, inc, inc, inc, no, no, '3', '1 month', '1 hour', '3–4 weeks'),
  },
  {
    slug: 'ecommerce-store',
    service: 'web-development/e-commerce',
    name: 'E-commerce Store',
    tagline: 'Sell online with local payment methods.',
    tab: 'websites',
    billing: 'one_off',
    priceType: 'starting_from',
    price: 150000,
    delivery: '5–8 weeks',
    revisions: '3 rounds',
    support: '3 months',
    costNote: 'Paynow transaction fees are paid by the merchant. Mailboxes as Business Website.',
    features: website('Up to 15 + shop', inc, inc, inc, '10', inc, inc, inc, inc, inc, 'Up to 100', '3', '3 months', '2 hours', '5–8 weeks'),
  },
  {
    slug: 'custom-web-app',
    service: 'web-development/web-applications',
    name: 'Custom Web App',
    tagline: 'Portals, dashboards and systems built around your process.',
    tab: 'websites',
    billing: 'one_off',
    priceType: 'custom_quote',
    delivery: 'Scoped',
    revisions: 'Agreed',
    support: 'Agreed',
    features: website('Scoped', inc, 'Optional', 'Scoped', 'Optional', 'Optional', inc, 'n/a', inc, 'Optional', 'Scoped', 'Agreed', 'Agreed', inc, 'Scoped'),
  },
  {
    slug: 'essential-care',
    service: 'cloud-it/backups-maintenance',
    name: 'Essential Care',
    tagline: 'Keep your website safe, backed up and online.',
    tab: 'care',
    billing: 'recurring',
    interval: 'month',
    priceType: 'fixed',
    price: 2500,
    annual: 25000,
    features: care('1 hr / month', no, no, '2 business days'),
  },
  {
    slug: 'business-care',
    service: 'cloud-it/backups-maintenance',
    name: 'Business Care',
    tagline: 'Regular updates and a monthly report.',
    tab: 'care',
    billing: 'recurring',
    interval: 'month',
    priceType: 'fixed',
    price: 6000,
    annual: 60000,
    popular: true,
    features: care('3 hrs / month', inc, no, '1 business day'),
  },
  {
    slug: 'growth-care',
    service: 'cloud-it/backups-maintenance',
    name: 'Growth Care',
    tagline: 'Ongoing improvement for sites that drive your business.',
    tab: 'care',
    billing: 'recurring',
    interval: 'month',
    priceType: 'fixed',
    price: 15000,
    annual: 150000,
    features: care('8 hrs / month', inc, inc, 'Same business day'),
  },
  {
    slug: 'business-email',
    service: 'cloud-it/business-email',
    name: 'Business Email',
    tagline: 'Professional addresses on your own domain.',
    tab: 'email',
    billing: 'recurring',
    interval: 'month',
    priceType: 'fixed',
    price: 300,
    annual: 3000,
    unit: 'per mailbox',
    minQuantity: 3,
    costNote: 'Cost basis: Zoho Mail Lite ≈ $1/user/month.',
    features: [
      ['address', 'Professional address @yourdomain', inc],
      ['storage', 'Mailbox storage', '10 GB'],
      ['apps', 'Webmail + phone apps', inc],
      ['spam', 'Spam and virus filtering', inc],
      ['dns', 'Setup + DNS (SPF, DKIM, DMARC)', inc],
    ],
  },
  {
    slug: 'business-email-pro',
    service: 'cloud-it/business-email',
    name: 'Business Email Pro',
    tagline: 'Google Workspace, set up and administered for you.',
    tab: 'email',
    billing: 'recurring',
    interval: 'month',
    priceType: 'fixed',
    price: 1000,
    unit: 'per user',
    costNote: 'Cost basis: Google Workspace ≈ $7/user/month.',
    features: [
      ['address', 'Gmail interface on your domain', inc],
      ['storage', 'Storage', '30 GB'],
      ['apps', 'Meet, Drive, Docs and Calendar', inc],
      ['dns', 'Setup + administration by Kuzikode', inc],
    ],
  },
  {
    slug: 'email-setup-migration',
    service: 'cloud-it/business-email',
    name: 'Email setup & migration',
    tagline: 'Move existing mail to your new mailboxes.',
    tab: 'email',
    billing: 'one_off',
    priceType: 'fixed',
    price: 5000,
    features: [
      ['migration', 'Mail migrated', '+$10 per mailbox'],
      ['dns', 'DNS records', inc],
      ['devices', 'Device setup guide', inc],
    ],
  },
  {
    slug: 'domain-registration',
    service: 'cloud-it/domain-management',
    name: 'Domain registration',
    tagline: '.com from $20 a year, .co.zw from $25 a year.',
    tab: 'email',
    billing: 'recurring',
    interval: 'year',
    priceType: 'starting_from',
    price: 2000,
    costNote: '.co.zw pricing depends on the registrar; owner to confirm.',
    features: [
      ['registration', 'Registration in your organisation’s name', inc],
      ['dns', 'DNS on Cloudflare', inc],
      ['reminders', 'Renewal reminders', inc],
    ],
  },
  ...(
    [
      ['mvp-mobile-app', 'mobile-desktop-apps/cross-platform', 'MVP mobile app', 'Android + iOS from one codebase.', 'starting_from', 250000],
      ['business-app-dashboard', 'mobile-desktop-apps/enterprise-apps', 'Business app with admin dashboard', 'A field or customer app with its own back office.', 'starting_from', 600000],
      ['pos-inventory-single-branch', 'business-software/pos', 'POS / inventory system', 'For a single branch.', 'starting_from', 150000],
      ['custom-erp', 'business-software/erp', 'Custom ERP / business platform', 'Scoped to your operations.', 'custom_quote', undefined],
      ['bi-dashboard-starter', 'ai-data/business-intelligence', 'BI dashboard starter', 'Up to 3 data sources.', 'starting_from', 60000],
      ['ai-assistant-integration', 'ai-data/ai-applications', 'AI assistant / chatbot integration', 'Answers questions from your own content.', 'starting_from', 90000],
      ['document-processing-pilot', 'ai-data/document-processing', 'Intelligent document processing pilot', 'Extract data from your invoices or forms.', 'starting_from', 120000],
      ['payment-gateway-integration', 'automation-integration/payment-gateways', 'Payment gateway integration', 'Paynow, PesePay, EcoCash and cards.', 'starting_from', 40000],
      ['workflow-automation', 'automation-integration/workflow-automation', 'Workflow automation', 'Per workflow.', 'starting_from', 50000],
      ['cloud-deployment', 'cloud-it/cloud-deployment', 'Cloud deployment & setup', 'Hosting, environments and monitoring.', 'starting_from', 20000],
    ] as const
  ).map(([slug, service, name, tagline, priceType, price]) => ({
    slug,
    service,
    name,
    tagline,
    tab: 'other' as const,
    billing: 'one_off' as const,
    priceType,
    ...(price ? { price } : {}),
    features: [] as [string, string, V][],
  })),
  { slug: 'api-development', service: 'automation-integration/api-development', name: 'API development', tagline: 'Billed by the hour.', tab: 'other', billing: 'one_off', priceType: 'fixed', price: 2500, unit: 'per hour', features: [] },
  { slug: 'it-support-retainer', service: 'cloud-it/technical-support', name: 'IT support retainer', tagline: '5 hours of support every month.', tab: 'other', billing: 'recurring', interval: 'month', priceType: 'fixed', price: 10000, features: [] },
  { slug: 'adhoc-support', service: 'cloud-it/technical-support', name: 'Ad-hoc technical support', tagline: 'Help when you need it.', tab: 'other', billing: 'one_off', priceType: 'fixed', price: 2000, unit: 'per hour', features: [] },
];

export const ADDONS: { id: string; name: string; description: string; price: number; unit: 'each' | 'page' | 'mailbox' | 'month' | 'year' | 'hour'; billing: 'one_off' | 'recurring' }[] = [
  { id: 'pad_extra_page', name: 'Extra page', description: 'An additional page beyond the package limit.', price: 2500, unit: 'page', billing: 'one_off' },
  { id: 'pad_extra_mailbox', name: 'Extra mailbox', description: 'One more Business Email mailbox for a year.', price: 3000, unit: 'mailbox', billing: 'recurring' },
  { id: 'pad_logo_design', name: 'Logo design', description: 'A simple, professional logo with files for web and print.', price: 8000, unit: 'each', billing: 'one_off' },
  { id: 'pad_copywriting', name: 'Copywriting', description: 'We write the text for a page.', price: 2000, unit: 'page', billing: 'one_off' },
  { id: 'pad_language', name: 'Additional language', description: 'A second language version of the site.', price: 15000, unit: 'each', billing: 'one_off' },
  { id: 'pad_catalogue_upload', name: 'Product catalogue upload', description: 'We load up to 50 more products for you.', price: 5000, unit: 'each', billing: 'one_off' },
  { id: 'pad_priority', name: 'Priority delivery', description: 'Your project is scheduled ahead of the queue.', price: 10000, unit: 'each', billing: 'one_off' },
  { id: 'pad_workspace_upgrade', name: 'Google Workspace upgrade', description: 'Upgrade mailboxes to Business Email Pro.', price: 700, unit: 'month', billing: 'recurring' },
];
