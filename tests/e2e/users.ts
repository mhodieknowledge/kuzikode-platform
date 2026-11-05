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
  newcomer: {
    id: 'usr_e2e_newcomer',
    email: 'e2e-newcomer@example.com',
    name: 'Nia New',
    role: 'support_staff',
    mustChange: true,
  },
} as const;
