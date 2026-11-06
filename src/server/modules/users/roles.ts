/**
 * Roles & permissions (P4.2, docs/07 §5). System roles are fixed (generated from src/shared/permissions.ts);
 * a Super Administrator (`roles.manage`) can create, edit and delete custom roles. Custom roles may never hold the
 * super-admin-only permissions. Permissions are read from role_permissions on every request, so edits apply at once.
 */
import { isPermission, SUPER_ADMIN_ONLY, type Permission } from '../../../shared/permissions';
import type { RequestContext } from '../../context';
import { Batch, isUniqueViolation } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { conflict, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { assertCan } from '../../lib/policies';

export interface RoleInfo {
  id: string;
  key: string;
  name: string;
  description: string | null;
  system: boolean;
  permissions: Permission[];
  members: number;
}

export async function listRoles(ctx: RequestContext): Promise<RoleInfo[]> {
  assertCan(ctx, 'users.view');
  const { results } = await ctx.db
    .prepare(
      `SELECT r.id, r.key, r.name, r.description, r.is_system,
         (SELECT group_concat(permission_key) FROM role_permissions WHERE role_id = r.id) AS perms,
         (SELECT COUNT(*) FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE ur.role_id = r.id AND u.status <> 'disabled') AS members
       FROM roles r ORDER BY r.is_system DESC, r.name`,
    )
    .all<{
      id: string;
      key: string;
      name: string;
      description: string | null;
      is_system: number;
      perms: string | null;
      members: number;
    }>();
  return results.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    system: r.is_system === 1,
    permissions: (r.perms ?? '').split(',').filter(isPermission).sort(),
    members: r.members,
  }));
}

function checkPermissions(perms: string[]): Permission[] {
  const unknown = perms.filter((p) => !isPermission(p));
  if (unknown.length) throw validationError({ permissions: [`Unknown permission: ${unknown.join(', ')}`] });
  const reserved = perms.filter((p) => SUPER_ADMIN_ONLY.includes(p as Permission));
  if (reserved.length) {
    throw validationError({ permissions: [`Only the Super Administrator role can hold: ${reserved.join(', ')}`] });
  }
  const out = [...new Set(perms as Permission[])].sort();
  if (!out.includes('dashboard.view')) out.unshift('dashboard.view');
  return out;
}

const insertPerms = (ctx: RequestContext, roleId: string, perms: Permission[]) =>
  ctx.db
    .prepare('INSERT INTO role_permissions (role_id, permission_key) SELECT ?, value FROM json_each(?)')
    .bind(roleId, JSON.stringify(perms));

export async function createRole(
  ctx: RequestContext,
  input: { key: string; name: string; description?: string | undefined; permissions: string[] },
): Promise<{ id: string }> {
  assertCan(ctx, 'roles.manage');
  const perms = checkPermissions(input.permissions);
  const id = newId('rol', ctx.now().getTime());
  const now = ctx.now().toISOString();
  try {
    await new Batch(ctx.db)
      .add(
        ctx.db
          .prepare(
            'INSERT INTO roles (id, key, name, description, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
          )
          .bind(id, input.key, input.name, input.description ?? null, now, now),
      )
      .add(insertPerms(ctx, id, perms))
      .add(
        auditStmt(ctx, {
          action: 'role.created',
          entityType: 'role',
          entityId: id,
          after: { key: input.key, name: input.name, permissions: perms },
        }),
      )
      .run();
  } catch (err) {
    if (isUniqueViolation(err)) throw validationError({ key: ['A role with this key already exists.'] });
    throw err;
  }
  return { id };
}

async function customRole(ctx: RequestContext, roleId: string) {
  const role = (await listRoles(ctx)).find((r) => r.id === roleId);
  if (!role) throw notFound();
  if (role.system) throw conflict('System roles cannot be changed. Create a custom role instead.');
  return role;
}

export async function updateRole(
  ctx: RequestContext,
  roleId: string,
  input: { name: string; description?: string | undefined; permissions: string[] },
): Promise<void> {
  assertCan(ctx, 'roles.manage');
  const role = await customRole(ctx, roleId);
  const perms = checkPermissions(input.permissions);
  await new Batch(ctx.db)
    .add(
      ctx.db
        .prepare('UPDATE roles SET name = ?, description = ?, updated_at = ? WHERE id = ? AND is_system = 0')
        .bind(input.name, input.description ?? null, ctx.now().toISOString(), roleId),
    )
    .add(ctx.db.prepare('DELETE FROM role_permissions WHERE role_id = ?').bind(roleId))
    .add(insertPerms(ctx, roleId, perms))
    .add(
      auditStmt(ctx, {
        action: 'role.updated',
        entityType: 'role',
        entityId: roleId,
        before: { name: role.name, permissions: role.permissions },
        after: { name: input.name, permissions: perms },
      }),
    )
    .run();
}

/** Deletes a custom role that nobody holds (disabled users included, so history stays readable). */
export async function deleteRole(ctx: RequestContext, roleId: string): Promise<void> {
  assertCan(ctx, 'roles.manage');
  const role = await customRole(ctx, roleId);
  const held = await ctx.db
    .prepare('SELECT COUNT(*) AS n FROM user_roles WHERE role_id = ?')
    .bind(roleId)
    .first<{ n: number }>();
  if (held?.n) throw conflict('Remove this role from every user before deleting it.');
  await new Batch(ctx.db)
    .add(ctx.db.prepare('DELETE FROM role_permissions WHERE role_id = ?').bind(roleId))
    .add(
      ctx.db
        .prepare(
          'DELETE FROM roles WHERE id = ? AND is_system = 0 AND NOT EXISTS (SELECT 1 FROM user_roles WHERE role_id = ?)',
        )
        .bind(roleId, roleId),
    )
    .add(
      auditStmt(ctx, {
        action: 'role.deleted',
        entityType: 'role',
        entityId: roleId,
        before: { key: role.key, permissions: role.permissions },
      }),
    )
    .run();
}
