/**
 * Client portal reads (P5.2+). Every query is scoped on the server to the caller's linked clients for the relevant
 * area (`portalAreaClientIds`), and only shows what is meant for the client: issued documents, sent quotations,
 * client-visible updates and milestones. Nothing here is reachable for staff sessions.
 */
import type { RequestContext } from '../../context';
import { businessDate } from '../../lib/dates';
import { clientScope, portalAreaClientIds, portalClientIds } from '../../lib/policies';

export interface PortalBalance {
  currency: string;
  outstandingMinor: number;
  overdueMinor: number;
  openInvoices: number;
  overdueInvoices: number;
}

export interface PortalQuotationSummary {
  id: string;
  number: string;
  title: string;
  currency: string;
  totalMinor: number;
  validUntil: string | null;
  status: 'sent' | 'viewed';
}

export interface PortalProjectSummary {
  id: string;
  reference: string;
  name: string;
  status: 'planning' | 'active' | 'on_hold';
  progressPct: number;
  targetDate: string | null;
  nextMilestone: { title: string; dueDate: string | null } | null;
}

export type PortalActivityKind = 'invoice' | 'quotation' | 'payment' | 'project_update';

export interface PortalActivity {
  kind: PortalActivityKind;
  id: string;
  /** The record to open: the document, payment, or (for updates) the project. */
  targetId: string;
  at: string;
  title: string;
  detail: string | null;
  currency: string | null;
  amountMinor: number | null;
}

export interface PortalOverview {
  /** Which areas the caller may see at all (from their access role per client). */
  areas: { finance: boolean; projects: boolean; quotations: boolean };
  balances: PortalBalance[];
  quotations: { total: number; items: PortalQuotationSummary[] };
  projects: { total: number; items: PortalProjectSummary[] };
  activity: PortalActivity[];
}

const OPEN_INVOICE = "status IN ('issued','partially_paid','overdue') AND balance_minor > 0";
const ACTIVITY_LIMIT = 8;
const LIST_LIMIT = 5;

export async function portalOverview(ctx: RequestContext): Promise<PortalOverview> {
  portalClientIds(ctx); // throws for non-portal callers
  const today = businessDate(ctx.now());
  const fin = clientScope('client_id', portalAreaClientIds(ctx, 'finance'));
  const quo = clientScope('client_id', portalAreaClientIds(ctx, 'quotations'));
  const prj = clientScope('p.client_id', portalAreaClientIds(ctx, 'projects'));
  const openQuote = `${quo.sql} AND status IN ('sent','viewed') AND (valid_until IS NULL OR valid_until >= ?)`;
  const activePrj = `${prj.sql} AND p.status IN ('planning','active','on_hold')`;

  const [balances, quoteCount, quotes, prjCount, projects, activity] = await ctx.db.batch([
    ctx.db
      .prepare(
        `SELECT currency, SUM(balance_minor) AS outstanding, COUNT(*) AS open_count,
           SUM(CASE WHEN status = 'overdue' OR (due_date IS NOT NULL AND due_date < ?) THEN balance_minor ELSE 0 END) AS overdue,
           SUM(CASE WHEN status = 'overdue' OR (due_date IS NOT NULL AND due_date < ?) THEN 1 ELSE 0 END) AS overdue_count
         FROM invoices WHERE ${fin.sql} AND ${OPEN_INVOICE} GROUP BY currency ORDER BY currency`,
      )
      .bind(today, today, ...fin.params),
    ctx.db.prepare(`SELECT COUNT(*) AS n FROM quotations WHERE ${openQuote}`).bind(...quo.params, today),
    ctx.db
      .prepare(
        `SELECT id, number, title, currency, total_minor, valid_until, status FROM quotations WHERE ${openQuote}
         ORDER BY COALESCE(valid_until, '9999-12-31'), sent_at DESC LIMIT ${LIST_LIMIT}`,
      )
      .bind(...quo.params, today),
    ctx.db.prepare(`SELECT COUNT(*) AS n FROM projects p WHERE ${activePrj}`).bind(...prj.params),
    ctx.db
      .prepare(
        `SELECT p.id, p.reference, p.name, p.status, p.progress_pct, p.target_date,
           (SELECT json_object('title', m.title, 'dueDate', m.due_date) FROM project_milestones m
            WHERE m.project_id = p.id AND m.client_visible = 1 AND m.status IN ('pending','in_progress')
            ORDER BY COALESCE(m.due_date, '9999-12-31'), m.position LIMIT 1) AS next_milestone
         FROM projects p WHERE ${activePrj}
         ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'planning' THEN 1 ELSE 2 END, p.updated_at DESC LIMIT ${LIST_LIMIT}`,
      )
      .bind(...prj.params),
    ctx.db
      .prepare(
        `SELECT * FROM (
           SELECT 'invoice' AS kind, id, id AS target, issued_at AS at, 'Invoice ' || number || ' issued' AS title, NULL AS detail,
             currency, total_minor AS amount FROM invoices
             WHERE ${fin.sql} AND status <> 'draft' AND status <> 'void' AND issued_at IS NOT NULL
           UNION ALL
           SELECT 'quotation', id, id, sent_at, 'Quotation ' || number || ' sent', title, currency, total_minor FROM quotations
             WHERE ${quo.sql} AND status NOT IN ('draft','void') AND sent_at IS NOT NULL
           UNION ALL
           SELECT 'payment', id, id, received_at, 'Payment received, receipt ' || receipt_number, NULL, currency, amount_minor
             FROM payments WHERE ${fin.sql} AND status <> 'reversed'
           UNION ALL
           SELECT 'project_update', u.id, p.id, u.created_at, 'Update on ' || p.name, substr(u.body, 1, 280), NULL, NULL
             FROM project_updates u JOIN projects p ON p.id = u.project_id
             WHERE ${prj.sql} AND u.visibility = 'client'
         ) ORDER BY at DESC LIMIT ${ACTIVITY_LIMIT}`,
      )
      .bind(...fin.params, ...quo.params, ...fin.params, ...prj.params),
  ]);

  type BalanceRow = {
    currency: string;
    outstanding: number;
    overdue: number;
    open_count: number;
    overdue_count: number;
  };
  type QuoteRow = {
    id: string;
    number: string;
    title: string;
    currency: string;
    total_minor: number;
    valid_until: string | null;
    status: 'sent' | 'viewed';
  };
  type ProjectRow = {
    id: string;
    reference: string;
    name: string;
    status: 'planning' | 'active' | 'on_hold';
    progress_pct: number;
    target_date: string | null;
    next_milestone: string | null;
  };
  type ActivityRow = {
    kind: PortalActivityKind;
    id: string;
    target: string;
    at: string;
    title: string;
    detail: string | null;
    currency: string | null;
    amount: number | null;
  };
  const n = (r: D1Result | undefined) => ((r?.results?.[0] as { n?: number } | undefined)?.n ?? 0) as number;

  return {
    areas: {
      finance: fin.params.length > 0,
      projects: prj.params.length > 0,
      quotations: quo.params.length > 0,
    },
    balances: ((balances?.results ?? []) as BalanceRow[]).map((b) => ({
      currency: b.currency,
      outstandingMinor: b.outstanding,
      overdueMinor: b.overdue,
      openInvoices: b.open_count,
      overdueInvoices: b.overdue_count,
    })),
    quotations: {
      total: n(quoteCount),
      items: ((quotes?.results ?? []) as QuoteRow[]).map((q) => ({
        id: q.id,
        number: q.number,
        title: q.title,
        currency: q.currency,
        totalMinor: q.total_minor,
        validUntil: q.valid_until,
        status: q.status,
      })),
    },
    projects: {
      total: n(prjCount),
      items: ((projects?.results ?? []) as ProjectRow[]).map((p) => ({
        id: p.id,
        reference: p.reference,
        name: p.name,
        status: p.status,
        progressPct: p.progress_pct,
        targetDate: p.target_date,
        nextMilestone: p.next_milestone
          ? (JSON.parse(p.next_milestone) as { title: string; dueDate: string | null })
          : null,
      })),
    },
    activity: ((activity?.results ?? []) as ActivityRow[]).map((a) => ({
      kind: a.kind,
      id: a.id,
      targetId: a.target,
      at: a.at,
      title: a.title,
      detail: a.detail,
      currency: a.currency,
      amountMinor: a.amount,
    })),
  };
}
