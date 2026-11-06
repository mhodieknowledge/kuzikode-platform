import { notificationLabel, SECURITY_TYPE } from '../../../shared/notifications';
import type { Permission } from '../../../shared/permissions';
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { dispatch, enqueue } from '../../jobs/outbox';
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
  /** Leave out the user who caused the event (default true): nobody needs to be told about their own action. */
  excludeActor?: boolean;
  /** false = in-app only, whatever the preferences (e.g. a failed email job: emailing about it can't help). */
  email?: boolean;
}

const COLUMNS =
  'id, user_id, type, title, body, link, entity_type, entity_id, dedupe_key, created_at, in_app, email_state';

/**
 * Preference-aware channel columns for recipient `u` (users) joined to `np` (notification_preferences for the type).
 * In-app and email default to on. Only staff get notification emails: client-facing emails are sent by the business
 * flow itself (support reply, project update), so a portal notification never emails twice. Security notices are
 * always shown and never emailed from here (the auth flow already sent the security_alert email).
 */
const CHANNELS = `CASE WHEN ? = '${SECURITY_TYPE}' THEN 1 ELSE COALESCE(np.in_app, 1) END,
  CASE WHEN ? = 1 AND ? <> '${SECURITY_TYPE}' AND u.user_type = 'staff' AND COALESCE(np.email, 1) = 1 THEN 'pending' ELSE 'none' END`;
/** A recipient who switched both channels off gets no row at all. */
const WANTED = `(? = '${SECURITY_TYPE}' OR COALESCE(np.in_app, 1) = 1 OR (u.user_type = 'staff' AND COALESCE(np.email, 1) = 1))`;

function values(ctx: RequestContext, n: NotificationInput) {
  return {
    head: [n.type, n.title, n.body ?? null, n.link ?? null, n.entityType ?? null, n.entityId ?? null],
    dedupe: [n.dedupeKey ?? null, n.dedupeKey ?? null],
    now: ctx.now().toISOString(),
    actor: n.excludeActor === false ? '' : (ctx.actor.userId ?? ''),
  };
}

/**
 * Notification rows for every active staff user holding `permission` (super admins always included), following each
 * user's preferences. Returns one INSERT … SELECT statement for the caller's batch; emails go out via
 * `dispatchNotificationEmails` (cron).
 */
export function notifyStaffWithPermission(
  ctx: RequestContext,
  permission: Permission,
  n: NotificationInput,
): D1PreparedStatement {
  const v = values(ctx, n);
  return stmt(
    ctx.db,
    `INSERT OR IGNORE INTO notifications (${COLUMNS})
     SELECT ? || '_' || u.id, u.id, ?, ?, ?, ?, ?, ?, CASE WHEN ? IS NULL THEN NULL ELSE ? || ':' || u.id END, ?, ${CHANNELS}
     FROM users u LEFT JOIN notification_preferences np ON np.user_id = u.id AND np.type = ?
     WHERE u.user_type = 'staff' AND u.status = 'active' AND u.id <> ? AND ${WANTED} AND EXISTS (
       SELECT 1 FROM user_roles ur LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
       WHERE ur.user_id = u.id AND (ur.role_id = 'rol_super_admin' OR rp.permission_key = ?)
     )`,
    newId('ntf', ctx.now().getTime()),
    ...v.head,
    ...v.dedupe,
    v.now,
    n.type,
    n.email === false ? 0 : 1,
    n.type,
    n.type,
    v.actor,
    n.type,
    permission,
  );
}

/** One notification for one user (staff or portal), following their preferences. */
export function notifyUser(ctx: RequestContext, userId: string, n: NotificationInput): D1PreparedStatement {
  const v = values(ctx, n);
  return stmt(
    ctx.db,
    `INSERT OR IGNORE INTO notifications (${COLUMNS})
     SELECT ?, u.id, ?, ?, ?, ?, ?, ?, CASE WHEN ? IS NULL THEN NULL ELSE ? || ':' || u.id END, ?, ${CHANNELS}
     FROM users u LEFT JOIN notification_preferences np ON np.user_id = u.id AND np.type = ?
     WHERE u.id = ? AND u.status = 'active' AND u.id <> ? AND ${WANTED}`,
    newId('ntf', ctx.now().getTime()),
    ...v.head,
    ...v.dedupe,
    v.now,
    n.type,
    n.email === false ? 0 : 1,
    n.type,
    n.type,
    userId,
    v.actor,
    n.type,
  );
}

/** In-app notifications for the active portal users linked to a client (their emails come from the business flow). */
export function notifyClientUsers(ctx: RequestContext, clientId: string, n: NotificationInput): D1PreparedStatement {
  const v = values(ctx, n);
  return stmt(
    ctx.db,
    `INSERT OR IGNORE INTO notifications (${COLUMNS})
     SELECT ? || '_' || u.id, u.id, ?, ?, ?, ?, ?, ?, CASE WHEN ? IS NULL THEN NULL ELSE ? || ':' || u.id END, ?, ${CHANNELS}
     FROM client_user_access a JOIN users u ON u.id = a.user_id
     LEFT JOIN notification_preferences np ON np.user_id = u.id AND np.type = ?
     WHERE a.client_id = ? AND a.status = 'active' AND u.status = 'active' AND u.user_type = 'client' AND ${WANTED}`,
    newId('ntf', ctx.now().getTime()),
    ...v.head,
    ...v.dedupe,
    v.now,
    n.type,
    n.email === false ? 0 : 1,
    n.type,
    n.type,
    clientId,
    n.type,
  );
}

/** In-app security notice for the account owner (new sign-in, password changed/reset, 2FA changed). Always shown. */
export function notifySecurity(
  ctx: RequestContext,
  userId: string,
  n: { title: string; body?: string; link?: string; dedupeKey: string },
): D1PreparedStatement {
  return notifyUser(ctx, userId, {
    ...n,
    type: SECURITY_TYPE,
    entityType: 'user',
    entityId: userId,
    excludeActor: false,
  });
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

/** Only same-site relative links are followed from the UI and emails. */
const safeLink = (link: string | null) => (link && /^\/(?!\/)/.test(link) ? link : null);

/** Latest in-app notifications for a user plus the unread count (bell and notifications page). */
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
         WHERE user_id = ? AND in_app = 1 AND (? = 0 OR read_at IS NULL) ORDER BY created_at DESC, id DESC LIMIT ?`,
      )
      .bind(userId, opts.unreadOnly ? 1 : 0, limit),
    ctx.db
      .prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND in_app = 1 AND read_at IS NULL')
      .bind(userId),
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
      link: safeLink(r.link),
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

const EMAIL_BATCH = 50;

/**
 * Turns pending notification emails into outbox jobs (cron, every 5 minutes). The job and the state change commit in one
 * batch, and the idempotency key is the notification id, so overlapping runs never email anyone twice.
 */
export async function dispatchNotificationEmails(ctx: RequestContext): Promise<{ queued: number; skipped: number }> {
  const { results } = await ctx.db
    .prepare(
      `SELECT n.id, n.type, n.title, n.body, n.link, u.email, u.name, u.status
       FROM notifications n JOIN users u ON u.id = n.user_id
       WHERE n.email_state = 'pending' ORDER BY n.created_at, n.id LIMIT ?`,
    )
    .bind(EMAIL_BATCH)
    .all<{
      id: string;
      type: string;
      title: string;
      body: string | null;
      link: string | null;
      email: string | null;
      name: string;
      status: string;
    }>();
  if (results.length === 0) return { queued: 0, skipped: 0 };
  const batch = new Batch(ctx.db);
  const jobIds: string[] = [];
  let skipped = 0;
  for (const n of results) {
    if (n.status !== 'active' || !n.email) {
      skipped++;
      batch.add(
        stmt(ctx.db, "UPDATE notifications SET email_state = 'skipped' WHERE id = ? AND email_state = 'pending'", n.id),
      );
      continue;
    }
    const link = safeLink(n.link);
    const job = enqueue(ctx, {
      type: 'email.send',
      payload: {
        template: 'notification',
        to: n.email,
        data: {
          name: n.name,
          label: notificationLabel(n.type),
          title: n.title,
          ...(n.body ? { body: n.body } : {}),
          ...(link ? { link: new URL(link, ctx.config.siteOrigin).toString() } : {}),
        },
      },
      idempotencyKey: `email:notification:${n.id}`,
    });
    jobIds.push(job.id);
    batch
      .add(job.stmt)
      .add(
        stmt(ctx.db, "UPDATE notifications SET email_state = 'queued' WHERE id = ? AND email_state = 'pending'", n.id),
      );
  }
  await batch.run();
  dispatch(ctx, jobIds);
  return { queued: jobIds.length, skipped };
}
