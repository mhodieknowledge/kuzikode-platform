import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { resolveSession } from '../../src/server/modules/auth';
import { disableUser, setUserRoles } from '../../src/server/modules/users';
import { assertPortalClient } from '../../src/server/lib/policies';
import { AppError } from '../../src/server/lib/errors';
import { ROLE_DEFINITIONS } from '../../src/shared/permissions';
import { login } from '../helpers/api';
import { createClient, createPortalUser, createStaff } from '../helpers/factories';

async function ctxFor(email: string, password: string, audience: 'admin' | 'portal' = 'admin') {
  const s = await login(audience, email, password);
  const ctx = createContext({ env });
  ctx.auth = await resolveSession(ctx, s.cookie, audience);
  ctx.actor = { type: audience === 'admin' ? 'staff' : 'client', userId: ctx.auth!.user.id };
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

describe('RBAC', () => {
  it('seeded role_permissions match the code role matrix', async () => {
    await createStaff();
    for (const role of ROLE_DEFINITIONS) {
      const { results } = await env.DB.prepare(
        'SELECT permission_key FROM role_permissions WHERE role_id = ? ORDER BY permission_key',
      )
        .bind(`rol_${role.key}`)
        .all<{ permission_key: string }>();
      expect(results.map((r) => r.permission_key)).toEqual([...role.permissions].sort());
    }
  });

  it('protects the last active super admin from losing the role or being disabled', async () => {
    await env.DB.prepare("DELETE FROM user_roles WHERE role_id = 'rol_super_admin'").run();
    const sa = await createStaff(['super_admin']);
    const ctx = await ctxFor(sa.email, sa.password);
    expect(await code(setUserRoles(ctx, sa.id, ['admin']))).toBe('CONFLICT');
    expect(await code(disableUser(ctx, sa.id))).toBe('CONFLICT');
    const audits = await env.DB.prepare(
      "SELECT count(*) n FROM audit_logs WHERE action = 'user.disabled' AND entity_id = ?",
    )
      .bind(sa.id)
      .first<{ n: number }>();
    expect(audits!.n).toBe(0);

    const second = await createStaff(['super_admin']);
    expect(await code(setUserRoles(ctx, sa.id, ['admin']))).toBe('OK');
    const ctx2 = await ctxFor(second.email, second.password);
    expect(await code(disableUser(ctx2, second.id))).toBe('CONFLICT');
  });

  it('only a super admin can grant super_admin', async () => {
    const admin = await createStaff(['admin']);
    const target = await createStaff(['support_staff']);
    const ctx = await ctxFor(admin.email, admin.password);
    expect(await code(setUserRoles(ctx, target.id, ['super_admin']))).toBe('FORBIDDEN');
    expect(await code(setUserRoles(ctx, target.id, ['support_staff', 'content_manager']))).toBe('OK');
    const content = await createStaff(['content_manager']);
    const cctx = await ctxFor(content.email, content.password);
    expect(await code(setUserRoles(cctx, target.id, ['admin']))).toBe('FORBIDDEN');
  });

  it('role changes revoke the target user sessions immediately', async () => {
    const sa = await createStaff(['super_admin']);
    const target = await createStaff(['finance_manager']);
    const s = await login('admin', target.email, target.password);
    await setUserRoles(await ctxFor(sa.email, sa.password), target.id, ['support_staff']);
    const ctx = createContext({ env });
    expect(await resolveSession(ctx, s.cookie, 'admin')).toBeNull();
  });

  it('portal scoping reports foreign clients as NOT_FOUND', async () => {
    const a = await createClient('Client A');
    const b = await createClient('Client B');
    const u = await createPortalUser([a.id]);
    const ctx = await ctxFor(u.email, u.password, 'portal');
    expect(() => assertPortalClient(ctx, a.id)).not.toThrow();
    expect(() => assertPortalClient(ctx, b.id)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
    await env.DB.prepare("UPDATE client_user_access SET status = 'revoked' WHERE user_id = ?").bind(u.id).run();
    const after = await ctxFor(u.email, u.password, 'portal');
    expect(after.auth!.clientIds).toEqual([]);
  });
});
