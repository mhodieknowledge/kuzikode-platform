/**
 * Industries (docs/12 §C.3). Honest copy: what we build for each sector ("solutions for"), never "clients include".
 * No statistics, no named organisations. `services` are `${divisionSlug}/${serviceSlug}` and are checked at build time.
 */
export interface IndustrySeed {
  slug: string;
  name: string;
  summary: string;
  icon: string;
  challenges: { title: string; body: string }[];
  body: string;
  services: string[];
  seoDescription: string;
}

export const INDUSTRIES: IndustrySeed[] = [
  {
    slug: 'retail-wholesale',
    name: 'Retail & Wholesale',
    summary: 'Point of sale, stock control and online ordering for shops, distributors and wholesalers.',
    icon: 'wallet',
    challenges: [
      {
        title: 'Stock that does not match the shelves',
        body: 'Sales, deliveries and transfers recorded in different places make it hard to know what is actually in stock.',
      },
      {
        title: 'Many ways to pay',
        body: 'Customers pay with cash, EcoCash, OneMoney, InnBucks, cards and bank transfers, and each needs reconciling.',
      },
      {
        title: 'Several branches, one picture',
        body: 'Owners need daily sales and stock figures from every branch without waiting for end-of-month reports.',
      },
    ],
    body: '<p>We build point-of-sale and inventory systems that record every sale and stock movement once, reconcile mobile money and card payments, and give owners a daily view across branches. For businesses that sell online, we add a store or ordering portal connected to the same stock.</p>',
    services: [
      'business-software/pos',
      'business-software/inventory-warehouse',
      'web-development/e-commerce',
      'automation-integration/payment-gateways',
      'ai-data/business-intelligence',
    ],
    seoDescription: 'POS, inventory, e-commerce and payment integration for retailers and wholesalers in Zimbabwe.',
  },
  {
    slug: 'financial-services',
    name: 'Financial Services & Microfinance',
    summary: 'Loan management, client portals and secure integrations for microfinance institutions and financial service providers.',
    icon: 'shield-check',
    challenges: [
      {
        title: 'Manual loan tracking',
        body: 'Applications, disbursements and repayments kept in spreadsheets are slow to update and easy to get wrong.',
      },
      {
        title: 'Security and audit expectations',
        body: 'Financial data needs role-based access, audit trails and careful handling of personal information.',
      },
      {
        title: 'Collecting repayments',
        body: 'Clients want to repay with mobile money, and every payment has to be matched to the right account.',
      },
    ],
    body: '<p>We build loan and client management systems with clear approval workflows, repayment schedules and audit logs, plus portals where clients can see their balances. Repayments can be collected through mobile money and card gateways and reconciled automatically.</p>',
    services: [
      'business-software/business-platforms',
      'web-development/portals',
      'automation-integration/payment-gateways',
      'ai-data/predictive-analytics',
      'cloud-it/database-management',
    ],
    seoDescription: 'Loan management, client portals and payment integration for microfinance and financial services.',
  },
  {
    slug: 'education',
    name: 'Education',
    summary: 'Fees, student records and parent communication for schools, colleges and training providers.',
    icon: 'layers',
    challenges: [
      {
        title: 'Collecting and tracking fees',
        body: 'Fee payments arrive through several channels and must be matched to the right learner and term.',
      },
      {
        title: 'Keeping parents informed',
        body: 'Notices, results and statements are often sent on paper or through scattered messaging groups.',
      },
      {
        title: 'Records in many places',
        body: 'Enrolment, attendance and results kept in separate files make reporting slow.',
      },
    ],
    body: '<p>We build school management systems and parent portals that bring enrolment, fees, results and communication together. Parents can view statements and pay fees online, and administrators get up-to-date reports without re-typing data.</p>',
    services: [
      'web-development/portals',
      'business-software/business-platforms',
      'automation-integration/payment-gateways',
      'mobile-desktop-apps/cross-platform',
      'web-development/business-websites',
    ],
    seoDescription: 'School management systems, parent portals and online fee payments for education providers.',
  },
  {
    slug: 'healthcare',
    name: 'Healthcare',
    summary: 'Appointments, patient records and billing for clinics, pharmacies and practices.',
    icon: 'life-buoy',
    challenges: [
      {
        title: 'Busy front desks',
        body: 'Phone bookings and paper diaries lead to double bookings, long queues and missed appointments.',
      },
      {
        title: 'Sensitive information',
        body: 'Patient information must be protected with strict access control and handled in line with data protection law.',
      },
      {
        title: 'Billing and medical aid',
        body: 'Invoices, cash payments and medical aid claims need to be tracked together.',
      },
    ],
    body: '<p>We build booking, patient record and billing systems designed around privacy: role-based access, audit trails and encrypted connections. Clinics can offer online booking and reminders, and pharmacies can manage stock and dispensing in one place.</p>',
    services: [
      'business-software/business-platforms',
      'web-development/web-applications',
      'business-software/inventory-warehouse',
      'automation-integration/workflow-automation',
      'cloud-it/backups-maintenance',
    ],
    seoDescription: 'Appointment booking, patient records and billing systems for clinics and pharmacies.',
  },
  {
    slug: 'ngos-development',
    name: 'NGOs & Development',
    summary: 'Data collection, beneficiary records and donor reporting for NGOs and development programmes.',
    icon: 'globe',
    challenges: [
      {
        title: 'Field data on paper',
        body: 'Survey and distribution data collected on paper is slow to capture and hard to check.',
      },
      {
        title: 'Donor reporting',
        body: 'Each donor wants indicators in a different format, and compiling them takes days.',
      },
      {
        title: 'Limited connectivity',
        body: 'Field teams often work where the network is weak or unavailable.',
      },
    ],
    body: '<p>We build mobile data collection apps that work offline and sync when a connection returns, beneficiary and programme databases, and dashboards that turn field data into donor-ready reports.</p>',
    services: [
      'mobile-desktop-apps/cross-platform',
      'ai-data/data-processing',
      'ai-data/business-intelligence',
      'web-development/dashboards',
      'cloud-it/cloud-deployment',
    ],
    seoDescription: 'Offline data collection apps, beneficiary databases and donor reporting dashboards for NGOs.',
  },
  {
    slug: 'hospitality-tourism',
    name: 'Hospitality & Tourism',
    summary: 'Direct bookings, guest communication and operations for lodges, hotels and tour operators.',
    icon: 'sparkles',
    challenges: [
      {
        title: 'Relying on third-party booking sites',
        body: 'Commission on every booking adds up, and guests cannot easily book directly.',
      },
      {
        title: 'Taking payments from abroad',
        body: 'International guests expect to pay by card, while local guests prefer mobile money.',
      },
      {
        title: 'Coordinating operations',
        body: 'Rooms, activities, transfers and staff schedules are often managed separately.',
      },
    ],
    body: '<p>We build websites with direct booking and online payments, and back-office tools for reservations, activities and guest communication, so you can sell more directly and run each day from one place.</p>',
    services: [
      'web-development/business-websites',
      'web-development/e-commerce',
      'automation-integration/payment-gateways',
      'business-software/crm',
      'cloud-it/business-email',
    ],
    seoDescription: 'Booking websites, online payments and reservation tools for hotels, lodges and tour operators.',
  },
  {
    slug: 'agriculture',
    name: 'Agriculture',
    summary: 'Farm records, supply chains and grower payments for farms, cooperatives and agri-businesses.',
    icon: 'line-chart',
    challenges: [
      {
        title: 'Tracking inputs and yields',
        body: 'Inputs, labour and harvests recorded in notebooks make it hard to see what each field really costs and produces.',
      },
      {
        title: 'Paying many growers',
        body: 'Cooperatives and contractors need accurate records of deliveries, deductions and payments for each grower.',
      },
      {
        title: 'Planning ahead',
        body: 'Decisions on planting, stock and sales are easier with reliable history to look back on.',
      },
    ],
    body: '<p>We build farm and cooperative management systems for inputs, deliveries, grower accounts and payments, with mobile apps for field teams and dashboards that show trends across seasons.</p>',
    services: [
      'business-software/business-platforms',
      'business-software/inventory-warehouse',
      'mobile-desktop-apps/android',
      'ai-data/predictive-analytics',
      'ai-data/data-analytics',
    ],
    seoDescription: 'Farm management, grower payment and supply-chain systems for agriculture in Zimbabwe.',
  },
  {
    slug: 'logistics-transport',
    name: 'Logistics & Transport',
    summary: 'Dispatch, tracking and fleet records for transporters, couriers and logistics companies.',
    icon: 'workflow',
    challenges: [
      {
        title: 'Knowing where every load is',
        body: 'Customers want updates, and dispatchers spend hours on the phone finding out where trucks are.',
      },
      {
        title: 'Paperwork on every trip',
        body: 'Waybills, proof of delivery and fuel records are easily lost or delayed.',
      },
      {
        title: 'Costs per vehicle',
        body: 'Fuel, maintenance and driver costs need to be tracked per vehicle and per trip.',
      },
    ],
    body: '<p>We build dispatch and fleet systems with driver apps for proof of delivery, customer tracking pages and cost reports per vehicle and route, connected to your invoicing.</p>',
    services: [
      'business-software/business-platforms',
      'mobile-desktop-apps/enterprise-apps',
      'web-development/portals',
      'automation-integration/third-party-integrations',
      'web-development/dashboards',
    ],
    seoDescription: 'Dispatch, proof-of-delivery apps and fleet cost tracking for logistics and transport companies.',
  },
];
