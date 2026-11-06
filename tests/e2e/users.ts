/** Fixed staff accounts created in the LOCAL D1 by global-setup.ts for e2e runs only (never staging/production). */
export const E2E_PASSWORD = 'E2e-only-password-2026!';
export const E2E_USERS = {
  admin: { id: 'usr_e2e_admin', email: 'e2e-admin@example.com', name: 'Eva Admin', role: 'admin', mustChange: false },
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
  newcomer: {
    id: 'usr_e2e_newcomer',
    email: 'e2e-newcomer@example.com',
    name: 'Nia New',
    role: 'support_staff',
    mustChange: true,
  },
} as const;
