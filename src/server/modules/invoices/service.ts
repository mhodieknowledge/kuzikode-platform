/**
 * Invoices (PRD §4.2 E, §8; docs/04 §11). Drafts are unnumbered and editable. Issuing assigns the gap-free number,
 * freezes client + business snapshots, opens the public link `/i/[token]` and queues the PDF and the email, all in
 * one batch. After issue the lines are immutable (DB triggers) and the status follows the money: payments and applied
 * credits reduce the balance; overpayment becomes client credit, never discarded. Void needs a reason and no money
 * applied; otherwise a credit note corrects the invoice (P4.10).
 *
 * Every money-changing write is guarded by the balance it was computed from (`WHERE balance_minor = ?`), so two
 * concurrent payments can't both apply to the same balance: the loser re-reads and recomputes.
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt, auditWhen } from '../../lib/audit';
import { sha256Hex } from '../../lib/crypto';
import { addDays, businessDate, businessYear } from '../../lib/dates';
import { conflict, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { priceLines, type PricedLine } from '../../lib/line-pricing';
import { assertCan } from '../../lib/policies';
import { documentLink, documentToken, looksLikeToken } from '../../lib/public-links';
import { numberSqlExpr, sequenceKey } from '../../lib/sequences';
import { dispatch, enqueue } from '../../jobs/outbox';
import { formatMoney } from '../../../shared/money';
import {
  canVoid,
  deriveStatus,
  OPEN_INVOICE_STATUSES,
  parseReminderSchedule,
  reminderKind,
  reminderOffsetFor,
  type InvoiceStatus,
} from '../../../shared/invoices';
import type { InvoiceInput, ManualPaymentInput } from '../../../shared/schemas/invoices';
import type { DiscountType } from '../../../shared/pricing';
import { getSettings, settingNumber, settingText } from '../cms';
import { notifyStaffWithPermission } from '../notifications';
import { snapshots, type BusinessSnapshot, type ClientSnapshot } from '../quotations/service';

export const PAGE_SIZE = 25;
const OPEN_SQL = `('issued','partially_paid','overdue')`;

export interface InvoiceRow {
  id: string;
  number: string | null;
  client_id: string;
  contact_id: string | null;
  project_id: string | null;
  subscription_id: string | null;
  source_quotation_id: string | null;
  currency: string;
  issue_date: string | null;
  due_date: string | null;
  payment_terms_days: number | null;
  notes: string | null;
  terms: string | null;
  discount_type: DiscountType;
  discount_value: number;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  amount_paid_minor: number;
  amount_credited_minor: number;
  balance_minor: number;
  status: InvoiceStatus;
  issued_at: string | null;
  issued_by: string | null;
  voided_at: string | null;
  void_reason: string | null;
  client_snapshot: string | null;
  business_snapshot: string | null;
  pdf_file_id: string | null;
  last_reminder_at: string | null;
  reminder_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItemRow {
  id: string;
  position: number;
  service_id: string | null;
  package_id: string | null;
  description: string;
  quantity_milli: number;
  unit_price_minor: number;
  discount_type: DiscountType;
  discount_value: number;
  tax_rate_id: string | null;
  tax_rate_bp: number;
  tax_inclusive: number;
  period_start: string | null;
  period_end: string | null;
  line_subtotal_minor: number;
  line_discount_minor: number;
  line_tax_minor: number;
  line_total_minor: number;
}

const ITEM_COLUMNS = `position, service_id, package_id, description, quantity_milli, unit_price_minor, discount_type, discount_value,
  tax_rate_id, tax_rate_bp, tax_inclusive, period_start, period_end, line_subtotal_minor, line_discount_minor, line_tax_minor, line_total_minor`;

export const publicLink = (ctx: RequestContext, id: string) => documentLink(ctx, 'invoice', id);

// ---------------------------------------------------------------- read

async function loadRow(ctx: RequestContext, id: string): Promise<InvoiceRow> {
  const r = await ctx.db.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first<InvoiceRow>();
  if (!r) throw notFound();
  return r;
}

async function loadItems(ctx: RequestContext, id: string): Promise<InvoiceItemRow[]> {
  const { results } = await ctx.db
    .prepare(`SELECT id, ${ITEM_COLUMNS} FROM invoice_items WHERE invoice_id = ? ORDER BY position`)
    .bind(id)
    .all<InvoiceItemRow>();
  return results;
}

export async function listInvoices(
  ctx: RequestContext,
  filter: { status?: string | undefined; clientId?: string | undefined; q?: string | undefined; page: number },
) {
  assertCan(ctx, 'invoices.view');
  const where: string[] = [];
  const params: unknown[] = [];
  if (!filter.status || filter.status === 'open')
    where.push(`i.status IN ('draft','issued','partially_paid','overdue')`);
  else if (filter.status !== 'all') {
    where.push('i.status = ?');
    params.push(filter.status);
  }
  if (filter.clientId) {
    where.push('i.client_id = ?');
    params.push(filter.clientId);
  }
  if (filter.q?.trim()) {
    const l = `%${filter.q
      .trim()
      .slice(0, 80)
      .replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push("(i.number LIKE ? ESCAPE '\\' OR c.display_name LIKE ? ESCAPE '\\')");
    params.push(l, l);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [count, rows, outstanding] = await ctx.db.batch([
    ctx.db.prepare(`SELECT COUNT(*) AS n FROM invoices i JOIN clients c ON c.id = i.client_id ${w}`).bind(...params),
    ctx.db
      .prepare(
        `SELECT i.id, i.number, i.status, i.currency, i.total_minor, i.balance_minor, i.issue_date, i.due_date, i.updated_at,
           c.id AS client_id, c.display_name AS client_name
         FROM invoices i JOIN clients c ON c.id = i.client_id ${w}
         ORDER BY CASE WHEN i.status = 'draft' THEN 0 ELSE 1 END, COALESCE(i.issued_at, i.created_at) DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, PAGE_SIZE, (filter.page - 1) * PAGE_SIZE),
    ctx.db.prepare(
      `SELECT currency, SUM(balance_minor) AS balance, SUM(CASE WHEN status = 'overdue' THEN balance_minor ELSE 0 END) AS overdue
       FROM invoices WHERE status IN ${OPEN_SQL} GROUP BY currency ORDER BY currency`,
    ),
  ]);
  const total = ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  return {
    total,
    page: filter.page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    outstanding: (outstanding?.results ?? []) as { currency: string; balance: number; overdue: number }[],
    items: (rows?.results ?? []) as {
      id: string;
      number: string | null;
      status: InvoiceStatus;
      currency: string;
      total_minor: number;
      balance_minor: number;
      issue_date: string | null;
      due_date: string | null;
      updated_at: string;
      client_id: string;
      client_name: string;
    }[],
  };
}

/** Client credit available in a currency (sum of the append-only credit ledger). */
export async function creditAvailable(ctx: RequestContext, clientId: string, currency: string): Promise<number> {
  const r = await ctx.db
    .prepare('SELECT COALESCE(SUM(amount_minor), 0) AS n FROM client_credits WHERE client_id = ? AND currency = ?')
    .bind(clientId, currency)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

export async function getInvoice(ctx: RequestContext, id: string) {
  assertCan(ctx, 'invoices.view');
  const inv = await loadRow(ctx, id);
  const [items, client, contact, history, payments, credits, reminders, quotation, creator, digits] =
    await ctx.db.batch([
      ctx.db.prepare(`SELECT id, ${ITEM_COLUMNS} FROM invoice_items WHERE invoice_id = ? ORDER BY position`).bind(id),
      ctx.db
        .prepare('SELECT id, client_number, display_name, email, status FROM clients WHERE id = ?')
        .bind(inv.client_id),
      // The chosen contact, or the client's main contact (who receives the invoice when none is chosen).
      ctx.db
        .prepare(
          'SELECT id, name, email FROM client_contacts WHERE client_id = ? AND (id = ? OR (? IS NULL AND is_primary = 1)) LIMIT 1',
        )
        .bind(inv.client_id, inv.contact_id ?? '', inv.contact_id),
      ctx.db
        .prepare(
          `SELECT h.from_status, h.to_status, h.reason, h.created_at, u.name AS actor FROM invoice_status_history h
           LEFT JOIN users u ON u.id = h.actor_id WHERE h.invoice_id = ? ORDER BY h.created_at, h.id`,
        )
        .bind(id),
      ctx.db
        .prepare(
          `SELECT p.id, p.receipt_number, p.method, p.provider_key, p.received_at, p.reference, p.amount_minor AS payment_minor,
             a.amount_minor AS applied_minor, p.status, p.receipt_file_id
           FROM payment_allocations a JOIN payments p ON p.id = a.payment_id WHERE a.invoice_id = ? ORDER BY p.received_at, p.id`,
        )
        .bind(id),
      ctx.db
        .prepare(
          `SELECT id, amount_minor, source_type, note, created_at FROM client_credits
           WHERE source_type = 'applied' AND source_id = ? ORDER BY created_at`,
        )
        .bind(id),
      ctx.db.prepare('SELECT kind, sent_at FROM invoice_reminders WHERE invoice_id = ? ORDER BY sent_at').bind(id),
      ctx.db.prepare('SELECT id, number FROM quotations WHERE id = ?').bind(inv.source_quotation_id ?? ''),
      ctx.db.prepare('SELECT name FROM users WHERE id = ?').bind(inv.created_by ?? ''),
      ctx.db.prepare('SELECT minor_digits FROM currencies WHERE code = ?').bind(inv.currency),
    ]);
  const first = <T>(r: D1Result | undefined) => ((r?.results ?? [])[0] ?? null) as T | null;
  return {
    invoice: inv,
    items: (items?.results ?? []) as InvoiceItemRow[],
    client: first<{ id: string; client_number: string; display_name: string; email: string | null; status: string }>(
      client,
    ),
    contact: first<{ id: string; name: string; email: string | null }>(contact),
    history: (history?.results ?? []) as {
      from_status: string | null;
      to_status: string;
      reason: string | null;
      created_at: string;
      actor: string | null;
    }[],
    payments: (payments?.results ?? []) as {
      id: string;
      receipt_number: string;
      method: string;
      provider_key: string;
      received_at: string;
      reference: string | null;
      payment_minor: number;
      applied_minor: number;
      status: string;
      receipt_file_id: string | null;
    }[],
    creditsApplied: (credits?.results ?? []) as { id: string; amount_minor: number; created_at: string }[],
    reminders: (reminders?.results ?? []) as { kind: string; sent_at: string }[],
    quotation: first<{ id: string; number: string | null }>(quotation),
    createdBy: first<{ name: string }>(creator)?.name ?? null,
    minorDigits: first<{ minor_digits: number }>(digits)?.minor_digits ?? 2,
    creditAvailable: inv.status === 'void' ? 0 : await creditAvailable(ctx, inv.client_id, inv.currency),
  };
}

// ---------------------------------------------------------------- drafts

function insertItemStmt(ctx: RequestContext, invoiceId: string, it: PricedLine) {
  return stmt(
    ctx.db,
    `INSERT INTO invoice_items (id, invoice_id, position, service_id, package_id, description, quantity_milli, unit_price_minor,
       discount_type, discount_value, tax_rate_id, tax_rate_bp, tax_inclusive, line_subtotal_minor, line_discount_minor,
       line_tax_minor, line_total_minor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    it.id,
    invoiceId,
    it.position,
    it.serviceId,
    it.packageId,
    it.description,
    it.quantityMilli,
    it.unitPriceMinor,
    it.discountType,
    it.discountValue,
    it.taxRateId,
    it.taxRateBp,
    it.taxInclusive ? 1 : 0,
    it.subtotal,
    it.discount,
    it.tax,
    it.total,
  );
}

export async function createInvoice(ctx: RequestContext, input: InvoiceInput): Promise<{ id: string }> {
  assertCan(ctx, 'invoices.create');
  const { items, totals } = await priceLines(ctx, input, 'iit');
  const settings = await getSettings(ctx);
  const client = await ctx.db
    .prepare('SELECT payment_terms_days FROM clients WHERE id = ?')
    .bind(input.clientId)
    .first<{ payment_terms_days: number | null }>();
  const id = newId('inv', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO invoices (id, client_id, contact_id, currency, issue_date, due_date, payment_terms_days, notes, terms,
           discount_type, discount_value, subtotal_minor, discount_minor, tax_minor, total_minor, balance_minor, status,
           created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
        id,
        input.clientId,
        input.contactId ?? null,
        input.currency,
        input.issueDate,
        input.dueDate,
        input.paymentTermsDays ??
          client?.payment_terms_days ??
          settingNumber(settings, 'invoice.default_terms_days', 14),
        input.notes,
        input.terms ?? settingText(settings, 'invoice.default_terms_text') ?? null,
        input.discountType,
        input.discountType === 'none' ? 0 : input.discountValue,
        totals.subtotalMinor,
        totals.discountMinor,
        totals.taxMinor,
        totals.totalMinor,
        totals.totalMinor,
        ctx.actor.userId,
        now,
        now,
      ),
    )
    .addAll(items.map((it) => insertItemStmt(ctx, id, it)))
    .add(historyStmt(ctx, id, null, 'draft', 'Created'))
    .add(
      auditStmt(ctx, {
        action: 'invoice.created',
        entityType: 'invoice',
        entityId: id,
        after: { clientId: input.clientId, totalMinor: totals.totalMinor, currency: input.currency },
      }),
    )
    .run();
  return { id };
}

export async function updateInvoice(ctx: RequestContext, id: string, input: InvoiceInput): Promise<void> {
  assertCan(ctx, 'invoices.update');
  const inv = await loadRow(ctx, id);
  if (inv.status !== 'draft') throw conflict('Issued invoices cannot be edited. Use a credit note to correct one.');
  const { items, totals } = await priceLines(ctx, input, 'iit');
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE invoices SET client_id = ?, contact_id = ?, currency = ?, issue_date = ?, due_date = ?, payment_terms_days = ?,
           notes = ?, terms = ?, discount_type = ?, discount_value = ?, subtotal_minor = ?, discount_minor = ?, tax_minor = ?,
           total_minor = ?, balance_minor = ?, updated_at = ?
         WHERE id = ? AND status = 'draft' AND updated_at = ?`,
        input.clientId,
        input.contactId ?? null,
        input.currency,
        input.issueDate,
        input.dueDate,
        input.paymentTermsDays ?? inv.payment_terms_days,
        input.notes,
        input.terms,
        input.discountType,
        input.discountType === 'none' ? 0 : input.discountValue,
        totals.subtotalMinor,
        totals.discountMinor,
        totals.taxMinor,
        totals.totalMinor,
        totals.totalMinor,
        now,
        id,
        inv.updated_at,
      ),
      'update',
    )
    // Lines are replaced only when the guarded update above went through (same batch, so all or nothing).
    .add(
      stmt(
        ctx.db,
        "DELETE FROM invoice_items WHERE invoice_id = ? AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND status = 'draft' AND updated_at = ?)",
        id,
        id,
        now,
      ),
    )
    .addAll(
      items.map((it) =>
        stmt(
          ctx.db,
          `INSERT INTO invoice_items (id, invoice_id, ${ITEM_COLUMNS.replace('period_start, period_end, ', '')})
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE EXISTS (SELECT 1 FROM invoices WHERE id = ? AND status = 'draft' AND updated_at = ?)`,
          it.id,
          id,
          it.position,
          it.serviceId,
          it.packageId,
          it.description,
          it.quantityMilli,
          it.unitPriceMinor,
          it.discountType,
          it.discountValue,
          it.taxRateId,
          it.taxRateBp,
          it.taxInclusive ? 1 : 0,
          it.subtotal,
          it.discount,
          it.tax,
          it.total,
          id,
          now,
        ),
      ),
    )
    .add(
      auditWhen(
        ctx,
        { action: 'invoice.updated', entityType: 'invoice', entityId: id, after: { totalMinor: totals.totalMinor } },
        'EXISTS (SELECT 1 FROM invoices WHERE id = ? AND updated_at = ?)',
        id,
        now,
      ),
    )
    .run();
  if (res.changes('update') !== 1) throw conflict('This invoice changed while you were editing. Reload and try again.');
}

/** Unnumbered drafts can be deleted outright (the DB refuses deleting anything issued). */
export async function deleteDraft(ctx: RequestContext, id: string): Promise<void> {
  assertCan(ctx, 'invoices.update');
  const inv = await loadRow(ctx, id);
  if (inv.status !== 'draft' || inv.number) throw conflict('Only unissued drafts can be deleted.');
  const res = await new Batch(ctx.db)
    .add(stmt(ctx.db, 'DELETE FROM invoice_items WHERE invoice_id = ?', id))
    .add(stmt(ctx.db, 'DELETE FROM invoice_status_history WHERE invoice_id = ?', id))
    .add(stmt(ctx.db, "DELETE FROM invoices WHERE id = ? AND status = 'draft' AND number IS NULL", id), 'delete')
    .add(
      auditStmt(ctx, {
        action: 'invoice.draft_deleted',
        entityType: 'invoice',
        entityId: id,
        before: { totalMinor: inv.total_minor, clientId: inv.client_id },
      }),
    )
    .run();
  if (res.changes('delete') !== 1) throw conflict('This invoice can no longer be deleted.');
}

// ---------------------------------------------------------------- issue & send

function historyStmt(
  ctx: RequestContext,
  invoiceId: string,
  from: InvoiceStatus | null,
  to: InvoiceStatus,
  reason: string | null,
  when?: { sql: string; params: unknown[] },
) {
  const id = newId('ish', ctx.now().getTime());
  return stmt(
    ctx.db,
    `INSERT INTO invoice_status_history (id, invoice_id, from_status, to_status, reason, actor_id, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ? ${when ? `WHERE ${when.sql}` : ''}`,
    id,
    invoiceId,
    from,
    to,
    reason,
    ctx.actor.userId,
    ctx.now().toISOString(),
    ...(when?.params ?? []),
  );
}

function recipient(client: ClientSnapshot): { to: string | null; name: string } {
  return { to: client.contact?.email ?? client.email, name: client.contact?.name ?? client.name };
}

/**
 * Issues a draft: number (gap-free; the sequence only moves when this batch issues the invoice), dates, snapshots,
 * public token, status history, audit, PDF job and (optionally) the email, atomically.
 */
export async function issueInvoice(
  ctx: RequestContext,
  id: string,
  opts: { send: boolean; message?: string | null } = { send: true },
): Promise<{ number: string; link: string; status: InvoiceStatus }> {
  assertCan(ctx, 'invoices.issue');
  if (opts.send) assertCan(ctx, 'invoices.send');
  const inv = await loadRow(ctx, id);
  if (inv.status !== 'draft') throw conflict('This invoice has already been issued.');
  const items = await loadItems(ctx, id);
  if (!items.length) throw validationError({ items: ['Add at least one line.'] });
  const snap = await snapshots(ctx, inv);
  const { to, name } = recipient(snap.client);
  if (opts.send && !to)
    throw validationError({ contactId: ['Add an email address to the client or choose a contact with one.'] });
  const today = businessDate(ctx.now());
  const issueDate = inv.issue_date ?? today;
  const dueDate =
    inv.due_date ??
    addDays(issueDate, inv.payment_terms_days ?? settingNumber(snap.settings, 'invoice.default_terms_days', 14));
  if (dueDate < issueDate) throw validationError({ dueDate: ['The due date is before the issue date.'] });
  const status = deriveStatus({ totalMinor: inv.total_minor, paidMinor: 0, creditedMinor: 0, dueDate }, today);
  const { token, hash } = await documentToken(ctx, 'invoice', id);
  const link = `${ctx.config.siteOrigin}/i/${token}`;
  const now = ctx.now().toISOString();
  const format = settingText(snap.settings, 'numbering.invoice') ?? 'INV-{YYYY}-{SEQ:5}';
  const year = businessYear(ctx.now());
  const key = sequenceKey('invoice', format, year);
  const number = numberSqlExpr(key, format, year);
  const issued = { sql: 'EXISTS (SELECT 1 FROM invoices WHERE id = ? AND issued_at = ?)', params: [id, now] };

  const jobs = [
    enqueue(ctx, { type: 'pdf.generate', payload: { kind: 'invoice', id }, idempotencyKey: `pdf:invoice:${id}` }),
    ...(opts.send && to
      ? [
          enqueue(ctx, {
            type: 'email.send',
            payload: {
              template: 'invoice_issued',
              to,
              data: { invoiceId: id, name, link, message: opts.message ?? null },
            },
            idempotencyKey: `email:invoice_issued:${id}`,
          }),
        ]
      : []),
  ];
  const res = await new Batch(ctx.db)
    .add(stmt(ctx.db, 'INSERT OR IGNORE INTO sequences (key, next_value) VALUES (?, 1)', key))
    .add(
      stmt(
        ctx.db,
        `UPDATE sequences SET next_value = next_value + 1
         WHERE key = ? AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND status = 'draft' AND updated_at = ?)`,
        key,
        id,
        inv.updated_at,
      ),
    )
    .add(
      stmt(
        ctx.db,
        `UPDATE invoices SET number = ${number.sql}, status = ?, issue_date = ?, due_date = ?, issued_at = ?, issued_by = ?,
           public_token_hash = ?, client_snapshot = ?, business_snapshot = ?, balance_minor = total_minor, updated_at = ?
         WHERE id = ? AND status = 'draft' AND updated_at = ?`,
        ...number.params,
        status,
        issueDate,
        dueDate,
        now,
        ctx.actor.userId,
        hash,
        JSON.stringify(snap.client),
        JSON.stringify(snap.business),
        now,
        id,
        inv.updated_at,
      ),
      'issue',
    )
    .add(historyStmt(ctx, id, 'draft', status, opts.send ? 'Issued and emailed' : 'Issued', issued))
    .addAll(jobs.map((j) => j.stmt))
    .add(
      stmt(
        ctx.db,
        `DELETE FROM outbox WHERE id IN (SELECT value FROM json_each(?)) AND NOT ${issued.sql}`,
        JSON.stringify(jobs.map((j) => j.id)),
        ...issued.params,
      ),
    )
    .add(
      auditWhen(
        ctx,
        {
          action: 'invoice.issued',
          entityType: 'invoice',
          entityId: id,
          after: { totalMinor: inv.total_minor, currency: inv.currency, dueDate, emailedTo: opts.send ? to : null },
        },
        issued.sql,
        ...issued.params,
      ),
    )
    .run();
  if (res.changes('issue') !== 1) throw conflict('This invoice changed while issuing. Reload and try again.');
  const after = await loadRow(ctx, id);
  await notifyStaffWithPermission(ctx, 'invoices.view', {
    type: 'invoice.issued',
    title: `${after.number} issued to ${snap.client.name}`,
    link: `/admin/invoices/${id}`,
    entityType: 'invoice',
    entityId: id,
    dedupeKey: `invoice_issued:${id}`,
  }).run();
  dispatch(
    ctx,
    jobs.map((j) => j.id),
  );
  return { number: after.number!, link, status: after.status };
}

/** Emails an issued invoice again (each resend is its own email job). */
export async function sendInvoice(
  ctx: RequestContext,
  id: string,
  opts: { message?: string | null } = {},
): Promise<{ to: string }> {
  assertCan(ctx, 'invoices.send');
  const inv = await loadRow(ctx, id);
  if (inv.status === 'draft' || inv.status === 'void') throw conflict('Only issued invoices can be sent.');
  const client = JSON.parse(inv.client_snapshot ?? '{}') as ClientSnapshot;
  const { to, name } = recipient(client);
  if (!to) throw validationError({ contactId: ['The invoice has no email address to send to.'] });
  const now = ctx.now().toISOString();
  const job = enqueue(ctx, {
    type: 'email.send',
    payload: {
      template: 'invoice_issued',
      to,
      data: { invoiceId: id, name, link: await publicLink(ctx, id), message: opts.message ?? null },
    },
    idempotencyKey: `email:invoice_issued:${id}:${now}`,
  });
  await new Batch(ctx.db)
    .add(job.stmt)
    .add(auditStmt(ctx, { action: 'invoice.resent', entityType: 'invoice', entityId: id, after: { to } }))
    .run();
  dispatch(ctx, [job.id]);
  return { to };
}

// ---------------------------------------------------------------- payments & credit

/** Optimistic retries when another write moved the balance first (each retry re-reads and recomputes). */
const MAX_RETRIES = 6;

/**
 * Records a manual payment (bank transfer, cash, manual EcoCash…). The amount up to the balance is allocated to the
 * invoice; any excess becomes client credit in the same batch. Receipt number, payment, allocation, invoice update,
 * credit, history, audit and the receipt PDF + email jobs commit together, guarded by the balance read.
 */
export async function recordManualPayment(
  ctx: RequestContext,
  id: string,
  input: ManualPaymentInput,
): Promise<{
  paymentId: string;
  receiptNumber: string;
  appliedMinor: number;
  creditMinor: number;
  status: InvoiceStatus;
}> {
  assertCan(ctx, 'payments.record_manual');
  const today = businessDate(ctx.now());
  if (input.receivedOn > today) throw validationError({ receivedOn: ['The payment date is in the future.'] });
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const inv = await loadRow(ctx, id);
    if (!OPEN_INVOICE_STATUSES.includes(inv.status) || inv.balance_minor <= 0)
      throw conflict('This invoice has no balance to pay.');
    const applied = Math.min(input.amountMinor, inv.balance_minor);
    const credit = input.amountMinor - applied;
    const paid = inv.amount_paid_minor + applied;
    const status = deriveStatus(
      { totalMinor: inv.total_minor, paidMinor: paid, creditedMinor: inv.amount_credited_minor, dueDate: inv.due_date },
      today,
    );
    const settings = await getSettings(ctx);
    const format = settingText(settings, 'numbering.receipt') ?? 'RCT-{YYYY}-{SEQ:5}';
    const year = businessYear(ctx.now());
    const key = sequenceKey('receipt', format, year);
    const number = numberSqlExpr(key, format, year);
    const paymentId = newId('pay', ctx.now().getTime());
    const now = ctx.now().toISOString();
    const receivedAt = input.receivedOn === today ? now : `${input.receivedOn}T10:00:00.000Z`;
    const guard = {
      sql: `EXISTS (SELECT 1 FROM invoices WHERE id = ? AND balance_minor = ? AND status IN ${OPEN_SQL})`,
      params: [id, inv.balance_minor],
    };
    const made = { sql: 'EXISTS (SELECT 1 FROM payments WHERE id = ?)', params: [paymentId] };
    const client = JSON.parse(inv.client_snapshot ?? '{}') as ClientSnapshot;
    const { to, name } = recipient(client);
    const jobs = [
      enqueue(ctx, {
        type: 'pdf.generate',
        payload: { kind: 'receipt', id: paymentId },
        idempotencyKey: `pdf:receipt:${paymentId}`,
      }),
      ...(to
        ? [
            enqueue(ctx, {
              type: 'email.send',
              payload: {
                template: 'payment_receipt',
                to,
                data: { paymentId, name, link: await publicLink(ctx, id) },
              },
              idempotencyKey: `email:payment_receipt:${paymentId}`,
            }),
          ]
        : []),
    ];
    const res = await new Batch(ctx.db)
      .add(stmt(ctx.db, 'INSERT OR IGNORE INTO sequences (key, next_value) VALUES (?, 1)', key))
      .add(
        stmt(
          ctx.db,
          `UPDATE sequences SET next_value = next_value + 1 WHERE key = ? AND ${guard.sql}`,
          key,
          ...guard.params,
        ),
      )
      .add(
        stmt(
          ctx.db,
          `INSERT INTO payments (id, receipt_number, client_id, provider_key, account_id, method, amount_minor, currency,
             received_at, status, recorded_by, reference, notes, created_at, updated_at)
           SELECT ?, ${number.sql}, ?, 'manual', NULL, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ? WHERE ${guard.sql}`,
          paymentId,
          ...number.params,
          inv.client_id,
          input.method,
          input.amountMinor,
          inv.currency,
          receivedAt,
          ctx.actor.userId,
          input.reference,
          input.notes,
          now,
          now,
          ...guard.params,
        ),
        'payment',
      )
      .add(
        stmt(
          ctx.db,
          `INSERT INTO payment_allocations (id, payment_id, invoice_id, amount_minor, currency, created_at)
           SELECT ?, ?, ?, ?, ?, ? WHERE ${made.sql}`,
          newId('pal', ctx.now().getTime()),
          paymentId,
          id,
          applied,
          inv.currency,
          now,
          ...made.params,
        ),
      )
      .add(
        stmt(
          ctx.db,
          `UPDATE invoices SET amount_paid_minor = amount_paid_minor + ?, balance_minor = balance_minor - ?, status = ?, updated_at = ?
           WHERE id = ? AND balance_minor = ? AND status IN ${OPEN_SQL} AND ${made.sql}`,
          applied,
          applied,
          status,
          now,
          id,
          inv.balance_minor,
          ...made.params,
        ),
        'invoice',
      )
      .addAll(
        credit > 0
          ? [
              stmt(
                ctx.db,
                `INSERT INTO client_credits (id, client_id, currency, amount_minor, source_type, source_id, note, created_by, created_at)
                 SELECT ?, ?, ?, ?, 'overpayment', ?, ?, ?, ? WHERE ${made.sql}`,
                newId('ccr', ctx.now().getTime()),
                inv.client_id,
                inv.currency,
                credit,
                paymentId,
                `Overpayment on ${inv.number}`,
                ctx.actor.userId,
                now,
                ...made.params,
              ),
            ]
          : [],
      )
      .addAll(
        status !== inv.status
          ? [historyStmt(ctx, id, inv.status, status, `Payment ${formatMoney(applied, inv.currency)}`, made)]
          : [],
      )
      .addAll(jobs.map((j) => j.stmt))
      .add(
        stmt(
          ctx.db,
          `DELETE FROM outbox WHERE id IN (SELECT value FROM json_each(?)) AND NOT ${made.sql}`,
          JSON.stringify(jobs.map((j) => j.id)),
          ...made.params,
        ),
      )
      .add(
        auditWhen(
          ctx,
          {
            action: 'payment.recorded_manual',
            entityType: 'invoice',
            entityId: id,
            after: {
              paymentId,
              amountMinor: input.amountMinor,
              appliedMinor: applied,
              creditMinor: credit,
              method: input.method,
              reference: input.reference,
            },
          },
          made.sql,
          ...made.params,
        ),
      )
      .run();
    if (res.changes('payment') !== 1) continue; // balance moved under us: re-read and recompute
    if (res.changes('invoice') !== 1) throw new Error('payment recorded without invoice update');
    const p = await ctx.db
      .prepare('SELECT receipt_number FROM payments WHERE id = ?')
      .bind(paymentId)
      .first<{ receipt_number: string }>();
    await notifyStaffWithPermission(ctx, 'payments.view', {
      type: 'payment.received',
      title: `${formatMoney(input.amountMinor, inv.currency)} received for ${inv.number}`,
      link: `/admin/invoices/${id}`,
      entityType: 'invoice',
      entityId: id,
      dedupeKey: `payment_received:${paymentId}`,
    }).run();
    dispatch(
      ctx,
      jobs.map((j) => j.id),
    );
    return { paymentId, receiptNumber: p!.receipt_number, appliedMinor: applied, creditMinor: credit, status };
  }
  throw conflict('The invoice balance kept changing. Reload and try again.');
}

/** Applies the client's available credit (same currency) to the invoice, up to its balance. */
export async function applyCredit(
  ctx: RequestContext,
  id: string,
  amountMinor: number,
): Promise<{ appliedMinor: number; status: InvoiceStatus }> {
  assertCan(ctx, 'payments.record_manual');
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const inv = await loadRow(ctx, id);
    if (!OPEN_INVOICE_STATUSES.includes(inv.status) || inv.balance_minor <= 0)
      throw conflict('This invoice has no balance to pay.');
    const available = await creditAvailable(ctx, inv.client_id, inv.currency);
    if (amountMinor > available)
      throw validationError({ amountMinor: [`Only ${formatMoney(available, inv.currency)} credit is available.`] });
    if (amountMinor > inv.balance_minor)
      throw validationError({ amountMinor: ['That is more than the invoice balance.'] });
    const today = businessDate(ctx.now());
    const status = deriveStatus(
      {
        totalMinor: inv.total_minor,
        paidMinor: inv.amount_paid_minor,
        creditedMinor: inv.amount_credited_minor + amountMinor,
        dueDate: inv.due_date,
      },
      today,
    );
    const creditId = newId('ccr', ctx.now().getTime());
    const now = ctx.now().toISOString();
    const made = { sql: 'EXISTS (SELECT 1 FROM client_credits WHERE id = ?)', params: [creditId] };
    const res = await new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          `INSERT INTO client_credits (id, client_id, currency, amount_minor, source_type, source_id, note, created_by, created_at)
           SELECT ?, ?, ?, ?, 'applied', ?, ?, ?, ?
           WHERE (SELECT COALESCE(SUM(amount_minor), 0) FROM client_credits WHERE client_id = ? AND currency = ?) >= ?
             AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND balance_minor = ? AND status IN ${OPEN_SQL})`,
          creditId,
          inv.client_id,
          inv.currency,
          -amountMinor,
          id,
          `Applied to ${inv.number}`,
          ctx.actor.userId,
          now,
          inv.client_id,
          inv.currency,
          amountMinor,
          id,
          inv.balance_minor,
        ),
        'credit',
      )
      .add(
        stmt(
          ctx.db,
          `UPDATE invoices SET amount_credited_minor = amount_credited_minor + ?, balance_minor = balance_minor - ?, status = ?,
             updated_at = ? WHERE id = ? AND balance_minor = ? AND ${made.sql}`,
          amountMinor,
          amountMinor,
          status,
          now,
          id,
          inv.balance_minor,
          ...made.params,
        ),
        'invoice',
      )
      .addAll(
        status !== inv.status
          ? [historyStmt(ctx, id, inv.status, status, `Credit ${formatMoney(amountMinor, inv.currency)} applied`, made)]
          : [],
      )
      .add(
        auditWhen(
          ctx,
          { action: 'invoice.credit_applied', entityType: 'invoice', entityId: id, after: { amountMinor, creditId } },
          made.sql,
          ...made.params,
        ),
      )
      .run();
    if (res.changes('credit') === 1) return { appliedMinor: amountMinor, status };
  }
  throw conflict('The balance or credit changed. Reload and try again.');
}

// ---------------------------------------------------------------- void

export async function voidInvoice(ctx: RequestContext, id: string, reason: string): Promise<void> {
  assertCan(ctx, 'invoices.void');
  const inv = await loadRow(ctx, id);
  if (!canVoid(inv.status, inv.amount_paid_minor, inv.amount_credited_minor))
    throw conflict(
      inv.status === 'draft'
        ? 'Delete a draft instead of voiding it.'
        : 'This invoice has payments or credits applied. Issue a credit note instead.',
    );
  const now = ctx.now().toISOString();
  const done = {
    sql: "EXISTS (SELECT 1 FROM invoices WHERE id = ? AND status = 'void' AND voided_at = ?)",
    params: [id, now],
  };
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE invoices SET status = 'void', voided_at = ?, voided_by = ?, void_reason = ?, updated_at = ?
         WHERE id = ? AND status IN ('issued','overdue') AND amount_paid_minor = 0 AND amount_credited_minor = 0`,
        now,
        ctx.actor.userId,
        reason,
        now,
        id,
      ),
      'void',
    )
    .add(historyStmt(ctx, id, inv.status, 'void', reason, done))
    .add(
      auditWhen(
        ctx,
        {
          action: 'invoice.voided',
          entityType: 'invoice',
          entityId: id,
          before: { status: inv.status },
          after: { reason },
        },
        done.sql,
        ...done.params,
      ),
    )
    .run();
  if (res.changes('void') !== 1) throw conflict('This invoice changed. Reload and try again.');
}

// ---------------------------------------------------------------- public link

export interface PublicInvoice {
  invoice: InvoiceRow;
  items: InvoiceItemRow[];
  client: ClientSnapshot;
  business: BusinessSnapshot;
  payments: { receipt_number: string; received_at: string; applied_minor: number }[];
  minorDigits: number;
}

/** Issued invoice by public token (drafts are never public; void ones stay viewable, marked void). */
export async function getPublicInvoice(ctx: RequestContext, token: string): Promise<PublicInvoice | null> {
  if (!looksLikeToken(token)) return null;
  const inv = await ctx.db
    .prepare("SELECT * FROM invoices WHERE public_token_hash = ? AND status <> 'draft'")
    .bind(await sha256Hex(token))
    .first<InvoiceRow>();
  if (!inv) return null;
  const [payments, digits] = await ctx.db.batch([
    ctx.db
      .prepare(
        `SELECT p.receipt_number, p.received_at, a.amount_minor AS applied_minor FROM payment_allocations a
         JOIN payments p ON p.id = a.payment_id WHERE a.invoice_id = ? ORDER BY p.received_at`,
      )
      .bind(inv.id),
    ctx.db.prepare('SELECT minor_digits FROM currencies WHERE code = ?').bind(inv.currency),
  ]);
  return {
    invoice: inv,
    items: await loadItems(ctx, inv.id),
    client: JSON.parse(inv.client_snapshot ?? '{}') as ClientSnapshot,
    business: JSON.parse(inv.business_snapshot ?? '{}') as BusinessSnapshot,
    payments: (payments?.results ?? []) as PublicInvoice['payments'],
    minorDigits: ((digits?.results ?? [])[0] as { minor_digits: number } | undefined)?.minor_digits ?? 2,
  };
}

export async function invoiceIdForToken(ctx: RequestContext, token: string): Promise<string | null> {
  if (!looksLikeToken(token)) return null;
  const r = await ctx.db
    .prepare("SELECT id FROM invoices WHERE public_token_hash = ? AND status <> 'draft'")
    .bind(await sha256Hex(token))
    .first<{ id: string }>();
  return r?.id ?? null;
}

// ---------------------------------------------------------------- cron

/**
 * Issued or partially paid invoices past their due date with a balance become overdue: history rows and the status
 * change in one batch (same condition), then one staff notification per invoice (deduplicated).
 */
export async function markOverdue(ctx: RequestContext): Promise<number> {
  const today = businessDate(ctx.now());
  const now = ctx.now().toISOString();
  const cond = `status IN ('issued','partially_paid') AND balance_minor > 0 AND due_date IS NOT NULL AND due_date < ?`;
  const [, updated] = await ctx.db.batch([
    ctx.db
      .prepare(
        `INSERT INTO invoice_status_history (id, invoice_id, from_status, to_status, reason, actor_id, created_at)
         SELECT 'ish_od_' || id || '_' || ?, id, status, 'overdue', 'Past due date', NULL, ? FROM invoices WHERE ${cond}`,
      )
      .bind(today, now, today),
    ctx.db
      .prepare(`UPDATE invoices SET status = 'overdue', updated_at = ? WHERE ${cond} RETURNING id, number, client_id`)
      .bind(now, today),
  ]);
  const rows = (updated?.results ?? []) as { id: string; number: string; client_id: string }[];
  if (rows.length) {
    await ctx.db.batch(
      rows.map((r) =>
        notifyStaffWithPermission(ctx, 'invoices.view', {
          type: 'invoice.overdue',
          title: `${r.number} is overdue`,
          link: `/admin/invoices/${r.id}`,
          entityType: 'invoice',
          entityId: r.id,
          dedupeKey: `invoice_overdue:${r.id}`,
        }),
      ),
    );
  }
  return rows.length;
}

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * Daily payment reminders per the `invoice.reminder_schedule` setting (days relative to the due date). Each
 * invoice gets each reminder at most once (`UNIQUE(invoice_id, kind)`), only the latest one reached is sent, and the
 * email job exists only if the reminder row was created in the same batch, so running twice sends nothing twice.
 */
export async function sendReminders(ctx: RequestContext): Promise<number> {
  const settings = await getSettings(ctx);
  const schedule = parseReminderSchedule(settings['invoice.reminder_schedule']);
  const today = businessDate(ctx.now());
  const horizon = addDays(today, -schedule[0]!); // earliest due date a "before" reminder can apply to
  const { results } = await ctx.db
    .prepare(
      `SELECT id, number, due_date, client_snapshot FROM invoices
       WHERE status IN ${OPEN_SQL} AND balance_minor > 0 AND due_date IS NOT NULL AND due_date <= ?
       ORDER BY due_date LIMIT 200`,
    )
    .bind(schedule[0]! < 0 ? horizon : today)
    .all<{ id: string; number: string; due_date: string; client_snapshot: string | null }>();
  const now = ctx.now().toISOString();
  const queued: string[] = [];
  for (const inv of results) {
    const offset = reminderOffsetFor(schedule, daysBetween(inv.due_date, today));
    if (offset === null) continue;
    const kind = reminderKind(offset);
    const { to, name } = recipient(JSON.parse(inv.client_snapshot ?? '{}') as ClientSnapshot);
    if (!to) continue;
    const reminderId = newId('irm', ctx.now().getTime());
    const job = enqueue(ctx, {
      type: 'email.send',
      payload: {
        template: 'invoice_reminder',
        to,
        data: { invoiceId: inv.id, name, link: await publicLink(ctx, inv.id) },
      },
      idempotencyKey: `email:invoice_reminder:${inv.id}:${kind}`,
    });
    // The job row goes first: the reminder row references it.
    const res = await new Batch(ctx.db)
      .add(job.stmt)
      .add(
        stmt(
          ctx.db,
          'INSERT OR IGNORE INTO invoice_reminders (id, invoice_id, kind, sent_at, outbox_id) VALUES (?, ?, ?, ?, ?)',
          reminderId,
          inv.id,
          kind,
          now,
          job.id,
        ),
        'reminder',
      )
      .add(
        stmt(
          ctx.db,
          'DELETE FROM outbox WHERE id = ? AND NOT EXISTS (SELECT 1 FROM invoice_reminders WHERE id = ?)',
          job.id,
          reminderId,
        ),
      )
      .add(
        stmt(
          ctx.db,
          `UPDATE invoices SET last_reminder_at = ?, reminder_count = reminder_count + 1
           WHERE id = ? AND EXISTS (SELECT 1 FROM invoice_reminders WHERE id = ?)`,
          now,
          inv.id,
          reminderId,
        ),
      )
      .run();
    if (res.changes('reminder') === 1) queued.push(job.id);
  }
  dispatch(ctx, queued);
  return queued.length;
}
