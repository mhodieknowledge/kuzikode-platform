/**
 * Workspace destinations (R5.1). One list feeds the side dock, the phone bottom dock + "More" sheet and the command palette, so
 * they never disagree. Areas the client's role cannot see are left out (same rules as before the rebuild).
 */
import type { IconName } from '../icons/registry';

export type WorkspaceKey =
  'overview' | 'projects' | 'quotations' | 'invoices' | 'payments' | 'services' | 'support' | 'account';

export interface WorkspaceItem {
  key: WorkspaceKey;
  label: string;
  href: string;
  icon: IconName;
}

export interface WorkspaceAreas {
  projects: boolean;
  quotations: boolean;
  finance: boolean;
  support: boolean;
}

export function workspaceItems(areas: WorkspaceAreas): WorkspaceItem[] {
  return [
    { key: 'overview', label: 'Overview', href: '/portal', icon: 'overview' },
    ...(areas.projects
      ? [{ key: 'projects', label: 'Projects', href: '/portal/projects', icon: 'projects' } as const]
      : []),
    ...(areas.quotations
      ? [{ key: 'quotations', label: 'Quotations', href: '/portal/quotations', icon: 'quotations' } as const]
      : []),
    ...(areas.finance
      ? ([
          { key: 'invoices', label: 'Invoices', href: '/portal/invoices', icon: 'invoices' },
          { key: 'payments', label: 'Payments', href: '/portal/payments', icon: 'payments' },
          { key: 'services', label: 'Services', href: '/portal/services', icon: 'subscriptions' },
        ] as const)
      : []),
    ...(areas.support ? [{ key: 'support', label: 'Support', href: '/portal/support', icon: 'support' } as const] : []),
    { key: 'account', label: 'Account', href: '/portal/account', icon: 'account' },
  ];
}

/** Phones: up to four destinations in the bottom dock (Overview first, then Projects, Invoices, Support); the rest go to "More". */
export function splitForPhone(items: WorkspaceItem[]): { dock: WorkspaceItem[]; more: WorkspaceItem[] } {
  const order: WorkspaceKey[] = ['overview', 'projects', 'invoices', 'support', 'quotations', 'payments', 'services'];
  const ranked = [...items]
    .filter((i) => i.key !== 'account')
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const dock = ranked.slice(0, 4);
  return { dock, more: items.filter((i) => !dock.includes(i)) };
}
