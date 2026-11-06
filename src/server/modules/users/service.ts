import { type RoleKey } from '../../../shared/permissions';
import type { RequestContext } from '../../context';
import { Batch } from '../../db/client';
import { auditStmt, auditWhen } from '../../lib/audit';
import { conflict, forbidden, notFound, validationError } from '../../lib/errors';
import { assertCan, isSuperAdmin } from '../../lib/policies';
import { buildInvitation, revokeAllSessionsOf } from '../auth';
import { dispatch, enqueue } from '../../jobs/outbox';
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
        "EXISTS (SELECT 1 FROM users WHERE id = ? AND status <> 'disabled' AND updated_at = ?)",
        userId,
        now,
      ),
    )
    .run();
  if (res.changes('enable') !== 1) throw notFound();
}

export type { RoleKey };

// ---------------------------------------------------------------- listing, invitations, profile (P4.2)

export interface StaffSummary {
  id: string;
  name: string;
  email: string;
  status: 'invited' | 'active' | 'disabled';
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string;
  mfaEnabled: boolean;
  invitationPending: boolean;
}

const toSummary = (r: repo.StaffListRow): StaffSummary => ({
  id: r.id,
  name: r.name,
  email: r.email,
  status: r.status as StaffSummary['status'],
  roles: (r.roles ?? '').split(',').filter(Boolean).sort(),
  lastLoginAt: r.last_login_at,
  createdAt: r.created_at,
  mfaEnabled: r.mfa_enabled === 1,
  invitationPending: r.invited_pending === 1,
});

export async function listStaff(
  ctx: RequestContext,
  filter: { q?: string | undefined; status?: string | undefined; role?: string | undefined } = {},
): Promise<StaffSummary[]> {
  assertCan(ctx, 'users.view');
  const where: string[] = [];
  const params: unknown[] = [ctx.now().toISOString()];
  if (filter.q) {
    where.push("(u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')");
    const like = `%${filter.q
      .trim()
      .slice(0, 80)
      .replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    params.push(like, like);
  }
  if (filter.status && ['invited', 'active', 'disabled'].includes(filter.status)) {
    where.push('u.status = ?');
    params.push(filter.status);
  }
  if (filter.role) {
    where.push(
      'EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.key = ?)',
    );
    params.push(filter.role);
  }
  const { results } = await ctx.db
    .prepare(
      `${repo.STAFF_LIST_SQL}${where.length ? ` AND ${where.join(' AND ')}` : ''} ORDER BY u.status = 'disabled', u.name LIMIT 500`,
    )
    .bind(...params)
    .all<repo.StaffListRow>();
  return results.map(toSummary);
}

export async function getStaff(ctx: RequestContext, userId: string) {
  assertCan(ctx, 'users.view');
  const row = await ctx.db
    .prepare(`${repo.STAFF_LIST_SQL} AND u.id = ?`)
    .bind(ctx.now().toISOString(), userId)
    .first<repo.StaffListRow>();
  if (!row) throw notFound();
  const [sessions, history] = await ctx.db.batch([
    ctx.db
      .prepare(
        "SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND audience = 'admin' AND revoked_at IS NULL AND expires_at > ?",
      )
      .bind(userId, ctx.now().toISOString()),
    ctx.db
      .prepare(
        `SELECT a.action, a.created_at, a.before AS before_json, a.after AS after_json, u.name AS actor_name FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_user_id WHERE a.entity_type = 'user' AND a.entity_id = ? ORDER BY a.created_at DESC LIMIT 50`,
      )
      .bind(userId),
  ]);
  return {
    ...toSummary(row),
    activeSessions: ((sessions?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0,
    history: (history?.results ?? []) as {
      action: string;
      created_at: string;
      before_json: string | null;
      after_json: string | null;
      actor_name: string | null;
    }[],
  };
}

/** Invites a staff member with roles. Only a Super Administrator may invite another Super Administrator. */
export async function inviteStaff(
  ctx: RequestContext,
  input: { name: string; email: string; roles: string[] },
): Promise<{ userId: string }> {
  assertCan(ctx, 'users.manage');
  const known = new Set(await repo.listRoleKeys(ctx.db));
  const roles = [...new Set(input.roles)];
  const unknown = roles.filter((r) => !known.has(r));
  if (unknown.length) throw validationError({ roles: [`Unknown role: ${unknown.join(', ')}`] });
  if (roles.length === 0) throw validationError({ roles: ['Choose at least one role.'] });
  if (roles.includes('super_admin') && !isSuperAdmin(ctx)) {
    throw forbidden('Only a Super Administrator can invite a Super Administrator.');
  }
  return sendStaffInvitation(ctx, { name: input.name, email: input.email, roles }, [], 'user.invited');
}

/** Invitation rows (incl. its audit row) and the email job in one atomic batch. */
async function sendStaffInvitation(
  ctx: RequestContext,
  input: { name: string; email: string; roles: string[] },
  before: D1PreparedStatement[],
  action: 'user.invited' | 'user.invitation_resent',
): Promise<{ userId: string }> {
  const inv = await buildInvitation(ctx, { kind: 'staff', ...input }, ctx.actor.userId);
  const email = enqueue(ctx, {
    type: 'email.send',
    payload: {
      template: 'staff_invitation',
      to: input.email.toLowerCase(),
      data: { name: input.name, link: inv.link, expiresInDays: 7 },
    },
    idempotencyKey: `email:invite:${inv.tokenId}`,
  });
  await new Batch(ctx.db)
    .addAll(before)
    .addAll(inv.statements)
    .add(email.stmt)
    // buildInvitation already expires older links and audits 'user.invited'; a resend is recorded as well.
    .addAll(
      action === 'user.invitation_resent' ? [auditStmt(ctx, { action, entityType: 'user', entityId: inv.userId })] : [],
    )
    .run();
  dispatch(ctx, [email.id]);
  return { userId: inv.userId };
}

/** Sends a fresh invitation link to someone who has not accepted yet (older links stop working). */
export async function resendInvitation(ctx: RequestContext, userId: string): Promise<void> {
  assertCan(ctx, 'users.manage');
  const user = await repo.findStaff(ctx.db, userId);
  if (!user) throw notFound();
  if (user.status !== 'invited') throw conflict('This person has already accepted their invitation.');
  const roles = (user.roles ?? '').split(',').filter(Boolean);
  if (roles.includes('super_admin') && !isSuperAdmin(ctx)) throw forbidden();
  await sendStaffInvitation(ctx, { name: user.name, email: user.email, roles }, [], 'user.invitation_resent');
}

export async function renameStaff(ctx: RequestContext, userId: string, name: string): Promise<void> {
  assertCan(ctx, 'users.manage');
  const user = await repo.findStaff(ctx.db, userId);
  if (!user) throw notFound();
  if (user.name === name) return;
  await new Batch(ctx.db)
    .add(
      ctx.db
        .prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ? AND user_type = 'staff'")
        .bind(name, ctx.now().toISOString(), userId),
    )
    .add(
      auditStmt(ctx, {
        action: 'user.renamed',
        entityType: 'user',
        entityId: userId,
        before: { name: user.name },
        after: { name },
      }),
    )
    .run();
}
