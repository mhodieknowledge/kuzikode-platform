import { type RoleKey } from '../../../shared/permissions';
import type { RequestContext } from '../../context';
import { Batch } from '../../db/client';
import { auditStmt, auditWhen } from '../../lib/audit';
import { conflict, forbidden, notFound, validationError } from '../../lib/errors';
import { assertCan, isSuperAdmin } from '../../lib/policies';
import { revokeAllSessionsOf } from '../auth';
import { revokeUserSessionsStmt } from '../auth/repository';
import * as repo from './repository';

const LAST_SUPER_ADMIN = 'At least one active Super Administrator must remain.';

/**
 * Replaces a staff user's roles. Only a Super Administrator may grant or remove `super_admin`; nobody can remove
 * the last active super admin's role (enforced in SQL inside the batch). Sessions are revoked so the change applies now.
 */
export async function setUserRoles(ctx: RequestContext, userId: string, roles: string[]): Promise<void> {
  assertCan(ctx, 'users.manage');
  const known = new Set(await repo.listRoleKeys(ctx.db));
  const unknown = roles.filter((r) => !known.has(r));
  if (unknown.length) throw validationError({ roles: [`Unknown role: ${unknown.join(', ')}`] });
  const user = await repo.findStaff(ctx.db, userId);
  if (!user) throw notFound();
  const before = (user.roles ?? '').split(',').filter(Boolean).sort();
  const after = [...new Set(roles)].sort();
  const touchesSuper = before.includes('super_admin') !== after.includes('super_admin');
  if (touchesSuper && !isSuperAdmin(ctx)) throw forbidden('Only a Super Administrator can change that role.');
  if (before.includes('super_admin') && !after.includes('super_admin')) {
    const others = await ctx.db
      .prepare(`SELECT ${repo.otherActiveSuperAdminsSql} AS n`)
      .bind(userId)
      .first<{ n: number }>();
    if (!others?.n) throw conflict(LAST_SUPER_ADMIN);
  }

  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(repo.removeRolesStmt(ctx.db, userId, after))
    .add(repo.addRolesStmt(ctx.db, userId, after, ctx.actor.userId, now))
    .add(revokeUserSessionsStmt(ctx.db, userId, now, ctx.auth?.user.id === userId ? ctx.auth.session.id : null))
    .add(
      auditStmt(ctx, {
        action: 'user.roles_changed',
        entityType: 'user',
        entityId: userId,
        before: { roles: before },
        after: { roles: after },
      }),
    )
    .run();

  const check = await repo.findStaff(ctx.db, userId);
  const actual = (check?.roles ?? '').split(',').filter(Boolean).sort();
  if (before.includes('super_admin') && !after.includes('super_admin') && actual.includes('super_admin')) {
    throw conflict(LAST_SUPER_ADMIN);
  }
}

export async function disableUser(ctx: RequestContext, userId: string): Promise<void> {
  assertCan(ctx, 'users.manage');
  const user = await repo.findStaff(ctx.db, userId);
  if (!user) throw notFound();
  if ((user.roles ?? '').split(',').includes('super_admin') && !isSuperAdmin(ctx)) {
    throw forbidden('Only a Super Administrator can disable a Super Administrator.');
  }
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(repo.disableStaffStmt(ctx.db, userId, now), 'disable')
    .add(
      auditWhen(
        ctx,
        { action: 'user.disabled', entityType: 'user', entityId: userId },
        "EXISTS (SELECT 1 FROM users WHERE id = ? AND status = 'disabled' AND updated_at = ?)",
        userId,
        now,
      ),
    )
    .run();
  if (res.changes('disable') !== 1) {
    throw conflict(user.status === 'disabled' ? 'This user is already disabled.' : LAST_SUPER_ADMIN);
  }
  await revokeAllSessionsOf(ctx, userId);
}

export async function enableUser(ctx: RequestContext, userId: string): Promise<void> {
  assertCan(ctx, 'users.manage');
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(repo.enableStaffStmt(ctx.db, userId, now), 'enable')
    .add(
      auditWhen(
        ctx,
        { action: 'user.enabled', entityType: 'user', entityId: userId },
        "EXISTS (SELECT 1 FROM users WHERE id = ? AND status = 'active' AND updated_at = ?)",
        userId,
        now,
      ),
    )
    .run();
  if (res.changes('enable') !== 1) throw notFound();
}

export type { RoleKey };
