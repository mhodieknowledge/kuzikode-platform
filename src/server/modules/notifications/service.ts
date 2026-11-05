import type { Permission } from '../../../shared/permissions';
import type { RequestContext } from '../../context';
import { stmt } from '../../db/client';
import { newId } from '../../lib/ids';

export interface NotificationInput {
  type: string;
  title: string;
  body?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  /** Same key → only one notification per user (e.g. `job_failed:obx_123`). */
  dedupeKey?: string;
}

/**
 * In-app notification rows for every active staff user holding `permission` (super admins always included).
 * Returns one INSERT … SELECT statement for the caller's batch. Per-user email dispatch follows preferences (P4.16).
 */
export function notifyStaffWithPermission(
  ctx: RequestContext,
  permission: Permission,
  n: NotificationInput,
): D1PreparedStatement {
  return stmt(
    ctx.db,
    `INSERT OR IGNORE INTO notifications (id, user_id, type, title, body, link, entity_type, entity_id, dedupe_key, created_at)
     SELECT ? || '_' || u.id, u.id, ?, ?, ?, ?, ?, ?, CASE WHEN ? IS NULL THEN NULL ELSE ? || ':' || u.id END, ?
     FROM users u
     WHERE u.user_type = 'staff' AND u.status = 'active' AND EXISTS (
       SELECT 1 FROM user_roles ur LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
       WHERE ur.user_id = u.id AND (ur.role_id = 'rol_super_admin' OR rp.permission_key = ?)
     )`,
    newId('ntf', ctx.now().getTime()),
    n.type,
    n.title,
    n.body ?? null,
    n.link ?? null,
    n.entityType ?? null,
    n.entityId ?? null,
    n.dedupeKey ?? null,
    n.dedupeKey ?? null,
    ctx.now().toISOString(),
    permission,
  );
}

export function notifyUser(ctx: RequestContext, userId: string, n: NotificationInput): D1PreparedStatement {
  return stmt(
    ctx.db,
    `INSERT OR IGNORE INTO notifications (id, user_id, type, title, body, link, entity_type, entity_id, dedupe_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId('ntf', ctx.now().getTime()),
    userId,
    n.type,
    n.title,
    n.body ?? null,
    n.link ?? null,
    n.entityType ?? null,
    n.entityId ?? null,
    n.dedupeKey ? `${n.dedupeKey}:${userId}` : null,
    ctx.now().toISOString(),
  );
}
