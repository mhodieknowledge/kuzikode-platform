import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { AppError } from '../../src/server/lib/errors';
import { resolveSession } from '../../src/server/modules/auth';
import {
  createRole,
  deleteRole,
  disableUser,
  enableUser,
  listRoles,
  setUserRoles,
  updateRole,
} from '../../src/server/modules/users';
import { api, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';

async function ctxFor(email: string, password: string) {
  const s = await login('admin', email, password);
  const ctx = createContext({ env });
  ctx.auth = await resolveSession(ctx, s.cookie, 'admin');
  ctx.actor = { type: 'staff', userId: ctx.auth!.user.id };
  return ctx;
}
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'OK';
  } catch (e) {
    return e instanceof AppError ? e.code : String(e);
  }
};
const audit = (action: string, id: string) =>
  env.DB.prepare('SELECT COUNT(*) n FROM audit_logs WHERE action = ? AND entity_id = ?')
    .bind(action, id)
    .first<{ n: number }>();

describe('users & roles admin (P4.2)', () => {
  it('admin invites, lists, renames and resends; each change is audited and emails are queued', async () => {
    const admin = await createStaff(['admin']);
    const s = await login('admin', admin.email, admin.password);
    const email = `new-${Date.now()}@example.com`;
    const inv = await api('/api/v1/admin/users', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { name: 'New Person', email, roles: ['project_manager'] },
    });
    expect(inv.status).toBe(201);
    const id = inv.body.data.userId;
    const list = await api(`/api/v1/admin/users?q=${encodeURIComponent('New Person')}`, { cookie: s.cookie });
    expect(list.body.data.find((u: any) => u.id === id)).toMatchObject({
      status: 'invited',
      roles: ['project_manager'],
      invitationPending: true,
    });
    expect((await audit('user.invited', id))!.n).toBe(1);

    expect(
      (
        await api(`/api/v1/admin/users/${id}`, {
          method: 'PATCH',
          cookie: s.cookie,
          csrf: s.csrf,
          body: { name: 'Renamed Person' },
        })
      ).status,
    ).toBe(200);
    expect((await audit('user.renamed', id))!.n).toBe(1);

    const tokensBefore = await env.DB.prepare(
      "SELECT COUNT(*) n FROM auth_tokens WHERE user_id = ? AND used_at IS NULL AND purpose = 'invite_staff'",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(tokensBefore!.n).toBe(1);
    expect(
      (await api(`/api/v1/admin/users/${id}/invitation`, { cookie: s.cookie, csrf: s.csrf, body: {} })).status,
    ).toBe(200);
    const open = await env.DB.prepare(
      "SELECT COUNT(*) n FROM auth_tokens WHERE user_id = ? AND purpose = 'invite_staff' AND used_at IS NULL AND expires_at > ?",
    )
      .bind(id, new Date().toISOString())
      .first<{ n: number }>();
    expect(open!.n).toBe(1);
    expect((await audit('user.invitation_resent', id))!.n).toBe(1);
    const mails = await env.DB.prepare(
      "SELECT COUNT(*) n FROM outbox WHERE json_extract(payload,'$.template') = 'staff_invitation' AND json_extract(payload,'$.to') = ?",
    )
      .bind(email)
      .first<{ n: number }>();
    expect(mails!.n).toBe(2);

    const detail = await api(`/api/v1/admin/users/${id}`, { cookie: s.cookie });
    expect(detail.body.data.history.map((h: any) => h.action)).toEqual(
      expect.arrayContaining(['user.invited', 'user.renamed', 'user.invitation_resent']),
    );
  });

  it('guards: support cannot list or invite; admin cannot invite a super admin or re-invite an active user', async () => {
    const support = await createStaff(['support_staff']);
    const s = await login('admin', support.email, support.password);
    expect((await api('/api/v1/admin/users', { cookie: s.cookie })).status).toBe(403);
    expect((await api('/api/v1/admin/roles', { cookie: s.cookie })).status).toBe(403);
    expect(
      (
        await api('/api/v1/admin/users', {
          cookie: s.cookie,
          csrf: s.csrf,
          body: { name: 'X', email: 'x@example.com', roles: ['admin'] },
        })
      ).status,
    ).toBe(403);

    const admin = await createStaff(['admin']);
    const a = await login('admin', admin.email, admin.password);
    const sa = await api('/api/v1/admin/users', {
      cookie: a.cookie,
      csrf: a.csrf,
      body: { name: 'Boss', email: `boss-${Date.now()}@example.com`, roles: ['super_admin'] },
    });
    expect(sa.status).toBe(403);
    const dup = await api('/api/v1/admin/users', {
      cookie: a.cookie,
      csrf: a.csrf,
      body: { name: 'Dup', email: support.email, roles: ['admin'] },
    });
    expect(dup.status).toBe(422);
    expect(
      (
        await api('/api/v1/admin/users', {
          cookie: a.cookie,
          csrf: a.csrf,
          body: { name: 'N', email: 'n@example.com', roles: ['nope'] },
        })
      ).status,
    ).toBe(422);
    // Admins hold users.manage but not roles.manage.
    expect(
      (
        await api('/api/v1/admin/roles', {
          cookie: a.cookie,
          csrf: a.csrf,
          body: { key: 'x_role', name: 'X role', permissions: [] },
        })
      ).status,
    ).toBe(403);
    // CSRF is required.
    expect((await api(`/api/v1/admin/users/${support.id}/disable`, { cookie: a.cookie, body: {} })).status).toBe(403);
  });

  it('disable revokes sessions; enable restores, and a never-accepted invitee goes back to invited', async () => {
    const admin = await createStaff(['admin']);
    const target = await createStaff(['support_staff']);
    const t = await login('admin', target.email, target.password);
    const ctx = await ctxFor(admin.email, admin.password);
    expect(await code(disableUser(ctx, target.id))).toBe('OK');
    expect((await api('/api/v1/auth/admin/me', { cookie: t.cookie })).status).toBe(401);
    expect(await code(enableUser(ctx, target.id))).toBe('OK');
    expect((await env.DB.prepare('SELECT status FROM users WHERE id = ?').bind(target.id).first<any>()).status).toBe(
      'active',
    );

    const invitee = await createStaff(['support_staff'], { status: 'invited' });
    await env.DB.prepare('UPDATE users SET password_hash = NULL WHERE id = ?').bind(invitee.id).run();
    expect(await code(disableUser(ctx, invitee.id))).toBe('OK');
    expect(await code(enableUser(ctx, invitee.id))).toBe('OK');
    expect((await env.DB.prepare('SELECT status FROM users WHERE id = ?').bind(invitee.id).first<any>()).status).toBe(
      'invited',
    );
    expect((await audit('user.enabled', invitee.id))!.n).toBe(1);
  });

  it('super admin manages custom roles; permissions apply immediately; system roles and reserved permissions are protected', async () => {
    const sa = await createStaff(['super_admin']);
    const ctx = await ctxFor(sa.email, sa.password);
    const key = `auditor_${Date.now() % 100000}`;
    expect(await code(createRole(ctx, { key, name: 'Auditor', permissions: ['data.export'] }))).toBe(
      'VALIDATION_FAILED',
    );
    expect(await code(createRole(ctx, { key, name: 'Auditor', permissions: ['made.up'] }))).toBe('VALIDATION_FAILED');
    const { id } = await createRole(ctx, { key, name: 'Auditor', permissions: ['audit.view', 'reports.view'] });
    expect(await code(createRole(ctx, { key, name: 'Again', permissions: [] }))).toBe('VALIDATION_FAILED');
    const role = (await listRoles(ctx)).find((r) => r.id === id)!;
    expect(role).toMatchObject({
      system: false,
      permissions: ['audit.view', 'dashboard.view', 'reports.view'],
      members: 0,
    });

    const member = await createStaff(['support_staff']);
    expect(await code(setUserRoles(ctx, member.id, [key]))).toBe('OK');
    const m = await login('admin', member.email, member.password);
    expect((await api('/api/v1/auth/admin/me', { cookie: m.cookie })).body.data.permissions).toContain('audit.view');
    await updateRole(ctx, id, { name: 'Auditor', permissions: ['reports.view'] });
    expect((await api('/api/v1/auth/admin/me', { cookie: m.cookie })).body.data.permissions).not.toContain(
      'audit.view',
    );
    expect((await audit('role.updated', id))!.n).toBe(1);

    expect(await code(updateRole(ctx, 'rol_admin', { name: 'Admin', permissions: [] }))).toBe('CONFLICT');
    expect(await code(deleteRole(ctx, 'rol_support_staff'))).toBe('CONFLICT');
    expect(await code(deleteRole(ctx, id))).toBe('CONFLICT'); // still held
    await setUserRoles(ctx, member.id, ['support_staff']);
    expect(await code(deleteRole(ctx, id))).toBe('OK');
    expect((await listRoles(ctx)).some((r) => r.id === id)).toBe(false);
    expect((await audit('role.deleted', id))!.n).toBe(1);
  });
});
