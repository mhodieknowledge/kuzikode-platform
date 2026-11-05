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

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Latest notifications for a user plus the unread count (bell and notifications page). */
export async function listNotifications(
  ctx: RequestContext,
  userId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {},
): Promise<{ items: NotificationItem[]; unread: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const [list, count] = await ctx.db.batch([
    ctx.db
      .prepare(
        `SELECT id, type, title, body, link, read_at, created_at FROM notifications
         WHERE user_id = ? AND (? = 0 OR read_at IS NULL) ORDER BY created_at DESC, id DESC LIMIT ?`,
      )
      .bind(userId, opts.unreadOnly ? 1 : 0, limit),
    ctx.db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(userId),
  ]);
  const rows = (list?.results ?? []) as {
    id: string;
    type: string;
    title: string;
    body: string | null;
    link: string | null;
    read_at: string | null;
    created_at: string;
  }[];
  return {
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      // Only same-site relative links are followed from the UI.
      link: r.link && /^\/(?!\/)/.test(r.link) ? r.link : null,
      readAt: r.read_at,
      createdAt: r.created_at,
    })),
    unread: ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0,
  };
}

/** Marks the given notifications (or all, when ids is empty) as read. Only the owner's rows are touched. */
export async function markNotificationsRead(ctx: RequestContext, userId: string, ids: string[]): Promise<number> {
  const now = ctx.now().toISOString();
  const res = ids.length
    ? await ctx.db
        .prepare(
          'UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (SELECT value FROM json_each(?))',
        )
        .bind(now, userId, JSON.stringify(ids.slice(0, 100)))
        .run()
    : await ctx.db
        .prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
        .bind(now, userId)
        .run();
  return res.meta.changes ?? 0;
}
