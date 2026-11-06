/**
 * Client portal view of projects (P5.6): status, progress, client-visible milestones and updates, deliverables the team
 * shared, and the project's message thread with Kuzikode. Scoped to the caller's clients where their role covers
 * delivery (`portalAreaClientIds(ctx, 'projects')`). Tasks, internal updates, internal or hidden files, budgets and the
 * internal description are never returned.
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { notFound } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { clientScope, portalAreaClientIds } from '../../lib/policies';
import { enforce } from '../../lib/rate-limit';
import type { MilestoneStatus, ProjectStatus } from '../../../shared/projects';
import { notifyUser } from '../notifications';

export interface PortalProjectListItem {
  id: string;
  reference: string;
  name: string;
  status: ProjectStatus;
  progressPct: number;
  startDate: string | null;
  targetDate: string | null;
  completedAt: string | null;
  clientName: string;
  unreadMessages: number;
}

const scope = (ctx: RequestContext, column: string) => clientScope(column, portalAreaClientIds(ctx, 'projects'));

export async function listPortalProjects(ctx: RequestContext): Promise<PortalProjectListItem[]> {
  const s = scope(ctx, 'p.client_id');
  const { results } = await ctx.db
    .prepare(
      `SELECT p.id, p.reference, p.name, p.status, p.progress_pct, p.start_date, p.target_date, p.completed_at,
         c.display_name AS client_name,
         (SELECT COUNT(*) FROM project_messages m JOIN users a ON a.id = m.author_user_id
          WHERE m.project_id = p.id AND a.user_type = 'staff' AND m.read_by_client_at IS NULL) AS unread
       FROM projects p JOIN clients c ON c.id = p.client_id
       WHERE ${s.sql}
       ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'planning' THEN 1 WHEN 'on_hold' THEN 2 ELSE 3 END, p.updated_at DESC
       LIMIT 500`,
    )
    .bind(...s.params)
    .all<{
      id: string;
      reference: string;
      name: string;
      status: ProjectStatus;
      progress_pct: number;
      start_date: string | null;
      target_date: string | null;
      completed_at: string | null;
      client_name: string;
      unread: number;
    }>();
  return results.map((p) => ({
    id: p.id,
    reference: p.reference,
    name: p.name,
    status: p.status,
    progressPct: p.progress_pct,
    startDate: p.start_date,
    targetDate: p.target_date,
    completedAt: p.completed_at,
    clientName: p.client_name,
    unreadMessages: p.unread,
  }));
}

interface ScopedProject {
  id: string;
  reference: string;
  name: string;
  client_id: string;
  status: ProjectStatus;
  progress_pct: number;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  created_by: string | null;
}

async function loadScoped(ctx: RequestContext, id: string): Promise<ScopedProject> {
  const s = scope(ctx, 'client_id');
  const p = await ctx.db
    .prepare(
      `SELECT id, reference, name, client_id, status, progress_pct, start_date, target_date, completed_at, created_by
       FROM projects WHERE id = ? AND ${s.sql}`,
    )
    .bind(id, ...s.params)
    .first<ScopedProject>();
  if (!p) throw notFound();
  return p;
}

export interface PortalProject {
  project: Omit<PortalProjectListItem, 'clientName' | 'unreadMessages'>;
  milestones: {
    id: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    status: MilestoneStatus;
    completedAt: string | null;
  }[];
  updates: { id: string; body: string; author: string; createdAt: string }[];
  deliverables: {
    fileId: string;
    label: string;
    kind: 'deliverable' | 'attachment';
    name: string;
    size: number;
    createdAt: string;
  }[];
  messages: { id: string; body: string; author: string; fromTeam: boolean; mine: boolean; createdAt: string }[];
}

/** One project as the client sees it. Opening it marks the team's messages as read by the client. */
export async function getPortalProject(ctx: RequestContext, id: string): Promise<PortalProject> {
  const p = await loadScoped(ctx, id);
  const [milestones, updates, files, messages] = await ctx.db.batch([
    ctx.db
      .prepare(
        `SELECT id, title, description, due_date, status, completed_at FROM project_milestones
         WHERE project_id = ? AND client_visible = 1 ORDER BY position, COALESCE(due_date, '9999-12-31'), created_at`,
      )
      .bind(id),
    ctx.db
      .prepare(
        `SELECT u.id, u.body, u.created_at, COALESCE(a.public_display_name, a.name) AS author FROM project_updates u
         JOIN users a ON a.id = u.author_id WHERE u.project_id = ? AND u.visibility = 'client' ORDER BY u.created_at DESC LIMIT 100`,
      )
      .bind(id),
    ctx.db
      .prepare(
        `SELECT pf.file_id, pf.label, pf.kind, pf.created_at, f.original_name, f.size_bytes FROM project_files pf
         JOIN files f ON f.id = pf.file_id
         WHERE pf.project_id = ? AND pf.client_visible = 1 AND pf.kind <> 'internal' ORDER BY pf.created_at DESC`,
      )
      .bind(id),
    ctx.db
      .prepare(
        `SELECT m.id, m.body, m.created_at, m.author_user_id, a.user_type, COALESCE(a.public_display_name, a.name) AS author
         FROM project_messages m JOIN users a ON a.id = m.author_user_id WHERE m.project_id = ? ORDER BY m.created_at LIMIT 500`,
      )
      .bind(id),
  ]);
  await ctx.db
    .prepare(
      `UPDATE project_messages SET read_by_client_at = ? WHERE project_id = ? AND read_by_client_at IS NULL
       AND author_user_id IN (SELECT id FROM users WHERE user_type = 'staff')`,
    )
    .bind(ctx.now().toISOString(), id)
    .run();
  type M = {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    status: MilestoneStatus;
    completed_at: string | null;
  };
  type U = { id: string; body: string; created_at: string; author: string };
  type F = {
    file_id: string;
    label: string;
    kind: 'deliverable' | 'attachment';
    created_at: string;
    original_name: string;
    size_bytes: number;
  };
  type G = { id: string; body: string; created_at: string; author_user_id: string; user_type: string; author: string };
  const me = ctx.auth!.user.id;
  return {
    project: {
      id: p.id,
      reference: p.reference,
      name: p.name,
      status: p.status,
      progressPct: p.progress_pct,
      startDate: p.start_date,
      targetDate: p.target_date,
      completedAt: p.completed_at,
    },
    milestones: ((milestones?.results ?? []) as M[]).map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      dueDate: m.due_date,
      status: m.status,
      completedAt: m.completed_at,
    })),
    updates: ((updates?.results ?? []) as U[]).map((u) => ({
      id: u.id,
      body: u.body,
      author: u.author,
      createdAt: u.created_at,
    })),
    deliverables: ((files?.results ?? []) as F[]).map((f) => ({
      fileId: f.file_id,
      label: f.label,
      kind: f.kind,
      name: f.original_name,
      size: f.size_bytes,
      createdAt: f.created_at,
    })),
    messages: ((messages?.results ?? []) as G[]).map((m) => ({
      id: m.id,
      body: m.body,
      author: m.author,
      fromTeam: m.user_type === 'staff',
      mine: m.author_user_id === me,
      createdAt: m.created_at,
    })),
  };
}

/** The client writes to the project thread; the project team (members + creator) is notified. */
export async function postPortalMessage(ctx: RequestContext, projectId: string, body: string): Promise<{ id: string }> {
  const p = await loadScoped(ctx, projectId);
  await enforce(ctx, { key: `project-message:user:${ctx.auth!.user.id}`, limit: 30, windowSeconds: 3600 });
  const { results: team } = await ctx.db
    .prepare('SELECT user_id FROM project_members WHERE project_id = ?')
    .bind(p.id)
    .all<{ user_id: string }>();
  const recipients = new Set(team.map((t) => t.user_id));
  if (p.created_by) recipients.add(p.created_by);
  const now = ctx.now().toISOString();
  const id = newId('pmg', ctx.now().getTime());
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'INSERT INTO project_messages (id, project_id, author_user_id, body, created_at, read_by_client_at) VALUES (?, ?, ?, ?, ?, ?)',
        id,
        p.id,
        ctx.auth!.user.id,
        body,
        now,
        now,
      ),
    )
    .addAll(
      [...recipients].map((u) =>
        notifyUser(ctx, u, {
          type: 'project.message',
          title: `New message on ${p.name}`,
          body: `${ctx.auth!.user.name}: ${body.slice(0, 180)}`,
          link: `/admin/projects/${p.id}`,
          entityType: 'project',
          entityId: p.id,
          dedupeKey: `project_message:${id}`,
        }),
      ),
    )
    .sql('UPDATE projects SET updated_at = ? WHERE id = ?', now, p.id)
    .add(
      auditStmt(ctx, {
        action: 'project.message_posted',
        entityType: 'project',
        entityId: p.id,
        after: { messageId: id },
      }),
    )
    .run();
  return { id };
}
