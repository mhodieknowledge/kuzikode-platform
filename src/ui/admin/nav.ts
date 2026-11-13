/**
 * Admin shell navigation model (R6.1). The permission filtering stays in the server (`adminNavFor`, which hides every module the
 * staff member's role cannot use and every unbuilt one); this module only dresses that result for the shell: an icon per module,
 * the current item for the top bar, and the "Go to" entries of the command palette. It never adds or removes an item, so the
 * sidebar, the phone sheet and the palette show exactly what the role may open.
 */
import type { IconName } from '../icons/registry';

/** The shape `adminNavFor` returns (and the dev UI kit passes). */
export interface AdminNavInput {
  label: string;
  items: { label: string; href: string; active?: boolean }[];
}

export interface AdminShellItem {
  label: string;
  href: string;
  icon: IconName;
  active: boolean;
}

export interface AdminShellGroup {
  label: string;
  items: AdminShellItem[];
}

/** One glyph per module, by its URL (labels can repeat: "Services" is a website module, "Managed services" is finance). */
export const ADMIN_ICONS: Record<string, IconName> = {
  '/admin': 'overview',
  '/admin/enquiries': 'enquiries',
  '/admin/leads': 'leads',
  '/admin/clients': 'clients',
  '/admin/quotations': 'quotations',
  '/admin/invoices': 'invoices',
  '/admin/payments': 'payments',
  '/admin/subscriptions': 'subscriptions',
  '/admin/assets': 'managed-services',
  '/admin/expenses': 'expenses',
  '/admin/reports': 'reports',
  '/admin/projects': 'projects',
  '/admin/time': 'time',
  '/admin/support': 'support',
  '/admin/cms': 'pages',
  '/admin/services': 'services',
  '/admin/packages': 'packages',
  '/admin/content': 'content',
  '/admin/media': 'media',
  '/admin/careers': 'careers',
  '/admin/users': 'users',
  '/admin/settings': 'settings',
  '/admin/audit': 'audit',
  '/admin/notifications': 'notifications',
};

export const adminIcon = (href: string): IconName => ADMIN_ICONS[href] ?? 'layers';

export function adminShellNav(nav: AdminNavInput[]): AdminShellGroup[] {
  return nav
    .map((g) => ({
      label: g.label,
      items: g.items.map((i) => ({ label: i.label, href: i.href, icon: adminIcon(i.href), active: !!i.active })),
    }))
    .filter((g) => g.items.length > 0);
}

/** The lit item and its group, for the top bar ("Finance / Invoices"). */
export function currentAdminItem(nav: AdminShellGroup[]): { group: string; item: AdminShellItem } | null {
  for (const g of nav) {
    const item = g.items.find((i) => i.active);
    if (item) return { group: g.label, item };
  }
  return null;
}

export interface AdminShortcut {
  label: string;
  href: string;
  icon: IconName;
  group: string;
}

/** Palette "Go to" entries: every visible module, in sidebar order. */
export function adminShortcuts(nav: AdminShellGroup[]): AdminShortcut[] {
  return nav.flatMap((g) => g.items.map((i) => ({ label: i.label, href: i.href, icon: i.icon, group: g.label })));
}

/** Sidebar collapse is remembered per device in this cookie, read server-side so the first paint is already right. */
export const ASIDE_COOKIE = 'kz_aside';
export type AsideState = 'collapsed' | 'expanded' | 'auto';
export const readAside = (v: string | undefined): AsideState => (v === 'collapsed' || v === 'expanded' ? v : 'auto');
