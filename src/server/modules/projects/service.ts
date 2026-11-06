/**
 * Projects (P4.12, PRD §4.2 F). A project belongs to a client and has members, milestones (optionally shown to the
 * client), tasks, updates (internal or client-visible, the latter notify the client), files/deliverables, messages
 * and an activity history (audit log). Staff with `projects.view_all` see every project; `projects.view` sees the
 * projects they are a member of (anything else reads as not found). Writes need `projects.manage`.
 *
 * Progress is automatic (tasks done, else milestones completed) unless set manually; it is recomputed in SQL inside
 * every batch that changes tasks or milestones, so it can never drift from the data.
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt, auditWhen } from '../../lib/audit';
import { businessYear } from '../../lib/dates';
import { conflict, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { assertCan, can } from '../../lib/policies';
import { numberSqlExpr, sequenceKey } from '../../lib/sequences';
import { dispatch, enqueue } from '../../jobs/outbox';
import type { ProjectStatus } from '../../../shared/projects';
import type { z } from 'zod';
import type {
  fileMetaSchema,
  milestoneSchema,
  ProjectInput,
  projectSettingsSchema,
  taskSchema,
  updateSchema,
} from '../../../shared/schemas/projects';
import { getSettings, settingText } from '../cms';
import { storeUpload } from '../files/service';

export const PAGE_SIZE = 25;
type MilestoneInput = z.output<typeof milestoneSchema>;
type TaskInput = z.output<typeof taskSchema>;
type UpdateInput = z.output<typeof updateSchema>;
type FileMeta = z.output<typeof fileMetaSchema>;
type SettingsInput = z.output<typeof projectSettingsSchema>;

export interface ProjectRow {
  id: string;
  reference: string;
  client_id: string;
  source_quotation_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  target_date: string | null;
  completed_at: string | null;
  budget_minor: number | null;
  currency: string | null;
  progress_pct: number;
  progress_mode: 'auto' | 'manual';
  internal_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------- access

/** SQL condition limiting `p` to projects the caller may see. */
function scope(ctx: RequestContext): { sql: string; params: unknown[] } {
  if (can(ctx, 'projects.view_all')) return { sql: '1 = 1', params: [] };
  return {
    sql: 'EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = ?)',
    params: [ctx.actor.userId ?? ''],
  };
}

/** Loads a project the caller may see (404 otherwise, never 403, so references can't be probed). */
export async function loadProject(ctx: RequestContext, id: string): Promise<ProjectRow> {
  if (!can(ctx, 'projects.view') && !can(ctx, 'projects.view_all')) throw notFound();
  const s = scope(ctx);
  const p = await ctx.db
    .prepare(`SELECT p.* FROM projects p WHERE p.id = ? AND ${s.sql}`)
    .bind(id, ...s.params)
    .first<ProjectRow>();
  if (!p) throw notFound();
  return p;
}

async function loadManaged(ctx: RequestContext, id: string): Promise<ProjectRow> {
  assertCan(ctx, 'projects.manage');
  return loadProject(ctx, id);
}

/** Keeps `progress_pct` in step with tasks/milestones unless the project is in manual mode. */
function progressStmt(ctx: RequestContext, projectId: string) {
  return stmt(
    ctx.db,
    `UPDATE projects SET progress_pct = CASE WHEN progress_mode = 'manual' THEN progress_pct ELSE (
       CASE
         WHEN (SELECT COUNT(*) FROM project_tasks WHERE project_id = ?1) > 0 THEN
           (SELECT CAST(ROUND(100.0 * SUM(status = 'done') / COUNT(*)) AS INTEGER) FROM project_tasks WHERE project_id = ?1)
         WHEN (SELECT COUNT(*) FROM project_milestones WHERE project_id = ?1 AND status <> 'cancelled') > 0 THEN
           (SELECT CAST(ROUND(100.0 * SUM(status = 'completed') / COUNT(*)) AS INTEGER) FROM project_milestones
            WHERE project_id = ?1 AND status <> 'cancelled')
         ELSE 0 END) END
     WHERE id = ?1`,
    projectId,
  );
}

const touch = (ctx: RequestContext, projectId: string) =>
  stmt(ctx.db, 'UPDATE projects SET updated_at = ? WHERE id = ?', ctx.now().toISOString(), projectId);

const audit = (ctx: RequestContext, projectId: string, action: string, after: Record<string, unknown>) =>
  auditStmt(ctx, { action, entityType: 'project', entityId: projectId, after });

// ---------------------------------------------------------------- read

export async function listProjects(
  ctx: RequestContext,
  f: { status?: string | undefined; clientId?: string | undefined; q?: string | undefined; page: number },
) {
  if (!can(ctx, 'projects.view') && !can(ctx, 'projects.view_all')) assertCan(ctx, 'projects.view');
  const s = scope(ctx);
  const where = [s.sql];
  const params: unknown[] = [...s.params];
  if (!f.status || f.status === 'open') where.push("p.status IN ('planning','active','on_hold')");
  else if (f.status !== 'all') {
    where.push('p.status = ?');
    params.push(f.status);
  }
  if (f.clientId) {
    where.push('p.client_id = ?');
    params.push(f.clientId);
  }
  if (f.q?.trim()) {
    const l = `%${f.q
      .trim()
      .slice(0, 80)
      .replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push("(p.reference LIKE ? ESCAPE '\\' OR p.name LIKE ? ESCAPE '\\' OR c.display_name LIKE ? ESCAPE '\\')");
    params.push(l, l, l);
  }
  const w = `WHERE ${where.join(' AND ')}`;
  const [count, rows] = await ctx.db.batch([
    ctx.db.prepare(`SELECT COUNT(*) AS n FROM projects p JOIN clients c ON c.id = p.client_id ${w}`).bind(...params),
    ctx.db
      .prepare(
        `SELECT p.id, p.reference, p.name, p.status, p.progress_pct, p.target_date, p.updated_at,
           c.id AS client_id, c.display_name AS client_name,
           (SELECT u.name FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = p.id AND m.role = 'lead') AS lead
         FROM projects p JOIN clients c ON c.id = p.client_id ${w}
         ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'planning' THEN 1 WHEN 'on_hold' THEN 2 ELSE 3 END,
           COALESCE(p.target_date, '9999') , p.updated_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, PAGE_SIZE, (f.page - 1) * PAGE_SIZE),
  ]);
  const total = ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  return {
    total,
    page: f.page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    items: (rows?.results ?? []) as {
      id: string;
      reference: string;
      name: string;
      status: ProjectStatus;
      progress_pct: number;
      target_date: string | null;
      updated_at: string;
      client_id: string;
      client_name: string;
      lead: string | null;
    }[],
  };
}

export async function getProject(ctx: RequestContext, id: string) {
  const p = await loadProject(ctx, id);
  const [client, members, milestones, tasks, updates, files, messages, activity, quotation, invoices] =
    await ctx.db.batch([
      ctx.db.prepare('SELECT id, client_number, display_name FROM clients WHERE id = ?').bind(p.client_id),
      ctx.db
        .prepare(
          `SELECT m.user_id, m.role, u.name, u.email FROM project_members m JOIN users u ON u.id = m.user_id
           WHERE m.project_id = ? ORDER BY m.role = 'lead' DESC, u.name`,
        )
        .bind(id),
      ctx.db
        .prepare(
          `SELECT ms.*, i.number AS invoice_number FROM project_milestones ms LEFT JOIN invoices i ON i.id = ms.invoice_id
           WHERE ms.project_id = ? ORDER BY ms.position, ms.created_at`,
        )
        .bind(id),
      ctx.db
        .prepare(
          `SELECT t.*, u.name AS assignee_name FROM project_tasks t LEFT JOIN users u ON u.id = t.assignee_id
           WHERE t.project_id = ? ORDER BY t.position, t.created_at`,
        )
        .bind(id),
      ctx.db
        .prepare(
          `SELECT pu.id, pu.body, pu.visibility, pu.notified_at, pu.created_at, u.name AS author FROM project_updates pu
           JOIN users u ON u.id = pu.author_id WHERE pu.project_id = ? ORDER BY pu.created_at DESC`,
        )
        .bind(id),
      ctx.db
        .prepare(
          `SELECT pf.id, pf.file_id, pf.label, pf.kind, pf.client_visible, pf.created_at, f.original_name, f.size_bytes,
             f.mime_type, u.name AS uploaded_by
           FROM project_files pf JOIN files f ON f.id = pf.file_id LEFT JOIN users u ON u.id = pf.uploaded_by
           WHERE pf.project_id = ? ORDER BY pf.created_at DESC`,
        )
        .bind(id),
      ctx.db
        .prepare(
          `SELECT pm.id, pm.body, pm.created_at, pm.read_by_client_at, u.name AS author, u.user_type
           FROM project_messages pm JOIN users u ON u.id = pm.author_user_id WHERE pm.project_id = ? ORDER BY pm.created_at`,
        )
        .bind(id),
      ctx.db
        .prepare(
          `SELECT a.action, a.created_at, a.after AS after_json, u.name AS actor FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
           WHERE a.entity_type = 'project' AND a.entity_id = ? ORDER BY a.created_at DESC LIMIT 100`,
        )
        .bind(id),
      ctx.db.prepare('SELECT id, number FROM quotations WHERE id = ?').bind(p.source_quotation_id ?? ''),
      ctx.db
        .prepare(
          "SELECT id, number FROM invoices WHERE client_id = ? AND status <> 'void' AND number IS NOT NULL ORDER BY issued_at DESC LIMIT 100",
        )
        .bind(p.client_id),
    ]);
  // Opening the project marks client messages as read by staff.
  await ctx.db
    .prepare(
      `UPDATE project_messages SET read_by_staff_at = ? WHERE project_id = ? AND read_by_staff_at IS NULL
       AND author_user_id IN (SELECT id FROM users WHERE user_type = 'client')`,
    )
    .bind(ctx.now().toISOString(), id)
    .run();
  const rows = <T>(r: D1Result | undefined) => (r?.results ?? []) as T[];
  return {
    project: p,
    client: rows<{ id: string; client_number: string; display_name: string }>(client)[0] ?? null,
    members: rows<{ user_id: string; role: 'lead' | 'member'; name: string; email: string }>(members),
    milestones: rows<{
      id: string;
      title: string;
      description: string | null;
      due_date: string | null;
      status: string;
      client_visible: number;
      position: number;
      completed_at: string | null;
      invoice_id: string | null;
      invoice_number: string | null;
    }>(milestones),
    tasks: rows<{
      id: string;
      milestone_id: string | null;
      title: string;
      description: string | null;
      assignee_id: string | null;
      assignee_name: string | null;
      status: string;
      priority: string;
      due_date: string | null;
      position: number;
    }>(tasks),
    updates: rows<{
      id: string;
      body: string;
      visibility: 'internal' | 'client';
      notified_at: string | null;
      created_at: string;
      author: string;
    }>(updates),
    files: rows<{
      id: string;
      file_id: string;
      label: string;
      kind: string;
      client_visible: number;
      created_at: string;
      original_name: string;
      size_bytes: number;
      mime_type: string;
      uploaded_by: string | null;
    }>(files),
    messages: rows<{
      id: string;
      body: string;
      created_at: string;
      read_by_client_at: string | null;
      author: string;
      user_type: string;
    }>(messages),
    activity: rows<{ action: string; created_at: string; after_json: string | null; actor: string | null }>(activity),
    quotation: rows<{ id: string; number: string | null }>(quotation)[0] ?? null,
    invoices: rows<{ id: string; number: string }>(invoices),
  };
}

/** Staff who can be added to projects. */
export async function staffOptions(ctx: RequestContext) {
  const { results } = await ctx.db
    .prepare("SELECT id, name, email FROM users WHERE user_type = 'staff' AND status = 'active' ORDER BY name")
    .all<{ id: string; name: string; email: string }>();
  return results;
}

// ---------------------------------------------------------------- create & edit

async function validateRefs(ctx: RequestContext, input: ProjectInput) {
  const users = [...new Set([...(input.leadId ? [input.leadId] : []), ...input.memberIds])];
  const [client, staff, currency] = await ctx.db.batch([
    ctx.db.prepare("SELECT id FROM clients WHERE id = ? AND status = 'active'").bind(input.clientId),
    ctx.db
      .prepare(
        "SELECT id FROM users WHERE user_type = 'staff' AND status = 'active' AND id IN (SELECT value FROM json_each(?))",
      )
      .bind(JSON.stringify(users)),
    ctx.db.prepare('SELECT code FROM currencies WHERE code = ? AND active = 1').bind(input.currency ?? ''),
  ]);
  const fields: Record<string, string[]> = {};
  if (!(client?.results ?? []).length) fields['clientId'] = ['Choose an active client.'];
  if ((staff?.results ?? []).length !== users.length) fields['memberIds'] = ['Choose active staff members.'];
  if (input.currency && !(currency?.results ?? []).length) fields['currency'] = ['Choose an active currency.'];
  if (Object.keys(fields).length) throw validationError(fields);
  return users;
}

function memberStmts(ctx: RequestContext, projectId: string, leadId: string | null | undefined, memberIds: string[]) {
  const ids = [...new Set([...(leadId ? [leadId] : []), ...memberIds])];
  return ids.map((u) =>
    stmt(
      ctx.db,
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
      projectId,
      u,
      u === leadId ? 'lead' : 'member',
    ),
  );
}

async function referenceParts(ctx: RequestContext) {
  const settings = await getSettings(ctx);
  const format = settingText(settings, 'numbering.project') ?? 'PRJ-{YYYY}-{SEQ:4}';
  const year = businessYear(ctx.now());
  const key = sequenceKey('project', format, year);
  return { key, number: numberSqlExpr(key, format, year) };
}

export async function createProject(ctx: RequestContext, input: ProjectInput): Promise<{ id: string }> {
  assertCan(ctx, 'projects.manage');
  await validateRefs(ctx, input);
  const id = newId('prj', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const { key, number } = await referenceParts(ctx);
  // The creator joins as lead when no lead is chosen, so a project is never invisible to whoever made it.
  const lead = input.leadId ?? ctx.actor.userId;
  await new Batch(ctx.db)
    .add(stmt(ctx.db, 'INSERT OR IGNORE INTO sequences (key, next_value) VALUES (?, 1)', key))
    .add(stmt(ctx.db, 'UPDATE sequences SET next_value = next_value + 1 WHERE key = ?', key))
    .add(
      stmt(
        ctx.db,
        `INSERT INTO projects (id, reference, client_id, name, description, status, start_date, target_date, completed_at,
           budget_minor, currency, created_by, created_at, updated_at)
         VALUES (?, ${number.sql}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        ...number.params,
        input.clientId,
        input.name,
        input.description,
        input.status,
        input.startDate,
        input.targetDate,
        input.status === 'completed' ? now : null,
        input.budgetMinor ?? null,
        input.budgetMinor != null ? input.currency : (input.currency ?? null),
        ctx.actor.userId,
        now,
        now,
      ),
    )
    .addAll(memberStmts(ctx, id, lead, input.memberIds))
    .add(audit(ctx, id, 'project.created', { name: input.name, clientId: input.clientId }))
    .run();
  return { id };
}

export async function updateProject(ctx: RequestContext, id: string, input: ProjectInput): Promise<void> {
  const p = await loadManaged(ctx, id);
  await validateRefs(ctx, input);
  const now = ctx.now().toISOString();
  const lead = input.leadId ?? null;
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE projects SET client_id = ?, name = ?, description = ?, status = ?, start_date = ?, target_date = ?,
           completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, ?) ELSE NULL END,
           budget_minor = ?, currency = ?, updated_at = ? WHERE id = ?`,
        input.clientId,
        input.name,
        input.description,
        input.status,
        input.startDate,
        input.targetDate,
        input.status,
        now,
        input.budgetMinor ?? null,
        input.currency ?? null,
        now,
        id,
      ),
    )
    .add(stmt(ctx.db, 'DELETE FROM project_members WHERE project_id = ?', id))
    .addAll(memberStmts(ctx, id, lead, input.memberIds))
    .add(
      auditStmt(ctx, {
        action: 'project.updated',
        entityType: 'project',
        entityId: id,
        before: { status: p.status, name: p.name },
        after: { status: input.status, name: input.name, members: input.memberIds.length + (lead ? 1 : 0) },
      }),
    )
    .run();
}

export async function updateSettings(ctx: RequestContext, id: string, input: SettingsInput): Promise<void> {
  await loadManaged(ctx, id);
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE projects SET progress_mode = ?, progress_pct = CASE WHEN ? = 'manual' THEN ? ELSE progress_pct END,
           internal_notes = ?, updated_at = ? WHERE id = ?`,
        input.progressMode,
        input.progressMode,
        input.progressPct ?? 0,
        input.internalNotes,
        ctx.now().toISOString(),
        id,
      ),
    )
    .add(progressStmt(ctx, id))
    .add(
      audit(ctx, id, 'project.settings_changed', {
        progressMode: input.progressMode,
        progressPct: input.progressPct ?? null,
      }),
    )
    .run();
}

/**
 * Accepted quotation → project with one client-visible milestone (and a matching task) per quotation line.
 * Idempotent: `projects.source_quotation_id` is UNIQUE and the reference sequence only moves when the project is
 * really created, so repeated or concurrent calls return the same project without a gap.
 */
export async function createFromQuotation(
  ctx: RequestContext,
  quotationId: string,
): Promise<{ projectId: string; created: boolean }> {
  assertCan(ctx, 'projects.manage');
  const existing = await ctx.db
    .prepare('SELECT id FROM projects WHERE source_quotation_id = ?')
    .bind(quotationId)
    .first<{ id: string }>();
  if (existing) return { projectId: existing.id, created: false };
  const q = await ctx.db
    .prepare('SELECT id, client_id, title, status FROM quotations WHERE id = ?')
    .bind(quotationId)
    .first<{ id: string; client_id: string; title: string; status: string }>();
  if (!q) throw notFound();
  if (q.status !== 'accepted') throw conflict('Only an accepted quotation can become a project.');
  const { results: lines } = await ctx.db
    .prepare('SELECT description, position FROM quotation_items WHERE quotation_id = ? ORDER BY position')
    .bind(quotationId)
    .all<{ description: string; position: number }>();
  const id = newId('prj', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const { key, number } = await referenceParts(ctx);
  const fresh = 'NOT EXISTS (SELECT 1 FROM projects WHERE source_quotation_id = ?)';
  const made = 'EXISTS (SELECT 1 FROM projects WHERE id = ?)';
  const res = await new Batch(ctx.db)
    .add(stmt(ctx.db, 'INSERT OR IGNORE INTO sequences (key, next_value) VALUES (?, 1)', key))
    .add(stmt(ctx.db, `UPDATE sequences SET next_value = next_value + 1 WHERE key = ? AND ${fresh}`, key, quotationId))
    .add(
      stmt(
        ctx.db,
        `INSERT INTO projects (id, reference, client_id, source_quotation_id, name, status, created_by, created_at, updated_at)
         SELECT ?, ${number.sql}, ?, ?, ?, 'planning', ?, ?, ? WHERE ${fresh}
         ON CONFLICT(source_quotation_id) DO NOTHING`,
        id,
        ...number.params,
        q.client_id,
        quotationId,
        q.title,
        ctx.actor.userId,
        now,
        now,
        quotationId,
      ),
      'project',
    )
    .add(
      stmt(
        ctx.db,
        `INSERT INTO project_members (project_id, user_id, role) SELECT ?, ?, 'lead' WHERE ${made}`,
        id,
        ctx.actor.userId,
        id,
      ),
    )
    .addAll(
      lines.flatMap((l, i) => {
        const title = l.description.split('\n')[0]!.slice(0, 200).trim() || `Part ${i + 1}`;
        const mil = `${id.replace(/^prj_/, 'mil_')}_${i}`;
        return [
          stmt(
            ctx.db,
            `INSERT INTO project_milestones (id, project_id, title, status, client_visible, position, created_at, updated_at)
             SELECT ?, ?, ?, 'pending', 1, ?, ?, ? WHERE ${made}`,
            mil,
            id,
            title,
            i,
            now,
            now,
            id,
          ),
          stmt(
            ctx.db,
            `INSERT INTO project_tasks (id, project_id, milestone_id, title, status, position, created_at, updated_at)
             SELECT ?, ?, ?, ?, 'todo', ?, ?, ? WHERE ${made}`,
            `${id.replace(/^prj_/, 'tsk_')}_${i}`,
            id,
            mil,
            title,
            i,
            now,
            now,
            id,
          ),
        ];
      }),
    )
    .add(
      auditWhen(
        ctx,
        { action: 'project.created_from_quotation', entityType: 'project', entityId: id, after: { quotationId } },
        made,
        id,
      ),
    )
    .run();
  if (res.changes('project') === 1) return { projectId: id, created: true };
  const winner = await ctx.db
    .prepare('SELECT id FROM projects WHERE source_quotation_id = ?')
    .bind(quotationId)
    .first<{ id: string }>();
  if (!winner) throw conflict('The project could not be created. Try again.');
  return { projectId: winner.id, created: false };
}

// ---------------------------------------------------------------- milestones

async function checkInvoice(ctx: RequestContext, p: ProjectRow, invoiceId: string | null | undefined) {
  if (!invoiceId) return;
  const inv = await ctx.db
    .prepare('SELECT id FROM invoices WHERE id = ? AND client_id = ?')
    .bind(invoiceId, p.client_id)
    .first();
  if (!inv) throw validationError({ invoiceId: ["Choose one of this client's invoices."] });
}

export async function addMilestone(ctx: RequestContext, projectId: string, input: MilestoneInput) {
  const p = await loadManaged(ctx, projectId);
  await checkInvoice(ctx, p, input.invoiceId);
  const id = newId('mil', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO project_milestones (id, project_id, title, description, due_date, status, client_visible, position,
           completed_at, invoice_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM project_milestones WHERE project_id = ?), ?, ?, ?, ?)`,
        id,
        projectId,
        input.title,
        input.description,
        input.dueDate,
        input.status,
        input.clientVisible ? 1 : 0,
        projectId,
        input.status === 'completed' ? now : null,
        input.invoiceId ?? null,
        now,
        now,
      ),
    )
    .add(progressStmt(ctx, projectId))
    .add(touch(ctx, projectId))
    .add(
      audit(ctx, projectId, 'project.milestone_added', {
        milestoneId: id,
        title: input.title,
        clientVisible: input.clientVisible,
      }),
    )
    .run();
  return { id };
}

export async function updateMilestone(ctx: RequestContext, projectId: string, id: string, input: MilestoneInput) {
  const p = await loadManaged(ctx, projectId);
  await checkInvoice(ctx, p, input.invoiceId);
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE project_milestones SET title = ?, description = ?, due_date = ?, status = ?, client_visible = ?, invoice_id = ?,
           completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, ?) ELSE NULL END, updated_at = ?
         WHERE id = ? AND project_id = ?`,
        input.title,
        input.description,
        input.dueDate,
        input.status,
        input.clientVisible ? 1 : 0,
        input.invoiceId ?? null,
        input.status,
        now,
        now,
        id,
        projectId,
      ),
      'milestone',
    )
    .add(progressStmt(ctx, projectId))
    .add(touch(ctx, projectId))
    .add(audit(ctx, projectId, 'project.milestone_updated', { milestoneId: id, status: input.status }))
    .run();
  if (res.changes('milestone') !== 1) throw notFound();
}

/** Deleting a milestone keeps its tasks (they become unassigned to a milestone). */
export async function deleteMilestone(ctx: RequestContext, projectId: string, id: string) {
  await loadManaged(ctx, projectId);
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'UPDATE project_tasks SET milestone_id = NULL WHERE milestone_id = ? AND project_id = ?',
        id,
        projectId,
      ),
    )
    .add(stmt(ctx.db, 'DELETE FROM project_milestones WHERE id = ? AND project_id = ?', id, projectId), 'milestone')
    .add(progressStmt(ctx, projectId))
    .add(touch(ctx, projectId))
    .add(audit(ctx, projectId, 'project.milestone_deleted', { milestoneId: id }))
    .run();
  if (res.changes('milestone') !== 1) throw notFound();
}

// ---------------------------------------------------------------- tasks

async function checkTaskRefs(ctx: RequestContext, projectId: string, input: TaskInput) {
  const [ms, user] = await ctx.db.batch([
    ctx.db
      .prepare('SELECT id FROM project_milestones WHERE id = ? AND project_id = ?')
      .bind(input.milestoneId ?? '', projectId),
    ctx.db
      .prepare("SELECT id FROM users WHERE id = ? AND user_type = 'staff' AND status = 'active'")
      .bind(input.assigneeId ?? ''),
  ]);
  const fields: Record<string, string[]> = {};
  if (input.milestoneId && !(ms?.results ?? []).length) fields['milestoneId'] = ['Choose a milestone of this project.'];
  if (input.assigneeId && !(user?.results ?? []).length) fields['assigneeId'] = ['Choose an active staff member.'];
  if (Object.keys(fields).length) throw validationError(fields);
}

export async function addTask(ctx: RequestContext, projectId: string, input: TaskInput) {
  await loadManaged(ctx, projectId);
  await checkTaskRefs(ctx, projectId, input);
  const id = newId('tsk', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO project_tasks (id, project_id, milestone_id, title, description, assignee_id, status, priority, due_date,
           position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM project_tasks WHERE project_id = ?), ?, ?)`,
        id,
        projectId,
        input.milestoneId ?? null,
        input.title,
        input.description,
        input.assigneeId ?? null,
        input.status,
        input.priority,
        input.dueDate,
        projectId,
        now,
        now,
      ),
    )
    // The assignee joins the project so they can see it.
    .addAll(
      input.assigneeId
        ? [
            stmt(
              ctx.db,
              "INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')",
              projectId,
              input.assigneeId,
            ),
          ]
        : [],
    )
    .add(progressStmt(ctx, projectId))
    .add(touch(ctx, projectId))
    .add(audit(ctx, projectId, 'project.task_added', { taskId: id, title: input.title }))
    .run();
  return { id };
}

export async function updateTask(ctx: RequestContext, projectId: string, id: string, input: TaskInput) {
  await loadManaged(ctx, projectId);
  await checkTaskRefs(ctx, projectId, input);
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE project_tasks SET milestone_id = ?, title = ?, description = ?, assignee_id = ?, status = ?, priority = ?,
           due_date = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
        input.milestoneId ?? null,
        input.title,
        input.description,
        input.assigneeId ?? null,
        input.status,
        input.priority,
        input.dueDate,
        ctx.now().toISOString(),
        id,
        projectId,
      ),
      'task',
    )
    .addAll(
      input.assigneeId
        ? [
            stmt(
              ctx.db,
              "INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, 'member')",
              projectId,
              input.assigneeId,
            ),
          ]
        : [],
    )
    .add(progressStmt(ctx, projectId))
    .add(touch(ctx, projectId))
    .add(audit(ctx, projectId, 'project.task_updated', { taskId: id, status: input.status }))
    .run();
  if (res.changes('task') !== 1) throw notFound();
}

/** Board drag/move: status only. Members may move tasks assigned to them even without `projects.manage`. */
export async function moveTask(ctx: RequestContext, projectId: string, id: string, status: string) {
  const p = await loadProject(ctx, projectId);
  const mine = !can(ctx, 'projects.manage');
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE project_tasks SET status = ?, updated_at = ? WHERE id = ? AND project_id = ? ${mine ? 'AND assignee_id = ?' : ''}`,
        status,
        ctx.now().toISOString(),
        id,
        p.id,
        ...(mine ? [ctx.actor.userId] : []),
      ),
      'task',
    )
    .add(progressStmt(ctx, projectId))
    .add(touch(ctx, projectId))
    .add(audit(ctx, projectId, 'project.task_moved', { taskId: id, status }))
    .run();
  if (res.changes('task') !== 1) throw notFound();
}

export async function deleteTask(ctx: RequestContext, projectId: string, id: string) {
  await loadManaged(ctx, projectId);
  const res = await new Batch(ctx.db)
    .add(stmt(ctx.db, 'DELETE FROM project_tasks WHERE id = ? AND project_id = ?', id, projectId), 'task')
    .add(progressStmt(ctx, projectId))
    .add(touch(ctx, projectId))
    .add(audit(ctx, projectId, 'project.task_deleted', { taskId: id }))
    .run();
  if (res.changes('task') !== 1) throw notFound();
}

// ---------------------------------------------------------------- updates, messages, files

/** Client-visible updates notify the client's portal users in-app and email the main contact once. */
export async function postUpdate(ctx: RequestContext, projectId: string, input: UpdateInput) {
  const p = await loadManaged(ctx, projectId);
  const id = newId('pup', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const toClient = input.visibility === 'client';
  const contact = toClient
    ? await ctx.db
        .prepare(
          `SELECT k.name, COALESCE(k.email, c.email) AS email FROM clients c
           LEFT JOIN client_contacts k ON k.client_id = c.id AND k.is_primary = 1 WHERE c.id = ?`,
        )
        .bind(p.client_id)
        .first<{ name: string | null; email: string | null }>()
    : null;
  const job =
    toClient && contact?.email
      ? enqueue(ctx, {
          type: 'email.send',
          payload: {
            template: 'project_update',
            to: contact.email,
            data: { name: contact.name ?? 'there', project: p.name, reference: p.reference, body: input.body },
          },
          idempotencyKey: `email:project_update:${id}`,
        })
      : null;
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'INSERT INTO project_updates (id, project_id, author_id, body, visibility, notified_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id,
        projectId,
        ctx.actor.userId,
        input.body,
        input.visibility,
        toClient ? now : null,
        now,
      ),
    )
    .addAll(
      toClient
        ? [
            stmt(
              ctx.db,
              `INSERT OR IGNORE INTO notifications (id, user_id, type, title, body, link, entity_type, entity_id, dedupe_key, created_at)
               SELECT ? || '_' || a.user_id, a.user_id, 'milestone.updated', ?, ?, ?, 'project', ?, ? || ':' || a.user_id, ?
               FROM client_user_access a JOIN users u ON u.id = a.user_id
               WHERE a.client_id = ? AND a.status = 'active' AND u.status = 'active'`,
              id.replace(/^pup_/, 'ntf_'),
              `New update on ${p.name}`,
              input.body.slice(0, 200),
              `/portal/projects/${projectId}`,
              projectId,
              `project_update:${id}`,
              now,
              p.client_id,
            ),
          ]
        : [],
    )
    .addAll(job ? [job.stmt] : [])
    .add(touch(ctx, projectId))
    .add(audit(ctx, projectId, 'project.update_posted', { updateId: id, visibility: input.visibility }))
    .run();
  if (job) dispatch(ctx, [job.id]);
  return { id };
}

export async function postMessage(ctx: RequestContext, projectId: string, body: string) {
  await loadProject(ctx, projectId);
  const id = newId('pmg', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'INSERT INTO project_messages (id, project_id, author_user_id, body, created_at, read_by_staff_at) VALUES (?, ?, ?, ?, ?, ?)',
        id,
        projectId,
        ctx.actor.userId,
        body,
        now,
        now,
      ),
    )
    .add(touch(ctx, projectId))
    .run();
  return { id };
}

export async function addFile(
  ctx: RequestContext,
  projectId: string,
  file: { bytes: Uint8Array<ArrayBuffer>; filename: string },
  meta: FileMeta,
) {
  await loadManaged(ctx, projectId);
  const stored = await storeUpload(ctx, {
    bytes: file.bytes,
    filename: file.filename,
    purpose: 'deliverable',
    ownerType: 'project',
    ownerId: projectId,
  });
  const id = newId('pfl', ctx.now().getTime());
  await new Batch(ctx.db)
    .add(stored.stmt)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO project_files (id, project_id, file_id, label, kind, client_visible, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        projectId,
        stored.id,
        meta.label,
        meta.kind,
        meta.clientVisible ? 1 : 0,
        ctx.actor.userId,
        ctx.now().toISOString(),
      ),
    )
    .add(touch(ctx, projectId))
    .add(
      audit(ctx, projectId, 'project.file_added', {
        fileId: stored.id,
        label: meta.label,
        clientVisible: meta.clientVisible,
      }),
    )
    .run();
  return { id, fileId: stored.id };
}

export async function setFileVisibility(ctx: RequestContext, projectId: string, id: string, clientVisible: boolean) {
  await loadManaged(ctx, projectId);
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        "UPDATE project_files SET client_visible = ? WHERE id = ? AND project_id = ? AND (kind <> 'internal' OR ? = 0)",
        clientVisible ? 1 : 0,
        id,
        projectId,
        clientVisible ? 1 : 0,
      ),
      'file',
    )
    .add(audit(ctx, projectId, 'project.file_visibility', { projectFileId: id, clientVisible }))
    .run();
  if (res.changes('file') !== 1)
    throw validationError({ clientVisible: ['Internal files are never shown to the client.'] });
}

/** Removes a project file: the link and file rows go first, then the R2 object. */
export async function deleteFile(ctx: RequestContext, projectId: string, id: string) {
  await loadManaged(ctx, projectId);
  const row = await ctx.db
    .prepare(
      `SELECT pf.file_id, f.r2_key FROM project_files pf JOIN files f ON f.id = pf.file_id WHERE pf.id = ? AND pf.project_id = ?`,
    )
    .bind(id, projectId)
    .first<{ file_id: string; r2_key: string }>();
  if (!row) throw notFound();
  await new Batch(ctx.db)
    .add(stmt(ctx.db, 'DELETE FROM project_files WHERE id = ?', id))
    .add(stmt(ctx.db, 'DELETE FROM files WHERE id = ?', row.file_id))
    .add(audit(ctx, projectId, 'project.file_deleted', { fileId: row.file_id }))
    .run();
  await ctx.env.FILES.delete(row.r2_key);
}

/** Clients, staff and currencies for the project form. */
export async function formOptions(ctx: RequestContext) {
  assertCan(ctx, 'projects.manage');
  const [clients, currencies] = await ctx.db.batch([
    ctx.db.prepare(
      "SELECT id, display_name AS name, client_number AS number, default_currency AS currency FROM clients WHERE status = 'active' ORDER BY display_name LIMIT 2000",
    ),
    ctx.db.prepare('SELECT code, minor_digits FROM currencies WHERE active = 1 ORDER BY is_default DESC, code'),
  ]);
  return {
    clients: (clients?.results ?? []) as { id: string; name: string; number: string; currency: string }[],
    currencies: (currencies?.results ?? []) as { code: string; minor_digits: number }[],
    staff: await staffOptions(ctx),
  };
}
