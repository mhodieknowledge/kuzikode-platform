/**
 * Client portal support (P5.7): the client's requests, the public part of each thread (internal notes never leave
 * the server), opening a request, replying with attachments and marking a request resolved. Scoped to the caller's
 * clients for the support area (every access role). Clients do not set priority: staff triage it (DECISIONS).
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { AppError, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { clientScope, portalAreaClientIds } from '../../lib/policies';
import { enforce } from '../../lib/rate-limit';
import { dispatch, enqueue } from '../../jobs/outbox';
import type { PortalNewSupportInput } from '../../../shared/schemas/support';
import { SUPPORT_CATEGORIES, type SupportStatus } from '../../../shared/support';
import { storeUpload } from '../files/service';
import { notifyStaffWithPermission, notifyUser } from '../notifications';
import { loadRow, requestStatements, type SupportRow } from './service';

export type UploadedFile = { bytes: Uint8Array<ArrayBuffer>; filename: string };
export const MAX_PORTAL_FILES = 5;

const supportClients = (ctx: RequestContext) => portalAreaClientIds(ctx, 'support');
const categoryLabel = (v: string) => SUPPORT_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export interface PortalSupportListItem {
  id: string;
  reference: string;
  subject: string;
  category: string;
  status: SupportStatus;
  clientName: string;
  lastMessageAt: string | null;
  createdAt: string;
  /** The last client-visible message came from the team (the client may want to answer). */
  teamReplied: boolean;
}

export async function listPortalRequests(
  ctx: RequestContext,
  f: { show: 'open' | 'all' },
): Promise<PortalSupportListItem[]> {
  const s = clientScope('r.client_id', supportClients(ctx));
  const open = f.show === 'open' ? "AND r.status IN ('open','awaiting_client')" : '';
  const { results } = await ctx.db
    .prepare(
      `SELECT r.id, r.reference, r.subject, r.category, r.status, r.last_message_at, r.created_at, c.display_name AS client_name,
         (SELECT a.user_type FROM support_messages m JOIN users a ON a.id = m.author_id
          WHERE m.request_id = r.id AND m.is_internal_note = 0 ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_author_type
       FROM support_requests r JOIN clients c ON c.id = r.client_id
       WHERE ${s.sql} ${open}
       ORDER BY CASE WHEN r.status IN ('open','awaiting_client') THEN 0 ELSE 1 END, COALESCE(r.last_message_at, r.created_at) DESC
       LIMIT 500`,
    )
    .bind(...s.params)
    .all<{
      id: string;
      reference: string;
      subject: string;
      category: string;
      status: SupportStatus;
      last_message_at: string | null;
      created_at: string;
      client_name: string;
      last_author_type: string | null;
    }>();
  return results.map((r) => ({
    id: r.id,
    reference: r.reference,
    subject: r.subject,
    category: categoryLabel(r.category),
    status: r.status,
    clientName: r.client_name,
    lastMessageAt: r.last_message_at,
    createdAt: r.created_at,
    teamReplied: r.last_author_type === 'staff',
  }));
}

async function loadScoped(ctx: RequestContext, id: string): Promise<SupportRow> {
  const s = clientScope('client_id', supportClients(ctx));
  const r = await ctx.db
    .prepare(`SELECT * FROM support_requests WHERE id = ? AND ${s.sql}`)
    .bind(id, ...s.params)
    .first<SupportRow>();
  if (!r) throw notFound();
  return r;
}

export interface PortalSupportRequest {
  request: {
    id: string;
    reference: string;
    subject: string;
    category: string;
    status: SupportStatus;
    clientName: string;
    project: { id: string; reference: string; name: string } | null;
    createdAt: string;
  };
  messages: {
    id: string;
    body: string;
    author: string;
    fromTeam: boolean;
    mine: boolean;
    createdAt: string;
    attachments: { fileId: string; name: string; size: number }[];
  }[];
}

/** One request as the client sees it: internal notes and their attachments are never selected. */
export async function getPortalRequest(ctx: RequestContext, id: string): Promise<PortalSupportRequest> {
  const r = await loadScoped(ctx, id);
  const projectScope = clientScope('client_id', portalAreaClientIds(ctx, 'projects'));
  const [client, messages, attachments, project] = await ctx.db.batch([
    ctx.db.prepare('SELECT display_name FROM clients WHERE id = ?').bind(r.client_id),
    ctx.db
      .prepare(
        `SELECT m.id, m.body, m.created_at, m.author_id, u.user_type, COALESCE(u.public_display_name, u.name) AS author
         FROM support_messages m JOIN users u ON u.id = m.author_id
         WHERE m.request_id = ? AND m.is_internal_note = 0 ORDER BY m.created_at, m.id`,
      )
      .bind(id),
    ctx.db
      .prepare(
        `SELECT a.message_id, f.id AS file_id, f.original_name, f.size_bytes FROM support_attachments a
         JOIN support_messages m ON m.id = a.message_id JOIN files f ON f.id = a.file_id
         WHERE m.request_id = ? AND m.is_internal_note = 0 ORDER BY f.created_at, f.id`,
      )
      .bind(id),
    // The linked project is only shown to contacts who can open projects.
    ctx.db
      .prepare(`SELECT id, reference, name FROM projects WHERE id = ? AND ${projectScope.sql}`)
      .bind(r.project_id ?? '', ...projectScope.params),
  ]);
  type M = { id: string; body: string; created_at: string; author_id: string; user_type: string; author: string };
  type A = { message_id: string; file_id: string; original_name: string; size_bytes: number };
  const files = (attachments?.results ?? []) as A[];
  const me = ctx.auth!.user.id;
  return {
    request: {
      id: r.id,
      reference: r.reference,
      subject: r.subject,
      category: categoryLabel(r.category),
      status: r.status,
      clientName: ((client?.results ?? [])[0] as { display_name: string } | undefined)?.display_name ?? '',
      project: ((project?.results ?? [])[0] as { id: string; reference: string; name: string } | undefined) ?? null,
      createdAt: r.created_at,
    },
    messages: ((messages?.results ?? []) as M[]).map((m) => ({
      id: m.id,
      body: m.body,
      author: m.author,
      fromTeam: m.user_type === 'staff',
      mine: m.author_id === me,
      createdAt: m.created_at,
      attachments: files
        .filter((f) => f.message_id === m.id)
        .map((f) => ({ fileId: f.file_id, name: f.original_name, size: f.size_bytes })),
    })),
  };
}

/** Choices for the "new request" form: the clients the caller can open requests for, and their projects. */
export async function portalSupportOptions(ctx: RequestContext) {
  const ids = supportClients(ctx);
  const s = clientScope('id', ids);
  const ps = clientScope('client_id', portalAreaClientIds(ctx, 'projects'));
  const [clients, projects] = await ctx.db.batch([
    ctx.db
      .prepare(`SELECT id, display_name AS name FROM clients WHERE ${s.sql} ORDER BY display_name`)
      .bind(...s.params),
    ctx.db
      .prepare(
        `SELECT id, client_id, reference || ' · ' || name AS label FROM projects
         WHERE ${ps.sql} AND status IN ('planning','active','on_hold','completed') ORDER BY reference DESC LIMIT 200`,
      )
      .bind(...ps.params),
  ]);
  return {
    clients: (clients?.results ?? []) as { id: string; name: string }[],
    projects: (projects?.results ?? []) as { id: string; client_id: string; label: string }[],
  };
}

async function storeFiles(ctx: RequestContext, requestId: string, files: UploadedFile[]) {
  if (files.length > MAX_PORTAL_FILES) throw validationError({ files: [`Attach at most ${MAX_PORTAL_FILES} files.`] });
  const stored = [];
  for (const f of files) {
    try {
      stored.push(
        await storeUpload(ctx, {
          bytes: f.bytes,
          filename: f.filename,
          purpose: 'document',
          ownerType: 'support',
          ownerId: requestId,
        }),
      );
    } catch (err) {
      // Report upload problems against the attachments field of the form.
      if (err instanceof AppError && err.code === 'VALIDATION_FAILED')
        throw validationError({ files: [err.message] }, err.message);
      throw err;
    }
  }
  return stored;
}

/**
 * Opens a request for one of the caller's clients (the only one, or the one chosen). The first message carries the
 * attachments; support staff are notified and the client gets an acknowledgement email.
 */
export async function createPortalRequest(
  ctx: RequestContext,
  input: PortalNewSupportInput,
  files: UploadedFile[] = [],
  opts: { auditAction?: string; auditAfter?: Record<string, unknown> } = {},
): Promise<{ id: string; reference: string }> {
  const ids = supportClients(ctx);
  const clientId = input.clientId ?? (ids.length === 1 ? ids[0] : undefined);
  if (!clientId || !ids.includes(clientId))
    throw validationError({
      clientId: [ids.length ? 'Choose the company this request is for.' : 'No company is linked to your account yet.'],
    });
  if (input.projectId) {
    const ps = clientScope('client_id', portalAreaClientIds(ctx, 'projects'));
    const p = await ctx.db
      .prepare(`SELECT id FROM projects WHERE id = ? AND client_id = ? AND ${ps.sql}`)
      .bind(input.projectId, clientId, ...ps.params)
      .first();
    if (!p) throw validationError({ projectId: ['Choose one of your projects, or leave this empty.'] });
  }
  await enforce(ctx, { key: `support-create:user:${ctx.auth!.user.id}`, limit: 10, windowSeconds: 3600 });
  const created = await requestStatements(ctx, {
    clientId,
    subject: input.subject,
    category: input.category,
    priority: 'normal',
    assignedTo: null,
    projectId: input.projectId ?? null,
    body: input.body,
  });
  const stored = await storeFiles(ctx, created.id, files);
  const user = ctx.auth!.user;
  await new Batch(ctx.db)
    .addAll(created.stmts)
    .addAll(stored.map((s) => s.stmt))
    .addAll(
      stored.map((s) =>
        stmt(ctx.db, 'INSERT INTO support_attachments (message_id, file_id) VALUES (?, ?)', created.messageId, s.id),
      ),
    )
    .add(
      auditStmt(ctx, {
        action: opts.auditAction ?? 'support.created',
        entityType: 'support_request',
        entityId: created.id,
        after: { clientId, subject: input.subject, attachments: stored.length, ...opts.auditAfter },
      }),
    )
    .run();
  const r = await loadRow(ctx, created.id);
  // The acknowledgement needs the request number, which the insert assigns, so it is queued right after (keyed by
  // request, so it is never sent twice).
  const ack = enqueue(ctx, {
    type: 'email.send',
    payload: {
      template: 'support_ack',
      to: user.email,
      data: {
        name: user.name,
        reference: r.reference,
        subject: r.subject,
        link: `${ctx.config.siteOrigin}/portal/support/${r.id}`,
      },
    },
    idempotencyKey: `email:support_ack:${r.id}`,
  });
  await ack.stmt.run();
  dispatch(ctx, [ack.id]);
  return { id: r.id, reference: r.reference };
}

/** Whoever handles the request hears about client activity: the assignee, or everyone who can see support. */
function tellStaff(ctx: RequestContext, r: SupportRow, title: string, body: string, dedupeKey: string) {
  const n = {
    type: 'support.replied',
    title,
    body: body.slice(0, 200),
    link: `/admin/support/${r.id}`,
    entityType: 'support_request',
    entityId: r.id,
    dedupeKey,
  };
  return r.assigned_to ? notifyUser(ctx, r.assigned_to, n) : notifyStaffWithPermission(ctx, 'support.view', n);
}

/**
 * The client answers on a request. A request waiting for the client, or one marked resolved, goes back to "open".
 * Closed requests take no more messages: the client opens a new request instead.
 */
export async function replyPortal(
  ctx: RequestContext,
  id: string,
  body: string,
  files: UploadedFile[] = [],
): Promise<{ messageId: string; status: SupportStatus }> {
  const r = await loadScoped(ctx, id);
  if (r.status === 'closed')
    throw validationError({ body: ['This request is closed. Open a new request if you still need help.'] });
  await enforce(ctx, { key: `support-reply:user:${ctx.auth!.user.id}`, limit: 30, windowSeconds: 3600 });
  const stored = await storeFiles(ctx, id, files);
  const messageId = newId('smg', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const status: SupportStatus = 'open';
  await new Batch(ctx.db)
    .sql(
      'INSERT INTO support_messages (id, request_id, author_id, body, is_internal_note, created_at) VALUES (?, ?, ?, ?, 0, ?)',
      messageId,
      id,
      ctx.auth!.user.id,
      body,
      now,
    )
    .addAll(stored.map((s) => s.stmt))
    .addAll(
      stored.map((s) =>
        stmt(ctx.db, 'INSERT INTO support_attachments (message_id, file_id) VALUES (?, ?)', messageId, s.id),
      ),
    )
    .sql(
      'UPDATE support_requests SET status = ?, last_message_at = ?, updated_at = ? WHERE id = ?',
      status,
      now,
      now,
      id,
    )
    .add(
      tellStaff(
        ctx,
        r,
        `Client reply on ${r.reference}: ${r.subject}`,
        `${ctx.auth!.user.name}: ${body}`,
        `support_client_reply:${messageId}`,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'support.client_replied',
        entityType: 'support_request',
        entityId: id,
        before: { status: r.status },
        after: { messageId, status, attachments: stored.length },
      }),
    )
    .run();
  return { messageId, status };
}

/** The client says the problem is solved. Staff close it later; a new message reopens it. */
export async function resolvePortal(ctx: RequestContext, id: string): Promise<{ status: SupportStatus }> {
  const r = await loadScoped(ctx, id);
  if (r.status === 'resolved') return { status: r.status };
  if (r.status === 'closed') throw validationError({ status: ['This request is already closed.'] });
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .sql("UPDATE support_requests SET status = 'resolved', updated_at = ? WHERE id = ?", now, id)
    .add(
      tellStaff(
        ctx,
        r,
        `${r.reference} marked resolved by the client`,
        `${ctx.auth!.user.name} marked “${r.subject}” as resolved.`,
        `support_client_resolved:${id}:${now}`,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'support.client_resolved',
        entityType: 'support_request',
        entityId: id,
        before: { status: r.status },
        after: { status: 'resolved' },
      }),
    )
    .run();
  return { status: 'resolved' };
}
