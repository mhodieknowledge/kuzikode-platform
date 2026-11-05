/**
 * The single list of permission keys and the default role matrix (docs/07 §5, docs/12 §D).
 * Seeds are generated from this file; the server and UI import it for checks and menus.
 */

export const PERMISSIONS = {
  'dashboard.view': ['dashboard', 'View the dashboard'],
  'dashboard.financial': ['dashboard', 'See financial dashboard tiles and charts'],
  'clients.view': ['clients', 'View clients and contacts'],
  'clients.create': ['clients', 'Create clients'],
  'clients.update': ['clients', 'Edit clients, contacts and portal access'],
  'clients.archive': ['clients', 'Archive or delete clients'],
  'leads.view': ['leads', 'View leads'],
  'leads.manage': ['leads', 'Create, assign and convert leads'],
  'enquiries.view': ['enquiries', 'View website enquiries'],
  'enquiries.manage': ['enquiries', 'Triage enquiries and mark spam'],
  'services.manage': ['services', 'Manage service divisions and services'],
  'packages.manage': ['packages', 'Manage packages, features and add-ons'],
  'packages.price_review': ['packages', 'Approve package prices (clear price-review flags)'],
  'quotations.view': ['quotations', 'View quotations'],
  'quotations.create': ['quotations', 'Create quotations'],
  'quotations.update': ['quotations', 'Edit and revise quotations'],
  'quotations.send': ['quotations', 'Send quotations to clients'],
  'quotations.void': ['quotations', 'Void quotations'],
  'invoices.view': ['invoices', 'View invoices'],
  'invoices.create': ['invoices', 'Create draft invoices'],
  'invoices.update': ['invoices', 'Edit draft invoices'],
  'invoices.issue': ['invoices', 'Issue invoices'],
  'invoices.void': ['invoices', 'Void invoices'],
  'invoices.send': ['invoices', 'Send and resend invoices'],
  'credit_notes.issue': ['invoices', 'Issue credit notes'],
  'payments.view': ['payments', 'View payments and attempts'],
  'payments.record_manual': ['payments', 'Record manual payments'],
  'payments.reconcile': ['payments', 'Re-check payments with the gateway'],
  'payments.refund': ['payments', 'Record refunds'],
  'payment_settings.manage': ['payments', 'Manage payment accounts and routing'],
  'subscriptions.view': ['subscriptions', 'View subscriptions'],
  'subscriptions.manage': ['subscriptions', 'Create, pause and cancel subscriptions'],
  'client_assets.manage': ['subscriptions', 'Manage the managed-services register'],
  'projects.view': ['projects', 'View assigned projects'],
  'projects.view_all': ['projects', 'View all projects'],
  'projects.manage': ['projects', 'Create and manage projects'],
  'time.track': ['time', 'Track own time'],
  'time.view_all': ['time', 'View everyone’s time'],
  'time.bill': ['time', 'Bill unbilled time to invoices'],
  'expenses.view': ['expenses', 'View expenses'],
  'expenses.manage': ['expenses', 'Record and void expenses'],
  'support.view': ['support', 'View support requests'],
  'support.reply': ['support', 'Reply to support requests'],
  'support.manage': ['support', 'Assign and close support requests'],
  'cms.manage': ['cms', 'Edit and publish website pages'],
  'media.manage': ['cms', 'Manage the media library'],
  'content.manage': ['cms', 'Manage insights, industries, FAQ, testimonials and technologies'],
  'newsletter.view': ['cms', 'View newsletter subscribers'],
  'newsletter.export': ['cms', 'Export newsletter subscribers'],
  'careers.view': ['careers', 'View job postings and applicants'],
  'careers.manage': ['careers', 'Manage postings and the hiring pipeline'],
  'reports.view': ['reports', 'View reports'],
  'reports.export': ['reports', 'Export reports'],
  'settings.view': ['settings', 'View settings'],
  'settings.manage': ['settings', 'Change company settings'],
  'numbering.manage': ['settings', 'Change document numbering'],
  'users.view': ['users', 'View staff users'],
  'users.manage': ['users', 'Invite, disable and assign roles to staff'],
  'roles.manage': ['users', 'Edit roles and permissions'],
  'audit.view': ['audit', 'View the audit log'],
  'audit.export': ['audit', 'Export the audit log'],
  'data.export': ['settings', 'Export all data'],
} as const satisfies Record<string, readonly [string, string]>;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export type RoleKey =
  | 'super_admin'
  | 'admin'
  | 'finance_manager'
  | 'project_manager'
  | 'content_manager'
  | 'support_staff'
  | 'hiring_manager';

/** Permissions only a Super Administrator holds (docs/07 §5). */
export const SUPER_ADMIN_ONLY: Permission[] = [
  'roles.manage',
  'payment_settings.manage',
  'numbering.manage',
  'data.export',
];

const pick = (...prefixes: string[]) =>
  ALL_PERMISSIONS.filter((p) => prefixes.some((pre) => (pre.endsWith('.') ? p.startsWith(pre) : p === pre)));

export interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
  permissions: Permission[];
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    key: 'super_admin',
    name: 'Super Administrator',
    description: 'Full access, including roles, payment settings, numbering and full data export.',
    permissions: [...ALL_PERMISSIONS],
  },
  {
    key: 'admin',
    name: 'Administrator',
    description: 'Everything except roles, payment provider settings, numbering and full data export.',
    permissions: ALL_PERMISSIONS.filter((p) => !SUPER_ADMIN_ONLY.includes(p)),
  },
  {
    key: 'finance_manager',
    name: 'Finance Manager',
    description: 'Quotations, invoices, payments, expenses, subscriptions and reports.',
    permissions: pick(
      'dashboard.',
      'clients.view',
      'quotations.',
      'invoices.',
      'credit_notes.',
      'payments.',
      'expenses.',
      'reports.',
      'audit.view',
      'subscriptions.',
      'time.bill',
    ),
  },
  {
    key: 'project_manager',
    name: 'Project Manager',
    description: 'Projects, time, support and read access to clients and quotations.',
    permissions: pick('dashboard.view', 'clients.view', 'projects.', 'support.', 'quotations.view', 'time.'),
  },
  {
    key: 'content_manager',
    name: 'Content Manager',
    description: 'Website pages, media, services, packages and content.',
    permissions: pick(
      'dashboard.view',
      'cms.',
      'media.',
      'services.',
      'content.',
      'packages.manage',
      'newsletter.view',
    ),
  },
  {
    key: 'support_staff',
    name: 'Support Staff',
    description: 'Enquiries, support requests and read access to leads, clients and assigned projects.',
    permissions: pick(
      'dashboard.view',
      'enquiries.',
      'leads.view',
      'clients.view',
      'support.view',
      'support.reply',
      'projects.view',
    ),
  },
  {
    key: 'hiring_manager',
    name: 'Hiring Manager',
    description: 'Job postings and the applicant pipeline.',
    permissions: pick('dashboard.view', 'careers.'),
  },
];

/** Union of permissions granted by the given roles. Super admin implicitly has everything. */
export function permissionsForRoles(roleKeys: readonly string[], custom?: Map<string, Permission[]>): Set<Permission> {
  if (roleKeys.includes('super_admin')) return new Set(ALL_PERMISSIONS);
  const out = new Set<Permission>();
  for (const key of roleKeys) {
    const perms = custom?.get(key) ?? ROLE_DEFINITIONS.find((r) => r.key === key)?.permissions ?? [];
    for (const p of perms) out.add(p);
  }
  return out;
}

export function isPermission(value: string): value is Permission {
  return Object.hasOwn(PERMISSIONS, value);
}
