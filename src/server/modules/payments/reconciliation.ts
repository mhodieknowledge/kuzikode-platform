/**
 * Payment reconciliation (docs/06 §3, P6.4). Callbacks get lost, so we never depend on them:
 *
 * - **Open attempts** (`initiated | pending | partially_paid`) older than 2 minutes whose `next_check_at` is due are checked
 *   with the gateway (server to server) and the verified status is applied. Each check moves `next_check_at` on by the
 *   backoff (2, 5, 10, 30, 60 min, then hourly; see `orchestration.ts`).
 * - **Past their lifetime** (`expires_at`, 72 h from the start): one final check, then `expired` if still open.
 * - **Never started** (`created` for 30 min: the Worker stopped between our insert and the gateway's answer, so there is
 *   no gateway reference to ask about) → `error`.
 * - **Late reversals:** succeeded payments from the last 7 days are re-checked once a day, disputed ones hourly (up to
 *   90 days), for a late `disputed` / `refunded` / `reversed`.
 *
 * Runs from the 5-minute cron (bounded per run); finance can also press "Check now" on an attempt (`checkAttemptNow`).
 */
import type { RequestContext } from '../../context';
import { Batch } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { enforce } from '../../lib/rate-limit';
import { assertCan } from '../../lib/policies';
import { notFound } from '../../lib/errors';
import { formatMoney } from '../../../shared/money';
import { OPEN_ATTEMPT, checkAttempt, checkedStmt, loadAttempt, markFinished, type AttemptRow } from './orchestration';

/** Attempts checked per cron run, per group (keeps one run well inside the Worker's CPU and subrequest limits). */
export const RECONCILE_LIMIT = 25;
const FIRST_CHECK_AFTER_MS = 2 * 60_000;
const NEVER_STARTED_MS = 30 * 60_000;
const SUCCEEDED_RECHECK_DAYS = 7;
const SUCCEEDED_RECHECK_EVERY_MS = 24 * 3_600_000;
const DISPUTED_RECHECK_DAYS = 90;
const DISPUTED_RECHECK_EVERY_MS = 3_600_000;

export interface ReconcileResult {
  checked: number;
  expired: number;
  neverStarted: number;
  recheckedSettled: number;
  failures: number;
}

const isOpen = (status: string) => (OPEN_ATTEMPT as readonly string[]).includes(status);

/**
 * Checks one attempt with the gateway (forced: no 5 s throttle) and makes sure it is not picked again before its next
 * backoff slot, even when the gateway could not be asked (no reference, unusable account) or the answer changed nothing.
 */
async function reconcileOne(ctx: RequestContext, a: AttemptRow): Promise<AttemptRow> {
  const after = await checkAttempt(ctx, a.id, { force: true });
  if (after.check_count === a.check_count && after.last_checked_at === a.last_checked_at) {
    await checkedStmt(ctx, after).run();
    return loadAttempt(ctx, a.id);
  }
  return after;
}

export async function reconcilePayments(ctx: RequestContext): Promise<ReconcileResult> {
  const now = ctx.now();
  const nowIso = now.toISOString();
  const out: ReconcileResult = { checked: 0, expired: 0, neverStarted: 0, recheckedSettled: 0, failures: 0 };

  // 1. Never started: no gateway reference exists, so there is nothing to ask. The client can simply pay again.
  const { results: stale } = await ctx.db
    .prepare(
      `SELECT * FROM payment_attempts WHERE status = 'created' AND created_at <= ?
       ORDER BY created_at LIMIT ?`,
    )
    .bind(new Date(now.getTime() - NEVER_STARTED_MS).toISOString(), RECONCILE_LIMIT)
    .all<AttemptRow>();
  for (const a of stale) {
    try {
      if (a.provider_reference || a.poll_url) continue; // started after all: the open-attempt pass checks it
      const done = await markFinished(ctx, a, 'error', 'The payment did not start with the gateway', {
        type: 'reconcile',
        payload: { outcome: 'never_started' },
      });
      if (done) out.neverStarted++;
    } catch (err) {
      out.failures++;
      ctx.logger.error('reconcile: never-started attempt not closed', { attemptId: a.id, err });
    }
  }

  // 2. Open attempts whose next check is due (oldest due first).
  const { results: due } = await ctx.db
    .prepare(
      `SELECT * FROM payment_attempts
       WHERE status IN ('initiated','pending','partially_paid') AND created_at <= ?
         AND (next_check_at IS NULL OR next_check_at <= ? OR expires_at <= ?)
       ORDER BY COALESCE(next_check_at, created_at) LIMIT ?`,
    )
    .bind(new Date(now.getTime() - FIRST_CHECK_AFTER_MS).toISOString(), nowIso, nowIso, RECONCILE_LIMIT)
    .all<AttemptRow & { expires_at: string | null }>();
  for (const a of due) {
    try {
      const after = await reconcileOne(ctx, a);
      out.checked++;
      const expiresAt = a.expires_at ? Date.parse(a.expires_at) : Number.POSITIVE_INFINITY;
      if (isOpen(after.status) && expiresAt <= now.getTime()) {
        // That was the final check: the gateway still has no outcome, so the attempt is closed as expired.
        const done = await markFinished(
          ctx,
          after,
          'expired',
          'No outcome from the gateway before the payment expired',
          {
            type: 'reconcile',
            payload: { outcome: 'expired', checks: after.check_count },
          },
        );
        if (done) out.expired++;
      }
    } catch (err) {
      out.failures++;
      ctx.logger.error('reconcile: attempt check failed', { attemptId: a.id, err });
    }
  }

  // 3. Settled payments: late disputes, refunds and reversals.
  const { results: settled } = await ctx.db
    .prepare(
      `SELECT * FROM payment_attempts
       WHERE (status = 'succeeded' AND completed_at >= ? AND (last_checked_at IS NULL OR last_checked_at <= ?))
          OR (status = 'disputed' AND completed_at >= ? AND (last_checked_at IS NULL OR last_checked_at <= ?))
       ORDER BY last_checked_at LIMIT ?`,
    )
    .bind(
      new Date(now.getTime() - SUCCEEDED_RECHECK_DAYS * 86_400_000).toISOString(),
      new Date(now.getTime() - SUCCEEDED_RECHECK_EVERY_MS).toISOString(),
      new Date(now.getTime() - DISPUTED_RECHECK_DAYS * 86_400_000).toISOString(),
      new Date(now.getTime() - DISPUTED_RECHECK_EVERY_MS).toISOString(),
      RECONCILE_LIMIT,
    )
    .all<AttemptRow>();
  for (const a of settled) {
    try {
      await reconcileOne(ctx, a);
      out.recheckedSettled++;
    } catch (err) {
      out.failures++;
      ctx.logger.error('reconcile: settled attempt re-check failed', { attemptId: a.id, err });
    }
  }
  return out;
}

// ---------------------------------------------------------------- admin

export interface AdminAttemptView {
  id: string;
  invoiceId: string;
  providerKey: string;
  accountLabel: string | null;
  testMode: boolean;
  methodCode: string | null;
  payerPhoneMasked: string | null;
  amount: string;
  amountMinor: number;
  currency: string;
  status: string;
  failureReason: string | null;
  merchantReference: string;
  providerReference: string | null;
  checkCount: number;
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  createdAt: string;
  completedAt: string | null;
  paymentId: string | null;
}

interface AdminAttemptRow extends AttemptRow {
  next_check_at: string | null;
  completed_at: string | null;
  account_label: string | null;
  account_mode: string | null;
  payment_id: string | null;
}

const ADMIN_ATTEMPT_SQL = `SELECT a.*, acc.label AS account_label, acc.mode AS account_mode, p.id AS payment_id
  FROM payment_attempts a
  LEFT JOIN payment_provider_accounts acc ON acc.id = a.account_id
  LEFT JOIN payments p ON p.attempt_id = a.id`;

function adminView(r: AdminAttemptRow): AdminAttemptView {
  return {
    id: r.id,
    invoiceId: r.invoice_id,
    providerKey: r.provider_key,
    accountLabel: r.account_label,
    testMode: r.account_mode === 'test',
    methodCode: r.method_code,
    payerPhoneMasked: r.payer_phone_masked,
    amount: formatMoney(r.amount_minor, r.currency),
    amountMinor: r.amount_minor,
    currency: r.currency,
    status: r.status,
    failureReason: r.failure_reason,
    merchantReference: r.merchant_reference,
    providerReference: r.provider_reference,
    checkCount: r.check_count,
    lastCheckedAt: r.last_checked_at,
    nextCheckAt: isOpen(r.status) ? r.next_check_at : null,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    paymentId: r.payment_id,
  };
}

/** The invoice's online payment attempts, newest first (finance view; no gateway URLs or instructions). */
export async function listInvoiceAttempts(ctx: RequestContext, invoiceId: string): Promise<AdminAttemptView[]> {
  assertCan(ctx, 'payments.view');
  const { results } = await ctx.db
    .prepare(`${ADMIN_ATTEMPT_SQL} WHERE a.invoice_id = ? ORDER BY a.created_at DESC, a.id DESC LIMIT 20`)
    .bind(invoiceId)
    .all<AdminAttemptRow>();
  return results.map(adminView);
}

async function adminAttempt(ctx: RequestContext, id: string): Promise<AdminAttemptView> {
  const r = await ctx.db.prepare(`${ADMIN_ATTEMPT_SQL} WHERE a.id = ?`).bind(id).first<AdminAttemptRow>();
  if (!r) throw notFound();
  return adminView(r);
}

/**
 * "Check now" (finance): asks the gateway at once, whatever the backoff says, and applies the verified result. Also
 * works on attempts we had given up on (a late success is money taken). Audited; 30 checks per user per 10 minutes.
 */
export async function checkAttemptNow(ctx: RequestContext, attemptId: string): Promise<AdminAttemptView> {
  assertCan(ctx, 'payments.view');
  const before = await loadAttempt(ctx, attemptId);
  await enforce(ctx, { key: `pay-check:user:${ctx.actor.userId ?? ctx.ip}`, limit: 30, windowSeconds: 600 });
  const after = await reconcileOne(ctx, before);
  await new Batch(ctx.db)
    .add(
      auditStmt(ctx, {
        action: 'payment.attempt_checked',
        entityType: 'payment_attempt',
        entityId: before.id,
        before: { status: before.status },
        after: { status: after.status },
      }),
    )
    .run();
  return adminAttempt(ctx, attemptId);
}
