/**
 * Payments admin (P4.11, PRD §4.2 H): every payment across providers and manual entry, its allocations, attempt and
 * events timeline (payloads are stored redacted), receipts and refunds, plus the unmatched-callback queue.
 *
 * Refunds are recorded, never pushed to a gateway here (Paynow and PesePay document no refund API; adapters that
 * support refunds arrive with Phase 6). A refund must be covered by a credit document so the books stay balanced:
 * either a credit note issued "to be refunded" on an invoice of the same client, or the client's account credit
 * (which the refund then uses up). Refund, ledger entry, payment status and audit commit in one guarded batch.
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditWhen } from '../../lib/audit';
import { conflict, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { assertCan } from '../../lib/policies';
import { formatMoney } from '../../../shared/money';
import type { PaymentListQuery, RefundInput } from '../../../shared/schemas/payments';

export const PAGE_SIZE = 25;

export interface PaymentRow {
  id: string;
  receipt_number: string;
  client_id: string;
  provider_key: string;
  account_id: string | null;
  method: string;
  amount_minor: number;
  currency: string;
  received_at: string;
  attempt_id: string | null;
  provider_reference: string | null;
  status: 'completed' | 'reversed' | 'refunded' | 'partially_refunded';
  recorded_by: string | null;
  reference: string | null;
  notes: string | null;
  receipt_file_id: string | null;
  created_at: string;
  updated_at: string;
}

const escapeLike = (q: string) =>
  `%${q
    .trim()
    .slice(0, 80)
    .replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export async function listPayments(ctx: RequestContext, f: PaymentListQuery) {
  assertCan(ctx, 'payments.view');
  const where: string[] = [];
  const params: unknown[] = [];
  const eq = (col: string, v: unknown) => {
    where.push(`${col} = ?`);
    params.push(v);
  };
  if (f.status) eq('p.status', f.status);
  if (f.provider) eq('p.provider_key', f.provider);
  if (f.method) eq('p.method', f.method);
  if (f.currency) eq('p.currency', f.currency);
  if (f.clientId) eq('p.client_id', f.clientId);
  if (f.from) {
    where.push('p.received_at >= ?');
    params.push(`${f.from}T00:00:00.000Z`);
  }
  if (f.to) {
    where.push('p.received_at < ?');
    params.push(`${f.to}T23:59:59.999Z`);
  }
  if (f.q?.trim()) {
    const l = escapeLike(f.q);
    where.push(
      `(p.receipt_number LIKE ? ESCAPE '\\' OR p.reference LIKE ? ESCAPE '\\' OR p.provider_reference LIKE ? ESCAPE '\\'
        OR c.display_name LIKE ? ESCAPE '\\'
        OR EXISTS (SELECT 1 FROM payment_allocations a JOIN invoices i ON i.id = a.invoice_id
                   WHERE a.payment_id = p.id AND i.number LIKE ? ESCAPE '\\'))`,
    );
    params.push(l, l, l, l, l);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = 'FROM payments p JOIN clients c ON c.id = p.client_id';
  const [count, rows, totals] = await ctx.db.batch([
    ctx.db.prepare(`SELECT COUNT(*) AS n ${from} ${w}`).bind(...params),
    ctx.db
      .prepare(
        `SELECT p.id, p.receipt_number, p.provider_key, p.method, p.amount_minor, p.currency, p.received_at, p.status,
           p.reference, p.provider_reference, c.id AS client_id, c.display_name AS client_name,
           (SELECT group_concat(i.number, ', ') FROM payment_allocations a JOIN invoices i ON i.id = a.invoice_id
            WHERE a.payment_id = p.id) AS invoices
         ${from} ${w} ORDER BY p.received_at DESC, p.id DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, PAGE_SIZE, (f.page - 1) * PAGE_SIZE),
    ctx.db
      .prepare(
        `SELECT p.currency, SUM(p.amount_minor) AS received,
           COALESCE(SUM((SELECT SUM(r.amount_minor) FROM refunds r WHERE r.payment_id = p.id AND r.status <> 'failed')), 0) AS refunded
         ${from} ${w} GROUP BY p.currency ORDER BY p.currency`,
      )
      .bind(...params),
  ]);
  const total = ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  return {
    total,
    page: f.page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    totals: (totals?.results ?? []) as { currency: string; received: number; refunded: number }[],
    items: (rows?.results ?? []) as {
      id: string;
      receipt_number: string;
      provider_key: string;
      method: string;
      amount_minor: number;
      currency: string;
      received_at: string;
      status: PaymentRow['status'];
      reference: string | null;
      provider_reference: string | null;
      client_id: string;
      client_name: string;
      invoices: string | null;
    }[],
  };
}

async function refundedSoFar(ctx: RequestContext, paymentId: string): Promise<number> {
  const r = await ctx.db
    .prepare("SELECT COALESCE(SUM(amount_minor), 0) AS n FROM refunds WHERE payment_id = ? AND status <> 'failed'")
    .bind(paymentId)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

/** Credit notes "to be refunded" for this client and currency that still have an unrefunded amount. */
async function refundableCreditNotes(ctx: RequestContext, clientId: string, currency: string) {
  const { results } = await ctx.db
    .prepare(
      `SELECT cn.id, cn.number, cn.total_minor,
         cn.total_minor - COALESCE((SELECT SUM(r.amount_minor) FROM refunds r WHERE r.credit_note_id = cn.id AND r.status <> 'failed'), 0) AS remaining_minor
       FROM credit_notes cn WHERE cn.client_id = ? AND cn.currency = ? AND cn.applied_to = 'refund' AND cn.status = 'issued'
       ORDER BY cn.issued_at`,
    )
    .bind(clientId, currency)
    .all<{ id: string; number: string; total_minor: number; remaining_minor: number }>();
  return results.filter((r) => r.remaining_minor > 0);
}

export async function getPayment(ctx: RequestContext, id: string) {
  assertCan(ctx, 'payments.view');
  const p = await ctx.db.prepare('SELECT * FROM payments WHERE id = ?').bind(id).first<PaymentRow>();
  if (!p) throw notFound();
  const [client, allocations, refunds, attempt, events, account, recorder, credit] = await ctx.db.batch([
    ctx.db.prepare('SELECT id, client_number, display_name, email FROM clients WHERE id = ?').bind(p.client_id),
    ctx.db
      .prepare(
        `SELECT a.amount_minor, a.created_at, i.id AS invoice_id, i.number, i.status, i.balance_minor
         FROM payment_allocations a JOIN invoices i ON i.id = a.invoice_id WHERE a.payment_id = ? ORDER BY a.created_at`,
      )
      .bind(id),
    ctx.db
      .prepare(
        `SELECT r.id, r.amount_minor, r.reason, r.method, r.status, r.provider_reference, r.created_at, u.name AS recorded_by,
           cn.number AS credit_note_number
         FROM refunds r LEFT JOIN users u ON u.id = r.recorded_by LEFT JOIN credit_notes cn ON cn.id = r.credit_note_id
         WHERE r.payment_id = ? ORDER BY r.created_at`,
      )
      .bind(id),
    ctx.db
      .prepare(
        `SELECT id, status, flow, method_code, merchant_reference, provider_reference, failure_reason, provider_status_raw,
           check_count, last_checked_at, created_at, completed_at FROM payment_attempts WHERE id = ?`,
      )
      .bind(p.attempt_id ?? ''),
    ctx.db
      .prepare(
        `SELECT id, event_type, provider_reference, payload_redacted, received_at FROM payment_events
         WHERE attempt_id = ? ORDER BY received_at, id LIMIT 200`,
      )
      .bind(p.attempt_id ?? ''),
    ctx.db.prepare('SELECT label, mode FROM payment_provider_accounts WHERE id = ?').bind(p.account_id ?? ''),
    ctx.db.prepare('SELECT name FROM users WHERE id = ?').bind(p.recorded_by ?? ''),
    ctx.db
      .prepare('SELECT COALESCE(SUM(amount_minor), 0) AS n FROM client_credits WHERE client_id = ? AND currency = ?')
      .bind(p.client_id, p.currency),
  ]);
  const first = <T>(r: D1Result | undefined) => ((r?.results ?? [])[0] ?? null) as T | null;
  const refunded = ((refunds?.results ?? []) as { amount_minor: number; status: string }[])
    .filter((r) => r.status !== 'failed')
    .reduce((s, r) => s + r.amount_minor, 0);
  return {
    payment: p,
    client: first<{ id: string; client_number: string; display_name: string; email: string | null }>(client),
    allocations: (allocations?.results ?? []) as {
      amount_minor: number;
      created_at: string;
      invoice_id: string;
      number: string;
      status: string;
      balance_minor: number;
    }[],
    refunds: (refunds?.results ?? []) as {
      id: string;
      amount_minor: number;
      reason: string;
      method: string;
      status: string;
      provider_reference: string | null;
      created_at: string;
      recorded_by: string | null;
      credit_note_number: string | null;
    }[],
    attempt: first<Record<string, unknown>>(attempt),
    events: (events?.results ?? []) as {
      id: string;
      event_type: string;
      provider_reference: string | null;
      payload_redacted: string | null;
      received_at: string;
    }[],
    account: first<{ label: string; mode: string }>(account),
    recordedBy: first<{ name: string }>(recorder)?.name ?? null,
    refundable: p.amount_minor - refunded,
    refundSources: {
      accountCredit: first<{ n: number }>(credit)?.n ?? 0,
      creditNotes: await refundableCreditNotes(ctx, p.client_id, p.currency),
    },
  };
}

/**
 * Records a refund made outside the system (bank transfer, cash, or in the gateway's merchant dashboard). Guards:
 * refunds never exceed the payment, and the covering credit note or account credit has enough left — all checked
 * inside the batch, so concurrent refunds can't overdraw either.
 */
export async function recordRefund(
  ctx: RequestContext,
  paymentId: string,
  input: RefundInput,
): Promise<{ id: string; status: PaymentRow['status'] }> {
  assertCan(ctx, 'payments.refund');
  const p = await ctx.db.prepare('SELECT * FROM payments WHERE id = ?').bind(paymentId).first<PaymentRow>();
  if (!p) throw notFound();
  if (p.status === 'reversed' || p.status === 'refunded') throw conflict('This payment has nothing left to refund.');
  const before = await refundedSoFar(ctx, paymentId);
  if (input.amountMinor > p.amount_minor - before)
    throw validationError({
      amountMinor: [`At most ${formatMoney(p.amount_minor - before, p.currency)} of this payment can be refunded.`],
    });
  const fromNote = input.source === 'credit_note';
  if (fromNote) {
    const notes = await refundableCreditNotes(ctx, p.client_id, p.currency);
    const note = notes.find((n) => n.id === input.creditNoteId);
    if (!note) throw validationError({ creditNoteId: ['Choose a credit note to be refunded for this client.'] });
    if (input.amountMinor > note.remaining_minor)
      throw validationError({
        amountMinor: [`${note.number} has ${formatMoney(note.remaining_minor, p.currency)} left to refund.`],
      });
  } else {
    const r = await ctx.db
      .prepare('SELECT COALESCE(SUM(amount_minor), 0) AS n FROM client_credits WHERE client_id = ? AND currency = ?')
      .bind(p.client_id, p.currency)
      .first<{ n: number }>();
    if (input.amountMinor > (r?.n ?? 0))
      throw validationError({
        amountMinor: [`The client has ${formatMoney(r?.n ?? 0, p.currency)} account credit to refund from.`],
      });
  }
  const after = before + input.amountMinor;
  const status: PaymentRow['status'] = after >= p.amount_minor ? 'refunded' : 'partially_refunded';
  const id = newId('ref', ctx.now().getTime());
  const now = ctx.now().toISOString();
  const coverSql = fromNote
    ? `(SELECT total_minor FROM credit_notes WHERE id = ? AND client_id = ? AND currency = ? AND applied_to = 'refund' AND status = 'issued')
         - (SELECT COALESCE(SUM(amount_minor), 0) FROM refunds WHERE credit_note_id = ? AND status <> 'failed') >= ?`
    : '(SELECT COALESCE(SUM(amount_minor), 0) FROM client_credits WHERE client_id = ? AND currency = ?) >= ?';
  const coverParams = fromNote
    ? [input.creditNoteId, p.client_id, p.currency, input.creditNoteId, input.amountMinor]
    : [p.client_id, p.currency, input.amountMinor];
  const made = { sql: 'EXISTS (SELECT 1 FROM refunds WHERE id = ?)', params: [id] };
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO refunds (id, payment_id, amount_minor, currency, reason, method, provider_reference, status, credit_note_id,
           recorded_by, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, 'manual', ?, 'completed', ?, ?, ?, ?
         WHERE (SELECT COALESCE(SUM(amount_minor), 0) FROM refunds WHERE payment_id = ? AND status <> 'failed') = ?
           AND ${coverSql}`,
        id,
        paymentId,
        input.amountMinor,
        p.currency,
        input.reason,
        input.reference,
        fromNote ? input.creditNoteId : null,
        ctx.actor.userId,
        now,
        now,
        paymentId,
        before,
        ...coverParams,
      ),
      'refund',
    )
    .addAll(
      fromNote
        ? []
        : [
            stmt(
              ctx.db,
              `INSERT INTO client_credits (id, client_id, currency, amount_minor, source_type, source_id, note, created_by, created_at)
               SELECT ?, ?, ?, ?, 'refund', ?, ?, ?, ? WHERE ${made.sql}`,
              newId('ccr', ctx.now().getTime()),
              p.client_id,
              p.currency,
              -input.amountMinor,
              id,
              `Refunded against ${p.receipt_number}`,
              ctx.actor.userId,
              now,
              ...made.params,
            ),
          ],
    )
    .add(
      stmt(
        ctx.db,
        `UPDATE payments SET status = ?, updated_at = ? WHERE id = ? AND ${made.sql}`,
        status,
        now,
        paymentId,
        ...made.params,
      ),
    )
    .add(
      auditWhen(
        ctx,
        {
          action: 'payment.refund_recorded',
          entityType: 'payment',
          entityId: paymentId,
          after: {
            refundId: id,
            amountMinor: input.amountMinor,
            source: input.source,
            creditNoteId: input.creditNoteId ?? null,
          },
        },
        made.sql,
        ...made.params,
      ),
    )
    .run();
  if (res.changes('refund') !== 1) throw conflict('Refunds or credit changed meanwhile. Reload and try again.');
  return { id, status };
}

/** Callbacks or status results that matched no attempt (docs/06 §3): shown for finance to resolve by hand. */
export async function listUnmatched(ctx: RequestContext, page: number) {
  assertCan(ctx, 'payments.view');
  const [count, rows] = await ctx.db.batch([
    ctx.db.prepare("SELECT COUNT(*) AS n FROM payment_events WHERE event_type = 'unmatched'"),
    ctx.db
      .prepare(
        `SELECT e.id, e.provider_key, e.provider_reference, e.payload_redacted, e.received_at, a.label AS account
         FROM payment_events e LEFT JOIN payment_provider_accounts a ON a.id = e.account_id
         WHERE e.event_type = 'unmatched' ORDER BY e.received_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(PAGE_SIZE, (page - 1) * PAGE_SIZE),
  ]);
  const total = ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    items: (rows?.results ?? []) as {
      id: string;
      provider_key: string;
      provider_reference: string | null;
      payload_redacted: string | null;
      received_at: string;
      account: string | null;
    }[],
  };
}
