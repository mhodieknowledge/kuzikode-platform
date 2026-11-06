/**
 * Subscriptions & recurring billing (P4.20, docs/12 §A.3). A subscription bills one period at a time: the daily cron creates
 * the invoice for every period that starts within the lead time, records it in `subscription_periods` (UNIQUE per period
 * start, in the same batch as the invoice) and advances `next_billing_date`. A second or overlapping run hits the unique
 * key, so its whole batch rolls back: a period is never invoiced twice. Billing dates are anchored to the start date, so
 * a subscription started on the 31st bills on the last day of shorter months and returns to the 31st afterwards.
 * Unpaid subscription invoices mark the subscription "at risk" after N days; nobody's service is suspended automatically.
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { addDays, addMonths, businessDate } from '../../lib/dates';
import { conflict, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { assertCan } from '../../lib/policies';
import { formatQuantity, mulDivHalfEven, parseQuantityMilli } from '../../../shared/money';
import { computeDocument } from '../../../shared/pricing';
import type {
  SubscriptionInput,
  SubscriptionListQuery,
  SubscriptionStatus,
} from '../../../shared/schemas/subscriptions';
import { getSettings, settingNumber } from '../cms';
import { draftInvoiceStatements, issueDraft } from '../invoices/service';
import { notifyStaffWithPermission } from '../notifications';

export const PAGE_SIZE = 25;
/** Statuses that bill. */
const BILLING = `('active','at_risk')`;

export interface SubscriptionRow {
  id: string;
  client_id: string;
  package_id: string | null;
  description: string;
  quantity_milli: number;
  unit_price_minor: number;
  currency: string;
  tax_rate_id: string | null;
  interval: 'month' | 'year';
  start_date: string;
  next_billing_date: string;
  auto_issue: number;
  status: SubscriptionStatus;
  cancelled_at: string | null;
  cancel_reason: string | null;
  source_quotation_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------- periods

const step = (interval: 'month' | 'year') => (interval === 'month' ? 1 : 12);

/** Last day of the period that starts on `start`. */
export function periodEnd(start: string, interval: 'month' | 'year', anchor = start): string {
  return addDays(nextAnchored(anchor, start, interval), -1);
}

/** The first billing date after `current` on the schedule anchored at `anchor` (the start date). */
export function nextAnchored(anchor: string, current: string, interval: 'month' | 'year'): string {
  for (let n = 1; n < 2400; n++) {
    const candidate = addMonths(anchor, step(interval) * n);
    if (candidate > current) return candidate;
  }
  throw new Error('billing schedule out of range');
}

/** "1–31 Dec 2026", "15 Dec 2026–14 Jan 2027". */
export function periodLabel(start: string, end: string): string {
  const d = (s: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(`${s}T00:00:00Z`));
  if (start.slice(0, 7) === end.slice(0, 7))
    return `${Number(start.slice(8))}–${d(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  if (start.slice(0, 4) === end.slice(0, 4))
    return `${d(start, { day: 'numeric', month: 'short' })}–${d(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return `${d(start, { day: 'numeric', month: 'short', year: 'numeric' })}–${d(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

// ---------------------------------------------------------------- reads

async function loadRow(ctx: RequestContext, id: string): Promise<SubscriptionRow> {
  const r = await ctx.db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first<SubscriptionRow>();
  if (!r) throw notFound();
  return r;
}

const escapeLike = (q: string) =>
  `%${q
    .trim()
    .slice(0, 80)
    .replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export async function listSubscriptions(ctx: RequestContext, f: SubscriptionListQuery) {
  assertCan(ctx, 'subscriptions.view');
  const where: string[] = [];
  const params: unknown[] = [];
  const status = f.status ?? 'open';
  if (status === 'open') where.push(`s.status IN ('active','at_risk','paused')`);
  else if (status !== 'all') {
    where.push('s.status = ?');
    params.push(status);
  }
  if (f.clientId) {
    where.push('s.client_id = ?');
    params.push(f.clientId);
  }
  if (f.dueBy) {
    where.push(`s.status IN ${BILLING} AND s.next_billing_date <= ?`);
    params.push(f.dueBy);
  }
  if (f.q) {
    where.push(`(s.description LIKE ? ESCAPE '\\' OR c.display_name LIKE ? ESCAPE '\\')`);
    params.push(escapeLike(f.q), escapeLike(f.q));
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [count, rows] = await ctx.db.batch([
    ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM subscriptions s JOIN clients c ON c.id = s.client_id ${w}`)
      .bind(...params),
    ctx.db
      .prepare(
        `SELECT s.*, c.display_name AS client_name FROM subscriptions s JOIN clients c ON c.id = s.client_id ${w}
         ORDER BY CASE WHEN s.status IN ${BILLING} THEN 0 ELSE 1 END, s.next_billing_date, s.id LIMIT ? OFFSET ?`,
      )
      .bind(...params, PAGE_SIZE, (f.page - 1) * PAGE_SIZE),
  ]);
  const total = ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  return {
    items: (rows?.results ?? []) as (SubscriptionRow & { client_name: string })[],
    total,
    page: f.page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    mrr: await recurringRevenue(ctx),
  };
}

/** Net (tax-exclusive) recurring revenue of billing subscriptions, per currency. Yearly plans count as 1/12 a month. */
export async function recurringRevenue(
  ctx: RequestContext,
): Promise<{ currency: string; mrrMinor: number; arrMinor: number; count: number }[]> {
  const { results } = await ctx.db
    .prepare(
      `SELECT currency, interval, quantity_milli, unit_price_minor FROM subscriptions WHERE status IN ${BILLING}`,
    )
    .all<{ currency: string; interval: 'month' | 'year'; quantity_milli: number; unit_price_minor: number }>();
  const by = new Map<string, { monthly: number; yearly: number; count: number }>();
  for (const s of results) {
    const amount = mulDivHalfEven(s.unit_price_minor, s.quantity_milli, 1000);
    const m = by.get(s.currency) ?? { monthly: 0, yearly: 0, count: 0 };
    if (s.interval === 'month') m.monthly += amount;
    else m.yearly += amount;
    m.count++;
    by.set(s.currency, m);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, m]) => ({
      currency,
      // Monthly value of yearly plans is rounded once per currency (half-even), so ARR stays exact.
      mrrMinor: m.monthly + mulDivHalfEven(m.yearly, 1, 12),
      arrMinor: m.monthly * 12 + m.yearly,
      count: m.count,
    }));
}

export interface InvoicePreview {
  periodStart: string;
  periodEnd: string;
  description: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
}

async function preview(ctx: RequestContext, s: SubscriptionRow): Promise<InvoicePreview | null> {
  if (!['active', 'at_risk', 'paused'].includes(s.status)) return null;
  const tax = s.tax_rate_id
    ? await ctx.db
        .prepare('SELECT rate_bp, inclusive FROM tax_rates WHERE id = ?')
        .bind(s.tax_rate_id)
        .first<{ rate_bp: number; inclusive: number }>()
    : null;
  const end = periodEnd(s.next_billing_date, s.interval, s.start_date);
  const totals = computeDocument({
    lines: [
      {
        quantityMilli: s.quantity_milli,
        unitPriceMinor: s.unit_price_minor,
        discount: { type: 'none', value: 0 },
        taxRateBp: tax?.rate_bp ?? 0,
        taxInclusive: tax?.inclusive === 1,
      },
    ],
    discount: { type: 'none', value: 0 },
  });
  return {
    periodStart: s.next_billing_date,
    periodEnd: end,
    description: lineDescription(s, s.next_billing_date, end),
    subtotalMinor: totals.subtotalMinor - totals.discountMinor,
    taxMinor: totals.taxMinor,
    totalMinor: totals.totalMinor,
  };
}

/** "Business Email, 10 mailboxes, 1–31 Dec 2026" style: the description plus the period. */
const lineDescription = (s: Pick<SubscriptionRow, 'description'>, start: string, end: string) =>
  `${s.description}, ${periodLabel(start, end)}`;

export async function getSubscription(ctx: RequestContext, id: string) {
  assertCan(ctx, 'subscriptions.view');
  const s = await loadRow(ctx, id);
  const [client, pkg, periods, assets, quotation] = await ctx.db.batch([
    ctx.db.prepare('SELECT id, display_name, email, status FROM clients WHERE id = ?').bind(s.client_id),
    ctx.db.prepare('SELECT id, name FROM service_packages WHERE id = ?').bind(s.package_id ?? ''),
    ctx.db
      .prepare(
        `SELECT sp.period_start, sp.period_end, i.id AS invoice_id, i.number, i.status, i.total_minor, i.balance_minor
         FROM subscription_periods sp JOIN invoices i ON i.id = sp.invoice_id
         WHERE sp.subscription_id = ? ORDER BY sp.period_start DESC LIMIT 36`,
      )
      .bind(id),
    ctx.db
      .prepare('SELECT id, type, name, renewal_date, status FROM client_assets WHERE subscription_id = ? ORDER BY name')
      .bind(id),
    ctx.db.prepare('SELECT id, number FROM quotations WHERE id = ?').bind(s.source_quotation_id ?? ''),
  ]);
  const first = <T>(r: D1Result | undefined) => ((r?.results ?? [])[0] as T | undefined) ?? null;
  return {
    subscription: s,
    client: first<{ id: string; display_name: string; email: string | null; status: string }>(client)!,
    package: first<{ id: string; name: string }>(pkg),
    periods: (periods?.results ?? []) as {
      period_start: string;
      period_end: string;
      invoice_id: string;
      number: string | null;
      status: string;
      total_minor: number;
      balance_minor: number;
    }[],
    assets: (assets?.results ?? []) as {
      id: string;
      type: string;
      name: string;
      renewal_date: string | null;
      status: string;
    }[],
    quotation: first<{ id: string; number: string | null }>(quotation),
    nextInvoice: await preview(ctx, s),
  };
}

/** What a client has with us (portal "Your services" and the client page). Internal notes are never included. */
export async function clientServices(ctx: RequestContext, clientId: string) {
  const [subs, assets] = await ctx.db.batch([
    ctx.db
      .prepare(
        `SELECT id, description, quantity_milli, unit_price_minor, currency, interval, next_billing_date, status
         FROM subscriptions WHERE client_id = ? AND status IN ('active','at_risk','paused') ORDER BY next_billing_date`,
      )
      .bind(clientId),
    ctx.db
      .prepare(
        `SELECT id, type, name, provider, renewal_date, auto_renew, status FROM client_assets
         WHERE client_id = ? AND status = 'active' ORDER BY renewal_date IS NULL, renewal_date, name`,
      )
      .bind(clientId),
  ]);
  return {
    subscriptions: (
      (subs?.results ?? []) as {
        id: string;
        description: string;
        quantity_milli: number;
        unit_price_minor: number;
        currency: string;
        interval: 'month' | 'year';
        next_billing_date: string;
        status: string;
      }[]
    ).map((s) => ({
      id: s.id,
      description: s.description,
      quantity: formatQuantity(s.quantity_milli),
      amountMinor: mulDivHalfEven(s.unit_price_minor, s.quantity_milli, 1000),
      currency: s.currency,
      interval: s.interval,
      // A paused subscription has no upcoming bill to show.
      nextBillingDate: s.status === 'paused' ? null : s.next_billing_date,
      paused: s.status === 'paused',
    })),
    assets: (
      (assets?.results ?? []) as {
        id: string;
        type: string;
        name: string;
        provider: string | null;
        renewal_date: string | null;
        auto_renew: number;
      }[]
    ).map((a) => ({
      id: a.id,
      type: a.type,
      name: a.name,
      provider: a.provider,
      renewalDate: a.renewal_date,
      autoRenew: a.auto_renew === 1,
    })),
  };
}

// ---------------------------------------------------------------- writes

async function checkRefs(ctx: RequestContext, input: SubscriptionInput) {
  const [client, pkg, tax, currency] = await ctx.db.batch([
    ctx.db.prepare("SELECT id FROM clients WHERE id = ? AND status = 'active'").bind(input.clientId),
    ctx.db.prepare('SELECT id FROM service_packages WHERE id = ?').bind(input.packageId ?? ''),
    ctx.db.prepare('SELECT id FROM tax_rates WHERE id = ? AND active = 1').bind(input.taxRateId ?? ''),
    ctx.db.prepare('SELECT code FROM currencies WHERE code = ? AND active = 1').bind(input.currency),
  ]);
  const fields: Record<string, string[]> = {};
  if (!(client?.results ?? []).length) fields['clientId'] = ['Choose an active client.'];
  if (input.packageId && !(pkg?.results ?? []).length) fields['packageId'] = ['Choose a package.'];
  if (input.taxRateId && !(tax?.results ?? []).length) fields['taxRateId'] = ['Choose an active tax rate.'];
  if (!(currency?.results ?? []).length) fields['currency'] = ['Choose an active currency.'];
  if (Object.keys(fields).length) throw validationError(fields);
}

const snapshot = (
  s: Pick<
    SubscriptionRow,
    | 'description'
    | 'quantity_milli'
    | 'unit_price_minor'
    | 'currency'
    | 'interval'
    | 'next_billing_date'
    | 'auto_issue'
    | 'status'
  >,
) => ({
  description: s.description,
  quantityMilli: s.quantity_milli,
  unitPriceMinor: s.unit_price_minor,
  currency: s.currency,
  interval: s.interval,
  nextBillingDate: s.next_billing_date,
  autoIssue: s.auto_issue === 1,
  status: s.status,
});

export async function createSubscription(ctx: RequestContext, input: SubscriptionInput): Promise<{ id: string }> {
  assertCan(ctx, 'subscriptions.manage');
  await checkRefs(ctx, input);
  const id = newId('sub', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const qty = parseQuantityMilli(input.quantity);
  const next = input.nextBillingDate ?? input.startDate;
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO subscriptions (id, client_id, package_id, description, quantity_milli, unit_price_minor, currency, tax_rate_id,
           interval, start_date, next_billing_date, auto_issue, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        id,
        input.clientId,
        input.packageId,
        input.description,
        qty,
        input.unitPriceMinor,
        input.currency,
        input.taxRateId,
        input.interval,
        input.startDate,
        next,
        input.autoIssue ? 1 : 0,
        ctx.actor.userId,
        now,
        now,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'subscription.created',
        entityType: 'subscription',
        entityId: id,
        after: {
          clientId: input.clientId,
          description: input.description,
          quantityMilli: qty,
          unitPriceMinor: input.unitPriceMinor,
          currency: input.currency,
          interval: input.interval,
          nextBillingDate: next,
        },
      }),
    )
    .run();
  return { id };
}

async function lastBilledStart(ctx: RequestContext, id: string): Promise<string | null> {
  const r = await ctx.db
    .prepare('SELECT MAX(period_start) AS d FROM subscription_periods WHERE subscription_id = ?')
    .bind(id)
    .first<{ d: string | null }>();
  return r?.d ?? null;
}

/** Edits apply to periods not yet invoiced. Client, currency and interval are fixed once a period has been billed. */
export async function updateSubscription(ctx: RequestContext, id: string, input: SubscriptionInput): Promise<void> {
  assertCan(ctx, 'subscriptions.manage');
  const before = await loadRow(ctx, id);
  if (!['active', 'at_risk', 'paused'].includes(before.status))
    throw conflict('Cancelled or ended subscriptions cannot be edited.');
  await checkRefs(ctx, input);
  const billed = await lastBilledStart(ctx, id);
  const fields: Record<string, string[]> = {};
  if (billed) {
    if (input.clientId !== before.client_id) fields['clientId'] = ['The client cannot change once a period is billed.'];
    if (input.currency !== before.currency)
      fields['currency'] = ['The currency cannot change once a period is billed.'];
    if (input.interval !== before.interval)
      fields['interval'] = ['The interval cannot change once a period is billed.'];
    if (input.startDate !== before.start_date)
      fields['startDate'] = ['The start date cannot change once a period is billed.'];
  }
  const next = input.nextBillingDate ?? before.next_billing_date;
  if (billed && next <= billed) fields['nextBillingDate'] = ['Choose a date after the last billed period started.'];
  if (Object.keys(fields).length) throw validationError(fields);
  const qty = parseQuantityMilli(input.quantity);
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE subscriptions SET client_id = ?, package_id = ?, description = ?, quantity_milli = ?, unit_price_minor = ?, currency = ?,
           tax_rate_id = ?, interval = ?, start_date = ?, next_billing_date = ?, auto_issue = ?, updated_at = ?
         WHERE id = ? AND updated_at = ?`,
        input.clientId,
        input.packageId,
        input.description,
        qty,
        input.unitPriceMinor,
        input.currency,
        input.taxRateId,
        input.interval,
        input.startDate,
        next,
        input.autoIssue ? 1 : 0,
        now,
        id,
        before.updated_at,
      ),
      'update',
    )
    .add(
      auditStmt(ctx, {
        action: 'subscription.updated',
        entityType: 'subscription',
        entityId: id,
        before: snapshot(before),
        after: snapshot({
          description: input.description,
          quantity_milli: qty,
          unit_price_minor: input.unitPriceMinor,
          currency: input.currency,
          interval: input.interval,
          next_billing_date: next,
          auto_issue: input.autoIssue ? 1 : 0,
          status: before.status,
        }),
      }),
    )
    .run();
  if (res.changes('update') !== 1)
    throw conflict('This subscription changed while you were editing. Reload and try again.');
}

async function setStatus(
  ctx: RequestContext,
  id: string,
  from: SubscriptionStatus[],
  to: SubscriptionStatus,
  action: string,
  extra: { nextBillingDate?: string; cancelledAt?: string; reason?: string } = {},
) {
  assertCan(ctx, 'subscriptions.manage');
  const s = await loadRow(ctx, id);
  if (!from.includes(s.status)) throw conflict(`This subscription is ${s.status.replace('_', ' ')}.`);
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE subscriptions SET status = ?, next_billing_date = COALESCE(?, next_billing_date),
           cancelled_at = COALESCE(?, cancelled_at), cancel_reason = COALESCE(?, cancel_reason), updated_at = ?
         WHERE id = ? AND status = ?`,
        to,
        extra.nextBillingDate ?? null,
        extra.cancelledAt ?? null,
        extra.reason ?? null,
        now,
        id,
        s.status,
      ),
      'status',
    )
    .add(
      auditStmt(ctx, {
        action,
        entityType: 'subscription',
        entityId: id,
        before: { status: s.status, nextBillingDate: s.next_billing_date },
        after: { status: to, ...extra },
      }),
    )
    .run();
  if (res.changes('status') !== 1) throw conflict('This subscription changed. Reload and try again.');
}

/** Paused subscriptions are not billed. */
export const pauseSubscription = (ctx: RequestContext, id: string) =>
  setStatus(ctx, id, ['active', 'at_risk'], 'paused', 'subscription.paused');

/** Resuming never back-bills: billing continues from the first scheduled date on or after today. */
export async function resumeSubscription(ctx: RequestContext, id: string): Promise<void> {
  const s = await loadRow(ctx, id);
  const today = businessDate(ctx.now());
  let next = s.next_billing_date;
  while (next < today) next = nextAnchored(s.start_date, next, s.interval);
  await setStatus(ctx, id, ['paused'], 'active', 'subscription.resumed', { nextBillingDate: next });
}

export async function cancelSubscription(
  ctx: RequestContext,
  id: string,
  input: { reason: string; effectiveDate: string | null },
): Promise<void> {
  const date = input.effectiveDate ?? businessDate(ctx.now());
  await setStatus(ctx, id, ['active', 'at_risk', 'paused'], 'cancelled', 'subscription.cancelled', {
    cancelledAt: date,
    reason: input.reason,
  });
}

// ---------------------------------------------------------------- quotation acceptance

/**
 * Subscriptions for the recurring lines of an accepted quotation, for the acceptance batch. The quotation's own invoice
 * (convert to invoice) bills the first period, so billing starts one interval after acceptance. The guard makes the
 * insert happen only if the acceptance itself went through (same batch).
 */
export function subscriptionsFromQuotationStmt(
  ctx: RequestContext,
  quotationId: string,
  guard: { sql: string; params: unknown[] },
): D1PreparedStatement {
  const today = businessDate(ctx.now());
  const now = ctx.now().toISOString();
  return stmt(
    ctx.db,
    `INSERT INTO subscriptions (id, client_id, package_id, description, quantity_milli, unit_price_minor, currency, tax_rate_id,
       interval, start_date, next_billing_date, auto_issue, status, source_quotation_id, created_by, created_at, updated_at)
     SELECT ? || '_' || qi.position, q.client_id, qi.package_id,
       substr(CASE WHEN instr(qi.description, char(10)) > 0 THEN substr(qi.description, 1, instr(qi.description, char(10)) - 1)
         ELSE qi.description END, 1, 300),
       qi.quantity_milli, qi.unit_price_minor, q.currency, qi.tax_rate_id, qi.recurring_interval, ?,
       CASE qi.recurring_interval WHEN 'month' THEN ? ELSE ? END, 0, 'active', q.id, ?, ?, ?
     FROM quotation_items qi JOIN quotations q ON q.id = qi.quotation_id
     WHERE qi.quotation_id = ? AND qi.is_recurring = 1 AND qi.recurring_interval IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.source_quotation_id = q.id)
       AND ${guard.sql}`,
    newId('sub', ctx.now().getTime()),
    today,
    addMonths(today, 1),
    addMonths(today, 12),
    ctx.actor.userId,
    now,
    now,
    quotationId,
    ...guard.params,
  );
}

// ---------------------------------------------------------------- billing cron

export interface BillingResult {
  invoices: number;
  issued: number;
  skipped: number;
}

/**
 * Creates the invoices for every period that starts within the lead time (setting, default 7 days). Safe to run twice or
 * concurrently: the period row is unique and shares the invoice's batch.
 */
export async function billSubscriptions(ctx: RequestContext): Promise<BillingResult> {
  const settings = await getSettings(ctx);
  const today = businessDate(ctx.now());
  const horizon = addDays(today, settingNumber(settings, 'subscriptions.lead_days', 7));
  const { results } = await ctx.db
    .prepare(
      `SELECT s.*, c.email AS client_email FROM subscriptions s JOIN clients c ON c.id = s.client_id
       WHERE s.status IN ${BILLING} AND s.next_billing_date <= ? ORDER BY s.next_billing_date, s.id LIMIT 100`,
    )
    .bind(horizon)
    .all<SubscriptionRow & { client_email: string | null }>();
  const out: BillingResult = { invoices: 0, issued: 0, skipped: 0 };
  for (const sub of results) {
    let s = sub;
    // Catch up at most a year of missed periods per run (a stalled cron or a back-dated start).
    for (let i = 0; i < 12 && s.next_billing_date <= horizon; i++) {
      const start = s.next_billing_date;
      const end = periodEnd(start, s.interval, s.start_date);
      const next = nextAnchored(s.start_date, start, s.interval);
      let created: { id: string } | null = null;
      try {
        created = await billPeriod(ctx, s, start, end, next);
      } catch (err) {
        out.skipped++;
        ctx.logger.warn('subscription period not billed', { subscriptionId: s.id, periodStart: start, err });
        await notifyStaffWithPermission(ctx, 'subscriptions.manage', {
          type: 'subscription.alert',
          title: `Could not bill ${s.description} for ${periodLabel(start, end)}`,
          body: err instanceof Error ? err.message.slice(0, 200) : 'Check the client and subscription details.',
          link: `/admin/subscriptions/${s.id}`,
          entityType: 'subscription',
          entityId: s.id,
          dedupeKey: `subscription_bill_failed:${s.id}:${start}`,
          excludeActor: false,
        }).run();
        break;
      }
      if (!created) break; // another run billed this period first
      out.invoices++;
      if (s.auto_issue === 1) {
        try {
          await issueDraft(ctx, created.id, { send: !!sub.client_email });
          out.issued++;
        } catch (err) {
          // The draft stays for staff to review; nothing is lost.
          ctx.logger.warn('subscription invoice left as draft', { subscriptionId: s.id, invoiceId: created.id, err });
        }
      }
      s = { ...s, next_billing_date: next };
    }
  }
  return out;
}

async function billPeriod(
  ctx: RequestContext,
  s: SubscriptionRow,
  start: string,
  end: string,
  next: string,
): Promise<{ id: string } | null> {
  const pkg = s.package_id
    ? await ctx.db
        .prepare('SELECT service_id FROM service_packages WHERE id = ?')
        .bind(s.package_id)
        .first<{ service_id: string }>()
    : null;
  const draft = await draftInvoiceStatements(
    ctx,
    {
      clientId: s.client_id,
      contactId: null,
      currency: s.currency,
      issueDate: null,
      dueDate: null,
      paymentTermsDays: null,
      notes: null,
      terms: null,
      discountType: 'none',
      discountValue: 0,
      items: [
        {
          serviceId: pkg?.service_id ?? null,
          packageId: s.package_id,
          description: lineDescription(s, start, end),
          quantity: formatQuantity(s.quantity_milli),
          unitPriceMinor: s.unit_price_minor,
          taxRateId: s.tax_rate_id,
          isRecurring: false,
          recurringInterval: null,
          discountType: 'none',
          discountValue: 0,
        },
      ],
    },
    { subscriptionId: s.id, periods: [{ start, end }], auditAction: 'invoice.created_by_subscription' },
  );
  try {
    await new Batch(ctx.db)
      .addAll(draft.statements)
      .add(
        stmt(
          ctx.db,
          'INSERT INTO subscription_periods (id, subscription_id, period_start, period_end, invoice_id) VALUES (?, ?, ?, ?, ?)',
          newId('spd', ctx.now().getTime()),
          s.id,
          start,
          end,
          draft.id,
        ),
      )
      .add(
        stmt(
          ctx.db,
          'UPDATE subscriptions SET next_billing_date = ?, updated_at = ? WHERE id = ? AND next_billing_date = ?',
          next,
          ctx.now().toISOString(),
          s.id,
          start,
        ),
      )
      .run();
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed: subscription_periods/.test(err.message)) return null;
    throw err;
  }
  return { id: draft.id };
}

/**
 * Flags subscriptions with a subscription invoice more than N days overdue (setting, default 30) as "at risk" and tells
 * staff; clears the flag once nothing is that late any more. Services are never suspended automatically.
 */
export async function flagAtRisk(ctx: RequestContext): Promise<{ flagged: number; cleared: number }> {
  const settings = await getSettings(ctx);
  const cutoff = addDays(businessDate(ctx.now()), -settingNumber(settings, 'subscriptions.at_risk_days', 30));
  const late = `EXISTS (SELECT 1 FROM invoices i WHERE i.subscription_id = s.id AND i.status IN ('issued','partially_paid','overdue')
    AND i.balance_minor > 0 AND i.due_date < ?)`;
  const [toFlag, toClear] = await ctx.db.batch([
    ctx.db
      .prepare(
        `SELECT s.id, s.description, c.display_name FROM subscriptions s JOIN clients c ON c.id = s.client_id WHERE s.status = 'active' AND ${late}`,
      )
      .bind(cutoff),
    ctx.db.prepare(`SELECT s.id FROM subscriptions s WHERE s.status = 'at_risk' AND NOT ${late}`).bind(cutoff),
  ]);
  const flag = (toFlag?.results ?? []) as { id: string; description: string; display_name: string }[];
  const clear = (toClear?.results ?? []) as { id: string }[];
  if (!flag.length && !clear.length) return { flagged: 0, cleared: 0 };
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .addAll(
      flag.flatMap((s) => [
        stmt(
          ctx.db,
          "UPDATE subscriptions SET status = 'at_risk', updated_at = ? WHERE id = ? AND status = 'active'",
          now,
          s.id,
        ),
        auditStmt(ctx, {
          action: 'subscription.at_risk',
          entityType: 'subscription',
          entityId: s.id,
          after: { cutoff },
        }),
        notifyStaffWithPermission(ctx, 'subscriptions.view', {
          type: 'subscription.alert',
          title: `Subscription at risk: ${s.display_name}`,
          body: `${s.description}: an invoice is more than ${settingNumber(settings, 'subscriptions.at_risk_days', 30)} days overdue.`,
          link: `/admin/subscriptions/${s.id}`,
          entityType: 'subscription',
          entityId: s.id,
          dedupeKey: `subscription_at_risk:${s.id}:${businessDate(ctx.now()).slice(0, 7)}`,
          excludeActor: false,
        }),
      ]),
    )
    .addAll(
      clear.flatMap((s) => [
        stmt(
          ctx.db,
          "UPDATE subscriptions SET status = 'active', updated_at = ? WHERE id = ? AND status = 'at_risk'",
          now,
          s.id,
        ),
        auditStmt(ctx, { action: 'subscription.back_in_good_standing', entityType: 'subscription', entityId: s.id }),
      ]),
    )
    .run();
  return { flagged: flag.length, cleared: clear.length };
}

/** Choices for the subscription and register editors. */
export async function formOptions(ctx: RequestContext) {
  const [clients, packages, currencies, taxes, subs] = await ctx.db.batch([
    ctx.db.prepare(
      "SELECT id, display_name AS name, default_currency AS currency FROM clients WHERE status = 'active' ORDER BY display_name",
    ),
    ctx.db.prepare(
      `SELECT id, name, price_minor AS priceMinor, currency, interval FROM service_packages
       WHERE billing_type = 'recurring' AND status <> 'inactive' ORDER BY pricing_tab, sort_order`,
    ),
    ctx.db.prepare('SELECT code FROM currencies WHERE active = 1 ORDER BY is_default DESC, code'),
    ctx.db.prepare('SELECT id, name FROM tax_rates WHERE active = 1 ORDER BY name'),
    ctx.db.prepare(
      "SELECT id, client_id AS clientId, description FROM subscriptions WHERE status IN ('active','at_risk','paused') ORDER BY description",
    ),
  ]);
  return {
    clients: (clients?.results ?? []) as { id: string; name: string; currency: string }[],
    packages: (packages?.results ?? []) as {
      id: string;
      name: string;
      priceMinor: number | null;
      currency: string | null;
      interval: 'month' | 'year' | null;
    }[],
    currencies: ((currencies?.results ?? []) as { code: string }[]).map((c) => c.code),
    taxRates: (taxes?.results ?? []) as { id: string; name: string }[],
    subscriptions: (subs?.results ?? []) as { id: string; clientId: string; description: string }[],
  };
}
