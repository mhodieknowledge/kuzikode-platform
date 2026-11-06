/**
 * Credit notes (P4.10). Issued against an issued invoice, numbered gap-free (`numbering.credit_note`), immutable and
 * never deleted. The credit either reduces the invoice balance (counted in `amount_credited_minor`), becomes account
 * credit in the `client_credits` ledger, or is recorded as owed back to the client (the refund itself is recorded in
 * Payments, P4.11). Everything commits in one batch guarded by the invoice's `updated_at`, which every money change
 * bumps, so two credit notes (or a credit note and a payment) can't both use the same headroom.
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditWhen } from '../../lib/audit';
import { businessDate, businessYear } from '../../lib/dates';
import { conflict, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { assertCan } from '../../lib/policies';
import { numberSqlExpr, sequenceKey } from '../../lib/sequences';
import { dispatch, enqueue } from '../../jobs/outbox';
import { creditForQuantity, creditLimit, type CreditApplication } from '../../../shared/credit-notes';
import { deriveStatus, type InvoiceStatus } from '../../../shared/invoices';
import { formatMoney, parseQuantityMilli } from '../../../shared/money';
import type { CreditNoteInput } from '../../../shared/schemas/invoices';
import { getSettings, settingText } from '../cms';
import type { InvoiceItemRow, InvoiceRow } from './service';

export interface CreditNoteRow {
  id: string;
  number: string;
  reason: string;
  total_minor: number;
  tax_minor: number;
  applied_to: CreditApplication;
  status: 'issued' | 'void';
  issued_at: string;
  pdf_file_id: string | null;
}

const CREDITABLE: readonly InvoiceStatus[] = ['issued', 'partially_paid', 'paid', 'overdue'];

/** What earlier (non-void) credit notes on the invoice used: in total, and given back as credit or refund. */
export async function creditedSoFar(ctx: RequestContext, invoiceId: string) {
  const r = await ctx.db
    .prepare(
      `SELECT COALESCE(SUM(total_minor), 0) AS total,
         COALESCE(SUM(CASE WHEN applied_to <> 'invoice' THEN total_minor ELSE 0 END), 0) AS returned
       FROM credit_notes WHERE invoice_id = ? AND status = 'issued'`,
    )
    .bind(invoiceId)
    .first<{ total: number; returned: number }>();
  return { total: r?.total ?? 0, returned: r?.returned ?? 0 };
}

/** Quantity of each invoice line already credited by earlier credit notes. */
async function creditedQuantities(ctx: RequestContext, invoiceId: string): Promise<Map<string, number>> {
  const { results } = await ctx.db
    .prepare(
      `SELECT i.invoice_item_id AS id, SUM(i.quantity_milli) AS qty FROM credit_note_items i
       JOIN credit_notes c ON c.id = i.credit_note_id
       WHERE c.invoice_id = ? AND c.status = 'issued' AND i.invoice_item_id IS NOT NULL GROUP BY i.invoice_item_id`,
    )
    .bind(invoiceId)
    .all<{ id: string; qty: number }>();
  return new Map(results.map((r) => [r.id, r.qty]));
}

export async function listCreditNotes(ctx: RequestContext, invoiceId: string): Promise<CreditNoteRow[]> {
  const { results } = await ctx.db
    .prepare(
      `SELECT id, number, reason, total_minor, tax_minor, applied_to, status, issued_at, pdf_file_id
       FROM credit_notes WHERE invoice_id = ? ORDER BY issued_at, id`,
    )
    .bind(invoiceId)
    .all<CreditNoteRow>();
  return results;
}

/** Remaining creditable quantity per line plus the limits per application, for the admin dialog. */
export async function creditOptions(ctx: RequestContext, inv: InvoiceRow, items: InvoiceItemRow[]) {
  const [done, qty] = await Promise.all([creditedSoFar(ctx, inv.id), creditedQuantities(ctx, inv.id)]);
  return {
    lines: items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity_milli: i.quantity_milli,
      remaining_milli: i.quantity_milli - (qty.get(i.id) ?? 0),
      line_total_minor: i.line_total_minor,
      line_tax_minor: i.line_tax_minor,
    })),
    limits: {
      invoice: creditLimit(inv, done, 'invoice'),
      client_credit: creditLimit(inv, done, 'client_credit'),
      refund: creditLimit(inv, done, 'refund'),
    },
  };
}

export async function issueCreditNote(
  ctx: RequestContext,
  invoiceId: string,
  input: CreditNoteInput,
): Promise<{ id: string; number: string; totalMinor: number; status: InvoiceStatus }> {
  assertCan(ctx, 'credit_notes.issue');
  const inv = await ctx.db.prepare('SELECT * FROM invoices WHERE id = ?').bind(invoiceId).first<InvoiceRow>();
  if (!inv) throw notFound();
  if (!CREDITABLE.includes(inv.status)) throw conflict('Credit notes can only be issued against an issued invoice.');
  const { results: items } = await ctx.db
    .prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position')
    .bind(invoiceId)
    .all<InvoiceItemRow>();
  const byId = new Map(items.map((i) => [i.id, i]));
  const already = await creditedQuantities(ctx, invoiceId);
  const requested = new Map<string, number>();
  const fields: Record<string, string[]> = {};

  const lines = input.lines.map((l, idx) => {
    if ('invoiceItemId' in l) {
      const item = byId.get(l.invoiceItemId);
      if (!item) {
        fields[`lines.${idx}`] = ['That line is not on this invoice.'];
        return null;
      }
      const q = parseQuantityMilli(l.quantity);
      const used = (already.get(item.id) ?? 0) + (requested.get(item.id) ?? 0) + q;
      if (q <= 0 || used > item.quantity_milli) {
        fields[`lines.${idx}.quantity`] = ['More than the quantity still on the invoice.'];
        return null;
      }
      requested.set(item.id, (requested.get(item.id) ?? 0) + q);
      const c = creditForQuantity(item, q);
      return {
        invoiceItemId: item.id,
        description: item.description,
        quantityMilli: q,
        unitPriceMinor: item.unit_price_minor,
        taxRateBp: item.tax_rate_bp,
        taxMinor: c.taxMinor,
        totalMinor: c.totalMinor,
      };
    }
    return {
      invoiceItemId: null,
      description: l.description,
      quantityMilli: 1000,
      unitPriceMinor: l.amountMinor,
      taxRateBp: 0,
      taxMinor: 0,
      totalMinor: l.amountMinor,
    };
  });
  if (Object.keys(fields).length) throw validationError(fields);
  const valid = lines.filter((l): l is NonNullable<typeof l> => !!l && l.totalMinor > 0);
  const total = valid.reduce((s, l) => s + l.totalMinor, 0);
  const tax = valid.reduce((s, l) => s + l.taxMinor, 0);
  if (total <= 0) throw validationError({ lines: ['The credit amount is zero.'] });
  const limit = creditLimit(inv, await creditedSoFar(ctx, invoiceId), input.appliedTo);
  if (total > limit)
    throw validationError({
      appliedTo: [
        limit === 0
          ? input.appliedTo === 'invoice'
            ? 'The invoice has no balance left to reduce.'
            : 'Nothing has been paid on this invoice that could be given back.'
          : `At most ${formatMoney(limit, inv.currency)} can be credited this way.`,
      ],
    });

  const today = businessDate(ctx.now());
  const toInvoice = input.appliedTo === 'invoice';
  const status = toInvoice
    ? deriveStatus(
        {
          totalMinor: inv.total_minor,
          paidMinor: inv.amount_paid_minor,
          creditedMinor: inv.amount_credited_minor + total,
          dueDate: inv.due_date,
        },
        today,
      )
    : inv.status;
  const settings = await getSettings(ctx);
  const format = settingText(settings, 'numbering.credit_note') ?? 'CN-{YYYY}-{SEQ:4}';
  const year = businessYear(ctx.now());
  const key = sequenceKey('credit_note', format, year);
  const number = numberSqlExpr(key, format, year);
  const id = newId('crn', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const guard = {
    sql: 'EXISTS (SELECT 1 FROM invoices WHERE id = ? AND updated_at = ?)',
    params: [invoiceId, inv.updated_at],
  };
  const made = { sql: 'EXISTS (SELECT 1 FROM credit_notes WHERE id = ?)', params: [id] };
  const pdf = enqueue(ctx, {
    type: 'pdf.generate',
    payload: { kind: 'credit_note', id },
    idempotencyKey: `pdf:credit_note:${id}`,
  });

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
        `INSERT INTO credit_notes (id, number, invoice_id, client_id, currency, reason, subtotal_minor, tax_minor, total_minor,
           status, applied_to, issued_by, issued_at, created_at)
         SELECT ?, ${number.sql}, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?, ? WHERE ${guard.sql}`,
        id,
        ...number.params,
        invoiceId,
        inv.client_id,
        inv.currency,
        input.reason,
        total - tax,
        tax,
        total,
        input.appliedTo,
        ctx.actor.userId,
        now,
        now,
        ...guard.params,
      ),
      'credit_note',
    )
    .addAll(
      valid.map((l, i) =>
        stmt(
          ctx.db,
          `INSERT INTO credit_note_items (id, credit_note_id, invoice_item_id, description, quantity_milli, unit_price_minor,
             tax_rate_bp, line_tax_minor, line_total_minor)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${made.sql}`,
          `${id.replace(/^crn_/, 'cni_')}_${i}`,
          id,
          l.invoiceItemId,
          l.description,
          l.quantityMilli,
          l.unitPriceMinor,
          l.taxRateBp,
          l.taxMinor,
          l.totalMinor,
          ...made.params,
        ),
      ),
    )
    // Every credit note bumps the invoice's updated_at (the guard for the next money change on it).
    .add(
      stmt(
        ctx.db,
        `UPDATE invoices SET amount_credited_minor = amount_credited_minor + ?, balance_minor = balance_minor - ?, status = ?,
           updated_at = ? WHERE id = ? AND updated_at = ? AND ${made.sql}`,
        toInvoice ? total : 0,
        toInvoice ? total : 0,
        status,
        now,
        invoiceId,
        inv.updated_at,
        ...made.params,
      ),
      'invoice',
    )
    .addAll(
      input.appliedTo === 'client_credit'
        ? [
            stmt(
              ctx.db,
              `INSERT INTO client_credits (id, client_id, currency, amount_minor, source_type, source_id, note, created_by, created_at)
               SELECT ?, ?, ?, ?, 'credit_note', ?, ?, ?, ? WHERE ${made.sql}`,
              newId('ccr', ctx.now().getTime()),
              inv.client_id,
              inv.currency,
              total,
              id,
              `Credit note against ${inv.number}`,
              ctx.actor.userId,
              now,
              ...made.params,
            ),
          ]
        : [],
    )
    .addAll(
      status !== inv.status
        ? [
            stmt(
              ctx.db,
              `INSERT INTO invoice_status_history (id, invoice_id, from_status, to_status, reason, actor_id, created_at)
               SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${made.sql}`,
              newId('ish', ctx.now().getTime()),
              invoiceId,
              inv.status,
              status,
              `Credit note ${formatMoney(total, inv.currency)}`,
              ctx.actor.userId,
              now,
              ...made.params,
            ),
          ]
        : [],
    )
    .add(pdf.stmt)
    .add(stmt(ctx.db, `DELETE FROM outbox WHERE id = ? AND NOT ${made.sql}`, pdf.id, ...made.params))
    .add(
      auditWhen(
        ctx,
        {
          action: 'credit_note.issued',
          entityType: 'invoice',
          entityId: invoiceId,
          after: { creditNoteId: id, totalMinor: total, appliedTo: input.appliedTo, reason: input.reason },
        },
        made.sql,
        ...made.params,
      ),
    )
    .run();
  if (res.changes('credit_note') !== 1)
    throw conflict('The invoice changed while you were working. Reload and try again.');
  if (res.changes('invoice') !== 1) throw new Error('credit note issued without invoice update');
  dispatch(ctx, [pdf.id]);
  const cn = await ctx.db.prepare('SELECT number FROM credit_notes WHERE id = ?').bind(id).first<{ number: string }>();
  return { id, number: cn!.number, totalMinor: total, status };
}
