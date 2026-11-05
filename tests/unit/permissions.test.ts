import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, permissionsForRoles, ROLE_DEFINITIONS, SUPER_ADMIN_ONLY } from '../../src/shared/permissions';

const perms = (...roles: string[]) => permissionsForRoles(roles);

describe('role matrix (docs/07 §5)', () => {
  it('gives super admin every permission', () => {
    expect(perms('super_admin').size).toBe(ALL_PERMISSIONS.length);
  });

  it('gives administrator everything except super-admin-only capabilities', () => {
    const admin = perms('admin');
    for (const p of SUPER_ADMIN_ONLY) expect(admin.has(p)).toBe(false);
    expect(admin.size).toBe(ALL_PERMISSIONS.length - SUPER_ADMIN_ONLY.length);
    expect(admin.has('careers.manage')).toBe(true);
    expect(admin.has('packages.price_review')).toBe(true);
  });

  it.each([
    [
      'finance_manager',
      [
        'invoices.issue',
        'payments.record_manual',
        'credit_notes.issue',
        'subscriptions.manage',
        'time.bill',
        'reports.export',
        'audit.view',
      ],
      ['cms.manage', 'users.manage', 'projects.manage', 'audit.export'],
    ],
    [
      'project_manager',
      ['projects.manage', 'projects.view_all', 'support.manage', 'quotations.view', 'time.track', 'time.bill'],
      ['invoices.view', 'dashboard.financial', 'quotations.create'],
    ],
    [
      'content_manager',
      ['cms.manage', 'media.manage', 'services.manage', 'content.manage', 'packages.manage'],
      ['invoices.view', 'packages.price_review', 'clients.view'],
    ],
    [
      'support_staff',
      ['enquiries.manage', 'leads.view', 'clients.view', 'support.reply', 'projects.view'],
      ['support.manage', 'leads.manage', 'invoices.view'],
    ],
    ['hiring_manager', ['careers.view', 'careers.manage', 'dashboard.view'], ['clients.view', 'invoices.view']],
  ])('%s has the expected grants and denials', (role, granted, denied) => {
    const p = perms(role);
    for (const g of granted) expect(p.has(g as never), `${role} should have ${g}`).toBe(true);
    for (const d of denied) expect(p.has(d as never), `${role} should not have ${d}`).toBe(false);
  });

  it('unions multiple roles and ignores unknown roles', () => {
    const p = perms('content_manager', 'hiring_manager', 'nope');
    expect(p.has('cms.manage')).toBe(true);
    expect(p.has('careers.manage')).toBe(true);
    expect(perms('nope').size).toBe(0);
  });

  it('only references real permission keys', () => {
    for (const r of ROLE_DEFINITIONS) for (const p of r.permissions) expect(ALL_PERMISSIONS).toContain(p);
  });
});
