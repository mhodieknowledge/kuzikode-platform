import { describe, expect, it } from 'vitest';
import { adminStage, safeNext } from '../../src/server/lib/admin-page';
import { ADMIN_NAV, adminNavFor, likePattern } from '../../src/server/modules/admin';
import { permissionsForRoles, ROLE_DEFINITIONS } from '../../src/shared/permissions';

const labels = (nav: ReturnType<typeof adminNavFor>) => nav.flatMap((g) => g.items.map((i) => i.label));

describe('admin navigation is filtered by permission (P4.1 AC)', () => {
  it('each role sees exactly the sections its permissions allow', () => {
    const expected: Record<string, string[]> = {
      hiring_manager: ['Dashboard', 'Careers'],
      content_manager: ['Dashboard', 'Pages', 'Services', 'Packages', 'Content', 'Media'],
      support_staff: ['Dashboard', 'Enquiries', 'Leads', 'Clients', 'Projects', 'Support'],
      project_manager: ['Dashboard', 'Clients', 'Quotations', 'Projects', 'Time', 'Support'],
    };
    for (const [role, items] of Object.entries(expected)) {
      expect(labels(adminNavFor(permissionsForRoles([role]), '/admin', { includeUnbuilt: true })), role).toEqual(items);
    }
    const finance = labels(adminNavFor(permissionsForRoles(['finance_manager']), '/admin', { includeUnbuilt: true }));
    expect(finance).toEqual(
      expect.arrayContaining([
        'Invoices',
        'Payments',
        'Subscriptions',
        'Expenses',
        'Reports',
        'Quotations',
        'Audit log',
      ]),
    );
    expect(finance).not.toContain('Users');
    expect(finance).not.toContain('Pages');
  });

  it('super admin sees every item; unbuilt sections are never rendered', () => {
    const all = ADMIN_NAV.flatMap((g) => g.items.map((i) => i.label));
    expect(labels(adminNavFor(permissionsForRoles(['super_admin']), '/admin', { includeUnbuilt: true }))).toEqual(all);
    const built = ADMIN_NAV.flatMap((g) => g.items.filter((i) => i.built).map((i) => i.label));
    expect(labels(adminNavFor(permissionsForRoles(['super_admin']), '/admin'))).toEqual(built);
    // Every role definition references only real permissions used by at least the dashboard.
    for (const r of ROLE_DEFINITIONS) expect(r.permissions).toContain('dashboard.view');
  });

  it('marks the active item, with /admin only active on itself', () => {
    const nav = adminNavFor(permissionsForRoles(['admin']), '/admin/clients/cli_1', { includeUnbuilt: true });
    const items = nav.flatMap((g) => g.items);
    expect(items.find((i) => i.label === 'Clients')!.active).toBe(true);
    expect(items.find((i) => i.label === 'Dashboard')!.active).toBe(false);
    expect(nav.find((g) => g.label === 'Overview')).toBeDefined();
    expect(nav.some((g) => g.items.length === 0)).toBe(false);
  });
});

describe('admin page helpers', () => {
  const auth = (over: { mustChange?: boolean; enabled?: boolean; required?: boolean; verified?: boolean }) =>
    ({
      user: { mustChangePassword: !!over.mustChange },
      mfa: { enabled: !!over.enabled, required: !!over.required },
      session: { mfaVerified: !!over.verified },
    }) as Parameters<typeof adminStage>[0];

  it('decides the sign-in stage: password change, then 2FA verify, then enrolment', () => {
    expect(adminStage(auth({ mustChange: true, enabled: true }))).toBe('password');
    expect(adminStage(auth({ enabled: true }))).toBe('mfa');
    expect(adminStage(auth({ enabled: true, verified: true }))).toBe('ready');
    expect(adminStage(auth({ required: true }))).toBe('mfa-setup');
    expect(adminStage(auth({}))).toBe('ready');
  });

  it('only allows same-site admin paths after login', () => {
    expect(safeNext('/admin/clients?status=active')).toBe('/admin/clients?status=active');
    for (const bad of ['https://evil.example', '//evil.example', '/portal', '/admin\\@evil', null, '']) {
      expect(safeNext(bad as string | null)).toBe('/admin');
    }
  });

  it('escapes LIKE wildcards', () => {
    expect(likePattern('50%_off\\')).toBe('%50\\%\\_off\\\\%');
  });
});
