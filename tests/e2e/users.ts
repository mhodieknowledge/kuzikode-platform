/** Fixed staff accounts created in the LOCAL D1 by global-setup.ts for e2e runs only (never staging/production). */
export const E2E_PASSWORD = 'E2e-only-password-2026!';
/** TOTP secret of the e2e Super Administrator (2FA is mandatory for that role). Local test data only. */
export const E2E_SUPER_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
export const E2E_USERS = {
  admin: { id: 'usr_e2e_admin', email: 'e2e-admin@example.com', name: 'Eva Admin', role: 'admin', mustChange: false },
  superAdmin: {
    id: 'usr_e2e_super',
    email: 'e2e-super@example.com',
    name: 'Sipho Super',
    role: 'super_admin',
    mustChange: false,
  },
  support: {
    id: 'usr_e2e_support',
    email: 'e2e-support@example.com',
    name: 'Sam Support',
    role: 'support_staff',
    mustChange: false,
  },
  // Separate accounts per spec: logins are limited to 5 per email per 15 minutes.
  settingsAdmin: {
    id: 'usr_e2e_settings',
    email: 'e2e-settings@example.com',
    name: 'Seda Settings',
    role: 'admin',
    mustChange: false,
  },
  usersAdmin: {
    id: 'usr_e2e_users',
    email: 'e2e-users@example.com',
    name: 'Uma Users',
    role: 'admin',
    mustChange: false,
  },
  clientsAdmin: {
    id: 'usr_e2e_clients',
    email: 'e2e-clients@example.com',
    name: 'Cleo Clients',
    role: 'admin',
    mustChange: false,
  },
  leadsAdmin: {
    id: 'usr_e2e_leads',
    email: 'e2e-leads@example.com',
    name: 'Lena Leads',
    role: 'admin',
    mustChange: false,
  },
  servicesAdmin: {
    id: 'usr_e2e_services',
    email: 'e2e-services@example.com',
    name: 'Sipho Services',
    role: 'content_manager',
    mustChange: false,
  },
  quotesAdmin: {
    id: 'usr_e2e_quotes',
    email: 'e2e-quotes@example.com',
    name: 'Quinn Quotes',
    role: 'admin',
    mustChange: false,
  },
  contentEditor: {
    id: 'usr_e2e_content',
    email: 'e2e-content@example.com',
    name: 'Cora Content',
    role: 'content_manager',
    mustChange: false,
  },
  packagesAdmin: {
    id: 'usr_e2e_packages',
    email: 'e2e-packages@example.com',
    name: 'Pat Packages',
    role: 'admin',
    mustChange: false,
  },
  subscriptionsAdmin: {
    id: 'usr_e2e_subscriptions',
    email: 'e2e-subscriptions@example.com',
    name: 'Sue Subscriptions',
    role: 'admin',
    mustChange: false,
  },
  hiringManager: {
    id: 'usr_e2e_hiring',
    email: 'e2e-hiring@example.com',
    name: 'Hana Hiring',
    role: 'hiring_manager',
    mustChange: false,
  },
  invoicesAdmin: {
    id: 'usr_e2e_invoices',
    email: 'e2e-invoices@example.com',
    name: 'Ivy Invoices',
    role: 'admin',
    mustChange: false,
  },
  contentAdmin: {
    id: 'usr_e2e_content_admin',
    email: 'e2e-content-admin@example.com',
    name: 'Cato Content',
    role: 'content_manager',
    mustChange: false,
  },
  timeAdmin: {
    id: 'usr_e2e_time',
    email: 'e2e-time@example.com',
    name: 'Tino Time',
    role: 'admin',
    mustChange: false,
  },
  reportsAdmin: {
    id: 'usr_e2e_reports',
    email: 'e2e-reports@example.com',
    name: 'Rudo Reports',
    role: 'admin',
    mustChange: false,
  },
  portalAdmin: {
    id: 'usr_e2e_portal_admin',
    email: 'e2e-portal-admin@example.com',
    name: 'Pania Portal',
    role: 'admin',
    mustChange: false,
  },
  newcomer: {
    id: 'usr_e2e_newcomer',
    email: 'e2e-newcomer@example.com',
    name: 'Nia New',
    role: 'support_staff',
    mustChange: true,
  },
} as const;

/** A fixed client-portal account (user_type client) linked to one client, for the portal specs. */
export const E2E_PORTAL_USER = {
  id: 'usr_e2e_portal',
  email: 'e2e-portal@example.com',
  name: 'Kuda Client',
  clientId: 'cli_e2e_portal',
  clientName: 'Borrowdale Florists (e2e)',
} as const;

/** A second owner contact of the portal client, so the support spec stays under the 5-logins-per-email limit. */
export const E2E_PORTAL_SUPPORT_USER = {
  id: 'usr_e2e_portal_support',
  email: 'e2e-portal-support@example.com',
  name: 'Rudo Client',
} as const;
