/**
 * Support inbox (P4.14). Requests are numbered (`numbering.support`), threaded, assignable and moved through
 * open → waiting for the client → resolved → closed. Staff messages are either replies (seen by the client, emailed
 * to them) or internal notes (never shown or sent to the client; their attachments are not readable from the portal).
 * Clients open requests from the portal (Phase 5); staff can open one on a client's behalf now.
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { businessYear } from '../../lib/dates';
import { notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { assertCan } from '../../lib/policies';
import { numberSqlExpr, sequenceKey } from '../../lib/sequences';
import { dispatch, enqueue } from '../../jobs/outbox';
import type { NewSupportInput, SupportListQuery, SupportReplyInput } from '../../../shared/schemas/support';
import type { SupportPriority, SupportStatus } from '../../../shared/support';
import { getSettings, settingText } from '../cms';
import { storeUpload } from '../files/service';
import { notifyClientUsers, notifyStaffWithPermission, notifyUser } from '../notifications';

export const PAGE_SIZE = 25;

export interface SupportRow {
  id: string;
  reference: string;
  client_id: string;
  opened_by: string;
  subject: string;
  category: string;
  priority: SupportPriority;
  status: SupportStatus;
  assigned_to: string | null;
  project_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listRequests(ctx: RequestContext, f: SupportListQuery) {
  assertCan(ctx, 'support.view');
  const where: string[] = [];
  const params: unknown[] = [];
  const status = f.status ?? 'active';
  if (status === 'active') where.push("r.status IN ('open','awaiting_client')");
  else if (status !== 'all') {
    where.push('r.status = ?');
    params.push(status);
  }
  if (f.priority) {
    where.push('r.priority = ?');
    params.push(f.priority);
  }
  if (f.assignee === 'none') where.push('r.assigned_to IS NULL');
  else if (f.assignee) {
    where.push('r.assigned_to = ?');
    params.push(f.assignee === 'me' ? ctx.actor.userId : f.assignee);
  }
  if (f.clientId) {
    where.push('r.client_id = ?');
    params.push(f.clientId);
  }
  if (f.q?.trim()) {
    const l = `%${f.q
      .trim()
      .slice(0, 80)
      .replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push("(r.reference LIKE ? ESCAPE '\\' OR r.subject LIKE ? ESCAPE '\\' OR c.display_name LIKE ? ESCAPE '\\')");
    params.push(l, l, l);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = 'FROM support_requests r JOIN clients c ON c.id = r.client_id';
  const [count, rows, counts] = await ctx.db.batch([
    ctx.db.prepare(`SELECT COUNT(*) AS n ${from} ${w}`).bind(...params),
    ctx.db
      .prepare(
        `SELECT r.id, r.reference, r.subject, r.status, r.priority, r.category, r.last_message_at, r.created_at,
           c.id AS client_id, c.display_name AS client_name, u.name AS assignee,
           (SELECT a.user_type FROM support_messages m JOIN users a ON a.id = m.author_id
            WHERE m.request_id = r.id AND m.is_internal_note = 0 ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_author_type
         ${from} LEFT JOIN users u ON u.id = r.assigned_to ${w}
         ORDER BY CASE r.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
           COALESCE(r.last_message_at, r.created_at) DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, PAGE_SIZE, (f.page - 1) * PAGE_SIZE),
    ctx.db.prepare('SELECT status, COUNT(*) AS n FROM support_requests GROUP BY status'),
  ]);
  const total = ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  return {
    total,
    page: f.page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts: Object.fromEntries(
      ((counts?.results ?? []) as { status: string; n: number }[]).map((r) => [r.status, r.n]),
    ),
    items: (rows?.results ?? []) as {
      id: string;
      reference: string;
      subject: string;
      status: SupportStatus;
      priority: SupportPriority;
      category: string;
      last_message_at: string | null;
      created_at: string;
      client_id: string;
      client_name: string;
      assignee: string | null;
      last_author_type: string | null;
    }[],
  };
}

export async function loadRow(ctx: RequestContext, id: string): Promise<SupportRow> {
  const r = await ctx.db.prepare('SELECT * FROM support_requests WHERE id = ?').bind(id).first<SupportRow>();
  if (!r) throw notFound();
  return r;
}

export async function getRequest(ctx: RequestContext, id: string) {
  assertCan(ctx, 'support.view');
  const r = await loadRow(ctx, id);
  const [client, messages, attachments, project, opener] = await ctx.db.batch([
    ctx.db.prepare('SELECT id, client_number, display_name, email FROM clients WHERE id = ?').bind(r.client_id),
    ctx.db
      .prepare(
        `SELECT m.id, m.body, m.is_internal_note, m.created_at, u.name AS author, u.user_type
         FROM support_messages m JOIN users u ON u.id = m.author_id WHERE m.request_id = ? ORDER BY m.created_at, m.id`,
      )
      .bind(id),
    ctx.db
      .prepare(
        `SELECT a.message_id, f.id AS file_id, f.original_name, f.size_bytes FROM support_attachments a
         JOIN support_messages m ON m.id = a.message_id JOIN files f ON f.id = a.file_id WHERE m.request_id = ?`,
      )
      .bind(id),
    ctx.db.prepare('SELECT id, reference, name FROM projects WHERE id = ?').bind(r.project_id ?? ''),
    ctx.db.prepare('SELECT name, user_type FROM users WHERE id = ?').bind(r.opened_by),
  ]);
  const rows = <T>(x: D1Result | undefined) => (x?.results ?? []) as T[];
  const files = rows<{ message_id: string; file_id: string; original_name: string; size_bytes: number }>(attachments);
  return {
    request: r,
    client: rows<{ id: string; client_number: string; display_name: string; email: string | null }>(client)[0] ?? null,
    project: rows<{ id: string; reference: string; name: string }>(project)[0] ?? null,
    openedBy: rows<{ name: string; user_type: string }>(opener)[0] ?? null,
    messages: rows<{
      id: string;
      body: string;
      is_internal_note: number;
      created_at: string;
      author: string;
      user_type: string;
    }>(messages).map((m) => ({ ...m, attachments: files.filter((f) => f.message_id === m.id) })),
  };
}

export async function supportStaff(ctx: RequestContext) {
  const { results } = await ctx.db
    .prepare(
      `SELECT DISTINCT u.id, u.name FROM users u JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
       WHERE u.user_type = 'staff' AND u.status = 'active' AND (ur.role_id = 'rol_super_admin' OR rp.permission_key = 'support.reply')
       ORDER BY u.name`,
    )
    .all<{ id: string; name: string }>();
  return results;
}

async function checkAssignee(ctx: RequestContext, userId: string | null | undefined) {
  if (!userId) return;
  if (!(await supportStaff(ctx)).some((s) => s.id === userId))
    throw validationError({ assignedTo: ['Choose a staff member who can answer support requests.'] });
}

/** The client's main contact (or the client email): where staff replies are sent. */
async function clientRecipient(ctx: RequestContext, clientId: string) {
  return ctx.db
    .prepare(
      `SELECT COALESCE(k.name, c.display_name) AS name, COALESCE(k.email, c.email) AS email FROM clients c
       LEFT JOIN client_contacts k ON k.client_id = c.id AND k.is_primary = 1 WHERE c.id = ?`,
    )
    .bind(clientId)
    .first<{ name: string; email: string | null }>();
}

/**
 * Statements that number and insert a request with its first message and tell support staff (shared by staff-opened
 * and portal-opened requests). The caller adds its own audit row (and attachments) to the same batch.
 */
export async function requestStatements(
  ctx: RequestContext,
  input: {
    clientId: string;
    subject: string;
    category: string;
    priority: SupportPriority;
    assignedTo: string | null;
    projectId: string | null;
    body: string;
  },
): Promise<{ id: string; messageId: string; stmts: D1PreparedStatement[] }> {
  const settings = await getSettings(ctx);
  const format = settingText(settings, 'numbering.support') ?? 'SUP-{YYYY}-{SEQ:4}';
  const year = businessYear(ctx.now());
  const key = sequenceKey('support', format, year);
  const number = numberSqlExpr(key, format, year);
  const id = newId('sup', ctx.now().getTime());
  const messageId = newId('smg', ctx.now().getTime());
  const now = ctx.now().toISOString();
  return {
    id,
    messageId,
    stmts: [
      stmt(ctx.db, 'INSERT OR IGNORE INTO sequences (key, next_value) VALUES (?, 1)', key),
      stmt(ctx.db, 'UPDATE sequences SET next_value = next_value + 1 WHERE key = ?', key),
      stmt(
        ctx.db,
        `INSERT INTO support_requests (id, reference, client_id, opened_by, subject, category, priority, status, assigned_to,
           project_id, last_message_at, created_at, updated_at)
         VALUES (?, ${number.sql}, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
        id,
        ...number.params,
        input.clientId,
        ctx.actor.userId,
        input.subject,
        input.category,
        input.priority,
        input.assignedTo,
        input.projectId,
        now,
        now,
        now,
      ),
      stmt(
        ctx.db,
        'INSERT INTO support_messages (id, request_id, author_id, body, is_internal_note, created_at) VALUES (?, ?, ?, ?, 0, ?)',
        messageId,
        id,
        ctx.actor.userId,
        input.body,
        now,
      ),
      notifyStaffWithPermission(ctx, 'support.view', {
        type: 'support.created',
        title: `New support request: ${input.subject}`,
        link: `/admin/support/${id}`,
        entityType: 'support_request',
        entityId: id,
        dedupeKey: `support_created:${id}`,
      }),
    ],
  };
}

export async function createRequest(
  ctx: RequestContext,
  input: NewSupportInput,
): Promise<{ id: string; reference: string }> {
  assertCan(ctx, 'support.reply');
  const [client, project] = await ctx.db.batch([
    ctx.db.prepare('SELECT id FROM clients WHERE id = ?').bind(input.clientId),
    ctx.db
      .prepare('SELECT id FROM projects WHERE id = ? AND client_id = ?')
      .bind(input.projectId ?? '', input.clientId),
  ]);
  if (!(client?.results ?? []).length) throw validationError({ clientId: ['Choose a client.'] });
  if (input.projectId && !(project?.results ?? []).length)
    throw validationError({ projectId: ["Choose one of this client's projects."] });
  await checkAssignee(ctx, input.assignedTo);
  const created = await requestStatements(ctx, {
    clientId: input.clientId,
    subject: input.subject,
    category: input.category,
    priority: input.priority,
    assignedTo: input.assignedTo ?? null,
    projectId: input.projectId ?? null,
    body: input.body,
  });
  await new Batch(ctx.db)
    .addAll(created.stmts)
    .add(
      auditStmt(ctx, {
        action: 'support.created',
        entityType: 'support_request',
        entityId: created.id,
        after: { clientId: input.clientId, subject: input.subject, onBehalf: true },
      }),
    )
    .run();
  const id = created.id;
  const r = await loadRow(ctx, id);
  return { id, reference: r.reference };
}

/**
 * A staff reply (emailed to the client and moving the request to "waiting for the client" unless another status is
 * chosen) or an internal note (no email, status unchanged unless chosen). Attachments are stored with the message.
 */
export async function reply(
  ctx: RequestContext,
  id: string,
  input: SupportReplyInput,
  files: { bytes: Uint8Array<ArrayBuffer>; filename: string }[] = [],
): Promise<{ messageId: string; status: SupportStatus }> {
  assertCan(ctx, 'support.reply');
  if (input.status && input.status !== 'awaiting_client') assertCan(ctx, 'support.manage');
  const r = await loadRow(ctx, id);
  if (files.length > 5) throw validationError({ files: ['Attach at most 5 files.'] });
  const stored = [];
  for (const f of files)
    stored.push(
      await storeUpload(ctx, {
        bytes: f.bytes,
        filename: f.filename,
        purpose: 'document',
        ownerType: 'support',
        ownerId: id,
      }),
    );
  const status: SupportStatus = input.status ?? (input.internal ? r.status : 'awaiting_client');
  const messageId = newId('smg', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const to = input.internal ? null : await clientRecipient(ctx, r.client_id);
  const job =
    to?.email && !input.internal
      ? enqueue(ctx, {
          type: 'email.send',
          payload: {
            template: 'support_reply',
            to: to.email,
            data: { name: to.name, reference: r.reference, subject: r.subject, body: input.body },
          },
          idempotencyKey: `email:support_reply:${messageId}`,
        })
      : null;
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'INSERT INTO support_messages (id, request_id, author_id, body, is_internal_note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        messageId,
        id,
        ctx.actor.userId,
        input.body,
        input.internal ? 1 : 0,
        now,
      ),
    )
    .addAll(stored.map((s) => s.stmt))
    .addAll(
      stored.map((s) =>
        stmt(ctx.db, 'INSERT INTO support_attachments (message_id, file_id) VALUES (?, ?)', messageId, s.id),
      ),
    )
    .add(
      stmt(
        ctx.db,
        `UPDATE support_requests SET status = ?, last_message_at = CASE WHEN ? = 1 THEN last_message_at ELSE ? END,
           assigned_to = COALESCE(assigned_to, ?), updated_at = ? WHERE id = ?`,
        status,
        input.internal ? 1 : 0,
        now,
        ctx.actor.userId,
        now,
        id,
      ),
    )
    // Portal users of the client see the reply in their notifications (Phase 5 portal).
    .addAll(
      input.internal
        ? []
        : [
            notifyClientUsers(ctx, r.client_id, {
              type: 'support.replied',
              title: `Reply on ${r.reference}: ${r.subject}`,
              body: input.body.slice(0, 200),
              link: `/portal/support/${id}`,
              entityType: 'support_request',
              entityId: id,
              dedupeKey: `support_reply:${messageId}`,
            }),
          ],
    )
    // The assignee hears about replies and notes someone else added (notifyUser skips the author).
    .addAll(
      r.assigned_to
        ? [
            notifyUser(ctx, r.assigned_to, {
              type: 'support.replied',
              title: `${input.internal ? 'Internal note' : 'Reply'} on ${r.reference}: ${r.subject}`,
              body: input.body.slice(0, 200),
              link: `/admin/support/${id}`,
              entityType: 'support_request',
              entityId: id,
              dedupeKey: `support_reply_staff:${messageId}`,
            }),
          ]
        : [],
    )
    .addAll(job ? [job.stmt] : [])
    .add(
      auditStmt(ctx, {
        action: input.internal ? 'support.note_added' : 'support.replied',
        entityType: 'support_request',
        entityId: id,
        after: { messageId, status, attachments: stored.length },
      }),
    )
    .run();
  if (job) dispatch(ctx, [job.id]);
  return { messageId, status };
}

export async function updateRequest(
  ctx: RequestContext,
  id: string,
  input: {
    status?: SupportStatus | undefined;
    priority?: SupportPriority | undefined;
    assignedTo?: string | null | undefined;
  },
): Promise<void> {
  assertCan(ctx, 'support.manage');
  const r = await loadRow(ctx, id);
  if (input.assignedTo !== undefined) await checkAssignee(ctx, input.assignedTo);
  const next = {
    status: input.status ?? r.status,
    priority: input.priority ?? r.priority,
    assignedTo: input.assignedTo === undefined ? r.assigned_to : input.assignedTo,
  };
  const assignedNotice =
    next.assignedTo && next.assignedTo !== r.assigned_to && next.assignedTo !== ctx.actor.userId
      ? [
          stmt(
            ctx.db,
            `INSERT OR IGNORE INTO notifications (id, user_id, type, title, link, entity_type, entity_id, dedupe_key, created_at)
             VALUES (?, ?, 'support.created', ?, ?, 'support_request', ?, ?, ?)`,
            newId('ntf', ctx.now().getTime()),
            next.assignedTo,
            `${r.reference} was assigned to you`,
            `/admin/support/${id}`,
            id,
            `support_assigned:${id}:${next.assignedTo}:${ctx.now().toISOString()}`,
            ctx.now().toISOString(),
          ),
        ]
      : [];
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'UPDATE support_requests SET status = ?, priority = ?, assigned_to = ?, updated_at = ? WHERE id = ?',
        next.status,
        next.priority,
        next.assignedTo,
        ctx.now().toISOString(),
        id,
      ),
    )
    .addAll(assignedNotice)
    .add(
      auditStmt(ctx, {
        action: 'support.updated',
        entityType: 'support_request',
        entityId: id,
        before: { status: r.status, priority: r.priority, assignedTo: r.assigned_to },
        after: next,
      }),
    )
    .run();
}

/** Clients and their projects for the "new request on behalf of a client" form. */
export async function newRequestOptions(ctx: RequestContext) {
  assertCan(ctx, 'support.reply');
  const [clients, projects] = await ctx.db.batch([
    ctx.db.prepare(
      "SELECT id, display_name AS name, client_number AS number FROM clients WHERE status = 'active' ORDER BY display_name LIMIT 2000",
    ),
    ctx.db.prepare(
      "SELECT id, client_id, reference || ' · ' || name AS label FROM projects WHERE status IN ('planning','active','on_hold') ORDER BY reference DESC LIMIT 1000",
    ),
  ]);
  return {
    clients: (clients?.results ?? []) as { id: string; name: string; number: string }[],
    projects: (projects?.results ?? []) as { id: string; client_id: string; label: string }[],
    staff: await supportStaff(ctx),
  };
}
