/**
 * Admin sidebar (docs/05 §3, P4.1): grouped items, each gated by a permission. Items whose pages are not built yet
 * are marked `built: false` and never rendered, so the sidebar has no dead links; each Phase 4 task flips its flag.
 */
import type { Permission } from '../../../shared/permissions';

export interface AdminNavItem {
  label: string;
  href: string;
  /** Any one of these permissions shows the item. */
  anyOf: Permission[];
  built: boolean;
}
export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/admin', anyOf: ['dashboard.view'], built: true }],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Enquiries', href: '/admin/enquiries', anyOf: ['enquiries.view'], built: false },
      { label: 'Leads', href: '/admin/leads', anyOf: ['leads.view'], built: false },
      { label: 'Clients', href: '/admin/clients', anyOf: ['clients.view'], built: false },
      { label: 'Quotations', href: '/admin/quotations', anyOf: ['quotations.view'], built: false },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Invoices', href: '/admin/invoices', anyOf: ['invoices.view'], built: false },
      { label: 'Payments', href: '/admin/payments', anyOf: ['payments.view'], built: false },
      { label: 'Subscriptions', href: '/admin/subscriptions', anyOf: ['subscriptions.view'], built: false },
      { label: 'Expenses', href: '/admin/expenses', anyOf: ['expenses.view'], built: false },
      { label: 'Reports', href: '/admin/reports', anyOf: ['reports.view'], built: false },
    ],
  },
  {
    label: 'Delivery',
    items: [
      { label: 'Projects', href: '/admin/projects', anyOf: ['projects.view', 'projects.view_all'], built: false },
      { label: 'Time', href: '/admin/time', anyOf: ['time.track', 'time.view_all'], built: false },
      { label: 'Support', href: '/admin/support', anyOf: ['support.view'], built: false },
    ],
  },
  {
    label: 'Website',
    items: [
      { label: 'Pages', href: '/admin/cms', anyOf: ['cms.manage'], built: false },
      { label: 'Services', href: '/admin/services', anyOf: ['services.manage'], built: false },
      { label: 'Packages', href: '/admin/packages', anyOf: ['packages.manage'], built: false },
      { label: 'Content', href: '/admin/content', anyOf: ['content.manage'], built: false },
      { label: 'Media', href: '/admin/media', anyOf: ['media.manage'], built: false },
      { label: 'Careers', href: '/admin/careers', anyOf: ['careers.view'], built: false },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', href: '/admin/users', anyOf: ['users.view'], built: true },
      { label: 'Settings', href: '/admin/settings', anyOf: ['settings.view'], built: true },
      { label: 'Audit log', href: '/admin/audit', anyOf: ['audit.view'], built: false },
    ],
  },
];

/** Groups and items the holder of `permissions` may see. `includeUnbuilt` is for tests of the permission matrix. */
export function adminNavFor(
  permissions: ReadonlySet<Permission>,
  currentPath: string,
  opts: { includeUnbuilt?: boolean; nav?: AdminNavGroup[] } = {},
) {
  const isActive = (href: string) =>
    href === '/admin' ? currentPath === '/admin' : currentPath === href || currentPath.startsWith(`${href}/`);
  return (opts.nav ?? ADMIN_NAV)
    .map((g) => ({
      label: g.label,
      items: g.items
        .filter((i) => (opts.includeUnbuilt || i.built) && i.anyOf.some((p) => permissions.has(p)))
        .map((i) => ({ label: i.label, href: i.href, active: isActive(i.href) })),
    }))
    .filter((g) => g.items.length > 0);
}
