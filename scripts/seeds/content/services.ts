/**
 * Service divisions and services: the 2026-11 catalogue (docs/redesign/REFINEMENTS.md §1, the source of truth for names,
 * slugs and prices). Real Kuzikode copy; the owner edits it in Admin → Services. Every service has a priced package in
 * `packages.ts`; `pricing` mirrors the package price on the service row (integer US cents).
 */

export interface SubServiceSeed {
  slug: string;
  name: string;
  summary: string;
  pricing: { model: 'fixed' | 'starting_from'; price: number };
}

export interface DivisionSeed {
  slug: string;
  name: string;
  shortName: string;
  icon: string;
  /** Home widgets show featured divisions only. Add-ons is a priced division but not a home widget. */
  featured: boolean;
  summary: string;
  description: string;
  benefits: { title: string; body: string }[];
  deliverables: string[];
  faq: { q: string; a: string }[];
  seoTitle: string;
  seoDescription: string;
  services: SubServiceSeed[];
}

const fixed = (price: number) => ({ model: 'fixed' as const, price });
const from = (price: number) => ({ model: 'starting_from' as const, price });

export const DIVISIONS: DivisionSeed[] = [
  {
    slug: 'websites',
    name: 'Websites & Web Applications',
    shortName: 'Websites & Web Apps',
    icon: 'globe',
    featured: true,
    summary: 'Business websites, online stores and custom web applications that load fast and are easy to update.',
    description:
      '<p>We design and build websites for organisations that need more than a brochure. Every site is designed for phones first, loads quickly on mobile data, is set up for search and, from the Business Website up, lets your team update content without calling us.</p><p>For larger needs we build web applications on the same foundations: secure sign-in, role-based access, a database built around your records and local payment options.</p>',
    benefits: [
      { title: 'Fast on real networks', body: 'Pages are built to load quickly on mobile data, with optimised images and minimal scripts.' },
      { title: 'Easy to update', body: 'Business and e-commerce sites include a content editor so your team can change text and images.' },
      { title: 'Found on search', body: 'Clean structure, metadata, a sitemap and Search Console setup so people can find you.' },
      { title: 'Ready to take payments', body: 'Accept EcoCash, OneMoney, InnBucks and cards through Paynow when you sell online.' },
    ],
    deliverables: [
      'Mobile-first design for phones, tablets and desktops',
      'Contact form and WhatsApp button',
      'On-page SEO basics and an SSL certificate',
      'Content editing on Business and E-commerce sites',
      'Handover notes, and training where the package includes it',
    ],
    faq: [
      {
        q: 'Can I update the website myself?',
        a: 'Yes, from the Business Website up. Those sites include a content editor and a short training session at handover. The Starter Website has no editor; we make changes for you during the support period.',
      },
      {
        q: 'How long does a website take?',
        a: 'A Starter Website takes 5 to 7 working days, a Business Website 2 to 3 weeks and an online store 4 to 6 weeks, once we have your content. Custom web applications are scheduled in the written quotation.',
      },
      {
        q: 'Who owns the website?',
        a: 'You do. On full payment, the content, design and code we wrote for you are yours, as set out in our service terms.',
      },
    ],
    seoTitle: 'Websites & Web Applications',
    seoDescription:
      'Starter and business websites, e-commerce stores and custom web applications for organisations in Zimbabwe. Fast, mobile-first and easy to update.',
    services: [
      { slug: 'starter-website', name: 'Starter Website', summary: 'Up to 5 pages: a professional presence for a new or small business.', pricing: fixed(15000) },
      { slug: 'business-website', name: 'Business Website', summary: 'Up to 12 pages with a content editor, blog, analytics and search setup.', pricing: fixed(32000) },
      { slug: 'ecommerce-website', name: 'E-commerce Website', summary: 'An online store with cart, checkout and local payment methods.', pricing: from(65000) },
      { slug: 'custom-web-applications', name: 'Custom Web Applications', summary: 'Logins, dashboards, a database and business logic, scoped in a written quotation.', pricing: from(120000) },
    ],
  },
  {
    slug: 'business-software',
    name: 'Business Software & Systems',
    shortName: 'Business Software',
    icon: 'layers',
    featured: true,
    summary: 'POS, inventory, ERP and reporting systems shaped around how your organisation works.',
    description:
      '<p>Off-the-shelf software often forces you to change how you work. We build business systems around your processes instead: point of sale and stock control, full business management platforms and the dashboards that show how the business is doing.</p><p>Systems support multiple branches and currencies, keep an audit trail of changes and can connect to the tools you already use.</p>',
    benefits: [
      { title: 'Fits your process', body: 'Workflows, approvals and reports follow how your team already works.' },
      { title: 'Multi-currency by design', body: 'USD and ZWG amounts are kept separate and reported correctly.' },
      { title: 'Clear audit trail', body: 'Every important change records who did it and when.' },
      { title: 'Grows in stages', body: 'Start with the module you need most and add others as you grow.' },
    ],
    deliverables: [
      'Process mapping and requirements document',
      'Web-based system with role-based access',
      'Data migration from spreadsheets or existing systems',
      'Reports and exports',
      'Staff training and user guides',
    ],
    faq: [
      {
        q: 'Can you move our data from spreadsheets?',
        a: 'Yes. Data migration is part of most projects. We clean and import your existing records and check the totals with you before go-live.',
      },
      {
        q: 'Does it work across branches?',
        a: 'Yes. Systems can run across several branches with each user seeing only what their role allows.',
      },
    ],
    seoTitle: 'Business Software: POS, ERP & Reporting Systems',
    seoDescription:
      'POS and inventory systems, custom ERP and business management platforms, and reporting dashboards built around your processes.',
    services: [
      { slug: 'pos', name: 'POS & Inventory Systems', summary: 'Fast checkout, stock control and daily reconciliation for shops and counters.', pricing: from(80000) },
      { slug: 'erp', name: 'Custom ERP & Business Management Systems', summary: 'One system for sales, purchasing, stock, finance and people.', pricing: from(250000) },
      { slug: 'dashboards-reporting', name: 'Business Dashboards & Reporting Systems', summary: 'One screen with the numbers your team checks every day, and scheduled reports.', pricing: from(60000) },
    ],
  },
  {
    slug: 'cross-platform-apps',
    name: 'Cross-Platform Application Development',
    shortName: 'Cross-Platform Apps',
    icon: 'smartphone',
    featured: true,
    summary: 'One codebase for Android, iOS, Windows, macOS and Linux, built for real networks and real devices.',
    description:
      '<p>We build one application from a single codebase and release it on the platforms your users have: Android, iOS, Windows, macOS and Linux. One codebase keeps the cost of building and maintaining the app down while every platform gets the same features.</p><p>Apps are designed for the devices people actually use, including mid-range Android phones and patchy connections, and can keep working offline and sync when a connection returns.</p>',
    benefits: [
      { title: 'One codebase, five platforms', body: 'Android, iOS, Windows, macOS and Linux from the same code, so features ship everywhere together.' },
      { title: 'Offline-capable', body: 'Apps can keep working without signal and sync data when the connection returns.' },
      { title: 'Store-ready', body: 'We prepare listings, screenshots and releases for the app stores you publish to.' },
      { title: 'Connected to your systems', body: 'Apps talk to your existing databases, payment methods and business software through secure APIs.' },
    ],
    deliverables: [
      'User experience and interface design',
      'One application released for the platforms you choose',
      'Back-end API and admin dashboard where needed',
      'Testing on real devices',
      'App store publishing support',
    ],
    faq: [
      {
        q: 'Which platforms are supported?',
        a: 'Android, iOS, Windows, macOS and Linux. You choose which ones to release on first; adding another later reuses the same code.',
      },
      {
        q: 'Can the app work without internet?',
        a: 'Yes. Offline support is planned during design so data is stored safely on the device and synced later.',
      },
    ],
    seoTitle: 'Cross-Platform App Development: Android, iOS & Desktop',
    seoDescription:
      'One codebase for Android, iOS, Windows, macOS and Linux apps, with offline support, app store publishing and secure back-ends.',
    services: [
      {
        slug: 'cross-platform-development',
        name: 'Cross-Platform Application Development',
        summary: 'One codebase released on Android, iOS, Windows, macOS and Linux.',
        pricing: from(120000),
      },
    ],
  },
  {
    slug: 'ai-data',
    name: 'AI, Data & Intelligence',
    shortName: 'AI, Data & Intelligence',
    icon: 'line-chart',
    featured: true,
    summary: 'Practical AI assistants, analytics and document processing that answer real business questions.',
    description:
      '<p>Most organisations already hold the data they need to make better decisions; it is just spread across systems and spreadsheets. We bring it together, clean it and present it in a form your team will use.</p><p>Where AI helps, we add it in practical ways: assistants that answer questions from your own documents, extraction of data from invoices and forms, and analysis of your history.</p>',
    benefits: [
      { title: 'Decisions from facts', body: 'Analysis built on clean, reconciled data from your own systems.' },
      { title: 'Less manual capture', body: 'Document processing extracts data from forms, receipts and invoices.' },
      { title: 'Practical AI', body: 'Assistants and automations are scoped to clear tasks, with human review where it matters.' },
      { title: 'Your data stays yours', body: 'We design for privacy and follow Zimbabwe’s Cyber and Data Protection Act.' },
    ],
    deliverables: [
      'Data audit and connection to your sources',
      'AI assistant, analysis or document-processing workflow',
      'Scheduled reports',
      'Documentation of data flows and access',
    ],
    faq: [
      {
        q: 'Do we need a lot of data to use AI?',
        a: 'Not always. Many useful features, such as document extraction or a question-answering assistant over your policies, work with the documents you already have.',
      },
      {
        q: 'Is our data shared with anyone?',
        a: 'Only with the services the solution needs to run, under agreements that protect it. We explain where your data goes in the written proposal.',
      },
    ],
    seoTitle: 'AI Integration, Data Intelligence & Document Processing',
    seoDescription:
      'AI assistants built on your own content, data intelligence and analytics, and intelligent document processing for invoices and forms.',
    services: [
      { slug: 'ai-applications', name: 'AI Integration & Intelligent Assistants', summary: 'Assistants that answer questions from your own content, added to your website or systems.', pricing: from(50000) },
      { slug: 'data-analytics', name: 'Data Intelligence & Analytics', summary: 'Analysis of your sales, operations and customer data, brought together in one place.', pricing: from(60000) },
      { slug: 'document-processing', name: 'Intelligent Document Processing', summary: 'Extract data from invoices, forms and receipts automatically.', pricing: from(80000) },
    ],
  },
  {
    slug: 'automation-integration',
    name: 'Automation & Integration',
    shortName: 'Automation & Integration',
    icon: 'workflow',
    featured: true,
    summary: 'Workflows, payment gateways, APIs and integrations that remove manual steps between systems.',
    description:
      '<p>When systems do not talk to each other, people re-type data, chase approvals and reconcile by hand. We connect your systems through APIs and automate the repetitive steps in between.</p><p>We work with Zimbabwean payment rails, including EcoCash, OneMoney, InnBucks, O’mari and card payments, and build integrations that confirm every payment before it is recorded.</p>',
    benefits: [
      { title: 'Fewer manual steps', body: 'Automated workflows move data and approvals without re-typing.' },
      { title: 'Reliable payments', body: 'Gateway integrations verify every payment with the provider before marking it paid.' },
      { title: 'Systems that agree', body: 'Integrations keep records consistent across your tools.' },
      { title: 'Room to change', body: 'Clean, documented APIs make it easier to swap or add systems later.' },
    ],
    deliverables: [
      'Integration design and documentation',
      'Automated workflows and notifications',
      'Payment integration with confirmation and reconciliation',
      'APIs with authentication',
      'Error alerts and safe retries',
    ],
    faq: [
      {
        q: 'Can you add EcoCash and card payments to our existing website?',
        a: 'Yes. Each local method (EcoCash, OneMoney, InnBucks or O’mari) is $50 and card payments are $100, including payment confirmation and receipts.',
      },
      {
        q: 'What happens if an integration fails?',
        a: 'Integrations retry safely and alert your team, so nothing is lost or processed twice.',
      },
    ],
    seoTitle: 'Automation, Payment Gateway Integration & APIs',
    seoDescription:
      'Business process automation, payment gateway integration for EcoCash, OneMoney, InnBucks, O’mari and cards, API development and systems integration.',
    services: [
      { slug: 'process-automation', name: 'Business Process Automation', summary: 'Automate approvals, reminders and hand-offs between teams, priced per workflow.', pricing: from(40000) },
      {
        slug: 'payment-gateways',
        name: 'Payment Gateway Integration',
        summary: 'EcoCash, OneMoney, InnBucks and O’mari at $50 per method; card payments at $100.',
        pricing: fixed(5000),
      },
      { slug: 'api-development', name: 'API Development', summary: 'Secure, documented APIs for your apps, partners and systems.', pricing: from(40000) },
      { slug: 'systems-integration', name: 'Systems Integration', summary: 'Connect accounting, CRM and the other systems you rely on so records agree.', pricing: from(50000) },
    ],
  },
  {
    slug: 'add-ons',
    name: 'Add-ons',
    shortName: 'Add-ons',
    icon: 'sparkles',
    featured: false,
    summary: 'Extra pages, logo design, copywriting, languages and catalogue uploads to add to a website package.',
    description:
      '<p>Add-ons extend a website package when you need a little more: extra pages, a logo, text written for you, another language or more products loaded into your store. Each one has a fixed published price.</p>',
    benefits: [],
    deliverables: [],
    faq: [],
    seoTitle: 'Website Add-ons',
    seoDescription: 'Additional website pages, logo design, copywriting, additional languages and product catalogue uploads at fixed prices.',
    services: [
      { slug: 'additional-pages', name: 'Additional Website Pages', summary: 'More pages beyond your package limit.', pricing: fixed(1500) },
      { slug: 'logo-design', name: 'Logo Design', summary: 'A simple, professional logo with files for web and print.', pricing: fixed(5000) },
      { slug: 'copywriting', name: 'Copywriting', summary: 'We write the text for a page.', pricing: fixed(1500) },
      { slug: 'additional-languages', name: 'Additional Languages', summary: 'Another language version of your site.', pricing: fixed(6000) },
      { slug: 'catalogue-upload', name: 'Product Catalogue Upload', summary: 'We load your products into the store, 50 at a time.', pricing: fixed(2500) },
    ],
  },
];
