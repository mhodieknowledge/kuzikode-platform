/**
 * Online payment orchestration (docs/06 §3): payment options, initiate (idempotent, reuses an open attempt), gateway
 * callbacks (a claim, always confirmed with a status check), status checks, and applying a verified status through the
 * attempt state machine. Gateway-independent: everything goes through the PaymentProvider interface and the router.
 *
 *   created → initiated → pending ─┬→ succeeded ─┬→ disputed → (succeeded | reversed)
 *                                  │             ├→ refunded
 *                                  │             └→ reversed
 *                                  ├→ partially_paid (non-terminal; keep reconciling)
 *                                  └→ failed | cancelled | expired | error
 */
import {
  ProviderError,
  type InboundCallback,
  type InitiateResult,
  type NormalizedStatus,
  type StatusResult,
} from '@kuzikode/payments';
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { sha256Hex } from '../../lib/crypto';
import { conflict, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { paymentReturnUrl } from '../../lib/public-links';
import { formatMoney } from '../../../shared/money';
import { OPEN_INVOICE_STATUSES, type InvoiceStatus } from '../../../shared/invoices';
import { normalizeZimPhone } from '../../../shared/payment-methods';
import { applyIncomingPayment, reverseIncomingPayment } from '../invoices/service';
import { notifyStaffWithPermission } from '../notifications';
import { attemptOutcome, type AttemptPhase } from './portal';
import { accountConfig, getAccount, paymentMethodOptions, resolveRoute } from './router';

/** Attempts still waiting for an outcome (reconciliation keeps checking these). */
export const OPEN_ATTEMPT = ['created', 'initiated', 'pending', 'partially_paid'] as const;
const OPEN_ATTEMPT_SQL = `('created','initiated','pending','partially_paid')`;
/** A verified success also lands on an attempt we had given up on: the money was taken, so it is recorded. */
const SUCCEEDABLE_SQL = `('created','initiated','pending','partially_paid','failed','cancelled','expired','error')`;
const REUSE_MINUTES = 30;
const ATTEMPT_LIFETIME_HOURS = 72;
/** Reconciliation backoff by check count (minutes): 2, 5, 10, 30, 60, then hourly. */
const BACKOFF_MINUTES = [2, 5, 10, 30, 60];

export interface AttemptRow {
  id: string;
  invoice_id: string;
  client_id: string;
  provider_key: string;
  account_id: string;
  flow: 'redirect' | 'express';
  method_code: string | null;
  payer_phone_masked: string | null;
  amount_minor: number;
  currency: string;
  status: string;
  merchant_reference: string;
  provider_reference: string | null;
  redirect_url: string | null;
  poll_url: string | null;
  instructions: string | null;
  failure_reason: string | null;
  idempotency_key: string;
  check_count: number;
  last_checked_at: string | null;
  created_at: string;
}

interface StoredInstructions {
  text?: string;
  authorizationCode?: string;
  authorizationExpiresAt?: string;
  /** Server-only: where the OTP goes. Never sent to the browser. */
  otp?: { otpReference: string; submitUrl: string };
}

/** What the browser gets after starting a payment or checking one (no gateway internals). */
export interface AttemptStart {
  attemptId: string;
  phase: AttemptPhase;
  message: string;
  flow: 'redirect' | 'express';
  methodCode: string | null;
  /** Card entry on the gateway's secure page; only while waiting. */
  redirectUrl: string | null;
  instructions: {
    text: string | null;
    authorizationCode: string | null;
    authorizationExpiresAt: string | null;
    otpRequired: boolean;
  } | null;
  testMode: boolean;
}

interface InvoiceForPay {
  id: string;
  number: string | null;
  client_id: string;
  currency: string;
  status: InvoiceStatus;
  balance_minor: number;
  client_snapshot: string | null;
}

async function loadInvoice(ctx: RequestContext, id: string): Promise<InvoiceForPay> {
  const inv = await ctx.db
    .prepare(
      'SELECT id, number, client_id, currency, status, balance_minor, client_snapshot FROM invoices WHERE id = ?',
    )
    .bind(id)
    .first<InvoiceForPay>();
  if (!inv || inv.status === 'draft') throw notFound();
  return inv;
}

const payable = (inv: InvoiceForPay) => OPEN_INVOICE_STATUSES.includes(inv.status) && inv.balance_minor > 0;

export async function loadAttempt(ctx: RequestContext, id: string): Promise<AttemptRow> {
  const a = await ctx.db.prepare('SELECT * FROM payment_attempts WHERE id = ?').bind(id).first<AttemptRow>();
  if (!a) throw notFound();
  return a;
}

function parseInstructions(s: string | null): StoredInstructions {
  if (!s) return {};
  try {
    return JSON.parse(s) as StoredInstructions;
  } catch {
    return {};
  }
}

async function isTestAccount(ctx: RequestContext, accountId: string) {
  return (await getAccount(ctx, accountId))?.mode !== 'live';
}

async function startView(ctx: RequestContext, a: AttemptRow): Promise<AttemptStart> {
  const o = attemptOutcome(a.status);
  const ins = parseInstructions(a.instructions);
  const waiting = o.phase === 'waiting';
  return {
    attemptId: a.id,
    ...o,
    flow: a.flow,
    methodCode: a.method_code,
    redirectUrl: waiting && a.flow === 'redirect' ? a.redirect_url : null,
    instructions:
      waiting && a.flow === 'express'
        ? {
            text: ins.text ?? null,
            authorizationCode: ins.authorizationCode ?? null,
            authorizationExpiresAt: ins.authorizationExpiresAt ?? null,
            otpRequired: !!ins.otp,
          }
        : null,
    testMode: await isTestAccount(ctx, a.account_id),
  };
}

/** A safe sentence for a failed start (the gateway's own message stays in the attempt for finance). */
function startFailureMessage(err: unknown): string {
  if (err instanceof ProviderError && err.code === 'declined')
    return 'The payment was declined. Nothing was taken from your account. Check your balance or try another method.';
  if (err instanceof ProviderError && err.code === 'invalid_request')
    return 'The payment could not be started with those details. Check the phone number and try again.';
  return 'We could not reach the payment provider. Nothing was taken from your account. Please try again shortly.';
}

// ---------------------------------------------------------------- options

export interface PaymentOptions {
  invoiceId: string;
  invoiceNumber: string | null;
  currency: string;
  amountDueMinor: number;
  payable: boolean;
  testMode: boolean;
  methods: { code: string; name: string; flow: 'redirect' | 'express'; needs: string[] }[];
}

/** The methods a customer can use for this invoice now (empty → no "Pay now"; admins are alerted once a day). */
export async function invoicePaymentOptions(ctx: RequestContext, invoiceId: string): Promise<PaymentOptions> {
  const inv = await loadInvoice(ctx, invoiceId);
  const open = payable(inv);
  const methods = open ? await paymentMethodOptions(ctx, { currency: inv.currency }) : [];
  if (open && !methods.length) {
    await notifyStaffWithPermission(ctx, 'payments.view', {
      type: 'payment.failed',
      title: `Online payment is unavailable for ${inv.currency} invoices: no payment route or credentials`,
      link: '/admin/payments',
      entityType: 'invoice',
      entityId: inv.id,
      dedupeKey: `no_route:${inv.currency}:${ctx.now().toISOString().slice(0, 10)}`,
    }).run();
  }
  return {
    invoiceId: inv.id,
    invoiceNumber: inv.number,
    currency: inv.currency,
    amountDueMinor: open ? inv.balance_minor : 0,
    payable: open && methods.length > 0,
    testMode: methods.some((m) => m.testMode),
    methods: methods.map((m) => ({ code: m.code, name: m.name, flow: m.flow, needs: m.needs ?? [] })),
  };
}

// ---------------------------------------------------------------- initiate

export interface InitiateRequest {
  methodCode: string;
  phone?: string | undefined;
  /** From the browser, one per click (a double-tap reuses it). */
  idempotencyKey: string;
}

/**
 * Starts (or returns the existing) payment attempt for the invoice's outstanding balance. The caller has already
 * checked the customer may pay this invoice (portal scope or the public link).
 */
export async function initiateInvoicePayment(
  ctx: RequestContext,
  invoiceId: string,
  req: InitiateRequest,
): Promise<AttemptStart> {
  const key = `${invoiceId}:${req.idempotencyKey}`;
  const existing = await ctx.db
    .prepare('SELECT * FROM payment_attempts WHERE idempotency_key = ?')
    .bind(key)
    .first<AttemptRow>();
  if (existing) return startView(ctx, existing);

  const inv = await loadInvoice(ctx, invoiceId);
  if (!payable(inv)) throw conflict('This invoice has nothing left to pay.');
  const route = await resolveRoute(ctx, { currency: inv.currency, methodCode: req.methodCode });
  const method = route?.methods.find((m) => m.code === req.methodCode);
  if (!route || !method) throw validationError({ methodCode: ['This payment method is not available right now.'] });
  const needsPhone = method.needs?.includes('phone') ?? false;
  const phone = needsPhone ? normalizeZimPhone(req.phone ?? '') : null;
  if (needsPhone && !phone) throw validationError({ phone: ['Enter a Zimbabwean mobile number, like 0771 234 567.'] });

  // A recent open attempt for the same thing is reused (no new prompt, no second gateway transaction).
  if (!needsPhone) {
    const since = new Date(ctx.now().getTime() - REUSE_MINUTES * 60_000).toISOString();
    const reuse = await ctx.db
      .prepare(
        `SELECT * FROM payment_attempts WHERE invoice_id = ? AND amount_minor = ? AND account_id = ? AND method_code = ?
           AND status IN ('initiated','pending') AND created_at > ? ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(invoiceId, inv.balance_minor, route.account.id, method.code, since)
      .first<AttemptRow>();
    if (reuse) return startView(ctx, reuse);
  }

  const id = newId('att', ctx.now().getTime());
  const now = ctx.now();
  const masked = phone ? `${phone.slice(0, 3)}****${phone.slice(-3)}` : null;
  try {
    await new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          `INSERT INTO payment_attempts (id, invoice_id, client_id, initiated_by_user_id, provider_key, account_id, flow, method_code,
             payer_phone_masked, amount_minor, currency, status, merchant_reference, idempotency_key, expires_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', ?, ?, ?, ?, ?)`,
          id,
          invoiceId,
          inv.client_id,
          ctx.actor.userId,
          route.provider.key,
          route.account.id,
          method.flow,
          method.code,
          masked,
          inv.balance_minor,
          inv.currency,
          id,
          key,
          new Date(now.getTime() + ATTEMPT_LIFETIME_HOURS * 3_600_000).toISOString(),
          now.toISOString(),
          now.toISOString(),
        ),
      )
      .add(
        eventStmt(ctx, {
          attemptId: id,
          accountId: route.account.id,
          providerKey: route.provider.key,
          type: 'initiate_request',
          dedupe: `init:${id}`,
          payload: { method: method.code, amountMinor: inv.balance_minor, currency: inv.currency },
        }),
      )
      .run();
  } catch (err) {
    // A concurrent request with the same key won the insert: return its attempt.
    const again = await ctx.db
      .prepare('SELECT * FROM payment_attempts WHERE idempotency_key = ?')
      .bind(key)
      .first<AttemptRow>();
    if (again) return startView(ctx, again);
    throw err;
  }

  const client = JSON.parse(inv.client_snapshot ?? '{}') as { name?: string; email?: string | null };
  let result: InitiateResult;
  try {
    result = await route.provider.initiatePayment(route.config, {
      merchantReference: id,
      amountMinor: inv.balance_minor,
      currency: inv.currency,
      description: `Invoice ${inv.number ?? invoiceId}`,
      returnUrl: await paymentReturnUrl(ctx, id),
      resultUrl: `${ctx.config.siteOrigin}/api/payments/callbacks/${encodeURIComponent(route.provider.key)}/${encodeURIComponent(route.account.id)}`,
      flow: method.flow,
      methodCode: method.code,
      ...(phone ? { phone } : {}),
      customer: {
        ...(client.email ? { email: client.email } : {}),
        ...(client.name ? { name: client.name } : {}),
        ...(phone ? { phone } : {}),
      },
    });
  } catch (err) {
    const declined = err instanceof ProviderError && err.code === 'declined';
    const reason = err instanceof ProviderError ? err.message : 'Unexpected error starting the payment';
    if (!(err instanceof ProviderError)) ctx.logger.error('payment initiate failed', { attemptId: id, err });
    await markFinished(ctx, await loadAttempt(ctx, id), declined ? 'failed' : 'error', reason, {
      type: 'error',
      payload: { code: err instanceof ProviderError ? err.code : 'unexpected', message: reason },
    });
    return { ...(await startView(ctx, await loadAttempt(ctx, id))), message: startFailureMessage(err) };
  }

  const instructions: StoredInstructions =
    result.kind === 'express_pending'
      ? {
          ...(result.customerInstructions ? { text: result.customerInstructions } : {}),
          ...(result.authorizationCode ? { authorizationCode: result.authorizationCode } : {}),
          ...(result.authorizationExpiresAt ? { authorizationExpiresAt: result.authorizationExpiresAt } : {}),
          ...(result.otpRequired ? { otp: result.otpRequired } : {}),
        }
      : {};
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE payment_attempts SET status = 'initiated', provider_reference = ?, redirect_url = ?, poll_url = ?, instructions = ?,
           next_check_at = ?, updated_at = ? WHERE id = ? AND status = 'created'`,
        result.providerReference ?? null,
        result.kind === 'redirect' ? result.redirectUrl : null,
        result.pollUrl ?? null,
        JSON.stringify(instructions),
        new Date(ctx.now().getTime() + BACKOFF_MINUTES[0]! * 60_000).toISOString(),
        ctx.now().toISOString(),
        id,
      ),
    )
    .add(
      eventStmt(ctx, {
        attemptId: id,
        accountId: route.account.id,
        providerKey: route.provider.key,
        type: 'initiate_response',
        dedupe: `init_res:${id}`,
        providerReference: result.providerReference ?? null,
        payload: result.raw,
      }),
    )
    .run();
  ctx.logger.info('payment initiated', {
    attemptId: id,
    provider: route.provider.key,
    account: route.account.id,
    flow: method.flow,
  });
  return startView(ctx, await loadAttempt(ctx, id));
}

/** The view of an attempt for the browser that started it (status polling / after an OTP). */
export async function attemptStart(ctx: RequestContext, attemptId: string): Promise<AttemptStart> {
  return startView(ctx, await loadAttempt(ctx, attemptId));
}

// ---------------------------------------------------------------- events

type EventType =
  | 'initiate_request'
  | 'initiate_response'
  | 'callback_received'
  | 'callback_rejected'
  | 'status_check'
  | 'status_change'
  | 'reconcile'
  | 'error'
  | 'unmatched';

function eventStmt(
  ctx: RequestContext,
  e: {
    attemptId: string | null;
    accountId: string | null;
    providerKey: string;
    type: EventType;
    dedupe: string;
    providerReference?: string | null;
    payload: Record<string, unknown>;
  },
) {
  return stmt(
    ctx.db,
    `INSERT OR IGNORE INTO payment_events (id, provider_key, account_id, attempt_id, event_type, provider_reference, dedupe_hash,
       payload_redacted, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId('pev', ctx.now().getTime()),
    e.providerKey,
    e.accountId,
    e.attemptId,
    e.type,
    e.providerReference ?? null,
    e.dedupe,
    JSON.stringify(e.payload),
    ctx.now().toISOString(),
  );
}

// ---------------------------------------------------------------- callbacks

/**
 * An inbound gateway callback (`POST /api/payments/callbacks/:provider/:accountId`). Recorded, authenticated, matched to
 * an attempt within that account, then CONFIRMED with a status check; only that result is applied. Never throws for bad
 * input: the route always answers 200 so gateways don't retry forever.
 */
export async function handleCallback(
  ctx: RequestContext,
  providerKey: string,
  accountId: string,
  req: InboundCallback,
): Promise<'applied' | 'rejected' | 'unmatched' | 'ignored'> {
  const account = await getAccount(ctx, accountId);
  const built = account && account.providerKey === providerKey ? accountConfig(ctx, account) : null;
  if (!built) {
    ctx.logger.warn('payment callback for an unusable account', { providerKey, accountId });
    return 'ignored';
  }
  const parsed = await built.provider.parseCallback(built.config, req);
  const dedupe = await sha256Hex(`${providerKey}|${accountId}|${req.body}`);
  const claimed = parsed.claimed;
  if (!parsed.authentic) {
    await eventStmt(ctx, {
      attemptId: null,
      accountId,
      providerKey,
      type: 'callback_rejected',
      dedupe: `rej:${dedupe}`,
      providerReference: claimed.providerReference ?? null,
      payload: claimed.raw,
    }).run();
    ctx.logger.warn('payment callback failed authentication', { providerKey, accountId });
    await notifyStaffWithPermission(ctx, 'payments.view', {
      type: 'payment.failed',
      title: `A payment notification for ${account!.label} failed verification and was ignored`,
      link: '/admin/payments',
      entityType: 'payment_account',
      entityId: accountId,
      dedupeKey: `callback_rejected:${accountId}:${ctx.now().toISOString().slice(0, 13)}`,
    }).run();
    return 'rejected';
  }
  const attempt = await findAttempt(ctx, accountId, claimed);
  if (!attempt) {
    await eventStmt(ctx, {
      attemptId: null,
      accountId,
      providerKey,
      type: 'unmatched',
      dedupe: `unm:${dedupe}`,
      providerReference: claimed.providerReference ?? null,
      payload: claimed.raw,
    }).run();
    ctx.logger.warn('payment callback matched no attempt', { providerKey, accountId });
    return 'unmatched';
  }
  await eventStmt(ctx, {
    attemptId: attempt.id,
    accountId,
    providerKey,
    type: 'callback_received',
    dedupe: `cb:${dedupe}`,
    providerReference: claimed.providerReference ?? null,
    payload: { ...claimed.raw, claimedStatus: claimed.status },
  }).run();
  await checkAttempt(ctx, attempt.id, { force: true });
  return 'applied';
}

async function findAttempt(ctx: RequestContext, accountId: string, claimed: StatusResult): Promise<AttemptRow | null> {
  if (claimed.providerReference) {
    const a = await ctx.db
      .prepare('SELECT * FROM payment_attempts WHERE account_id = ? AND provider_reference = ?')
      .bind(accountId, claimed.providerReference)
      .first<AttemptRow>();
    if (a) return a;
  }
  if (claimed.merchantReference) {
    return ctx.db
      .prepare('SELECT * FROM payment_attempts WHERE account_id = ? AND merchant_reference = ?')
      .bind(accountId, claimed.merchantReference)
      .first<AttemptRow>();
  }
  return null;
}

// ---------------------------------------------------------------- status checks

/**
 * Asks the gateway (server to server) for the attempt's status and applies it. Without `force`, a gateway is asked at
 * most once per 5 s per attempt (browser polling). Returns the attempt as it is afterwards.
 */
export async function checkAttempt(
  ctx: RequestContext,
  attemptId: string,
  opts: { force?: boolean } = {},
): Promise<AttemptRow> {
  const a = await loadAttempt(ctx, attemptId);
  // Forced checks (a callback, an admin re-check) also look at attempts we had given up on: a late success is money taken.
  const finished = ['failed', 'cancelled', 'expired', 'error'].includes(a.status);
  const checkable =
    (OPEN_ATTEMPT as readonly string[]).includes(a.status) ||
    a.status === 'succeeded' ||
    a.status === 'disputed' ||
    (finished && !!opts.force);
  if (!checkable || (!a.provider_reference && !a.poll_url)) return a;
  if (!opts.force && a.last_checked_at && ctx.now().getTime() - Date.parse(a.last_checked_at) < 5000) return a;
  const account = await getAccount(ctx, a.account_id);
  const built = account ? accountConfig(ctx, account) : null;
  if (!built) {
    ctx.logger.warn('payment attempt cannot be checked: account unusable', { attemptId, account: a.account_id });
    return a;
  }
  let result: StatusResult;
  try {
    result = await built.provider.checkPaymentStatus(built.config, {
      ...(a.poll_url ? { pollUrl: a.poll_url } : {}),
      ...(a.provider_reference ? { providerReference: a.provider_reference } : {}),
      merchantReference: a.merchant_reference,
    });
  } catch (err) {
    const message = err instanceof ProviderError ? err.message : 'Unexpected error checking the payment';
    if (!(err instanceof ProviderError)) ctx.logger.error('payment status check failed', { attemptId, err });
    await new Batch(ctx.db)
      .add(checkedStmt(ctx, a))
      .add(
        eventStmt(ctx, {
          attemptId: a.id,
          accountId: a.account_id,
          providerKey: a.provider_key,
          type: 'error',
          dedupe: `chkerr:${a.id}:${a.check_count}:${ctx.now().getTime()}`,
          payload: { message },
        }),
      )
      .run();
    return loadAttempt(ctx, attemptId);
  }
  await eventStmt(ctx, {
    attemptId: a.id,
    accountId: a.account_id,
    providerKey: a.provider_key,
    type: 'status_check',
    dedupe: `chk:${a.id}:${newId('pev', ctx.now().getTime())}`,
    providerReference: result.providerReference ?? null,
    payload: { ...result.raw, normalized: result.status, providerStatus: result.providerStatus },
  }).run();
  await applyStatus(ctx, a, result);
  return loadAttempt(ctx, attemptId);
}

function nextCheckAt(ctx: RequestContext, checkCount: number): string {
  const minutes = BACKOFF_MINUTES[Math.min(checkCount, BACKOFF_MINUTES.length - 1)]!;
  return new Date(ctx.now().getTime() + minutes * 60_000).toISOString();
}

/** Records that we checked (count, time, next check) without changing the status. */
function checkedStmt(ctx: RequestContext, a: AttemptRow, providerStatus?: string) {
  return stmt(
    ctx.db,
    `UPDATE payment_attempts SET check_count = check_count + 1, last_checked_at = ?, next_check_at = ?,
       provider_status_raw = COALESCE(?, provider_status_raw), updated_at = ? WHERE id = ?`,
    ctx.now().toISOString(),
    nextCheckAt(ctx, a.check_count + 1),
    providerStatus ?? null,
    ctx.now().toISOString(),
    a.id,
  );
}

async function markFinished(
  ctx: RequestContext,
  a: AttemptRow,
  status: 'failed' | 'cancelled' | 'expired' | 'error',
  reason: string,
  event?: { type: EventType; payload: Record<string, unknown> },
): Promise<boolean> {
  if (!(OPEN_ATTEMPT as readonly string[]).includes(a.status)) return false;
  const now = ctx.now().toISOString();
  const inv = await ctx.db
    .prepare('SELECT number FROM invoices WHERE id = ?')
    .bind(a.invoice_id)
    .first<{ number: string | null }>();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE payment_attempts SET status = ?, failure_reason = ?, completed_at = ?, last_checked_at = ?, next_check_at = NULL,
           updated_at = ? WHERE id = ? AND status IN ${OPEN_ATTEMPT_SQL}`,
        status,
        reason.slice(0, 500),
        now,
        now,
        now,
        a.id,
      ),
      'attempt',
    )
    .addAll(
      event
        ? [
            eventStmt(ctx, {
              attemptId: a.id,
              accountId: a.account_id,
              providerKey: a.provider_key,
              type: event.type,
              dedupe: `fin:${a.id}:${status}`,
              payload: event.payload,
            }),
          ]
        : [],
    )
    // payment.failed for finance, in the same batch (deduplicated per attempt).
    .add(
      notifyStaffWithPermission(ctx, 'payments.view', {
        type: 'payment.failed',
        title: `Online payment ${status} for ${inv?.number ?? 'an invoice'} (${formatMoney(a.amount_minor, a.currency)})`,
        link: `/admin/invoices/${a.invoice_id}`,
        entityType: 'payment_attempt',
        entityId: a.id,
        dedupeKey: `payment_failed:${a.id}`,
      }),
    )
    .run();
  return res.changes('attempt') === 1;
}

async function alertFinance(ctx: RequestContext, a: AttemptRow, title: string, key: string) {
  await notifyStaffWithPermission(ctx, 'payments.view', {
    type: 'payment.failed',
    title,
    link: `/admin/invoices/${a.invoice_id}`,
    entityType: 'payment_attempt',
    entityId: a.id,
    dedupeKey: `${key}:${a.id}`,
  }).run();
}

/** Applies a status the gateway confirmed, following the attempt state machine (see the file header). */
export async function applyStatus(ctx: RequestContext, a: AttemptRow, r: StatusResult): Promise<void> {
  const now = ctx.now().toISOString();
  if (r.merchantReference && r.merchantReference !== a.merchant_reference) {
    await markFinished(ctx, a, 'error', 'Gateway returned another payment reference');
    await alertFinance(ctx, a, 'Payment requires review: the gateway reported a different reference', 'review');
    return;
  }
  const status: NormalizedStatus = r.status;
  switch (status) {
    case 'pending': {
      await new Batch(ctx.db)
        .add(checkedStmt(ctx, a, r.providerStatus))
        .add(
          stmt(
            ctx.db,
            `UPDATE payment_attempts SET status = 'pending', provider_reference = COALESCE(provider_reference, ?)
             WHERE id = ? AND status IN ('created','initiated')`,
            r.providerReference ?? null,
            a.id,
          ),
        )
        .run();
      return;
    }
    case 'succeeded': {
      if (r.amountMinor !== a.amount_minor || (r.currency && r.currency !== a.currency)) {
        await markFinished(ctx, a, 'error', 'Amount or currency differs from the attempt');
        await alertFinance(
          ctx,
          a,
          `Payment requires review: the gateway reported ${r.amountMinor === undefined ? 'no amount' : formatMoney(r.amountMinor, r.currency ?? a.currency)} for an attempt of ${formatMoney(a.amount_minor, a.currency)}`,
          'review',
        );
        return;
      }
      const claimed = {
        sql: "EXISTS (SELECT 1 FROM payment_attempts WHERE id = ? AND status = 'succeeded')",
        params: [a.id],
      };
      try {
        await applyIncomingPayment(ctx, a.invoice_id, {
          amountMinor: a.amount_minor,
          method: a.method_code ?? a.provider_key,
          providerKey: a.provider_key,
          accountId: a.account_id,
          attemptId: a.id,
          providerReference: r.providerReference ?? a.provider_reference,
          reference: r.providerReference ?? a.provider_reference,
          notes: null,
          receivedAt: now,
          recordedBy: null,
          auditAction: 'payment.received_online',
          requireOpen: false,
          before: (guard) => [
            stmt(
              ctx.db,
              `UPDATE payment_attempts SET status = 'succeeded', completed_at = ?, last_checked_at = ?, next_check_at = NULL,
                 provider_status_raw = ?, provider_reference = COALESCE(provider_reference, ?), failure_reason = NULL, updated_at = ?
               WHERE id = ? AND status IN ${SUCCEEDABLE_SQL} AND ${guard.sql}`,
              now,
              now,
              r.providerStatus,
              r.providerReference ?? null,
              now,
              a.id,
              ...guard.params,
            ),
          ],
          onlyIf: claimed,
        });
      } catch (err) {
        // payments.attempt_id is UNIQUE: a concurrent apply recorded it first, and this batch rolled back entirely.
        if (err instanceof Error && /UNIQUE/i.test(err.message)) return;
        throw err;
      }
      return;
    }
    case 'partially_paid': {
      const res = await new Batch(ctx.db)
        .add(checkedStmt(ctx, a, r.providerStatus))
        .add(
          stmt(
            ctx.db,
            `UPDATE payment_attempts SET status = 'partially_paid' WHERE id = ? AND status IN ('created','initiated','pending')`,
            a.id,
          ),
          'attempt',
        )
        .run();
      if (res.changes('attempt') === 1)
        await alertFinance(
          ctx,
          a,
          `Payment requires review: only part of ${formatMoney(a.amount_minor, a.currency)} was paid online`,
          'partial',
        );
      return;
    }
    case 'failed':
    case 'cancelled':
    case 'expired':
    case 'error': {
      if (!(OPEN_ATTEMPT as readonly string[]).includes(a.status)) {
        await checkedStmt(ctx, a, r.providerStatus).run();
        return;
      }
      await markFinished(ctx, a, status, r.failureReason ?? `Gateway status: ${r.providerStatus}`);
      return;
    }
    case 'disputed': {
      const res = await new Batch(ctx.db)
        .add(checkedStmt(ctx, a, r.providerStatus))
        .add(
          stmt(ctx.db, `UPDATE payment_attempts SET status = 'disputed' WHERE id = ? AND status = 'succeeded'`, a.id),
          'attempt',
        )
        .run();
      if (res.changes('attempt') === 1)
        await alertFinance(
          ctx,
          a,
          `Payment disputed for an online payment of ${formatMoney(a.amount_minor, a.currency)}`,
          'disputed',
        );
      return;
    }
    case 'refunded':
    case 'reversed': {
      const p = await ctx.db
        .prepare("SELECT id FROM payments WHERE attempt_id = ? AND status = 'completed'")
        .bind(a.id)
        .first<{ id: string }>();
      if (!p || (a.status !== 'succeeded' && a.status !== 'disputed')) {
        await checkedStmt(ctx, a, r.providerStatus).run();
        return;
      }
      const done = await reverseIncomingPayment(ctx, p.id, {
        status,
        reason: `The gateway reports this payment ${status}.`,
        before: (guard) => [
          stmt(
            ctx.db,
            `UPDATE payment_attempts SET status = ?, last_checked_at = ?, provider_status_raw = ?, updated_at = ?
             WHERE id = ? AND status IN ('succeeded','disputed') AND ${guard.sql}`,
            status,
            now,
            r.providerStatus,
            now,
            a.id,
            ...guard.params,
          ),
        ],
      });
      if (done)
        await alertFinance(
          ctx,
          a,
          `Online payment ${status} by the gateway: ${formatMoney(done.restoredMinor, a.currency)} is owed again`,
          status,
        );
      return;
    }
  }
}

// ---------------------------------------------------------------- OTP (O'mari)

export async function submitAttemptOtp(ctx: RequestContext, attemptId: string, otp: string): Promise<AttemptStart> {
  const a = await loadAttempt(ctx, attemptId);
  const ins = parseInstructions(a.instructions);
  if (!ins.otp || !(OPEN_ATTEMPT as readonly string[]).includes(a.status))
    throw conflict('This payment is not waiting for a code.');
  const account = await getAccount(ctx, a.account_id);
  const built = account ? accountConfig(ctx, account) : null;
  if (!built || !built.provider.submitOtp) throw conflict('This payment is not waiting for a code.');
  let result: StatusResult;
  try {
    result = await built.provider.submitOtp(built.config, { submitUrl: ins.otp.submitUrl, otp });
  } catch (err) {
    // A wrong code can be tried again (Paynow cancels after 5 wrong codes; the status check then shows it).
    if (err instanceof ProviderError && (err.code === 'declined' || err.code === 'invalid_request'))
      throw validationError({ otp: ['That code was not accepted. Check the SMS and try again.'] });
    if (err instanceof ProviderError) throw conflict('The code could not be checked. Start the payment again.');
    throw err;
  }
  const { otp: _used, ...rest } = ins;
  await stmt(ctx.db, 'UPDATE payment_attempts SET instructions = ? WHERE id = ?', JSON.stringify(rest), a.id).run();
  await eventStmt(ctx, {
    attemptId: a.id,
    accountId: a.account_id,
    providerKey: a.provider_key,
    type: 'status_change',
    dedupe: `otp:${a.id}`,
    payload: { ...result.raw, normalized: result.status },
  }).run();
  // The OTP answer is the gateway's word too; confirm it like any other status before applying a success.
  if (result.status === 'succeeded') await checkAttempt(ctx, a.id, { force: true });
  else await applyStatus(ctx, await loadAttempt(ctx, a.id), result);
  return attemptStart(ctx, a.id);
}
