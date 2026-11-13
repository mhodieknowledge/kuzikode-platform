/**
 * Quotations (P4.7, PRD §4.2 D). Drafts are freely editable and unnumbered; sending assigns the gap-free number,
 * freezes the client and business snapshots and opens the public link `/q/[token]`. A sent quotation is read-only:
 * changes are made by revising it (new version, the previous one kept read-only and marked superseded).
 * Every line amount is computed by the shared pricing engine and stored rounded, so totals are sums of lines.
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt, auditWhen } from '../../lib/audit';
import { sha256Hex } from '../../lib/crypto';
import { documentLink, documentToken } from '../../lib/public-links';
import { addDays, businessDate, businessYear } from '../../lib/dates';
import { conflict, notFound, validationError } from '../../lib/errors';
import { sanitizeHtml } from '../../lib/html-sanitize';
import { newId } from '../../lib/ids';
import { assertCan, clientScope, portalAreaClientIds } from '../../lib/policies';
import { type DiscountType } from '../../lib/pricing';
import { priceLines, type PricedLine } from '../../lib/line-pricing';
import { numberSqlExpr, sequenceKey, sequenceStatements } from '../../lib/sequences';
import { dispatch, enqueue } from '../../jobs/outbox';
import { canTransition, OPEN_FOR_RESPONSE, REVISABLE, type QuotationStatus } from '../../../shared/quotations';
import type { QuotationInput } from '../../../shared/schemas/quotations';
import type { Permission } from '../../../shared/permissions';
import { getSettings, settingNumber, settingText } from '../cms';
import { subscriptionsFromQuotationStmt } from '../subscriptions/service';
import { notifyStaffWithPermission, notifyUser } from '../notifications';

export const PAGE_SIZE = 25;

export interface QuotationRow {
  id: string;
  number: string | null;
  client_id: string;
  contact_id: string | null;
  lead_id: string | null;
  enquiry_id: string | null;
  title: string;
  intro_html: string | null;
  currency: string;
  issue_date: string | null;
  valid_until: string | null;
  payment_terms: string | null;
  notes: string | null;
  terms: string | null;
  discount_type: DiscountType;
  discount_value: number;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  status: QuotationStatus;
  version: number;
  parent_quotation_id: string | null;
  superseded_by_id: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  voided_at: string | null;
  void_reason: string | null;
  client_snapshot: string | null;
  business_snapshot: string | null;
  pdf_file_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationItemRow {
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
  is_recurring: number;
  recurring_interval: 'month' | 'year' | null;
  line_subtotal_minor: number;
  line_discount_minor: number;
  line_tax_minor: number;
  line_total_minor: number;
}

export interface ClientSnapshot {
  name: string;
  legalName: string | null;
  number: string;
  email: string | null;
  phone: string | null;
  taxNumber: string | null;
  address: string | null;
  contact: { name: string; email: string | null } | null;
}
export interface BusinessSnapshot {
  name: string;
  legalName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
}

const ITEM_COLUMNS = `position, service_id, package_id, description, quantity_milli, unit_price_minor, discount_type, discount_value,
  tax_rate_id, tax_rate_bp, tax_inclusive, is_recurring, recurring_interval, line_subtotal_minor, line_discount_minor, line_tax_minor, line_total_minor`;

// ---------------------------------------------------------------- tokens & links

/** The public token is derived (HMAC of the id), so the same link can be shown or re-sent; only its hash is stored. */
const publicToken = (ctx: RequestContext, id: string) => documentToken(ctx, 'quotation', id);

export const publicLink = (ctx: RequestContext, id: string): Promise<string> => documentLink(ctx, 'quotation', id);

// ---------------------------------------------------------------- pricing of the lines

function insertItemStmt(ctx: RequestContext, quotationId: string, it: PricedLine) {
  return stmt(
    ctx.db,
    `INSERT INTO quotation_items (id, quotation_id, ${ITEM_COLUMNS})
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE (SELECT status FROM quotations WHERE id = ?) = 'draft'`,
    it.id,
    quotationId,
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
    it.isRecurring ? 1 : 0,
    it.recurringInterval,
    it.subtotal,
    it.discount,
    it.tax,
    it.total,
    quotationId,
  );
}

// ---------------------------------------------------------------- read

const LIST_SELECT = `SELECT q.id, q.number, q.title, q.status, q.currency, q.total_minor, q.valid_until, q.version, q.superseded_by_id,
  q.created_at, q.updated_at, q.sent_at, c.id AS client_id, c.display_name AS client_name
  FROM quotations q JOIN clients c ON c.id = q.client_id`;

export async function listQuotations(
  ctx: RequestContext,
  filter: { status?: string | undefined; clientId?: string | undefined; q?: string | undefined; page: number },
) {
  assertCan(ctx, 'quotations.view');
  const where: string[] = [];
  const params: unknown[] = [];
  if (!filter.status || filter.status === 'open') {
    where.push("q.status IN ('draft','sent','viewed') AND q.superseded_by_id IS NULL");
  } else if (filter.status !== 'all') {
    where.push('q.status = ?');
    params.push(filter.status);
  }
  if (filter.clientId) {
    where.push('q.client_id = ?');
    params.push(filter.clientId);
  }
  if (filter.q?.trim()) {
    const l = `%${filter.q
      .trim()
      .slice(0, 80)
      .replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push("(q.number LIKE ? ESCAPE '\\' OR q.title LIKE ? ESCAPE '\\' OR c.display_name LIKE ? ESCAPE '\\')");
    params.push(l, l, l);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [count, rows] = await ctx.db.batch([
    ctx.db.prepare(`SELECT COUNT(*) AS n FROM quotations q JOIN clients c ON c.id = q.client_id ${w}`).bind(...params),
    ctx.db
      .prepare(`${LIST_SELECT} ${w} ORDER BY q.updated_at DESC LIMIT ? OFFSET ?`)
      .bind(...params, PAGE_SIZE, (filter.page - 1) * PAGE_SIZE),
  ]);
  const total = ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  return {
    total,
    page: filter.page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    items: (rows?.results ?? []) as {
      id: string;
      number: string | null;
      title: string;
      status: QuotationStatus;
      currency: string;
      total_minor: number;
      valid_until: string | null;
      version: number;
      superseded_by_id: string | null;
      created_at: string;
      updated_at: string;
      sent_at: string | null;
      client_id: string;
      client_name: string;
    }[],
  };
}

async function loadRow(ctx: RequestContext, id: string): Promise<QuotationRow> {
  const q = await ctx.db.prepare('SELECT * FROM quotations WHERE id = ?').bind(id).first<QuotationRow>();
  if (!q) throw notFound();
  return q;
}

async function loadItems(ctx: RequestContext, id: string): Promise<QuotationItemRow[]> {
  const { results } = await ctx.db
    .prepare(`SELECT id, ${ITEM_COLUMNS} FROM quotation_items WHERE quotation_id = ? ORDER BY position`)
    .bind(id)
    .all<QuotationItemRow>();
  return results;
}

export async function getQuotation(ctx: RequestContext, id: string) {
  assertCan(ctx, 'quotations.view');
  const q = await loadRow(ctx, id);
  const [items, client, contact, versions, invoice, creator] = await ctx.db.batch([
    ctx.db.prepare(`SELECT id, ${ITEM_COLUMNS} FROM quotation_items WHERE quotation_id = ? ORDER BY position`).bind(id),
    ctx.db
      .prepare('SELECT id, client_number, display_name, email, default_currency, status FROM clients WHERE id = ?')
      .bind(q.client_id),
    ctx.db.prepare('SELECT id, name, email FROM client_contacts WHERE id = ?').bind(q.contact_id ?? ''),
    // Every version in this quotation's family (walk up to the root, then all descendants).
    ctx.db
      .prepare(
        `WITH RECURSIVE up(id, parent) AS (
           SELECT id, parent_quotation_id FROM quotations WHERE id = ?
           UNION SELECT q.id, q.parent_quotation_id FROM quotations q JOIN up ON q.id = up.parent),
         root AS (SELECT id FROM up WHERE parent IS NULL),
         down(id) AS (SELECT id FROM root UNION SELECT q.id FROM quotations q JOIN down ON q.parent_quotation_id = down.id)
         SELECT q.id, q.number, q.version, q.status, q.created_at FROM quotations q JOIN down ON down.id = q.id ORDER BY q.version`,
      )
      .bind(id),
    ctx.db.prepare('SELECT id, number, status FROM invoices WHERE source_quotation_id = ?').bind(id),
    ctx.db.prepare('SELECT name FROM users WHERE id = ?').bind(q.created_by ?? ''),
  ]);
  return {
    quotation: q,
    items: (items?.results ?? []) as QuotationItemRow[],
    client: ((client?.results ?? [])[0] ?? null) as {
      id: string;
      client_number: string;
      display_name: string;
      email: string | null;
      default_currency: string;
      status: string;
    } | null,
    contact: ((contact?.results ?? [])[0] ?? null) as { id: string; name: string; email: string | null } | null,
    versions: (versions?.results ?? []) as {
      id: string;
      number: string | null;
      version: number;
      status: QuotationStatus;
      created_at: string;
    }[],
    invoice: ((invoice?.results ?? [])[0] ?? null) as { id: string; number: string | null; status: string } | null,
    createdBy: ((creator?.results ?? [])[0] as { name: string } | undefined)?.name ?? null,
  };
}

// ---------------------------------------------------------------- write: drafts

export async function createQuotation(ctx: RequestContext, input: QuotationInput): Promise<{ id: string }> {
  assertCan(ctx, 'quotations.create');
  const { items, totals } = await priceLines(ctx, input, 'qit');
  const id = newId('quo', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO quotations (id, client_id, contact_id, lead_id, enquiry_id, title, intro_html, currency, valid_until, payment_terms,
           notes, terms, discount_type, discount_value, subtotal_minor, discount_minor, tax_minor, total_minor, status, version, created_by,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, ?, ?)`,
        id,
        input.clientId,
        input.contactId ?? null,
        input.leadId ?? null,
        input.enquiryId ?? null,
        input.title,
        sanitizeHtml(input.introHtml) || null,
        input.currency,
        input.validUntil,
        input.paymentTerms,
        input.notes,
        input.terms,
        input.discountType,
        input.discountType === 'none' ? 0 : input.discountValue,
        totals.subtotalMinor,
        totals.discountMinor,
        totals.taxMinor,
        totals.totalMinor,
        ctx.actor.userId,
        now,
        now,
      ),
    )
    .addAll(items.map((it) => insertItemStmt(ctx, id, it)))
    .add(
      auditStmt(ctx, {
        action: 'quotation.created',
        entityType: 'quotation',
        entityId: id,
        after: { clientId: input.clientId, currency: input.currency, totalMinor: totals.totalMinor },
      }),
    )
    .run();
  return { id };
}

export async function updateQuotation(ctx: RequestContext, id: string, input: QuotationInput): Promise<void> {
  assertCan(ctx, 'quotations.update');
  const before = await loadRow(ctx, id);
  if (before.status !== 'draft') throw conflict('Only drafts can be edited. Revise the quotation to change it.');
  const { items, totals } = await priceLines(ctx, input, 'qit');
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE quotations SET client_id = ?, contact_id = ?, lead_id = ?, enquiry_id = ?, title = ?, intro_html = ?, currency = ?, valid_until = ?,
           payment_terms = ?, notes = ?, terms = ?, discount_type = ?, discount_value = ?, subtotal_minor = ?, discount_minor = ?, tax_minor = ?,
           total_minor = ?, updated_at = ?
         WHERE id = ? AND status = 'draft'`,
        input.clientId,
        input.contactId ?? null,
        input.leadId ?? null,
        input.enquiryId ?? null,
        input.title,
        sanitizeHtml(input.introHtml) || null,
        input.currency,
        input.validUntil,
        input.paymentTerms,
        input.notes,
        input.terms,
        input.discountType,
        input.discountType === 'none' ? 0 : input.discountValue,
        totals.subtotalMinor,
        totals.discountMinor,
        totals.taxMinor,
        totals.totalMinor,
        now,
        id,
      ),
      'update',
    )
    .add(
      stmt(
        ctx.db,
        "DELETE FROM quotation_items WHERE quotation_id = ? AND (SELECT status FROM quotations WHERE id = ?) = 'draft'",
        id,
        id,
      ),
    )
    .addAll(items.map((it) => insertItemStmt(ctx, id, it)))
    .add(
      auditWhen(
        ctx,
        {
          action: 'quotation.updated',
          entityType: 'quotation',
          entityId: id,
          before: { totalMinor: before.total_minor, currency: before.currency },
          after: { totalMinor: totals.totalMinor, currency: input.currency },
        },
        "EXISTS (SELECT 1 FROM quotations WHERE id = ? AND status = 'draft' AND updated_at = ?)",
        id,
        now,
      ),
    )
    .run();
  if (res.changes('update') !== 1) throw conflict('This quotation is no longer a draft. Reload the page.');
}

/** Drafts have no number and were never sent, so they can be deleted outright. */
export async function deleteDraft(ctx: RequestContext, id: string): Promise<void> {
  assertCan(ctx, 'quotations.update');
  const q = await loadRow(ctx, id);
  if (q.status !== 'draft') throw conflict('Only drafts can be deleted. Void a sent quotation instead.');
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        "DELETE FROM quotation_items WHERE quotation_id = ? AND (SELECT status FROM quotations WHERE id = ?) = 'draft'",
        id,
        id,
      ),
    )
    .add(
      stmt(
        ctx.db,
        "UPDATE quotations SET superseded_by_id = NULL WHERE superseded_by_id = ? AND (SELECT status FROM quotations WHERE id = ?) = 'draft'",
        id,
        id,
      ),
    )
    .add(
      auditWhen(
        ctx,
        { action: 'quotation.draft_deleted', entityType: 'quotation', entityId: id, before: { title: q.title } },
        "EXISTS (SELECT 1 FROM quotations WHERE id = ? AND status = 'draft')",
        id,
      ),
    )
    .add(stmt(ctx.db, "DELETE FROM quotations WHERE id = ? AND status = 'draft'", id), 'delete')
    .run();
  if (res.changes('delete') !== 1) throw conflict('This quotation is no longer a draft.');
}

/** Copies a quotation (any status) into a new, independent draft. */
export async function duplicateQuotation(ctx: RequestContext, id: string): Promise<{ id: string }> {
  assertCan(ctx, 'quotations.create');
  return copyAsDraft(ctx, await loadRow(ctx, id), { revision: false });
}

/** New version of a sent/rejected/expired quotation; the old version stays read-only and is marked superseded. */
export async function reviseQuotation(ctx: RequestContext, id: string): Promise<{ id: string }> {
  assertCan(ctx, 'quotations.update');
  const q = await loadRow(ctx, id);
  if (!REVISABLE.includes(q.status)) throw conflict('Only a sent, rejected or expired quotation can be revised.');
  if (q.superseded_by_id) throw conflict('This quotation already has a newer version.');
  return copyAsDraft(ctx, q, { revision: true });
}

async function copyAsDraft(ctx: RequestContext, q: QuotationRow, opts: { revision: boolean }): Promise<{ id: string }> {
  const items = await loadItems(ctx, q.id);
  const newIdValue = newId('quo', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const base = newId('qit', ctx.now().getTime());
  const batch = new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO quotations (id, client_id, contact_id, lead_id, enquiry_id, title, intro_html, currency, valid_until, payment_terms, notes, terms,
           discount_type, discount_value, subtotal_minor, discount_minor, tax_minor, total_minor, status, version, parent_quotation_id, created_by,
           created_at, updated_at)
         SELECT ?, client_id, contact_id, lead_id, enquiry_id, title, intro_html, currency, NULL, payment_terms, notes, terms,
           discount_type, discount_value, subtotal_minor, discount_minor, tax_minor, total_minor, 'draft', ?, ?, ?, ?, ?
         FROM quotations WHERE id = ?`,
        newIdValue,
        opts.revision ? q.version + 1 : 1,
        opts.revision ? q.id : null,
        ctx.actor.userId,
        now,
        now,
        q.id,
      ),
    )
    .addAll(
      items.map((it, i) =>
        stmt(
          ctx.db,
          `INSERT INTO quotation_items (id, quotation_id, ${ITEM_COLUMNS})
           SELECT ?, ?, ${ITEM_COLUMNS} FROM quotation_items WHERE id = ?`,
          `${base}_${i}`,
          newIdValue,
          it.id,
        ),
      ),
    );
  if (opts.revision) {
    const res = await batch
      .add(
        stmt(
          ctx.db,
          'UPDATE quotations SET superseded_by_id = ?, updated_at = ? WHERE id = ? AND superseded_by_id IS NULL',
          newIdValue,
          now,
          q.id,
        ),
        'link',
      )
      .add(
        auditStmt(ctx, {
          action: 'quotation.revised',
          entityType: 'quotation',
          entityId: q.id,
          after: { newVersionId: newIdValue, version: q.version + 1 },
        }),
      )
      .run();
    // A concurrent revise linked first: the batch still committed our copy, so remove it again.
    if (res.changes('link') !== 1) {
      await ctx.db.batch([
        ctx.db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').bind(newIdValue),
        ctx.db.prepare("DELETE FROM quotations WHERE id = ? AND status = 'draft'").bind(newIdValue),
      ]);
      throw conflict('This quotation already has a newer version.');
    }
  } else {
    await batch
      .add(
        auditStmt(ctx, {
          action: 'quotation.duplicated',
          entityType: 'quotation',
          entityId: newIdValue,
          after: { from: q.id },
        }),
      )
      .run();
  }
  return { id: newIdValue };
}

// ---------------------------------------------------------------- send

/** Current client + business details (frozen into the quotation at first send; used live for draft previews). */
export async function snapshots(ctx: RequestContext, q: { client_id: string; contact_id: string | null }) {
  const settings = await getSettings(ctx);
  const [client, contact] = await ctx.db.batch([
    ctx.db
      .prepare(
        'SELECT client_number, display_name, legal_name, email, phone, tax_number, billing_address FROM clients WHERE id = ?',
      )
      .bind(q.client_id),
    // The chosen contact, or the client's main contact when none was chosen.
    ctx.db
      .prepare(
        'SELECT name, email FROM client_contacts WHERE client_id = ? AND (id = ? OR (? IS NULL AND is_primary = 1)) LIMIT 1',
      )
      .bind(q.client_id, q.contact_id ?? '', q.contact_id),
  ]);
  const c = (client?.results ?? [])[0] as
    | {
        client_number: string;
        display_name: string;
        legal_name: string | null;
        email: string | null;
        phone: string | null;
        tax_number: string | null;
        billing_address: string | null;
      }
    | undefined;
  if (!c) throw notFound();
  const k = (contact?.results ?? [])[0] as { name: string; email: string | null } | undefined;
  let address: string | null = null;
  try {
    const a = c.billing_address ? (JSON.parse(c.billing_address) as Record<string, string | undefined>) : null;
    address = a
      ? [a['line1'], a['line2'], a['city'], a['region'], a['postalCode'], a['country']].filter(Boolean).join(', ') ||
        null
      : null;
  } catch {
    address = null;
  }
  const client$: ClientSnapshot = {
    name: c.display_name,
    legalName: c.legal_name,
    number: c.client_number,
    email: c.email,
    phone: c.phone,
    taxNumber: c.tax_number,
    address,
    contact: k ? { name: k.name, email: k.email } : null,
  };
  const business: BusinessSnapshot = {
    name: settingText(settings, 'company.name') ?? 'Kuzikode Intelligent Technologies',
    legalName: settingText(settings, 'company.legal_name') ?? null,
    registrationNumber: settingText(settings, 'company.registration_number') ?? null,
    taxNumber: settingText(settings, 'company.tax_number') ?? null,
    address: settingText(settings, 'contact.address') ?? null,
    email: settingText(settings, 'contact.billing_email') ?? settingText(settings, 'contact.email') ?? null,
    phone: settingText(settings, 'contact.phone') ?? null,
  };
  return { client: client$, business, settings };
}

/**
 * Sends (or re-sends) a quotation by email with its public link. The first send assigns the number (revisions reuse
 * the original number with a `-v2`, `-v3`… suffix), sets the issue and valid-until dates and freezes the snapshots.
 */
export async function sendQuotation(
  ctx: RequestContext,
  id: string,
  opts: { message?: string | null } = {},
): Promise<{ number: string; link: string }> {
  assertCan(ctx, 'quotations.send');
  const q = await loadRow(ctx, id);
  if (!canTransition(q.status, 'sent')) throw conflict('This quotation can no longer be sent.');
  if (q.superseded_by_id) throw conflict('A newer version of this quotation exists. Send that one instead.');
  const items = await loadItems(ctx, id);
  if (!items.length) throw validationError({ items: ['Add at least one line.'] });
  const snap = await snapshots(ctx, q);
  const to = snap.client.contact?.email ?? snap.client.email;
  if (!to) throw validationError({ contactId: ['Add an email address to the client or choose a contact with one.'] });
  const { token, hash } = await publicToken(ctx, id);
  const link = `${ctx.config.siteOrigin}/q/${token}`;
  const now = ctx.now().toISOString();
  const today = businessDate(ctx.now());
  const first = q.status === 'draft';
  const validity = settingNumber(snap.settings, 'quotation.default_validity_days', 30);
  const validUntil = q.valid_until && q.valid_until >= today ? q.valid_until : addDays(today, validity);

  const batch = new Batch(ctx.db);
  let numberSql: { sql: string; params: unknown[] };
  if (first && q.parent_quotation_id) {
    // Revision: original number + version suffix (no new sequence number).
    const parent = await ctx.db
      .prepare('SELECT number FROM quotations WHERE id = ?')
      .bind(q.parent_quotation_id)
      .first<{ number: string | null }>();
    const base = (parent?.number ?? '').replace(/-v\d+$/, '');
    if (!base) throw conflict('The previous version has no number.');
    numberSql = { sql: '?', params: [`${base}-v${q.version}`] };
  } else if (first) {
    const format = settingText(snap.settings, 'numbering.quotation') ?? 'QUO-{YYYY}-{SEQ:4}';
    const year = businessYear(ctx.now());
    const key = sequenceKey('quotation', format, year);
    batch.addAll(sequenceStatements(ctx.db, key));
    numberSql = numberSqlExpr(key, format, year);
  } else {
    numberSql = { sql: 'number', params: [] };
  }
  const email = enqueue(ctx, {
    type: 'email.send',
    payload: {
      template: 'quotation_sent',
      to,
      // Number, total and dates are filled in at send time by the email resolver (the number is assigned in this batch).
      data: {
        quotationId: id,
        name: snap.client.contact?.name ?? snap.client.name,
        link,
        message: opts.message ?? null,
      },
    },
    idempotencyKey: `email:quotation:${id}:${now}`,
  });
  // The PDF is generated in the background once per content state: a resend that moves the validity date gets a new
  // file (the earlier one is kept, not overwritten).
  const pdf = enqueue(ctx, {
    type: 'pdf.generate',
    payload: { kind: 'quotation', id },
    idempotencyKey: `pdf:quotation:${id}:${validUntil}`,
  });
  const res = await batch
    .add(
      stmt(
        ctx.db,
        `UPDATE quotations SET number = ${numberSql.sql}, status = CASE WHEN status = 'viewed' THEN 'viewed' ELSE 'sent' END,
           issue_date = COALESCE(issue_date, ?), valid_until = ?, sent_at = ?, public_token_hash = ?,
           client_snapshot = COALESCE(client_snapshot, ?), business_snapshot = COALESCE(business_snapshot, ?), updated_at = ?,
           pdf_file_id = CASE WHEN valid_until IS ? THEN pdf_file_id ELSE NULL END
         WHERE id = ? AND status = ? AND superseded_by_id IS NULL`,
        ...numberSql.params,
        today,
        validUntil,
        now,
        hash,
        JSON.stringify(snap.client),
        JSON.stringify(snap.business),
        now,
        validUntil,
        id,
        q.status,
      ),
      'send',
    )
    .add(email.stmt)
    .add(pdf.stmt)
    // The jobs only stay queued when the guarded update above changed the quotation (the audit row is conditional too).
    .add(
      stmt(
        ctx.db,
        `DELETE FROM outbox WHERE id IN (?, ?) AND NOT EXISTS (SELECT 1 FROM quotations WHERE id = ? AND sent_at = ?)`,
        email.id,
        pdf.id,
        id,
        now,
      ),
    )
    .add(
      auditWhen(
        ctx,
        {
          action: first ? 'quotation.sent' : 'quotation.resent',
          entityType: 'quotation',
          entityId: id,
          after: { to, totalMinor: q.total_minor, validUntil },
        },
        'EXISTS (SELECT 1 FROM quotations WHERE id = ? AND sent_at = ?)',
        id,
        now,
      ),
    )
    .run();
  if (res.changes('send') !== 1) throw conflict('This quotation changed while sending. Reload and try again.');
  const sent = await loadRow(ctx, id);
  dispatch(ctx, [email.id, pdf.id]);
  return { number: sent.number!, link };
}

// ---------------------------------------------------------------- responses

export interface PublicQuotation {
  quotation: QuotationRow;
  items: QuotationItemRow[];
  client: ClientSnapshot;
  business: BusinessSnapshot;
  /** Accept/reject buttons are shown only when true. */
  open: boolean;
  newerVersionLink: string | null;
}

/** The client's first look (public link or portal) moves a sent quotation to "viewed" and tells its author once. */
async function markViewed(ctx: RequestContext, q: QuotationRow): Promise<void> {
  if (q.status === 'sent') {
    const now = ctx.now().toISOString();
    const res = await new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          "UPDATE quotations SET status = 'viewed', viewed_at = ?, updated_at = ? WHERE id = ? AND status = 'sent'",
          now,
          now,
          q.id,
        ),
        'view',
      )
      .addAll(
        q.created_by
          ? [
              notifyUser(ctx, q.created_by, {
                type: 'quotation.viewed',
                title: `${q.number} was opened by the client`,
                link: `/admin/quotations/${q.id}`,
                entityType: 'quotation',
                entityId: q.id,
                dedupeKey: `quotation_viewed:${q.id}`,
              }),
            ]
          : [],
      )
      .run();
    if (res.changes('view') === 1) {
      q.status = 'viewed';
      q.viewed_at = now;
    }
  }
}

/** Looks a quotation up by its public token and records the first view. Drafts are never public. */
export async function getPublicQuotation(ctx: RequestContext, token: string): Promise<PublicQuotation | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const hash = await sha256Hex(token);
  const q = await ctx.db
    .prepare("SELECT * FROM quotations WHERE public_token_hash = ? AND status <> 'draft'")
    .bind(hash)
    .first<QuotationRow>();
  if (!q) return null;
  const today = businessDate(ctx.now());
  await markViewed(ctx, q);
  let newer: string | null = null;
  if (q.superseded_by_id) {
    const n = await ctx.db
      .prepare("SELECT id FROM quotations WHERE id = ? AND status <> 'draft'")
      .bind(q.superseded_by_id)
      .first<{ id: string }>();
    if (n) newer = await publicLink(ctx, n.id);
  }
  return {
    quotation: q,
    items: await loadItems(ctx, q.id),
    client: JSON.parse(q.client_snapshot ?? '{}') as ClientSnapshot,
    business: JSON.parse(q.business_snapshot ?? '{}') as BusinessSnapshot,
    open: OPEN_FOR_RESPONSE.includes(q.status) && !q.superseded_by_id && (!q.valid_until || q.valid_until >= today),
    newerVersionLink: newer,
  };
}

type Decision =
  | { decision: 'accept'; name: string; byStaff: boolean }
  | { decision: 'reject'; reason: string | null; byStaff: boolean };

async function respond(ctx: RequestContext, q: QuotationRow, d: Decision): Promise<void> {
  const today = businessDate(ctx.now());
  if (!OPEN_FOR_RESPONSE.includes(q.status) || q.superseded_by_id)
    throw conflict('This quotation can no longer be accepted or rejected.');
  if (q.valid_until && q.valid_until < today) throw conflict('This quotation has expired. Ask us for an updated one.');
  const now = ctx.now().toISOString();
  const accept = d.decision === 'accept';
  const res = await new Batch(ctx.db)
    .add(
      accept
        ? stmt(
            ctx.db,
            `UPDATE quotations SET status = 'accepted', accepted_at = ?, accepted_by_name = ?, accepted_ip = ?, accepted_user_agent = ?, updated_at = ?
             WHERE id = ? AND status IN ('sent','viewed') AND superseded_by_id IS NULL AND (valid_until IS NULL OR valid_until >= ?)`,
            now,
            d.name,
            d.byStaff ? null : ctx.ip,
            d.byStaff ? null : ctx.userAgent,
            now,
            q.id,
            today,
          )
        : stmt(
            ctx.db,
            `UPDATE quotations SET status = 'rejected', rejected_at = ?, rejection_reason = ?, updated_at = ?
             WHERE id = ? AND status IN ('sent','viewed') AND superseded_by_id IS NULL AND (valid_until IS NULL OR valid_until >= ?)`,
            now,
            d.decision === 'reject' ? d.reason : null,
            now,
            q.id,
            today,
          ),
      'respond',
    )
    .add(
      auditWhen(
        ctx,
        {
          action: `quotation.${accept ? 'accepted' : 'rejected'}${d.byStaff ? '_on_behalf' : ''}`,
          entityType: 'quotation',
          entityId: q.id,
          after: accept
            ? { name: d.decision === 'accept' ? d.name : null }
            : { reason: d.decision === 'reject' ? d.reason : null },
        },
        'EXISTS (SELECT 1 FROM quotations WHERE id = ? AND updated_at = ? AND status = ?)',
        q.id,
        now,
        accept ? 'accepted' : 'rejected',
      ),
    )
    // Recurring lines become subscriptions once the client accepts (docs/12 §A.3); the guard ties them to this acceptance.
    .addAll(
      accept
        ? [
            subscriptionsFromQuotationStmt(ctx, q.id, {
              sql: "EXISTS (SELECT 1 FROM quotations WHERE id = ? AND updated_at = ? AND status = 'accepted')",
              params: [q.id, now],
            }),
          ]
        : [],
    )
    .add(
      notifyStaffWithPermission(ctx, 'quotations.view', {
        type: accept ? 'quotation.accepted' : 'quotation.rejected',
        title: `${q.number} was ${accept ? 'accepted' : 'rejected'}${d.byStaff ? ' (recorded by staff)' : ''}`,
        link: `/admin/quotations/${q.id}`,
        entityType: 'quotation',
        entityId: q.id,
        dedupeKey: `quotation_${accept ? 'accepted' : 'rejected'}:${q.id}`,
      }),
    )
    .run();
  if (res.changes('respond') !== 1) throw conflict('This quotation can no longer be accepted or rejected.');
}

/** Client response through the public link (accept needs a typed name + confirmation; IP/UA/time recorded). */
export async function respondPublic(
  ctx: RequestContext,
  token: string,
  input: { decision: 'accept' | 'reject'; name?: string | undefined; reason?: string | null | undefined },
): Promise<QuotationStatus> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) throw notFound();
  const q = await ctx.db
    .prepare("SELECT * FROM quotations WHERE public_token_hash = ? AND status <> 'draft'")
    .bind(await sha256Hex(token))
    .first<QuotationRow>();
  if (!q) throw notFound();
  await respond(
    ctx,
    q,
    input.decision === 'accept'
      ? { decision: 'accept', name: input.name!, byStaff: false }
      : { decision: 'reject', reason: input.reason ?? null, byStaff: false },
  );
  return input.decision === 'accept' ? 'accepted' : 'rejected';
}

/** Staff record the client's answer (e.g. given by phone); audited as "on behalf". */
export async function recordResponse(
  ctx: RequestContext,
  id: string,
  input: { decision: 'accept' | 'reject'; name?: string | undefined; reason?: string | null | undefined },
): Promise<void> {
  assertCan(ctx, 'quotations.update');
  const q = await loadRow(ctx, id);
  await respond(
    ctx,
    q,
    input.decision === 'accept'
      ? { decision: 'accept', name: input.name!, byStaff: true }
      : { decision: 'reject', reason: input.reason ?? null, byStaff: true },
  );
}

export async function voidQuotation(ctx: RequestContext, id: string, reason: string): Promise<void> {
  assertCan(ctx, 'quotations.void');
  const q = await loadRow(ctx, id);
  if (q.status === 'draft') throw conflict('Delete the draft instead.');
  if (!canTransition(q.status, 'void')) throw conflict('This quotation is already void.');
  const inv = await ctx.db.prepare('SELECT 1 FROM invoices WHERE source_quotation_id = ?').bind(id).first();
  if (inv) throw conflict('This quotation has been converted to an invoice. Void or credit the invoice instead.');
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE quotations SET status = 'void', voided_at = ?, void_reason = ?, updated_at = ?
         WHERE id = ? AND status = ? AND NOT EXISTS (SELECT 1 FROM invoices WHERE source_quotation_id = ?)`,
        now,
        reason,
        now,
        id,
        q.status,
        id,
      ),
      'void',
    )
    .add(
      auditWhen(
        ctx,
        {
          action: 'quotation.voided',
          entityType: 'quotation',
          entityId: id,
          before: { status: q.status },
          after: { reason },
        },
        "EXISTS (SELECT 1 FROM quotations WHERE id = ? AND status = 'void' AND voided_at = ?)",
        id,
        now,
      ),
    )
    .run();
  if (res.changes('void') !== 1) throw conflict('This quotation changed meanwhile. Reload and try again.');
}

// ---------------------------------------------------------------- convert

/**
 * Accepted quotation → draft invoice with the same lines and totals. Idempotent: `invoices.source_quotation_id` is
 * UNIQUE, the insert is `ON CONFLICT DO NOTHING` and lines are only copied when this call created the invoice, so
 * repeated or concurrent calls all return the same invoice.
 */
export async function convertToInvoice(
  ctx: RequestContext,
  id: string,
): Promise<{ invoiceId: string; created: boolean }> {
  assertCan(ctx, 'invoices.create');
  const q = await loadRow(ctx, id);
  const existing = await ctx.db
    .prepare('SELECT id FROM invoices WHERE source_quotation_id = ?')
    .bind(id)
    .first<{ id: string }>();
  if (existing) return { invoiceId: existing.id, created: false };
  if (q.status !== 'accepted') throw conflict('Only an accepted quotation can be converted to an invoice.');
  const settings = await getSettings(ctx);
  const client = await ctx.db
    .prepare('SELECT payment_terms_days FROM clients WHERE id = ?')
    .bind(q.client_id)
    .first<{ payment_terms_days: number }>();
  const invoiceId = newId('inv', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const itemBase = newId('iit', ctx.now().getTime());
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO invoices (id, client_id, contact_id, source_quotation_id, currency, payment_terms_days, notes, terms, discount_type,
           discount_value, subtotal_minor, discount_minor, tax_minor, total_minor, balance_minor, status, created_by, created_at, updated_at)
         SELECT ?, client_id, contact_id, id, currency, ?, notes, ?, discount_type, discount_value, subtotal_minor, discount_minor, tax_minor,
           total_minor, total_minor, 'draft', ?, ?, ?
         FROM quotations WHERE id = ? AND status = 'accepted'
         ON CONFLICT(source_quotation_id) DO NOTHING`,
        invoiceId,
        client?.payment_terms_days ?? settingNumber(settings, 'invoice.default_terms_days', 14),
        settingText(settings, 'invoice.default_terms_text') ?? q.terms,
        ctx.actor.userId,
        now,
        now,
        id,
      ),
      'invoice',
    )
    .add(
      stmt(
        ctx.db,
        `INSERT INTO invoice_items (id, invoice_id, position, service_id, package_id, description, quantity_milli, unit_price_minor,
           discount_type, discount_value, tax_rate_id, tax_rate_bp, tax_inclusive, line_subtotal_minor, line_discount_minor, line_tax_minor,
           line_total_minor)
         SELECT ? || '_' || position, ?, position, service_id, package_id, description, quantity_milli, unit_price_minor, discount_type,
           discount_value, tax_rate_id, tax_rate_bp, tax_inclusive, line_subtotal_minor, line_discount_minor, line_tax_minor, line_total_minor
         FROM quotation_items WHERE quotation_id = ? AND EXISTS (SELECT 1 FROM invoices WHERE id = ?)`,
        itemBase,
        invoiceId,
        id,
        invoiceId,
      ),
    )
    .add(
      stmt(
        ctx.db,
        `INSERT INTO invoice_status_history (id, invoice_id, from_status, to_status, reason, actor_id, created_at)
         SELECT ?, ?, NULL, 'draft', 'Created from quotation', ?, ? WHERE EXISTS (SELECT 1 FROM invoices WHERE id = ?)`,
        newId('ish', ctx.now().getTime()),
        invoiceId,
        ctx.actor.userId,
        now,
        invoiceId,
      ),
    )
    .add(
      auditWhen(
        ctx,
        { action: 'quotation.converted', entityType: 'quotation', entityId: id, after: { invoiceId } },
        'EXISTS (SELECT 1 FROM invoices WHERE id = ?)',
        invoiceId,
      ),
    )
    .run();
  if (res.changes('invoice') === 1) return { invoiceId, created: true };
  const winner = await ctx.db
    .prepare('SELECT id FROM invoices WHERE source_quotation_id = ?')
    .bind(id)
    .first<{ id: string }>();
  if (!winner) throw conflict('Only an accepted quotation can be converted to an invoice.');
  return { invoiceId: winner.id, created: false };
}

// ---------------------------------------------------------------- cron

/** Nightly: sent/viewed quotations past their valid-until date become expired (one audit row each). */
export async function expireQuotations(ctx: RequestContext): Promise<number> {
  const today = businessDate(ctx.now());
  const { results } = await ctx.db
    .prepare(
      "SELECT id FROM quotations WHERE status IN ('sent','viewed') AND valid_until IS NOT NULL AND valid_until < ? LIMIT 200",
    )
    .bind(today)
    .all<{ id: string }>();
  if (!results.length) return 0;
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .addAll(
      results.flatMap((r) => [
        stmt(
          ctx.db,
          "UPDATE quotations SET status = 'expired', updated_at = ? WHERE id = ? AND status IN ('sent','viewed') AND valid_until < ?",
          now,
          r.id,
          today,
        ),
        auditWhen(
          ctx,
          { action: 'quotation.expired', entityType: 'quotation', entityId: r.id },
          "EXISTS (SELECT 1 FROM quotations WHERE id = ? AND status = 'expired' AND updated_at = ?)",
          r.id,
          now,
        ),
      ]),
    )
    .run();
  return results.length;
}

// ---------------------------------------------------------------- editor options

/** Choices for the editor: active clients (with contacts), currencies, tax rates, services and priced packages. */
export async function editorOptions(ctx: RequestContext, permission: Permission = 'quotations.view') {
  assertCan(ctx, permission);
  const [clients, contacts, currencies, taxes, services, packages] = await ctx.db.batch([
    ctx.db.prepare(
      "SELECT id, display_name AS name, client_number AS number, default_currency AS currency FROM clients WHERE status = 'active' ORDER BY display_name LIMIT 2000",
    ),
    ctx.db.prepare(
      "SELECT k.id, k.client_id, k.name, k.email FROM client_contacts k JOIN clients c ON c.id = k.client_id WHERE c.status = 'active' ORDER BY k.is_primary DESC, k.name",
    ),
    ctx.db.prepare('SELECT code, minor_digits FROM currencies WHERE active = 1 ORDER BY is_default DESC, code'),
    ctx.db.prepare(
      'SELECT id, name, rate_bp, inclusive, is_default FROM tax_rates WHERE active = 1 ORDER BY is_default DESC, name',
    ),
    ctx.db.prepare(
      `SELECT s.id, s.name, c.name AS division, s.pricing_model, s.price_minor, s.currency FROM services s
       JOIN service_categories c ON c.id = s.category_id WHERE s.status <> 'inactive' ORDER BY c.sort_order, s.sort_order`,
    ),
    ctx.db.prepare(
      `SELECT p.id, p.name, p.service_id, s.name AS service_name, p.price_type, p.price_minor, p.currency, p.billing_type, p.interval, p.min_quantity
       FROM service_packages p JOIN services s ON s.id = p.service_id WHERE p.status <> 'inactive' ORDER BY s.name, p.sort_order`,
    ),
  ]);
  return {
    clients: (clients?.results ?? []) as { id: string; name: string; number: string; currency: string }[],
    contacts: (contacts?.results ?? []) as { id: string; client_id: string; name: string; email: string | null }[],
    currencies: (currencies?.results ?? []) as { code: string; minor_digits: number }[],
    taxRates: (taxes?.results ?? []) as {
      id: string;
      name: string;
      rate_bp: number;
      inclusive: number;
      is_default: number;
    }[],
    services: (services?.results ?? []) as {
      id: string;
      name: string;
      division: string;
      pricing_model: string;
      price_minor: number | null;
      currency: string | null;
    }[],
    packages: (packages?.results ?? []) as {
      id: string;
      name: string;
      service_id: string;
      service_name: string;
      price_type: string;
      price_minor: number | null;
      currency: string | null;
      billing_type: 'one_off' | 'recurring';
      interval: 'month' | 'year' | null;
      min_quantity: number;
    }[],
  };
}

// ---------------------------------------------------------------- client portal (P5.3)

export interface PortalQuotationListItem {
  id: string;
  number: string;
  title: string;
  currency: string;
  totalMinor: number;
  status: QuotationStatus;
  issueDate: string | null;
  validUntil: string | null;
  /** The client can still accept or reject it. */
  open: boolean;
  clientName: string;
}

const isOpen = (q: Pick<QuotationRow, 'status' | 'superseded_by_id' | 'valid_until'>, today: string) =>
  OPEN_FOR_RESPONSE.includes(q.status) && !q.superseded_by_id && (!q.valid_until || q.valid_until >= today);

/** Quotations the portal caller may see: their clients, never drafts. Open ones first, then newest. */
export async function listPortalQuotations(
  ctx: RequestContext,
  filter: { show: 'open' | 'all' } = { show: 'all' },
): Promise<PortalQuotationListItem[]> {
  const scope = clientScope('q.client_id', portalAreaClientIds(ctx, 'quotations'));
  const today = businessDate(ctx.now());
  const openSql = `q.status IN ('sent','viewed') AND q.superseded_by_id IS NULL AND (q.valid_until IS NULL OR q.valid_until >= ?)`;
  const { results } = await ctx.db
    .prepare(
      `SELECT q.id, q.number, q.title, q.currency, q.total_minor, q.status, q.issue_date, q.valid_until, q.superseded_by_id,
         c.display_name AS client_name
       FROM quotations q JOIN clients c ON c.id = q.client_id
       WHERE ${scope.sql} AND q.status <> 'draft' ${filter.show === 'open' ? `AND ${openSql}` : ''}
       ORDER BY CASE WHEN ${openSql} THEN 0 ELSE 1 END, COALESCE(q.sent_at, q.created_at) DESC LIMIT 500`,
    )
    .bind(...scope.params, ...(filter.show === 'open' ? [today] : []), today)
    .all<
      Pick<
        QuotationRow,
        | 'id'
        | 'number'
        | 'title'
        | 'currency'
        | 'total_minor'
        | 'status'
        | 'issue_date'
        | 'valid_until'
        | 'superseded_by_id'
      > & { client_name: string }
    >();
  return results.map((q) => ({
    id: q.id,
    number: q.number ?? '',
    title: q.title,
    currency: q.currency,
    totalMinor: q.total_minor,
    status: q.status,
    issueDate: q.issue_date,
    validUntil: q.valid_until,
    open: isOpen(q, today),
    clientName: q.client_name,
  }));
}

/** A quotation in the caller's scope (404 otherwise, including drafts). */
async function loadPortalRow(ctx: RequestContext, id: string): Promise<QuotationRow> {
  const scope = clientScope('client_id', portalAreaClientIds(ctx, 'quotations'));
  const q = await ctx.db
    .prepare(`SELECT * FROM quotations WHERE id = ? AND status <> 'draft' AND ${scope.sql}`)
    .bind(id, ...scope.params)
    .first<QuotationRow>();
  if (!q) throw notFound();
  return q;
}

export interface PortalQuotation extends Omit<PublicQuotation, 'newerVersionLink'> {
  /** The newer version's id when this one was revised (and the newer one is visible to the client). */
  newerVersionId: string | null;
}

/** Portal view of one quotation. Opening it counts as the client's first view, like the public link. */
export async function getPortalQuotation(ctx: RequestContext, id: string): Promise<PortalQuotation> {
  const q = await loadPortalRow(ctx, id);
  await markViewed(ctx, q);
  let newer: string | null = null;
  if (q.superseded_by_id) {
    const n = await ctx.db
      .prepare("SELECT id FROM quotations WHERE id = ? AND status <> 'draft' AND client_id = ?")
      .bind(q.superseded_by_id, q.client_id)
      .first<{ id: string }>();
    newer = n?.id ?? null;
  }
  return {
    quotation: q,
    items: await loadItems(ctx, q.id),
    client: JSON.parse(q.client_snapshot ?? '{}') as ClientSnapshot,
    business: JSON.parse(q.business_snapshot ?? '{}') as BusinessSnapshot,
    open: isOpen(q, businessDate(ctx.now())),
    newerVersionId: newer,
  };
}

/** The signed-in client accepts (typed name) or rejects a quotation from the portal. */
export async function respondPortal(
  ctx: RequestContext,
  id: string,
  input: { decision: 'accept' | 'reject'; name?: string | undefined; reason?: string | null | undefined },
): Promise<QuotationStatus> {
  const q = await loadPortalRow(ctx, id);
  await respond(
    ctx,
    q,
    input.decision === 'accept'
      ? { decision: 'accept', name: input.name!, byStaff: false }
      : { decision: 'reject', reason: input.reason ?? null, byStaff: false },
  );
  return input.decision === 'accept' ? 'accepted' : 'rejected';
}

/** For the portal PDF route: the id when the caller may download it (never drafts). */
export async function portalQuotationId(ctx: RequestContext, id: string): Promise<string> {
  return (await loadPortalRow(ctx, id)).id;
}
