/**
 * Reports (P4.18, PRD §4.2 L). Every money figure is grouped by currency and never summed across currencies.
 * Dates are Harare business dates (UTC+2, no DST). Revenue = payments received (not reversed) minus refunds (not
 * failed) in the period they were made, the same rule as the dashboard. "By service" uses invoiced line totals on
 * issued invoices, because a receipt can't be split exactly across the lines it paid. Profit is indicative only.
 */
import type { RequestContext } from '../../context';
import { auditStmt } from '../../lib/audit';
import { toCsv } from '../../lib/csv';
import { addMonths, businessDate } from '../../lib/dates';
import { assertCan } from '../../lib/policies';
import { minorToDecimalString } from '../../../shared/money';
import { AGEING_LABEL, type AgeingBucket, type ReportKey } from '../../../shared/schemas/reports';

const HARARE = '+2 hours';
const bizDate = (col: string) => `date(datetime(${col}, '${HARARE}'))`;
const bizMonth = (col: string) => `substr(datetime(${col}, '${HARARE}'), 1, 7)`;

export interface Range {
  from: string;
  to: string;
}

/** Default range: the first day of the month 11 months ago to today (12 business months). */
export function resolveRange(ctx: RequestContext, q: { from?: string | undefined; to?: string | undefined }): Range {
  const today = businessDate(ctx.now());
  const to = q.to ?? today;
  const from = q.from ?? addMonths(`${today.slice(0, 7)}-01`, -11);
  return from <= to ? { from, to } : { from: to, to: from };
}

type Money = { currency: string; amountMinor: number };
const rows = async <T>(ctx: RequestContext, sql: string, ...params: unknown[]) =>
  (
    await ctx.db
      .prepare(sql)
      .bind(...params)
      .all<T>()
  ).results;

export async function revenueByMonth(ctx: RequestContext, r: Range) {
  const [received, refunded] = await Promise.all([
    rows<{ month: string; currency: string; amount: number }>(
      ctx,
      `SELECT ${bizMonth('received_at')} AS month, currency, SUM(amount_minor) AS amount FROM payments
       WHERE status <> 'reversed' AND ${bizDate('received_at')} BETWEEN ? AND ? GROUP BY month, currency`,
      r.from,
      r.to,
    ),
    rows<{ month: string; currency: string; amount: number }>(
      ctx,
      `SELECT ${bizMonth('rf.created_at')} AS month, rf.currency, SUM(rf.amount_minor) AS amount
       FROM refunds rf JOIN payments p ON p.id = rf.payment_id
       WHERE rf.status <> 'failed' AND p.status <> 'reversed' AND ${bizDate('rf.created_at')} BETWEEN ? AND ?
       GROUP BY month, rf.currency`,
      r.from,
      r.to,
    ),
  ]);
  const map = new Map<string, { month: string; currency: string; receivedMinor: number; refundedMinor: number }>();
  const key = (m: string, c: string) => `${m}|${c}`;
  for (const x of received)
    map.set(key(x.month, x.currency), {
      month: x.month,
      currency: x.currency,
      receivedMinor: x.amount,
      refundedMinor: 0,
    });
  for (const x of refunded) {
    const cur = map.get(key(x.month, x.currency)) ?? {
      month: x.month,
      currency: x.currency,
      receivedMinor: 0,
      refundedMinor: 0,
    };
    cur.refundedMinor += x.amount;
    map.set(key(x.month, x.currency), cur);
  }
  return [...map.values()]
    .map((v) => ({ ...v, netMinor: v.receivedMinor - v.refundedMinor }))
    .sort((a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency));
}

/** Net revenue per currency over the range. */
export async function revenueTotals(ctx: RequestContext, r: Range): Promise<Money[]> {
  const months = await revenueByMonth(ctx, r);
  const m = new Map<string, number>();
  for (const x of months) m.set(x.currency, (m.get(x.currency) ?? 0) + x.netMinor);
  return [...m.entries()]
    .map(([currency, amountMinor]) => ({ currency, amountMinor }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export async function revenueByClient(ctx: RequestContext, r: Range) {
  return rows<{ client_id: string; client: string; currency: string; received: number; refunded: number; net: number }>(
    ctx,
    `SELECT c.id AS client_id, c.display_name AS client, x.currency, SUM(x.received) AS received, SUM(x.refunded) AS refunded,
       SUM(x.received) - SUM(x.refunded) AS net
     FROM (
       SELECT client_id, currency, amount_minor AS received, 0 AS refunded FROM payments
       WHERE status <> 'reversed' AND ${bizDate('received_at')} BETWEEN ?1 AND ?2
       UNION ALL
       SELECT p.client_id, rf.currency, 0, rf.amount_minor FROM refunds rf JOIN payments p ON p.id = rf.payment_id
       WHERE rf.status <> 'failed' AND p.status <> 'reversed' AND ${bizDate('rf.created_at')} BETWEEN ?1 AND ?2
     ) x JOIN clients c ON c.id = x.client_id
     GROUP BY c.id, x.currency ORDER BY x.currency, net DESC, client LIMIT 1000`,
    r.from,
    r.to,
  );
}

export async function invoicedByService(ctx: RequestContext, r: Range) {
  return rows<{ service: string; currency: string; amount: number; lines: number }>(
    ctx,
    `SELECT COALESCE(s.name, 'Other (custom lines)') AS service, i.currency, SUM(it.line_total_minor) AS amount, COUNT(*) AS lines
     FROM invoice_items it JOIN invoices i ON i.id = it.invoice_id LEFT JOIN services s ON s.id = it.service_id
     WHERE i.status NOT IN ('draft','void') AND i.issue_date BETWEEN ? AND ?
     GROUP BY service, i.currency ORDER BY i.currency, amount DESC`,
    r.from,
    r.to,
  );
}

/** Open invoice balances by how far past due they are, as of `asOf` (default today). */
export async function ageing(ctx: RequestContext, asOf = businessDate(ctx.now())) {
  const open = await rows<{
    id: string;
    number: string;
    client: string;
    currency: string;
    due_date: string | null;
    balance_minor: number;
    days: number;
  }>(
    ctx,
    `SELECT i.id, i.number, c.display_name AS client, i.currency, i.due_date, i.balance_minor,
       CAST(julianday(?) - julianday(COALESCE(i.due_date, ?)) AS INTEGER) AS days
     FROM invoices i JOIN clients c ON c.id = i.client_id
     WHERE i.status IN ('issued','partially_paid','overdue') AND i.balance_minor > 0
     ORDER BY i.currency, days DESC, i.number`,
    asOf,
    asOf,
  );
  const bucketOf = (days: number): AgeingBucket =>
    days <= 0 ? 'current' : days <= 30 ? 'd1_30' : days <= 60 ? 'd31_60' : days <= 90 ? 'd61_90' : 'd90_plus';
  type Buckets = Record<AgeingBucket, { amountMinor: number; count: number }> & { totalMinor: number };
  const empty = (): Buckets => ({
    current: { amountMinor: 0, count: 0 },
    d1_30: { amountMinor: 0, count: 0 },
    d31_60: { amountMinor: 0, count: 0 },
    d61_90: { amountMinor: 0, count: 0 },
    d90_plus: { amountMinor: 0, count: 0 },
    totalMinor: 0,
  });
  const byCurrency = new Map<string, Buckets>();
  for (const inv of open) {
    const cur = byCurrency.get(inv.currency) ?? empty();
    const b = cur[bucketOf(inv.days)];
    b.amountMinor += inv.balance_minor;
    b.count += 1;
    cur.totalMinor += inv.balance_minor;
    byCurrency.set(inv.currency, cur);
  }
  return {
    asOf,
    summary: [...byCurrency.entries()].map(([currency, v]) => ({ currency, ...v })),
    invoices: open.map((i) => ({ ...i, bucket: bucketOf(i.days) })),
  };
}

/** Quotations first sent in the range and what became of them. */
export async function conversion(ctx: RequestContext, r: Range) {
  const counts = await rows<{ status: string; n: number }>(
    ctx,
    `SELECT status, COUNT(*) AS n FROM quotations
     WHERE sent_at IS NOT NULL AND status <> 'void' AND ${bizDate('sent_at')} BETWEEN ? AND ? GROUP BY status`,
    r.from,
    r.to,
  );
  const accepted = await rows<{ currency: string; amount: number; n: number }>(
    ctx,
    `SELECT currency, SUM(total_minor) AS amount, COUNT(*) AS n FROM quotations
     WHERE status = 'accepted' AND sent_at IS NOT NULL AND ${bizDate('sent_at')} BETWEEN ? AND ? GROUP BY currency ORDER BY currency`,
    r.from,
    r.to,
  );
  const n = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;
  const sent = counts.reduce((a, c) => a + c.n, 0);
  const acceptedCount = n('accepted');
  return {
    sent,
    accepted: acceptedCount,
    rejected: n('rejected'),
    expired: n('expired'),
    open: n('sent') + n('viewed'),
    /** Accepted as a share of quotations sent, in basis points (2500 = 25%); null when nothing was sent. */
    rateBp: sent ? Math.round((acceptedCount * 10_000) / sent) : null,
    acceptedValue: accepted.map((a) => ({ currency: a.currency, amountMinor: a.amount, count: a.n })),
  };
}

export async function expensesByCategory(ctx: RequestContext, r: Range) {
  return rows<{ category: string; currency: string; amount: number; n: number }>(
    ctx,
    `SELECT c.name AS category, e.currency, SUM(e.amount_minor) AS amount, COUNT(*) AS n
     FROM expenses e JOIN expense_categories c ON c.id = e.category_id
     WHERE e.status = 'recorded' AND e.expense_date BETWEEN ? AND ?
     GROUP BY c.name, e.currency ORDER BY e.currency, amount DESC`,
    r.from,
    r.to,
  );
}

/** Indicative profit per currency: net revenue received − recorded expenses. Not accounting figures. */
export async function profitIndicator(ctx: RequestContext, r: Range) {
  const [revenue, expenses] = await Promise.all([revenueTotals(ctx, r), expensesByCategory(ctx, r)]);
  const out = new Map<string, { currency: string; revenueMinor: number; expensesMinor: number; profitMinor: number }>();
  const get = (c: string) => out.get(c) ?? { currency: c, revenueMinor: 0, expensesMinor: 0, profitMinor: 0 };
  for (const x of revenue) out.set(x.currency, { ...get(x.currency), revenueMinor: x.amountMinor });
  for (const e of expenses) {
    const cur = get(e.currency);
    cur.expensesMinor += e.amount;
    out.set(e.currency, cur);
  }
  return [...out.values()]
    .map((v) => ({ ...v, profitMinor: v.revenueMinor - v.expensesMinor }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export async function reports(ctx: RequestContext, r: Range) {
  assertCan(ctx, 'reports.view');
  const [byMonth, byClient, byService, aged, conv, expenses, profit] = await Promise.all([
    revenueByMonth(ctx, r),
    revenueByClient(ctx, r),
    invoicedByService(ctx, r),
    ageing(ctx),
    conversion(ctx, r),
    expensesByCategory(ctx, r),
    profitIndicator(ctx, r),
  ]);
  return { range: r, byMonth, byClient, byService, ageing: aged, conversion: conv, expenses, profit };
}

/** Every active currency uses 2 minor digits (USD, ZWG); amounts are written as plain decimals. */
const plain = (minor: number) => minorToDecimalString(minor, 2);

/** CSV for one report. Amounts are decimal strings in the row's currency (never converted). Audited. */
export async function exportReportCsv(ctx: RequestContext, report: ReportKey, r: Range): Promise<string> {
  assertCan(ctx, 'reports.export');
  let table: unknown[][];
  switch (report) {
    case 'revenue_month':
      table = [
        ['Month', 'Currency', 'Received', 'Refunded', 'Net'],
        ...(await revenueByMonth(ctx, r)).map((x) => [
          x.month,
          x.currency,
          plain(x.receivedMinor),
          plain(x.refundedMinor),
          plain(x.netMinor),
        ]),
      ];
      break;
    case 'revenue_client':
      table = [
        ['Client', 'Currency', 'Received', 'Refunded', 'Net'],
        ...(await revenueByClient(ctx, r)).map((x) => [
          x.client,
          x.currency,
          plain(x.received),
          plain(x.refunded),
          plain(x.net),
        ]),
      ];
      break;
    case 'revenue_service':
      table = [
        ['Service', 'Currency', 'Invoiced', 'Lines'],
        ...(await invoicedByService(ctx, r)).map((x) => [x.service, x.currency, plain(x.amount), x.lines]),
      ];
      break;
    case 'ageing': {
      const a = await ageing(ctx);
      table = [
        ['Invoice', 'Client', 'Currency', 'Due date', 'Days overdue', 'Bucket', 'Balance'],
        ...a.invoices.map((i) => [
          i.number,
          i.client,
          i.currency,
          i.due_date,
          Math.max(0, i.days),
          AGEING_LABEL[i.bucket],
          plain(i.balance_minor),
        ]),
      ];
      break;
    }
    case 'conversion': {
      const c = await conversion(ctx, r);
      table = [
        ['Measure', 'Value'],
        ['Quotations sent', c.sent],
        ['Accepted', c.accepted],
        ['Rejected', c.rejected],
        ['Expired', c.expired],
        ['Still open', c.open],
        ['Conversion rate (%)', c.rateBp === null ? '' : (c.rateBp / 100).toFixed(2)],
        ...c.acceptedValue.map((v) => [`Accepted value (${v.currency})`, plain(v.amountMinor)]),
      ];
      break;
    }
    case 'expenses':
      table = [
        ['Category', 'Currency', 'Amount', 'Records'],
        ...(await expensesByCategory(ctx, r)).map((x) => [x.category, x.currency, plain(x.amount), x.n]),
      ];
      table.unshift(['Expense records. This is not a statutory accounting system.']);
      break;
    case 'profit':
      table = [
        ['Indicative only: revenue received minus recorded expenses. Not accounting figures.'],
        ['Currency', 'Revenue received', 'Expenses', 'Indicative profit'],
        ...(await profitIndicator(ctx, r)).map((x) => [
          x.currency,
          plain(x.revenueMinor),
          plain(x.expensesMinor),
          plain(x.profitMinor),
        ]),
      ];
      break;
  }
  await auditStmt(ctx, {
    action: 'report.exported',
    entityType: 'report',
    entityId: report,
    after: { from: r.from, to: r.to },
  }).run();
  return toCsv([[`Period ${r.from} to ${r.to} (Africa/Harare)`], ...table]);
}
