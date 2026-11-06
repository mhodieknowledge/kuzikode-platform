/**
 * Admin dashboard (PRD §4.1): real figures only, filtered by permission. Money is always grouped per currency and never
 * summed across currencies (no FX). Months are business months in Africa/Harare (UTC+2 all year, no daylight saving).
 */
import type { Permission } from '../../../shared/permissions';
import type { RequestContext } from '../../context';
import { addDays, addMonths, businessDate } from '../../lib/dates';
import { can } from '../../lib/policies';

/** Harare has no DST, so a fixed offset converts stored UTC timestamps to business dates inside SQL. */
const HARARE = '+2 hours';
const bizMonth = (col: string) => `substr(datetime(${col}, '${HARARE}'), 1, 7)`;

export interface CurrencyAmount {
  currency: string;
  amountMinor: number;
  count?: number;
}
export interface MonthSeries {
  /** YYYY-MM, oldest first, always 12 entries. */
  months: string[];
  /** Net revenue received per month for one currency (refunds deducted in the month they were made). */
  revenue: { currency: string; values: number[] }[];
  /** Invoices issued (by issue date) and fully paid (by the date of the payment that settled them), counts per month. */
  issued: number[];
  paid: number[];
}

export interface Dashboard {
  today: string;
  financial: null | {
    revenueAllTime: CurrencyAmount[];
    revenueThisMonth: CurrencyAmount[];
    outstanding: CurrencyAmount[];
    overdue: CurrencyAmount[];
    charts: MonthSeries;
  };
  quotations: null | { pending: number; pendingValue: CurrencyAmount[] };
  projects: null | {
    active: number;
    completed: number;
    upcomingMilestones: {
      id: string;
      title: string;
      dueDate: string;
      projectId: string;
      projectName: string;
      reference: string;
    }[];
  };
  enquiries: null | { last7Days: number; briefs7Days: number };
  careers: null | { openRoles: number; newApplicants7Days: number };
  recentPayments:
    | null
    | {
        id: string;
        receiptNumber: string;
        client: string;
        amountMinor: number;
        currency: string;
        method: string;
        receivedAt: string;
        providerReference: string | null;
      }[];
  dueInvoices:
    null | { id: string; number: string; client: string; dueDate: string; balanceMinor: number; currency: string }[];
  activity:
    | null
    | {
        id: string;
        action: string;
        entityType: string | null;
        entityId: string | null;
        actor: string | null;
        createdAt: string;
      }[];
}

type Row = Record<string, unknown>;
const rows = <T>(r: D1Result | undefined) => (r?.results ?? []) as T[];
const amounts = (r: D1Result | undefined): CurrencyAmount[] =>
  rows<{ currency: string; amount: number; n?: number }>(r).map((x) => ({
    currency: x.currency,
    amountMinor: x.amount ?? 0,
    ...(x.n !== undefined ? { count: x.n } : {}),
  }));

const anyOf = (ctx: RequestContext, ...p: Permission[]) => p.some((x) => can(ctx, x));

/** The last 12 business months ending with the current one, oldest first. */
export function lastTwelveMonths(today: string): string[] {
  const first = `${today.slice(0, 7)}-01`;
  return Array.from({ length: 12 }, (_, i) => addMonths(first, i - 11).slice(0, 7));
}

async function financial(ctx: RequestContext, today: string): Promise<NonNullable<Dashboard['financial']>> {
  const months = lastTwelveMonths(today);
  const thisMonth = months[11]!;
  // Window start in UTC: the first business day of the oldest month, 00:00 Harare = 22:00 UTC the day before.
  const since = new Date(`${months[0]}-01T00:00:00.000+02:00`).toISOString();
  const db = ctx.db;
  const [allRec, allRef, monRec, monRef, outstanding, overdue, issued, paid] = await db.batch([
    db.prepare(
      "SELECT currency, SUM(amount_minor) AS amount FROM payments WHERE status <> 'reversed' GROUP BY currency ORDER BY currency",
    ),
    db.prepare(
      "SELECT r.currency, SUM(r.amount_minor) AS amount FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE r.status <> 'failed' AND p.status <> 'reversed' GROUP BY r.currency",
    ),
    db
      .prepare(
        `SELECT ${bizMonth('received_at')} AS month, currency, SUM(amount_minor) AS amount FROM payments
         WHERE status <> 'reversed' AND received_at >= ? GROUP BY month, currency`,
      )
      .bind(since),
    db
      .prepare(
        `SELECT ${bizMonth('r.created_at')} AS month, r.currency, SUM(r.amount_minor) AS amount
         FROM refunds r JOIN payments p ON p.id = r.payment_id
         WHERE r.status <> 'failed' AND p.status <> 'reversed' AND r.created_at >= ? GROUP BY month, r.currency`,
      )
      .bind(since),
    db.prepare(
      `SELECT currency, SUM(balance_minor) AS amount, COUNT(*) AS n FROM invoices
       WHERE status IN ('issued','partially_paid','overdue') AND balance_minor > 0 GROUP BY currency ORDER BY currency`,
    ),
    db
      .prepare(
        `SELECT currency, SUM(balance_minor) AS amount, COUNT(*) AS n FROM invoices
         WHERE status IN ('issued','partially_paid','overdue') AND balance_minor > 0 AND due_date < ?
         GROUP BY currency ORDER BY currency`,
      )
      .bind(today),
    db
      .prepare(
        `SELECT substr(issue_date, 1, 7) AS month, COUNT(*) AS n FROM invoices
         WHERE issue_date >= ? AND status NOT IN ('draft','void') GROUP BY month`,
      )
      .bind(`${months[0]}-01`),
    db
      .prepare(
        `SELECT ${bizMonth('settled')} AS month, COUNT(*) AS n FROM (
           SELECT i.id, MAX(p.received_at) AS settled FROM invoices i
           JOIN payment_allocations a ON a.invoice_id = i.id JOIN payments p ON p.id = a.payment_id
           WHERE i.status = 'paid' AND p.status <> 'reversed' GROUP BY i.id
         ) WHERE settled >= ? GROUP BY month`,
      )
      .bind(since),
  ]);

  const net = (rec: CurrencyAmount[], ref: CurrencyAmount[]) => {
    const m = new Map(rec.map((r) => [r.currency, r.amountMinor]));
    for (const r of ref) m.set(r.currency, (m.get(r.currency) ?? 0) - r.amountMinor);
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, amountMinor]) => ({ currency, amountMinor }));
  };

  const byMonth = new Map<string, Map<string, number>>(); // currency → month → amount
  const add = (cur: string, month: string, v: number) => {
    const m = byMonth.get(cur) ?? new Map<string, number>();
    m.set(month, (m.get(month) ?? 0) + v);
    byMonth.set(cur, m);
  };
  for (const r of rows<{ month: string; currency: string; amount: number }>(monRec)) add(r.currency, r.month, r.amount);
  for (const r of rows<{ month: string; currency: string; amount: number }>(monRef))
    add(r.currency, r.month, -r.amount);
  const revenue = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, m]) => ({ currency, values: months.map((k) => m.get(k) ?? 0) }));
  const counts = (r: D1Result | undefined) => {
    const m = new Map(rows<{ month: string; n: number }>(r).map((x) => [x.month, x.n]));
    return months.map((k) => m.get(k) ?? 0);
  };

  return {
    revenueAllTime: net(amounts(allRec), amounts(allRef)),
    revenueThisMonth: revenue
      .map((s) => ({ currency: s.currency, amountMinor: s.values[11] ?? 0 }))
      .filter((s) => byMonth.get(s.currency)?.has(thisMonth)),
    outstanding: amounts(outstanding),
    overdue: amounts(overdue),
    charts: { months, revenue, issued: counts(issued), paid: counts(paid) },
  };
}

/** Builds every tile, list and chart the signed-in staff member may see. Sections they can't see are null. */
export async function getDashboard(ctx: RequestContext): Promise<Dashboard> {
  const now = ctx.now();
  const today = businessDate(now);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const db = ctx.db;
  const d: Dashboard = {
    today,
    financial: null,
    quotations: null,
    projects: null,
    enquiries: null,
    careers: null,
    recentPayments: null,
    dueInvoices: null,
    activity: null,
  };
  if (!can(ctx, 'dashboard.view')) return d;

  if (can(ctx, 'dashboard.financial')) d.financial = await financial(ctx, today);

  if (can(ctx, 'quotations.view')) {
    const [count, value] = await db.batch([
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM quotations WHERE status IN ('sent','viewed') AND (valid_until IS NULL OR valid_until >= ?)",
        )
        .bind(today),
      db
        .prepare(
          `SELECT currency, SUM(total_minor) AS amount, COUNT(*) AS n FROM quotations
           WHERE status IN ('sent','viewed') AND (valid_until IS NULL OR valid_until >= ?) GROUP BY currency ORDER BY currency`,
        )
        .bind(today),
    ]);
    d.quotations = { pending: rows<{ n: number }>(count)[0]?.n ?? 0, pendingValue: amounts(value) };
  }

  if (anyOf(ctx, 'projects.view', 'projects.view_all')) {
    const all = can(ctx, 'projects.view_all');
    const scope = all
      ? '1 = 1'
      : 'EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = p.id AND m.user_id = ?)';
    const sp = all ? [] : [ctx.actor.userId ?? ''];
    const [counts, milestones] = await db.batch([
      db
        .prepare(
          `SELECT SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed FROM projects p WHERE ${scope}`,
        )
        .bind(...sp),
      db
        .prepare(
          `SELECT ms.id, ms.title, ms.due_date, p.id AS project_id, p.name, p.reference
           FROM project_milestones ms JOIN projects p ON p.id = ms.project_id
           WHERE ms.status IN ('pending','in_progress') AND ms.due_date BETWEEN ? AND ?
             AND p.status IN ('planning','active','on_hold') AND ${scope}
           ORDER BY ms.due_date, ms.position LIMIT 6`,
        )
        .bind(today, addDays(today, 30), ...sp),
    ]);
    const c = rows<{ active: number | null; completed: number | null }>(counts)[0];
    d.projects = {
      active: c?.active ?? 0,
      completed: c?.completed ?? 0,
      upcomingMilestones: rows<Row>(milestones).map((m) => ({
        id: m.id as string,
        title: m.title as string,
        dueDate: m.due_date as string,
        projectId: m.project_id as string,
        projectName: m.name as string,
        reference: m.reference as string,
      })),
    };
  }

  if (can(ctx, 'enquiries.view')) {
    const r = await db
      .prepare(
        `SELECT COUNT(*) AS n, SUM(CASE WHEN kind = 'wizard' THEN 1 ELSE 0 END) AS briefs FROM enquiries
         WHERE status <> 'spam' AND created_at >= ?`,
      )
      .bind(weekAgo)
      .first<{ n: number; briefs: number | null }>();
    d.enquiries = { last7Days: r?.n ?? 0, briefs7Days: r?.briefs ?? 0 };
  }

  if (can(ctx, 'careers.view')) {
    const [open, apps] = await db.batch([
      db.prepare("SELECT COUNT(*) AS n FROM job_postings WHERE status = 'open'"),
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM job_applications WHERE status = 'new' AND created_at >= ? AND anonymised_at IS NULL",
        )
        .bind(weekAgo),
    ]);
    d.careers = {
      openRoles: rows<{ n: number }>(open)[0]?.n ?? 0,
      newApplicants7Days: rows<{ n: number }>(apps)[0]?.n ?? 0,
    };
  }

  if (can(ctx, 'payments.view')) {
    const { results } = await db
      .prepare(
        `SELECT p.id, p.receipt_number, c.display_name, p.amount_minor, p.currency, p.method, p.received_at, p.provider_reference
         FROM payments p JOIN clients c ON c.id = p.client_id ORDER BY p.received_at DESC, p.id DESC LIMIT 6`,
      )
      .all<Row>();
    d.recentPayments = results.map((p) => ({
      id: p.id as string,
      receiptNumber: p.receipt_number as string,
      client: p.display_name as string,
      amountMinor: p.amount_minor as number,
      currency: p.currency as string,
      method: p.method as string,
      receivedAt: p.received_at as string,
      providerReference: (p.provider_reference as string | null) ?? null,
    }));
  }

  if (can(ctx, 'invoices.view')) {
    const { results } = await db
      .prepare(
        `SELECT i.id, i.number, c.display_name, i.due_date, i.balance_minor, i.currency FROM invoices i
         JOIN clients c ON c.id = i.client_id
         WHERE i.status IN ('issued','partially_paid') AND i.balance_minor > 0 AND i.due_date BETWEEN ? AND ?
         ORDER BY i.due_date, i.number LIMIT 6`,
      )
      .bind(today, addDays(today, 14))
      .all<Row>();
    d.dueInvoices = results.map((i) => ({
      id: i.id as string,
      number: i.number as string,
      client: i.display_name as string,
      dueDate: i.due_date as string,
      balanceMinor: i.balance_minor as number,
      currency: i.currency as string,
    }));
  }

  // Business activity only: sign-ins and sign-outs would drown it (they stay in the audit log viewer).
  if (can(ctx, 'audit.view')) {
    const { results } = await db
      .prepare(
        `SELECT a.id, a.action, a.entity_type, a.entity_id, a.created_at, u.name FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_user_id
         WHERE a.action NOT LIKE 'auth.%' ORDER BY a.created_at DESC, a.id DESC LIMIT 8`,
      )
      .all<Row>();
    d.activity = results.map((a) => ({
      id: a.id as string,
      action: a.action as string,
      entityType: (a.entity_type as string | null) ?? null,
      entityId: (a.entity_id as string | null) ?? null,
      actor: (a.name as string | null) ?? null,
      createdAt: a.created_at as string,
    }));
  }
  return d;
}
