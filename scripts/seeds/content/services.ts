/** Service divisions and sub-services (PRD §3.3). Real Kuzikode copy; the owner edits it in Admin → Services. */

export interface SubServiceSeed {
  slug: string;
  name: string;
  summary: string;
}

export interface DivisionSeed {
  slug: string;
  name: string;
  shortName: string;
  icon: string;
  summary: string;
  description: string;
  benefits: { title: string; body: string }[];
  deliverables: string[];
  faq: { q: string; a: string }[];
  seoTitle: string;
  seoDescription: string;
  services: SubServiceSeed[];
}

export const DIVISIONS: DivisionSeed[] = [
  {
    slug: 'web-development',
    name: 'Web Development & Digital Solutions',
    shortName: 'Web Development',
    icon: 'globe',
    summary: 'Business websites, e-commerce and web applications that load fast and are easy to update.',
    description:
      '<p>We design and build websites and web applications for organisations that need more than a brochure. Every site is responsive, fast on mobile data, search-friendly and set up so your team can update content without calling us.</p><p>For larger needs we build web applications, portals and dashboards on the same foundations: secure sign-in, role-based access, audit trails and local payment options.</p>',
    benefits: [
      { title: 'Fast on real networks', body: 'Pages are built to load quickly on mobile data, with optimised images and minimal scripts.' },
      { title: 'Easy to update', body: 'A content editor lets your team change text, images and announcements without technical help.' },
      { title: 'Found on search', body: 'Clean structure, metadata, sitemaps and Search Console setup so people can find you.' },
      { title: 'Ready to take payments', body: 'Accept EcoCash, OneMoney, InnBucks and cards through Paynow when you need to sell online.' },
    ],
    deliverables: [
      'Responsive design for phones, tablets and desktops',
      'Content management so your team can edit pages',
      'On-page SEO, sitemap and Google Search Console setup',
      'Analytics dashboard',
      'Hosting, SSL certificate and domain setup',
      'Training session and handover notes',
    ],
    faq: [
      {
        q: 'Can I update the website myself?',
        a: 'Yes. Business and e-commerce sites include a content editor. We show your team how to use it during handover.',
      },
      {
        q: 'Do you build on WordPress?',
        a: 'We choose the platform that fits the job. For most business sites we use a modern, lightweight stack that is fast and secure; where WordPress is the better fit, we will say so in the quotation.',
      },
      {
        q: 'Who owns the website?',
        a: 'You do. On full payment, the content, design and code we wrote for you are yours, as set out in our service terms.',
      },
    ],
    seoTitle: 'Website & Web Application Development',
    seoDescription:
      'Business websites, e-commerce stores and web applications for organisations in Zimbabwe and across Africa. Fast, secure and easy to update.',
    services: [
      { slug: 'business-websites', name: 'Corporate & business websites', summary: 'Professional sites that explain what you do and turn visitors into enquiries.' },
      { slug: 'e-commerce', name: 'E-commerce platforms', summary: 'Online stores with product catalogues, stock and local payment methods.' },
      { slug: 'web-applications', name: 'Web applications', summary: 'Browser-based systems built around your processes, with secure user accounts.' },
      { slug: 'portals', name: 'Customer & employee portals', summary: 'Self-service areas where clients or staff can see documents, requests and status.' },
      { slug: 'dashboards', name: 'Custom dashboards', summary: 'One screen that brings together the numbers your team checks every day.' },
      { slug: 'redesign-optimisation', name: 'Website redesign & optimisation', summary: 'Faster, clearer, better-ranking versions of existing websites.' },
    ],
  },
  {
    slug: 'mobile-desktop-apps',
    name: 'Mobile & Desktop Application Development',
    shortName: 'Mobile & Desktop Apps',
    icon: 'smartphone',
    summary: 'Android, iOS and desktop apps built for real networks and real devices.',
    description:
      '<p>We build mobile and desktop applications that work well on the devices your users actually have, including mid-range Android phones and patchy connections. Apps can work offline and sync when a connection returns.</p><p>We handle design, development, testing, app store publishing and the back-end services the app depends on.</p>',
    benefits: [
      { title: 'One codebase where it makes sense', body: 'Cross-platform builds reach Android and iOS together, which keeps cost and maintenance down.' },
      { title: 'Offline-capable', body: 'Apps can keep working without signal and sync data when the connection returns.' },
      { title: 'Store-ready', body: 'We prepare listings, screenshots and releases for Google Play and the App Store.' },
      { title: 'Connected to your systems', body: 'Apps talk to your existing databases, payment methods and business software through secure APIs.' },
    ],
    deliverables: [
      'User experience and interface design',
      'Android and/or iOS app, or a desktop app for Windows and macOS',
      'Back-end API and admin dashboard where needed',
      'Testing on real devices',
      'App store publishing support',
      'Source code and documentation on full payment',
    ],
    faq: [
      {
        q: 'Should we build for Android or iPhone first?',
        a: 'In Zimbabwe most users are on Android, so many projects start there. A cross-platform build lets you cover both at little extra cost; we will recommend an approach after discovery.',
      },
      {
        q: 'Can the app work without internet?',
        a: 'Yes. Offline support is planned during design so data is stored safely on the device and synced later.',
      },
    ],
    seoTitle: 'Mobile & Desktop App Development',
    seoDescription:
      'Android, iOS, Windows and macOS applications built for real networks, with offline support, app store publishing and secure back-ends.',
    services: [
      { slug: 'android', name: 'Android apps', summary: 'Native-quality Android apps tuned for the phones your customers use.' },
      { slug: 'ios', name: 'iOS apps', summary: 'iPhone and iPad apps published through the App Store.' },
      { slug: 'windows', name: 'Windows applications', summary: 'Desktop software for offices, counters and back-office teams.' },
      { slug: 'macos', name: 'macOS applications', summary: 'Desktop tools for teams working on Mac.' },
      { slug: 'cross-platform', name: 'Cross-platform apps', summary: 'One codebase for Android and iOS to reach both audiences efficiently.' },
      { slug: 'enterprise-apps', name: 'Custom enterprise applications', summary: 'Field, sales and operations apps connected to your internal systems.' },
    ],
  },
  {
    slug: 'business-software',
    name: 'Business Software & Enterprise Systems',
    shortName: 'Business Software',
    icon: 'layers',
    summary: 'ERP, POS, inventory, HR and CRM systems shaped around how your organisation works.',
    description:
      '<p>Off-the-shelf software often forces you to change how you work. We build business systems around your processes instead: point of sale, stock control, HR and payroll records, customer management and full ERP platforms.</p><p>Systems support multiple branches and currencies, keep an audit trail of changes and can connect to the tools you already use.</p>',
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
      'Support and maintenance options after launch',
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
    seoTitle: 'Business Software, ERP & POS Systems',
    seoDescription:
      'Custom ERP, point of sale, inventory, HR and CRM systems built around your processes, with multi-currency support and audit trails.',
    services: [
      { slug: 'erp', name: 'Custom ERP', summary: 'One system for sales, purchasing, stock, finance and people.' },
      { slug: 'pos', name: 'POS systems', summary: 'Fast checkout for shops and counters, with receipts and daily reconciliation.' },
      { slug: 'inventory-warehouse', name: 'Inventory & warehouse', summary: 'Stock levels, transfers and reorder alerts across locations.' },
      { slug: 'hr-payroll', name: 'HR & payroll', summary: 'Employee records, leave and payroll calculations in one place.' },
      { slug: 'crm', name: 'CRM', summary: 'Track leads, customers, follow-ups and sales conversations.' },
      { slug: 'business-platforms', name: 'Business management platforms', summary: 'Purpose-built systems for the way your sector operates.' },
    ],
  },
  {
    slug: 'ai-data',
    name: 'AI, Data & Intelligence',
    shortName: 'AI, Data & Intelligence',
    icon: 'line-chart',
    summary: 'Dashboards, analytics and practical AI features that answer real business questions.',
    description:
      '<p>Most organisations already hold the data they need to make better decisions; it is just spread across systems and spreadsheets. We bring it together, clean it and present it in dashboards your team will use.</p><p>Where AI helps, we add it in practical ways: assistants that answer questions about your documents, extraction of data from invoices and forms, and forecasts based on your history.</p>',
    benefits: [
      { title: 'Decisions from facts', body: 'Dashboards built on clean, reconciled data from your own systems.' },
      { title: 'Less manual capture', body: 'Document processing extracts data from forms, receipts and invoices.' },
      { title: 'Practical AI', body: 'Assistants and automations are scoped to clear tasks, with human review where it matters.' },
      { title: 'Your data stays yours', body: 'We design for privacy and follow Zimbabwe’s Cyber and Data Protection Act.' },
    ],
    deliverables: [
      'Data audit and connection to your sources',
      'Business intelligence dashboards',
      'Scheduled reports',
      'AI assistant or document-processing pilot where relevant',
      'Documentation of data flows and access',
    ],
    faq: [
      {
        q: 'Do we need a lot of data to use AI?',
        a: 'Not always. Many useful features, such as document extraction or a question-answering assistant over your policies, work with the documents you already have.',
      },
      {
        q: 'Which tools do you use for dashboards?',
        a: 'We use the tool that fits your budget and team, from custom web dashboards to established BI platforms.',
      },
    ],
    seoTitle: 'AI, Data Analytics & Business Intelligence',
    seoDescription:
      'Business intelligence dashboards, analytics, predictive models and practical AI features such as document processing and assistants.',
    services: [
      { slug: 'ai-applications', name: 'AI-powered applications', summary: 'Assistants and features that use AI for a clear, measurable task.' },
      { slug: 'data-analytics', name: 'Data analytics', summary: 'Analysis of your sales, operations and customer data.' },
      { slug: 'business-intelligence', name: 'Business intelligence', summary: 'Dashboards that combine data from several systems in one view.' },
      { slug: 'predictive-analytics', name: 'Predictive analytics', summary: 'Forecasts for demand, cash flow or churn based on your history.' },
      { slug: 'data-processing', name: 'Data processing', summary: 'Cleaning, merging and moving data between systems reliably.' },
      { slug: 'document-processing', name: 'Intelligent document processing', summary: 'Extract data from invoices, forms and receipts automatically.' },
    ],
  },
  {
    slug: 'automation-integration',
    name: 'Automation & Systems Integration',
    shortName: 'Automation & Integration',
    icon: 'workflow',
    summary: 'APIs, payment gateways and workflows that remove manual steps between systems.',
    description:
      '<p>When systems do not talk to each other, people re-type data, chase approvals and reconcile by hand. We connect your systems through APIs and automate the repetitive steps in between.</p><p>We have deep experience with Zimbabwean payment rails, including Paynow, PesePay, EcoCash, OneMoney, InnBucks and card payments, and build integrations that confirm every payment before it is recorded.</p>',
    benefits: [
      { title: 'Fewer manual steps', body: 'Automated workflows move data and approvals without re-typing.' },
      { title: 'Reliable payments', body: 'Gateway integrations verify every payment with the provider before marking it paid.' },
      { title: 'Systems that agree', body: 'Integrations keep records consistent across your tools.' },
      { title: 'Room to change', body: 'Clean, documented APIs make it easier to swap or add systems later.' },
    ],
    deliverables: [
      'Integration design and documentation',
      'REST APIs with authentication and rate limiting',
      'Payment gateway integration with reconciliation',
      'Automated workflows and notifications',
      'Monitoring and error alerts',
    ],
    faq: [
      {
        q: 'Can you add EcoCash and card payments to our existing website?',
        a: 'Yes. We integrate Paynow or PesePay into existing sites and systems, including payment confirmation and receipts.',
      },
      {
        q: 'What happens if an integration fails?',
        a: 'Integrations retry safely and alert your team, so nothing is lost or processed twice.',
      },
    ],
    seoTitle: 'Automation, API Development & Payment Integration',
    seoDescription:
      'Business process automation, API development and payment gateway integration with Paynow, PesePay, EcoCash, OneMoney, InnBucks and cards.',
    services: [
      { slug: 'process-automation', name: 'Business process automation', summary: 'Automate approvals, reminders and hand-offs between teams.' },
      { slug: 'api-development', name: 'API development', summary: 'Secure, documented APIs for your apps, partners and systems.' },
      { slug: 'third-party-integrations', name: 'Third-party integrations', summary: 'Connect accounting, CRM, email and other services you rely on.' },
      { slug: 'payment-gateways', name: 'Payment gateway integration', summary: 'Paynow, PesePay, EcoCash, OneMoney, InnBucks and cards, with reconciliation.' },
      { slug: 'workflow-automation', name: 'Workflow automation', summary: 'Rules that move work forward automatically and notify the right people.' },
      { slug: 'system-modernisation', name: 'System modernisation', summary: 'Move ageing systems to maintainable, secure platforms in stages.' },
    ],
  },
  {
    slug: 'cloud-it',
    name: 'Cloud, Infrastructure & IT Solutions',
    shortName: 'Cloud & IT',
    icon: 'cloud',
    summary: 'Hosting, business email, domains, backups and technical support.',
    description:
      '<p>We set up and look after the infrastructure your business depends on: cloud hosting, domains, professional email on your own domain, databases, backups and day-to-day technical support.</p><p>You get clear ownership of every account, renewal reminders before anything expires, and a named contact when something needs fixing.</p>',
    benefits: [
      { title: 'Professional email', body: 'Addresses on your own domain with spam filtering and phone access.' },
      { title: 'Nothing expires by surprise', body: 'We track domain, hosting and certificate renewals and remind you in advance.' },
      { title: 'Backups you can restore', body: 'Scheduled backups are tested, not just taken.' },
      { title: 'Support when you need it', body: 'Retainer or ad-hoc support with clear response targets.' },
    ],
    deliverables: [
      'Cloud deployment and configuration',
      'Domain registration and DNS management',
      'Business email setup, including SPF, DKIM and DMARC',
      'Database setup and maintenance',
      'Backup schedule with restore tests',
      'Technical support plan',
    ],
    faq: [
      {
        q: 'Can you move our existing email to our own domain?',
        a: 'Yes. We set up the new mailboxes, configure DNS, migrate existing mail and help your team set up their phones.',
      },
      {
        q: 'Who owns the domain?',
        a: 'Your organisation is the registered owner. We manage it on your behalf if you want us to.',
      },
    ],
    seoTitle: 'Cloud Hosting, Business Email, Domains & IT Support',
    seoDescription:
      'Cloud deployment, domain registration, business email on your own domain, backups and technical support for organisations in Zimbabwe.',
    services: [
      { slug: 'cloud-deployment', name: 'Cloud deployment', summary: 'Host applications and websites on reliable cloud infrastructure.' },
      { slug: 'domain-management', name: 'Domain management', summary: 'Registration, DNS and renewals for .com, .co.zw and other domains.' },
      { slug: 'business-email', name: 'Business email', summary: 'Professional mailboxes on your own domain, set up and managed.' },
      { slug: 'database-management', name: 'Database design & management', summary: 'Well-structured databases that stay fast and backed up.' },
      { slug: 'server-configuration', name: 'Server configuration', summary: 'Secure server setup, updates and monitoring.' },
      { slug: 'backups-maintenance', name: 'Backups & maintenance', summary: 'Scheduled backups, restore tests and routine updates.' },
      { slug: 'technical-support', name: 'Technical support', summary: 'Help for your team by retainer or by the hour.' },
    ],
  },
];
