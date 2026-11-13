/** Default website content (PRD §3). Published on first seed; the owner edits everything in Admin → Website. */

export interface SectionSeed {
  key: string;
  type: string;
  content: Record<string, unknown>;
}

export interface PageSeed {
  key: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  sections: SectionSeed[];
}

const startProject = { label: 'Start a project', href: '/start-a-project' };

export const PAGES: PageSeed[] = [
  {
    key: 'home',
    title: 'Home',
    seoTitle: 'Kuzikode Technologies · Building intelligent digital solutions',
    seoDescription:
      'Kuzikode designs, builds and runs websites, apps and business software for organisations in Zimbabwe and across Africa.',
    sections: [
      {
        key: 'hero',
        type: 'hero',
        content: {
          eyebrow: 'Technology partner for growing organisations',
          title: 'Building intelligent digital solutions.',
          body: 'Kuzikode designs, builds and runs websites, apps and business software for organisations in Zimbabwe and across Africa.',
          primaryCta: startProject,
          secondaryCta: { label: 'Explore services', href: '/services' },
        },
      },
      {
        key: 'services',
        type: 'services_grid',
        content: {
          title: 'What we do',
          intro: 'Five areas of work, one team. Start with what you need now and add more as you grow.',
        },
      },
      {
        key: 'why',
        type: 'features',
        content: {
          title: 'Why Kuzikode',
          intro: 'How we approach every project, whatever its size.',
          items: [
            {
              icon: 'wallet',
              title: 'Built for local rails',
              body: 'EcoCash, OneMoney, InnBucks and cards through Paynow, with every payment confirmed before it is recorded.',
            },
            {
              icon: 'gauge',
              title: 'Fast on real networks',
              body: 'Pages and apps are built to load quickly on mobile data and mid-range phones.',
            },
            {
              icon: 'list-checks',
              title: 'Clear scope, fixed milestones',
              body: 'A written quotation, agreed milestones and weekly updates in your client portal.',
            },
            {
              icon: 'life-buoy',
              title: 'Support after launch',
              body: 'A support period on every project, and help with updates and fixes whenever you need it after that.',
            },
          ],
        },
      },
      {
        key: 'work',
        type: 'work_grid',
        content: { title: 'Selected work', intro: 'A few projects we have delivered.' },
      },
      {
        key: 'process',
        type: 'process',
        content: {
          title: 'How we work',
          steps: [
            { title: 'Discover', body: 'We learn how your organisation works and agree what success looks like.' },
            { title: 'Design', body: 'We plan the structure and design the screens before writing code.' },
            { title: 'Build', body: 'We build in milestones and show you progress every week.' },
            { title: 'Launch', body: 'We test, migrate your data, train your team and go live.' },
            { title: 'Support', body: 'We stay on hand to fix, improve and keep things running.' },
          ],
          link: { label: 'More about how we work', href: '/how-we-work' },
        },
      },
      {
        key: 'values',
        type: 'values',
        content: {
          title: 'What we value',
          items: [
            { title: 'Excellence', body: 'We do careful work and check it before it reaches you.' },
            { title: 'Integrity', body: 'We say what we can do, price it honestly and keep our word.' },
            { title: 'Customer commitment', body: 'Your goals set the priorities, and we stay with you after launch.' },
          ],
          link: { label: 'About Kuzikode', href: '/about' },
        },
      },
      {
        key: 'cta',
        type: 'cta',
        content: {
          title: 'Have a project in mind?',
          body: 'Tell us what you need. We will reply with questions or a proposed next step.',
          primaryCta: startProject,
          secondaryCta: { label: 'Contact us', href: '/contact' },
        },
      },
    ],
  },
  {
    key: 'about',
    title: 'About',
    seoTitle: 'About Kuzikode Technologies',
    seoDescription:
      'Kuzikode Technologies is a Zimbabwe-based technology company that designs, builds and runs digital solutions for businesses and organisations.',
    sections: [
      {
        key: 'overview',
        type: 'rich_text',
        content: {
          title: 'About Kuzikode',
          html: '<p>Kuzikode Technologies is a technology company based in Zimbabwe. We design, build and run digital solutions for businesses, organisations and individuals: websites and web applications, business software, cross-platform apps, data and AI tools, and the automations and integrations that connect them.</p><p>We work as a long-term technology partner rather than a one-off supplier. That means clear scope before we start, regular updates while we build, and support once the work is live.</p>',
        },
      },
      {
        key: 'story',
        type: 'rich_text',
        content: {
          title: 'Our story',
          html: '<p>Kuzikode started from a simple observation: many organisations in Zimbabwe run on spreadsheets, paper and tools that do not talk to each other, while the software built for other markets rarely fits local payment methods, currencies and networks.</p><p>We set out to build technology that fits. That means accepting EcoCash and cards, handling USD and ZWG correctly, working on mobile data, and being simple enough for busy teams to use every day.</p>',
        },
      },
      {
        key: 'mission',
        type: 'statement',
        content: {
          title: 'Mission',
          body: 'To empower businesses and organisations through accessible, intelligent and dependable technology solutions that solve real-world problems.',
        },
      },
      {
        key: 'vision',
        type: 'statement',
        content: {
          title: 'Vision',
          body: 'To become a leading African technology company, creating impactful digital solutions that contribute to business growth and technological advancement.',
        },
      },
      {
        key: 'values',
        type: 'values',
        content: {
          title: 'Core values',
          items: [
            {
              title: 'Excellence',
              body: 'We hold our work to a high standard and test it properly. Small details matter to the people who use it every day.',
            },
            {
              title: 'Innovation',
              body: 'We use new technology where it solves a real problem, not for its own sake.',
            },
            {
              title: 'Integrity',
              body: 'We are honest about scope, cost and timelines, and we keep our commitments.',
            },
            {
              title: 'Customer commitment',
              body: 'Our clients’ goals set our priorities. We stay involved after launch so the work keeps delivering.',
            },
            {
              title: 'Continuous growth',
              body: 'We keep learning, improve how we work after every project and help our clients grow their own capability.',
            },
          ],
        },
      },
      {
        key: 'objectives',
        type: 'list',
        content: {
          title: 'Objectives',
          items: [
            'Deliver reliable websites, apps and business systems that organisations use every day.',
            'Make local payment methods and multi-currency records work properly in the software we build.',
            'Help organisations move from paper and spreadsheets to connected digital processes.',
            'Build lasting client relationships through clear communication and dependable support.',
            'Develop our own products for African small and medium businesses.',
          ],
        },
      },
      {
        key: 'approach',
        type: 'rich_text',
        content: {
          title: 'Our approach to technology and problem-solving',
          html: '<p>We start with the problem, not the tool. Before proposing anything we learn how your team works, where time is lost and what a good outcome looks like.</p><p>We then choose proven technology that suits your budget, your users and the networks they rely on. We build in small milestones, show working software early and adjust based on what we learn.</p><p>Security, data protection and maintainability are part of the build from day one: role-based access, audit trails, backups and documentation come as standard.</p>',
        },
      },
    ],
  },
  {
    key: 'services',
    title: 'Services',
    seoTitle: 'Services · Kuzikode Technologies',
    seoDescription:
      'Websites and web applications, business software, cross-platform apps, AI and data, and automation and integration, with published prices.',
    sections: [
      {
        key: 'intro',
        type: 'rich_text',
        content: {
          title: 'Services',
          html: '<p>From a first website to a full business platform, we design, build and support technology across five areas. Each one can stand alone or work together.</p>',
        },
      },
    ],
  },
  {
    key: 'work',
    title: 'Our Work',
    seoTitle: 'Our Work · Kuzikode Technologies',
    seoDescription: 'Case studies of websites, apps and systems built by Kuzikode Technologies.',
    sections: [
      {
        key: 'intro',
        type: 'rich_text',
        content: { title: 'Our work', html: '<p>Projects we have designed, built and supported.</p>' },
      },
      {
        key: 'empty',
        type: 'cta',
        content: {
          title: 'Case studies are being prepared.',
          body: 'Talk to us about what we can build for you.',
          primaryCta: { label: 'Contact us', href: '/contact' },
        },
      },
    ],
  },
  {
    key: 'pricing',
    title: 'Pricing',
    seoTitle: 'Pricing · Kuzikode Technologies',
    seoDescription:
      'Website packages and published prices for business software, cross-platform apps, AI and data, automation and integration, and add-ons from Kuzikode Technologies.',
    sections: [
      {
        key: 'intro',
        type: 'rich_text',
        content: {
          title: 'Clear packages, confirmed in writing',
          html: '<p>Start from a package, add what you need, and we confirm the final scope and price in a written quotation before any work begins.</p>',
        },
      },
      {
        key: 'cta',
        type: 'cta',
        content: {
          title: 'Not sure which package fits?',
          body: 'Tell us about your project and we will recommend a package or quote it separately.',
          primaryCta: { label: 'Start a project', href: '/start-a-project' },
          secondaryCta: { label: 'Contact us', href: '/contact' },
        },
      },
    ],
  },
  {
    key: 'start-a-project',
    title: 'Start a project',
    seoTitle: 'Start a project · Kuzikode Technologies',
    seoDescription:
      'Tell Kuzikode Technologies what you need in five short steps and get a reply with questions or a written quotation.',
    sections: [
      {
        key: 'intro',
        type: 'rich_text',
        content: {
          title: 'Start a project',
          html: '<p>Five short steps. Tell us what you need, pick a package if one fits, and we will reply with questions or a written quotation, usually within one business day.</p>',
        },
      },
    ],
  },
  {
    key: 'industries',
    title: 'Industries',
    seoTitle: 'Industries · Kuzikode Technologies',
    seoDescription:
      'Software, websites and systems for retail, financial services, education, healthcare, NGOs, hospitality, agriculture and logistics.',
    sections: [
      {
        key: 'intro',
        type: 'rich_text',
        content: {
          title: 'Solutions for your sector',
          html: '<p>Every sector has its own way of working. These are the problems we design for, and the services that solve them.</p>',
        },
      },
    ],
  },
  {
    key: 'insights',
    title: 'Insights',
    seoTitle: 'Insights · Kuzikode Technologies',
    seoDescription:
      'Practical guides on websites, online payments, business email and software for businesses in Zimbabwe and across Africa.',
    sections: [
      {
        key: 'intro',
        type: 'rich_text',
        content: {
          title: 'Insights',
          html: '<p>Practical guides on websites, online payments, business email and software, written for growing organisations.</p>',
        },
      },
    ],
  },
  {
    key: 'how-we-work',
    title: 'How we work',
    seoTitle: 'How we work · Kuzikode Technologies',
    seoDescription:
      'Our process, engagement models, what clients can expect and the quality and security practices behind every Kuzikode project.',
    sections: [
      {
        key: 'intro',
        type: 'rich_text',
        content: {
          title: 'How we work',
          html: '<p>Clear scope, steady progress you can see, and software you own. This is how we run every project, from a five-page website to a business platform.</p>',
        },
      },
      {
        key: 'process',
        type: 'process',
        content: {
          title: 'Our process',
          steps: [
            {
              title: 'Discover',
              body: 'We learn how your organisation works, who will use the solution and what success looks like, then agree the scope in writing.',
            },
            {
              title: 'Design',
              body: 'We plan the structure and design the key screens with you before development starts, so there are no surprises.',
            },
            {
              title: 'Build',
              body: 'We build in milestones, share progress every week in your client portal and ask for your approval at each milestone.',
            },
            {
              title: 'Launch',
              body: 'We test thoroughly, move your data across, train your team and go live when you are ready.',
            },
            {
              title: 'Support',
              body: 'We stay on hand after launch to fix issues, make improvements and keep everything secure and up to date.',
            },
          ],
        },
      },
      {
        key: 'engagement',
        type: 'features',
        content: {
          title: 'Ways to work with us',
          intro: 'Choose the model that fits the work. We will recommend one when we read your brief.',
          items: [
            {
              icon: 'list-checks',
              title: 'Fixed-price package',
              body: 'A defined package such as a business website or an online store, with a clear list of what is included.',
            },
            {
              icon: 'layers',
              title: 'Fixed-scope project',
              body: 'A custom project scoped in a written quotation, with milestones and a price agreed before we start.',
            },
            {
              icon: 'gauge',
              title: 'Time and materials',
              body: 'For evolving or exploratory work, billed by the hour against an agreed budget, with time reports you can see.',
            },
            {
              icon: 'life-buoy',
              title: 'Retainer',
              body: 'A monthly block of hours for ongoing improvements, support and maintenance.',
            },
          ],
        },
      },
      {
        key: 'expect',
        type: 'values',
        content: {
          title: 'What you can expect',
          items: [
            {
              title: 'Weekly updates',
              body: 'Progress, decisions and next steps posted in your client portal every week.',
            },
            {
              title: 'Milestone-based payments',
              body: 'You pay as agreed milestones are delivered, and can pay invoices online with mobile money or card.',
            },
            {
              title: 'You own what we build for you',
              body: 'Once paid in full, the code and content created specifically for you are yours, as set out in our service terms.',
            },
            {
              title: 'Straight answers',
              body: 'If something will take longer or cost more, we tell you early and explain why, before any extra work starts.',
            },
          ],
        },
      },
      {
        key: 'quality',
        type: 'list',
        content: {
          title: 'Quality and security practices',
          items: [
            'Code reviewed and tested automatically before every release.',
            'Accessibility checked against WCAG 2.1 AA.',
            'Encrypted connections, hashed passwords and role-based access in every system we build.',
            'Two-factor authentication for administrator accounts.',
            'Audit logs for sensitive actions such as payments and permission changes.',
            'Regular backups, with restores tested.',
            'Personal information handled in line with Zimbabwe\'s Cyber and Data Protection Act.',
          ],
        },
      },
      {
        key: 'cta',
        type: 'cta',
        content: {
          title: 'Ready to talk about your project?',
          body: 'Tell us what you need and we will reply with questions or a written quotation.',
          primaryCta: { label: 'Start a project', href: '/start-a-project' },
          secondaryCta: { label: 'See pricing', href: '/pricing' },
        },
      },
    ],
  },
  {
    key: 'faq',
    title: 'Frequently asked questions',
    seoTitle: 'FAQ · Kuzikode Technologies',
    seoDescription: 'Answers to common questions about working with Kuzikode Technologies: projects, pricing, payments, support and careers.',
    sections: [
      {
        key: 'intro',
        type: 'rich_text',
        content: {
          title: 'Frequently asked questions',
          html: '<p>Answers to the questions we hear most. If yours is not here, <a href="/contact">ask us</a>.</p>',
        },
      },
    ],
  },
  {
    key: 'contact',
    title: 'Contact',
    seoTitle: 'Contact Kuzikode Technologies',
    seoDescription: 'Tell us about your project or ask a question. We reply to every enquiry.',
    sections: [
      {
        key: 'intro',
        type: 'rich_text',
        content: {
          title: 'Contact us',
          html: '<p>Tell us about your project, ask a question or request a quotation. We reply to every enquiry, usually within one business day.</p>',
        },
      },
    ],
  },
];

export const PRODUCTS = [
  {
    id: 'prd_business_suite',
    slug: 'business-suite',
    name: 'Kuzikode Business Suite',
    tagline: 'Integrated business management for African SMEs.',
    description:
      'An integrated platform we are developing for small and medium businesses: sales and point of sale, stock, finance, people and customer management in one place, built for local payment methods and multi-currency trading. It is in development and not yet available.',
    status: 'in_development',
    interestFormEnabled: 1,
  },
];

export const EXPENSE_CATEGORIES = [
  ['exc_hosting', 'Hosting & cloud', 'Servers, cloud services and hosting fees'],
  ['exc_software', 'Software & subscriptions', 'Licences and SaaS subscriptions'],
  ['exc_domains', 'Domains & email', 'Domain registrations and mailbox costs'],
  ['exc_equipment', 'Equipment', 'Computers, phones and accessories'],
  ['exc_internet', 'Internet & airtime', 'Data bundles, fibre and airtime'],
  ['exc_transport', 'Transport & travel', 'Fuel, taxis and travel to clients'],
  ['exc_office', 'Office & utilities', 'Rent, power and office supplies'],
  ['exc_marketing', 'Marketing', 'Advertising and promotional costs'],
  ['exc_professional', 'Professional fees', 'Legal, accounting and consulting'],
  ['exc_contractors', 'Contractors', 'Freelancers and subcontractors'],
  ['exc_bank', 'Bank & payment fees', 'Bank charges and gateway fees'],
  ['exc_training', 'Training', 'Courses, books and certifications'],
  ['exc_other', 'Other', 'Anything not covered above'],
] as const;

/** application_settings defaults. Blank values are hidden on the site, never shown as placeholders. */
export const SETTINGS: Record<string, unknown> = {
  'company.name': 'Kuzikode Technologies',
  'company.legal_name': '',
  'company.registration_number': '',
  'company.tax_number': '',
  'company.tagline': 'Building intelligent digital solutions.',
  'company.blurb':
    'Kuzikode Technologies designs, builds and runs websites, apps and business software for organisations in Zimbabwe and across Africa.',
  'contact.email': '',
  'contact.billing_email': '',
  'contact.phone': '',
  'contact.whatsapp_number': '',
  'contact.whatsapp_message': 'Hi Kuzikode, I would like to talk about a project.',
  'contact.location': 'Zimbabwe',
  'contact.address': '',
  'contact.hours': '',
  'social.linkedin': '',
  'social.facebook': '',
  'social.x': '',
  'social.instagram': '',
  'social.github': '',
  'social.youtube': '',
  'branding.accent_colour': '#2747E8',
  'branding.logo_file_id': '',
  'documents.footer_text': 'Thank you for your business.',
  'documents.bank_details': '',
  'numbering.invoice': 'INV-{YYYY}-{SEQ:5}',
  'numbering.quotation': 'QUO-{YYYY}-{SEQ:4}',
  'numbering.credit_note': 'CN-{YYYY}-{SEQ:4}',
  'numbering.receipt': 'RCT-{YYYY}-{SEQ:5}',
  'numbering.project': 'PRJ-{YYYY}-{SEQ:4}',
  'numbering.enquiry': 'ENQ-{YYYY}-{SEQ:4}',
  'numbering.support': 'SUP-{YYYY}-{SEQ:4}',
  'numbering.application': 'APP-{YYYY}-{SEQ:4}',
  'numbering.client': 'CL-{SEQ:4}',
  'currency.default': 'USD',
  'display.timezone': 'Africa/Harare',
  'invoice.default_terms_days': 14,
  'invoice.default_terms_text':
    'Payment is due by the due date shown. Please quote the invoice number with your payment.',
  'invoice.reminder_schedule': [
    { kind: 'before_due', offsetDays: -3 },
    { kind: 'due', offsetDays: 0 },
    { kind: 'overdue_7', offsetDays: 7 },
    { kind: 'overdue_14', offsetDays: 14 },
  ],
  'quotation.default_validity_days': 30,
  'quotation.default_terms_text':
    'This quotation is valid until the date shown. Work starts once the quotation is accepted and any agreed deposit is paid.',
  'payments.allow_partial': false,
  'pricing.show_prices': false,
  'pricing.vat_note': 'Prices exclude VAT where applicable. Final scope and price are confirmed in a written quotation.',
  'careers.general_applications': false,
  'careers.show_in_nav_when_open': true,
  'careers.retention_months': 12,
  'careers.intro':
    'We are a small team building technology for organisations across Zimbabwe and Africa. When we hire, we look for people who care about doing careful work, communicate clearly and want to keep learning.',
  'booking.cal_url': '',
  'subscriptions.lead_days': 7,
  'subscriptions.at_risk_days': 30,
  'time.default_hourly_rate_minor': 2500,
  'time.default_currency': 'USD',
  'portal.self_registration': false,
  'content_version': 1,
};
