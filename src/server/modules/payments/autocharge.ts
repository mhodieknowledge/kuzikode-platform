/**
 * Subscription auto-charge (docs/06 §3b rule 5). With the client's recorded consent and a usable saved card, the
 * morning cron charges the card for each subscription invoice that is due. One attempt per invoice, ever (its
 * idempotency key): a failed charge leaves the invoice open and the client is emailed a pay link (see
 * `markFinished`); the attempt, its consent and the payment are all audited/recorded like any other online payment.
 */
import type { RequestContext } from '../../context';
import { businessDate } from '../../lib/dates';
import { AUTOCHARGE_KEY, initiateInvoicePayment } from './orchestration';

export interface AutoChargeResult {
  started: number;
  failed: number;
}

export async function autoChargeDueInvoices(ctx: RequestContext): Promise<AutoChargeResult> {
  const today = businessDate(ctx.now());
  const { results } = await ctx.db
    .prepare(
      `SELECT i.id AS invoice_id, m.id AS card_id FROM invoices i
         JOIN subscriptions s ON s.id = i.subscription_id
         JOIN saved_payment_methods m ON m.id = s.autocharge_method_id AND m.client_id = i.client_id
       WHERE s.status IN ('active','at_risk') AND m.status = 'active' AND m.autocharge_consent_at IS NOT NULL
         AND (m.token_expiry IS NULL OR m.token_expiry > ?)
         AND i.status IN ('issued','partially_paid','overdue') AND i.balance_minor > 0 AND i.due_date IS NOT NULL AND i.due_date <= ?
         AND NOT EXISTS (SELECT 1 FROM payment_attempts a WHERE a.idempotency_key = i.id || ':' || ?)
       ORDER BY i.due_date, i.id LIMIT 50`,
    )
    .bind(ctx.now().toISOString(), today, AUTOCHARGE_KEY)
    .all<{ invoice_id: string; card_id: string }>();
  const out: AutoChargeResult = { started: 0, failed: 0 };
  for (const r of results) {
    try {
      const start = await initiateInvoicePayment(ctx, r.invoice_id, {
        methodCode: 'card',
        savedCardId: r.card_id,
        idempotencyKey: AUTOCHARGE_KEY,
      });
      if (start.phase === 'failed') out.failed++;
      else out.started++;
    } catch (err) {
      // No attempt was created (e.g. no card route right now): tried again on the next run.
      out.failed++;
      ctx.logger.warn('subscription auto-charge not started', {
        invoiceId: r.invoice_id,
        error: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
      });
    }
  }
  return out;
}
