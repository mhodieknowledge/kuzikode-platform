import { describe, expect, it } from 'vitest';
import { ADMIN_NAV, adminNavFor } from '../../src/server/modules/admin';
import { ICONS } from '../../src/ui/icons/registry';
import { ADMIN_ICONS, adminShellNav, adminShortcuts, currentAdminItem, readAside } from '../../src/ui/admin/nav';
import { initials } from '../../src/ui/admin/account';
import { ago, badge } from '../../src/ui/admin/useNotifications';
import { permissionsForRoles } from '../../src/shared/permissions';

const shape = (nav: { label: string; items: { label: string; href: string }[] }[]) =>
  nav.map((g) => [g.label, g.items.map((i) => `${i.label} ${i.href}`)]);

describe('admin shell navigation (R6.1)', () => {
  it('has a real icon for every module in the server nav', () => {
    for (const item of ADMIN_NAV.flatMap((g) => g.items)) {
      expect(ADMIN_ICONS[item.href], item.href).toBeDefined();
      expect(Object.hasOwn(ICONS, ADMIN_ICONS[item.href]!), item.href).toBe(true);
    }
  });

  it('shows exactly what the permission filter allows, per role, in the same order', () => {
    for (const role of [
      'super_admin',
      'admin',
      'finance_manager',
      'support_staff',
      'content_manager',
      'hiring_manager',
    ]) {
      const filtered = adminNavFor(permissionsForRoles([role]), '/admin/invoices');
      expect(shape(adminShellNav(filtered)), role).toEqual(shape(filtered));
    }
  });

  it('keeps the active flag, finds the current item and lists palette shortcuts in sidebar order', () => {
    const nav = adminShellNav(adminNavFor(permissionsForRoles(['admin']), '/admin/clients/cli_1'));
    expect(currentAdminItem(nav)).toMatchObject({ group: 'Sales', item: { label: 'Clients', icon: 'clients' } });
    expect(nav.flatMap((g) => g.items).filter((i) => i.active)).toHaveLength(1);
    const shortcuts = adminShortcuts(nav);
    expect(shortcuts[0]).toEqual({ label: 'Dashboard', href: '/admin', icon: 'overview', group: 'Overview' });
    expect(shortcuts.map((s) => s.href)).toEqual(nav.flatMap((g) => g.items.map((i) => i.href)));
  });

  it('drops empty groups from a static nav and has no current item when nothing is active', () => {
    const nav = adminShellNav([
      { label: 'Overview', items: [{ label: 'Dashboard', href: '/admin' }] },
      { label: 'Empty', items: [] },
    ]);
    expect(nav.map((g) => g.label)).toEqual(['Overview']);
    expect(currentAdminItem(nav)).toBeNull();
  });

  it('reads the remembered sidebar state, defaulting to the responsive behaviour', () => {
    expect(readAside('collapsed')).toBe('collapsed');
    expect(readAside('expanded')).toBe('expanded');
    expect(readAside(undefined)).toBe('auto');
    expect(readAside('<script>')).toBe('auto');
  });

  it('formats initials, badge counts and relative times', () => {
    expect(initials('Sam  Support')).toBe('SS');
    expect(initials('eva')).toBe('E');
    expect(initials('')).toBe('');
    expect(badge(7)).toBe('7');
    expect(badge(120)).toBe('99+');
    const now = Date.parse('2026-11-13T12:00:00Z');
    expect(ago('2026-11-13T11:59:30Z', now)).toBe('just now');
    expect(ago('2026-11-13T11:55:00Z', now)).toBe('5 min ago');
    expect(ago('2026-11-13T09:00:00Z', now)).toBe('3 h ago');
    expect(ago('2026-11-01T09:00:00Z', now)).toBe('1 Nov');
  });
});
