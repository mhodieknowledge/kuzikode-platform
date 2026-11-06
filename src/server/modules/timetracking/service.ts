/**
 * Time tracking (P4.23, docs/12 §E.3). Staff log time against projects (and optionally tasks) by hand or with a timer
 * (one running timer per person, enforced by a unique index), see a weekly timesheet, and staff with `time.bill` turn
 * unbilled billable time into lines on a new draft invoice. Billing is one guarded batch: the invoice, its lines and the
 * entries' invoice links are written only if every chosen entry is still unbilled when the batch runs, so two people
 * billing the same time at once produce exactly one invoice. Deleting the draft or voiding the invoice releases the time.
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt, auditWhen } from '../../lib/audit';
import { businessDate } from '../../lib/dates';
import { conflict, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { assertCan, can } from '../../lib/policies';
import { formatQuantity, mulDivHalfEven } from '../../../shared/money';
import {
  addDays,
  MAX_ENTRY_MINUTES,
  type TimeEntryInput,
  type TimeListQuery,
  type TimerStartInput,
  weekStart,
} from '../../../shared/schemas/time';
import { getSettings, settingNumber, settingText } from '../cms/service';
import { draftInvoiceStatements } from '../invoices/service';
import { loadProject } from '../projects/service';

export interface TimeEntryRow {
  id: string;
  project_id: string;
  project_name: string;
  project_reference: string;
  task_id: string | null;
  task_title: string | null;
  user_id: string;
  user_name: string;
  entry_date: string;
  minutes: number | null;
  description: string | null;
  billable: number;
  rate_minor: number | null;
  currency: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  timer_started_at: string | null;
}

const SELECT = `SELECT e.id, e.project_id, p.name AS project_name, p.reference AS project_reference, e.task_id,
    t.title AS task_title, e.user_id, u.name AS user_name, e.entry_date, e.minutes, e.description, e.billable, e.rate_minor,
    e.currency, e.invoice_id, i.number AS invoice_number, e.timer_started_at
  FROM time_entries e
  JOIN projects p ON p.id = e.project_id
  JOIN users u ON u.id = e.user_id
  LEFT JOIN project_tasks t ON t.id = e.task_id
  LEFT JOIN invoices i ON i.id = e.invoice_id`;

/** Value of an entry in minor units: minutes × hourly rate, rounded half-even once. */
export const entryAmountMinor = (minutes: number, rateMinor: number) => mulDivHalfEven(minutes, rateMinor, 60);

async function defaults(ctx: RequestContext) {
  const s = await getSettings(ctx);
  return {
    rateMinor: settingNumber(s, 'time.default_hourly_rate_minor', 2500),
    currency: settingText(s, 'time.default_currency') ?? 'USD',
  };
}

async function checkTask(ctx: RequestContext, projectId: string, taskId: string | null) {
  if (!taskId) return;
  const t = await ctx.db
    .prepare('SELECT 1 AS ok FROM project_tasks WHERE id = ? AND project_id = ?')
    .bind(taskId, projectId)
    .first();
  if (!t) throw validationError({ taskId: ['Choose a task from this project.'] });
}

/** Billing staff (e.g. Finance) may not be project members: `time.bill` lets them reach any project's time. */
async function projectForBilling(ctx: RequestContext, id: string) {
  if (!can(ctx, 'time.bill')) return loadProject(ctx, id);
  const p = await ctx.db
    .prepare('SELECT * FROM projects WHERE id = ?')
    .bind(id)
    .first<Awaited<ReturnType<typeof loadProject>>>();
  if (!p) throw notFound();
  return p;
}

async function loadEntry(ctx: RequestContext, id: string) {
  const e = await ctx.db.prepare('SELECT * FROM time_entries WHERE id = ?').bind(id).first<{
    id: string;
    user_id: string;
    project_id: string;
    invoice_id: string | null;
    timer_started_at: string | null;
    minutes: number | null;
    updated_at: string;
  }>();
  // Other people's entries are invisible without time.view_all (404, so ids can't be probed).
  if (!e || (e.user_id !== ctx.actor.userId && !can(ctx, 'time.view_all'))) throw notFound();
  return e;
}

// ---------------------------------------------------------------- entries

export async function listEntries(ctx: RequestContext, q: TimeListQuery): Promise<TimeEntryRow[]> {
  if (!can(ctx, 'time.track') && !can(ctx, 'time.view_all')) throw notFound();
  const where: string[] = ['e.minutes IS NOT NULL'];
  const params: unknown[] = [];
  if (!can(ctx, 'time.view_all')) {
    where.push('e.user_id = ?');
    params.push(ctx.actor.userId ?? '');
  } else if (q.userId) {
    where.push('e.user_id = ?');
    params.push(q.userId);
  }
  if (q.projectId) {
    where.push('e.project_id = ?');
    params.push(q.projectId);
  }
  if (q.from) {
    where.push('e.entry_date >= ?');
    params.push(q.from);
  }
  if (q.to) {
    where.push('e.entry_date <= ?');
    params.push(q.to);
  }
  if (q.billing === 'unbilled') where.push('e.billable = 1 AND e.invoice_id IS NULL');
  if (q.billing === 'billed') where.push('e.invoice_id IS NOT NULL');
  if (q.billing === 'non_billable') where.push('e.billable = 0');
  const { results } = await ctx.db
    .prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY e.entry_date DESC, e.created_at DESC LIMIT 1000`)
    .bind(...params)
    .all<TimeEntryRow>();
  return results;
}

export async function createEntry(ctx: RequestContext, input: TimeEntryInput): Promise<{ id: string }> {
  assertCan(ctx, 'time.track');
  const project = await loadProject(ctx, input.projectId);
  await checkTask(ctx, project.id, input.taskId);
  const d = await defaults(ctx);
  const id = newId('tim', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO time_entries (id, project_id, task_id, user_id, entry_date, minutes, description, billable, rate_minor,
           currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        project.id,
        input.taskId,
        ctx.actor.userId,
        input.entryDate,
        input.minutes,
        input.description,
        input.billable ? 1 : 0,
        input.rateMinor ?? d.rateMinor,
        project.currency ?? d.currency,
        now,
        now,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'time.entry_created',
        entityType: 'time_entry',
        entityId: id,
        after: { projectId: project.id, minutes: input.minutes, billable: input.billable },
      }),
    )
    .run();
  return { id };
}

export async function updateEntry(ctx: RequestContext, id: string, input: TimeEntryInput): Promise<void> {
  assertCan(ctx, 'time.track');
  const e = await loadEntry(ctx, id);
  if (e.invoice_id) throw conflict('This time has been billed. Delete the draft invoice or void it to change it.');
  if (e.timer_started_at) throw conflict('Stop the timer first.');
  const project = await loadProject(ctx, input.projectId);
  await checkTask(ctx, project.id, input.taskId);
  const d = await defaults(ctx);
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE time_entries SET project_id = ?, task_id = ?, entry_date = ?, minutes = ?, description = ?, billable = ?,
           rate_minor = ?, currency = ?, updated_at = ?
         WHERE id = ? AND invoice_id IS NULL AND timer_started_at IS NULL AND updated_at = ?`,
        project.id,
        input.taskId,
        input.entryDate,
        input.minutes,
        input.description,
        input.billable ? 1 : 0,
        input.rateMinor ?? d.rateMinor,
        project.currency ?? d.currency,
        now,
        id,
        e.updated_at,
      ),
      'save',
    )
    .add(
      auditStmt(ctx, {
        action: 'time.entry_updated',
        entityType: 'time_entry',
        entityId: id,
        before: { minutes: e.minutes },
        after: { minutes: input.minutes, billable: input.billable },
      }),
    )
    .run();
  if (res.changes('save') !== 1) throw conflict('This entry changed. Reload and try again.');
}

export async function deleteEntry(ctx: RequestContext, id: string): Promise<void> {
  assertCan(ctx, 'time.track');
  const e = await loadEntry(ctx, id);
  if (e.invoice_id) throw conflict('Billed time can’t be deleted.');
  const res = await new Batch(ctx.db)
    .add(stmt(ctx.db, 'DELETE FROM time_entries WHERE id = ? AND invoice_id IS NULL', id), 'delete')
    .add(
      auditStmt(ctx, {
        action: 'time.entry_deleted',
        entityType: 'time_entry',
        entityId: id,
        before: { minutes: e.minutes, projectId: e.project_id },
      }),
    )
    .run();
  if (res.changes('delete') !== 1) throw conflict('This entry changed. Reload and try again.');
}

// ---------------------------------------------------------------- timer

export async function runningTimer(ctx: RequestContext): Promise<TimeEntryRow | null> {
  if (!can(ctx, 'time.track')) return null;
  return ctx.db
    .prepare(`${SELECT} WHERE e.user_id = ? AND e.timer_started_at IS NOT NULL`)
    .bind(ctx.actor.userId ?? '')
    .first<TimeEntryRow>();
}

export async function startTimer(ctx: RequestContext, input: TimerStartInput): Promise<{ id: string }> {
  assertCan(ctx, 'time.track');
  const project = await loadProject(ctx, input.projectId);
  await checkTask(ctx, project.id, input.taskId);
  const d = await defaults(ctx);
  const id = newId('tim', ctx.now().getTime());
  const now = ctx.now().toISOString();
  try {
    await stmt(
      ctx.db,
      `INSERT INTO time_entries (id, project_id, task_id, user_id, entry_date, minutes, description, billable, rate_minor,
         currency, timer_started_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      project.id,
      input.taskId,
      ctx.actor.userId,
      businessDate(ctx.now()),
      input.description,
      input.billable ? 1 : 0,
      d.rateMinor,
      project.currency ?? d.currency,
      now,
      now,
      now,
    ).run();
  } catch (err) {
    // uq_time_running_timer: one running timer per person.
    if (String(err).includes('UNIQUE')) throw conflict('You already have a timer running. Stop it first.');
    throw err;
  }
  return { id };
}

/** Stops the caller's timer and records the elapsed time (at least one minute, at most 24 hours). */
export async function stopTimer(ctx: RequestContext): Promise<{ id: string; minutes: number }> {
  assertCan(ctx, 'time.track');
  const t = await ctx.db
    .prepare('SELECT id, timer_started_at FROM time_entries WHERE user_id = ? AND timer_started_at IS NOT NULL')
    .bind(ctx.actor.userId ?? '')
    .first<{ id: string; timer_started_at: string }>();
  if (!t) throw conflict('No timer is running.');
  const elapsed = Math.round((ctx.now().getTime() - Date.parse(t.timer_started_at)) / 60_000);
  const minutes = Math.min(MAX_ENTRY_MINUTES, Math.max(1, elapsed));
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE time_entries SET minutes = ?, entry_date = ?, timer_started_at = NULL, updated_at = ?
         WHERE id = ? AND timer_started_at = ?`,
        minutes,
        businessDate(new Date(t.timer_started_at)),
        now,
        t.id,
        t.timer_started_at,
      ),
      'stop',
    )
    .add(auditStmt(ctx, { action: 'time.timer_stopped', entityType: 'time_entry', entityId: t.id, after: { minutes } }))
    .run();
  if (res.changes('stop') !== 1) throw conflict('The timer was already stopped.');
  return { id: t.id, minutes };
}

export async function discardTimer(ctx: RequestContext): Promise<void> {
  assertCan(ctx, 'time.track');
  await stmt(
    ctx.db,
    'DELETE FROM time_entries WHERE user_id = ? AND timer_started_at IS NOT NULL AND minutes IS NULL AND invoice_id IS NULL',
    ctx.actor.userId ?? '',
  ).run();
}

// ---------------------------------------------------------------- timesheet

export interface Timesheet {
  userId: string;
  week: string;
  days: string[];
  rows: { projectId: string; label: string; minutes: number[]; total: number }[];
  dayTotals: number[];
  total: number;
  billableTotal: number;
}

/** One person's week (Monday to Sunday) by project. Others' timesheets need time.view_all. */
export async function timesheet(ctx: RequestContext, userId: string | null, date: string): Promise<Timesheet> {
  if (!can(ctx, 'time.track') && !can(ctx, 'time.view_all')) throw notFound();
  const uid = userId && can(ctx, 'time.view_all') ? userId : (ctx.actor.userId ?? '');
  const week = weekStart(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const { results } = await ctx.db
    .prepare(
      `SELECT e.project_id, p.reference || ' · ' || p.name AS label, e.entry_date, SUM(e.minutes) AS minutes,
         SUM(CASE WHEN e.billable = 1 THEN e.minutes ELSE 0 END) AS billable
       FROM time_entries e JOIN projects p ON p.id = e.project_id
       WHERE e.user_id = ? AND e.entry_date BETWEEN ? AND ? AND e.minutes IS NOT NULL
       GROUP BY e.project_id, e.entry_date ORDER BY label`,
    )
    .bind(uid, days[0], days[6])
    .all<{ project_id: string; label: string; entry_date: string; minutes: number; billable: number }>();
  const rows = new Map<string, Timesheet['rows'][number]>();
  let billableTotal = 0;
  for (const r of results) {
    const row = rows.get(r.project_id) ?? {
      projectId: r.project_id,
      label: r.label,
      minutes: Array(7).fill(0),
      total: 0,
    };
    row.minutes[days.indexOf(r.entry_date)] += r.minutes;
    row.total += r.minutes;
    billableTotal += r.billable;
    rows.set(r.project_id, row);
  }
  const list = [...rows.values()];
  const dayTotals = days.map((_, i) => list.reduce((n, r) => n + (r.minutes[i] ?? 0), 0));
  return {
    userId: uid,
    week,
    days,
    rows: list,
    dayTotals,
    total: dayTotals.reduce((a, b) => a + b, 0),
    billableTotal,
  };
}

// ---------------------------------------------------------------- project summary & billing

export async function projectTime(ctx: RequestContext, projectId: string) {
  const project = await projectForBilling(ctx, projectId);
  const viewAll = can(ctx, 'time.view_all') || can(ctx, 'time.bill');
  const { results } = await ctx.db
    .prepare(
      `${SELECT} WHERE e.project_id = ? AND e.minutes IS NOT NULL ${viewAll ? '' : 'AND e.user_id = ?'}
       ORDER BY e.entry_date DESC, e.created_at DESC LIMIT 500`,
    )
    .bind(project.id, ...(viewAll ? [] : [ctx.actor.userId ?? '']))
    .all<TimeEntryRow>();
  const unbilled = results.filter((e) => e.billable === 1 && !e.invoice_id);
  const byCurrency = new Map<string, { minutes: number; amountMinor: number }>();
  for (const e of unbilled) {
    const k = e.currency ?? 'USD';
    const cur = byCurrency.get(k) ?? { minutes: 0, amountMinor: 0 };
    cur.minutes += e.minutes ?? 0;
    cur.amountMinor += entryAmountMinor(e.minutes ?? 0, e.rate_minor ?? 0);
    byCurrency.set(k, cur);
  }
  return {
    entries: results,
    totalMinutes: results.reduce((n, e) => n + (e.minutes ?? 0), 0),
    unbilled: [...byCurrency.entries()].map(([currency, v]) => ({ currency, ...v })),
    seesEveryone: viewAll,
  };
}

/**
 * Bills the chosen unbilled time on a new draft invoice for the project's client, one line per entry
 * (quantity in hours to 3 decimals × the entry's hourly rate). All entries must share one currency.
 */
export async function billUnbilledTime(
  ctx: RequestContext,
  projectId: string,
  entryIds: string[],
): Promise<{ invoiceId: string; lines: number }> {
  assertCan(ctx, 'time.bill');
  const project = await projectForBilling(ctx, projectId);
  const ids = [...new Set(entryIds)];
  const marks = ids.map(() => '?').join(', ');
  const { results } = await ctx.db
    .prepare(
      `${SELECT} WHERE e.id IN (${marks}) AND e.project_id = ? AND e.billable = 1 AND e.invoice_id IS NULL
         AND e.minutes IS NOT NULL AND e.timer_started_at IS NULL
       ORDER BY e.entry_date, e.created_at`,
    )
    .bind(...ids, project.id)
    .all<TimeEntryRow>();
  if (results.length !== ids.length)
    throw conflict('Some of this time has already been billed or changed. Reload and try again.');
  const currencies = new Set(results.map((e) => e.currency ?? 'USD'));
  if (currencies.size !== 1) throw validationError({ entryIds: ['Bill time in one currency at a time.'] });
  const currency = [...currencies][0]!;
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${d}T00:00:00Z`),
    );
  const guard = {
    sql: `(SELECT COUNT(*) FROM time_entries WHERE id IN (${marks}) AND project_id = ? AND billable = 1
            AND invoice_id IS NULL AND minutes IS NOT NULL AND timer_started_at IS NULL) = ?`,
    params: [...ids, project.id, ids.length],
  };
  const draft = await draftInvoiceStatements(
    ctx,
    {
      clientId: project.client_id,
      contactId: null,
      currency,
      issueDate: null,
      dueDate: null,
      paymentTermsDays: null,
      notes: `Time for ${project.reference} · ${project.name}.`,
      terms: null,
      discountType: 'none',
      discountValue: 0,
      items: results.map((e) => ({
        serviceId: null,
        packageId: null,
        description:
          `${fmt(e.entry_date)} · ${e.user_name} · ${[e.task_title, e.description].filter(Boolean).join(': ') || 'Project work'}`.slice(
            0,
            2000,
          ),
        quantity: formatQuantity(mulDivHalfEven(e.minutes ?? 0, 1000, 60)),
        unitPriceMinor: e.rate_minor ?? 0,
        taxRateId: null,
        isRecurring: false,
        recurringInterval: null,
        discountType: 'none' as const,
        discountValue: 0,
      })),
    },
    { auditAction: 'invoice.created_from_time', guard },
  );
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .addAll(draft.statements)
    .addAll(
      results.map((e, i) =>
        stmt(
          ctx.db,
          `UPDATE time_entries SET invoice_id = ?, invoice_item_id = ?, updated_at = ?
           WHERE id = ? AND invoice_id IS NULL AND EXISTS (SELECT 1 FROM invoices WHERE id = ?)`,
          draft.id,
          draft.itemIds[i],
          now,
          e.id,
          draft.id,
        ),
      ),
    )
    .add(
      auditWhen(
        ctx,
        {
          action: 'time.billed',
          entityType: 'project',
          entityId: project.id,
          after: { invoiceId: draft.id, entries: ids.length, totalMinor: draft.totalMinor, currency },
        },
        'EXISTS (SELECT 1 FROM invoices WHERE id = ?)',
        draft.id,
      ),
    )
    .run();
  const created = await ctx.db.prepare('SELECT 1 AS ok FROM invoices WHERE id = ?').bind(draft.id).first();
  if (!created) throw conflict('Some of this time has already been billed or changed. Reload and try again.');
  return { invoiceId: draft.id, lines: results.length };
}

/** Projects with unbilled billable time, for the billing view (`time.bill`). */
export async function unbilledByProject(ctx: RequestContext) {
  assertCan(ctx, 'time.bill');
  const { results } = await ctx.db
    .prepare(
      `SELECT p.id, p.reference, p.name, c.display_name AS client_name, e.currency, COUNT(*) AS entries,
         SUM(e.minutes) AS minutes, MIN(e.entry_date) AS oldest
       FROM time_entries e JOIN projects p ON p.id = e.project_id JOIN clients c ON c.id = p.client_id
       WHERE e.billable = 1 AND e.invoice_id IS NULL AND e.minutes IS NOT NULL AND e.timer_started_at IS NULL
       GROUP BY p.id, e.currency ORDER BY oldest`,
    )
    .all<{
      id: string;
      reference: string;
      name: string;
      client_name: string;
      currency: string | null;
      entries: number;
      minutes: number;
      oldest: string;
    }>();
  return results;
}

/** Projects (with their open tasks) the caller can log time against. */
export async function trackingOptions(ctx: RequestContext) {
  assertCan(ctx, 'time.track');
  const all = can(ctx, 'projects.view_all');
  const { results: projects } = await ctx.db
    .prepare(
      `SELECT p.id, p.reference, p.name FROM projects p
       WHERE p.status IN ('planning','active','on_hold')
         ${all ? '' : 'AND EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = ?)'}
       ORDER BY p.reference DESC LIMIT 500`,
    )
    .bind(...(all ? [] : [ctx.actor.userId ?? '']))
    .all<{ id: string; reference: string; name: string }>();
  if (projects.length === 0) return [];
  const { results: tasks } = await ctx.db
    .prepare(
      `SELECT id, project_id, title FROM project_tasks WHERE status <> 'done'
         AND project_id IN (${projects.map(() => '?').join(', ')}) ORDER BY position, title`,
    )
    .bind(...projects.map((p) => p.id))
    .all<{ id: string; project_id: string; title: string }>();
  return projects.map((p) => ({
    id: p.id,
    label: `${p.reference} · ${p.name}`,
    tasks: tasks.filter((t) => t.project_id === p.id).map((t) => ({ id: t.id, title: t.title })),
  }));
}

/** Staff whose timesheets a time.view_all user can open. */
export async function timeStaff(ctx: RequestContext) {
  assertCan(ctx, 'time.view_all');
  const { results } = await ctx.db
    .prepare("SELECT id, name FROM users WHERE user_type = 'staff' AND status = 'active' ORDER BY name")
    .all<{ id: string; name: string }>();
  return results;
}
