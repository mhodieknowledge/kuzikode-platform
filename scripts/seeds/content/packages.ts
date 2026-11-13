/**
 * Priced packages: the 2026-11 catalogue (docs/redesign/REFINEMENTS.md §1 is the source of truth for names and USD prices;
 * rationale in docs/DECISIONS.md). Amounts are integer US cents. Seeded with price_review_required = 0: the owner set these
 * prices. They stay editable in Admin → Packages.
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

/** One comparison row set for the four website packages, so the table lines up column by column. */
const website = (v: {
  pages: V;
  contact: V;
  seo: V;
  gbp: V;
  cms: V;
  blog: V;
  analytics: V;
  speed: V;
  store: V;
  payments: V;
  orders: V;
  app: V;
  revisions: V;
  support: V;
  training: V;
  delivery: V;
}) =>
  [
    ['pages', 'Pages', v.pages],
    ['responsive', 'Mobile-first design', inc],
    ['contact', 'Contact form + WhatsApp button', v.contact],
    ['ssl', 'SSL certificate', inc],
    ['seo', 'Search setup', v.seo],
    ['gbp', 'Google Business Profile setup', v.gbp],
    ['cms', 'Content editing (CMS)', v.cms],
    ['blog', 'Blog / news section', v.blog],
    ['analytics', 'Analytics', v.analytics],
    ['speed', 'Speed optimisation', v.speed],
    ['store', 'Online store: cart and checkout', v.store],
    ['payments', 'EcoCash, OneMoney, InnBucks and card payments via Paynow', v.payments],
    ['orders', 'Order emails + stock basics', v.orders],
    ['app', 'Logins, dashboards, database and business logic', v.app],
    ['revisions', 'Revision rounds', v.revisions],
    ['support', 'Post-launch support', v.support],
    ['training', 'Training', v.training],
    ['delivery', 'Typical delivery', v.delivery],
  ] as [string, string, V][];

/** A single priced service (non-website divisions and add-ons): shown as a ledger row, no comparison features. */
const single = (
  slug: string,
  service: string,
  name: string,
  tagline: string,
  priceType: 'fixed' | 'starting_from',
  price: number,
  unit?: string,
): PackageSeed => ({ slug, service, name, tagline, tab: 'other', billing: 'one_off', priceType, price, ...(unit ? { unit } : {}), features: [] });

export const PACKAGES: PackageSeed[] = [
  {
    slug: 'starter-website',
    service: 'websites/starter-website',
    name: 'Starter Website',
    tagline: 'A professional presence for a new or small business.',
    tab: 'websites',
    billing: 'one_off',
    priceType: 'fixed',
    price: 15000,
    delivery: '5–7 working days',
    revisions: '1 round',
    support: '2 weeks',
    features: website({
      pages: 'Up to 5',
      contact: inc,
      seo: 'On-page SEO basics',
      gbp: inc,
      cms: no,
      blog: no,
      analytics: no,
      speed: no,
      store: no,
      payments: no,
      orders: no,
      app: no,
      revisions: '1',
      support: '2 weeks',
      training: no,
      delivery: '5–7 working days',
    }),
  },
  {
    slug: 'business-website',
    service: 'websites/business-website',
    name: 'Business Website',
    tagline: 'The complete website most growing businesses need.',
    tab: 'websites',
    billing: 'one_off',
    priceType: 'fixed',
    price: 32000,
    delivery: '2–3 weeks',
    revisions: '3 rounds',
    support: '1 month',
    popular: true,
    features: website({
      pages: 'Up to 12',
      contact: inc,
      seo: 'On-page SEO + Search Console + sitemap',
      gbp: inc,
      cms: inc,
      blog: inc,
      analytics: inc,
      speed: inc,
      store: no,
      payments: no,
      orders: no,
      app: no,
      revisions: '3',
      support: '1 month',
      training: '1 hour',
      delivery: '2–3 weeks',
    }),
  },
  {
    slug: 'ecommerce-website',
    service: 'websites/ecommerce-website',
    name: 'E-commerce Website',
    tagline: 'Sell online with local payment methods.',
    tab: 'websites',
    billing: 'one_off',
    priceType: 'starting_from',
    price: 65000,
    delivery: '4–6 weeks',
    revisions: '3 rounds',
    support: '2 months',
    costNote: 'Paynow transaction fees are paid by the merchant.',
    features: website({
      pages: 'Up to 12 + store',
      contact: inc,
      seo: 'On-page SEO + Search Console + sitemap',
      gbp: inc,
      cms: inc,
      blog: inc,
      analytics: inc,
      speed: inc,
      store: 'Up to 100 products',
      payments: inc,
      orders: inc,
      app: no,
      revisions: '3',
      support: '2 months',
      training: '1 hour',
      delivery: '4–6 weeks',
    }),
  },
  {
    slug: 'custom-web-application',
    service: 'websites/custom-web-applications',
    name: 'Custom Web Applications',
    tagline: 'Logins, dashboards, a database and business logic, scoped in a written quotation.',
    tab: 'websites',
    billing: 'one_off',
    priceType: 'starting_from',
    price: 120000,
    delivery: 'Quoted',
    revisions: 'Agreed in quotation',
    support: 'Agreed in quotation',
    features: website({
      pages: 'Scoped',
      contact: 'Scoped',
      seo: 'Scoped',
      gbp: 'Optional',
      cms: 'Scoped',
      blog: 'Optional',
      analytics: 'Scoped',
      speed: inc,
      store: 'Optional',
      payments: 'Optional',
      orders: 'Scoped',
      app: inc,
      revisions: 'Agreed',
      support: 'Agreed',
      training: 'Scoped',
      delivery: 'Quoted',
    }),
  },
  single('pos-inventory-system', 'business-software/pos', 'POS & Inventory Systems', 'Checkout, stock control and daily reconciliation.', 'starting_from', 80000),
  single('custom-erp', 'business-software/erp', 'Custom ERP & Business Management Systems', 'Sales, purchasing, stock, finance and people in one system.', 'starting_from', 250000),
  single('business-dashboards', 'business-software/dashboards-reporting', 'Business Dashboards & Reporting Systems', 'The numbers your team checks every day, on one screen.', 'starting_from', 60000),
  single('cross-platform-app', 'cross-platform-apps/cross-platform-development', 'Cross-Platform Application Development', 'One codebase for Android, iOS, Windows, macOS and Linux.', 'starting_from', 120000),
  single('ai-assistant-integration', 'ai-data/ai-applications', 'AI Integration & Intelligent Assistants', 'Assistants that answer from your own content.', 'starting_from', 50000),
  single('data-intelligence', 'ai-data/data-analytics', 'Data Intelligence & Analytics', 'Your sales, operations and customer data in one place.', 'starting_from', 60000),
  single('document-processing', 'ai-data/document-processing', 'Intelligent Document Processing', 'Extract data from invoices, forms and receipts.', 'starting_from', 80000),
  single('process-automation', 'automation-integration/process-automation', 'Business Process Automation', 'Approvals, reminders and hand-offs, automated.', 'starting_from', 40000, 'per workflow'),
  single('payment-local-method', 'automation-integration/payment-gateways', 'Payment Gateway Integration: local methods', 'EcoCash, OneMoney, InnBucks or O’mari.', 'fixed', 5000, 'per local method'),
  single('payment-card', 'automation-integration/payment-gateways', 'Payment Gateway Integration: card payments', 'Visa and Mastercard payments on your site or system.', 'fixed', 10000),
  single('api-development', 'automation-integration/api-development', 'API Development', 'Secure, documented APIs for apps, partners and systems.', 'starting_from', 40000),
  single('systems-integration', 'automation-integration/systems-integration', 'Systems Integration', 'Connect the systems you rely on so records agree.', 'starting_from', 50000),
  single('additional-pages', 'add-ons/additional-pages', 'Additional Website Pages', 'More pages beyond your package limit.', 'fixed', 1500, 'per page'),
  single('logo-design', 'add-ons/logo-design', 'Logo Design', 'A simple, professional logo with files for web and print.', 'fixed', 5000),
  single('copywriting', 'add-ons/copywriting', 'Copywriting', 'We write the text for a page.', 'fixed', 1500, 'per page'),
  single('additional-languages', 'add-ons/additional-languages', 'Additional Languages', 'Another language version of your site.', 'fixed', 6000, 'per language'),
  single('catalogue-upload', 'add-ons/catalogue-upload', 'Product Catalogue Upload', 'We load your products into the store.', 'fixed', 2500, 'per 50 products'),
];

/**
 * Add-ons offered in the Start-a-Project wizard and on quotations (package_addons). Same names and prices as the Add-ons
 * division packages above; the pricing-accuracy e2e test checks that they agree.
 */
export const ADDONS: { id: string; name: string; description: string; price: number; unit: 'each' | 'page' | 'mailbox' | 'month' | 'year' | 'hour'; billing: 'one_off' | 'recurring' }[] = [
  { id: 'pad_extra_page', name: 'Additional Website Pages', description: 'More pages beyond your package limit.', price: 1500, unit: 'page', billing: 'one_off' },
  { id: 'pad_logo_design', name: 'Logo Design', description: 'A simple, professional logo with files for web and print.', price: 5000, unit: 'each', billing: 'one_off' },
  { id: 'pad_copywriting', name: 'Copywriting', description: 'We write the text for a page.', price: 1500, unit: 'page', billing: 'one_off' },
  { id: 'pad_language', name: 'Additional Languages', description: 'Another language version of your site, per language.', price: 6000, unit: 'each', billing: 'one_off' },
  { id: 'pad_catalogue_upload', name: 'Product Catalogue Upload', description: 'We load your products into the store, per 50 products.', price: 2500, unit: 'each', billing: 'one_off' },
];
