/**
 * P6.4 reconciliation (docs/06 §3): a missed callback is applied by the cron, once; backoff between checks; expiry after
 * the final check; attempts that never started; late reversals of settled payments; the admin "Check now" button.
 */
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { CRON_FREQUENT, SCHEDULE } from '../../src/server/jobs/scheduled';
import { reconcilePayments } from '../../src/server/modules/payments';
import { api, login, type Session } from '../helpers/api';
import { createPortalUser, createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

const u = () => Math.random().toString(36).slice(2, 10);
const A = (s: Session, path: string, body?: unknown) =>
  api(`/api/v1/admin${path}`, { cookie: s.cookie, csrf: s.csrf, ...(body === undefined ? {} : { body }) });

async function staff(roles = ['admin']) {
  const x = await createStaff(roles);
  return login('admin', x.email, x.password);
}

async function invoiceFor(s: Session, amount = 30_000) {
  const c = await A(s, '/clients', {
    type: 'business',
    displayName: `Reconcile ${u()}`,
    email: `r-${u()}@example.com`,
    defaultCurrency: 'USD',
    paymentTermsDays: 14,
    tags: [],
  });
  const clientId = c.body.data.id as string;
  const d = await A(s, '/invoices', {
    clientId,
    currency: 'USD',
    items: [{ description: 'Hosting', quantity: '1', unitPriceMinor: amount, discountType: 'none', discountValue: 0 }],
  });
  const invoiceId = d.body.data.id as string;
  expect((await A(s, `/invoices/${invoiceId}/issue`, { send: false })).status).toBe(200);
  const user = await createPortalUser([clientId], { role: 'billing' });
  const portal = await login('portal', user.email, user.password);
  return { clientId, invoiceId, portal };
}

async function startPayment(p: Session, invoiceId: string, body: Record<string, unknown> = { methodCode: 'card' }) {
  const r = await api(`/api/v1/portal/invoices/${invoiceId}/pay`, {
    cookie: p.cookie,
    csrf: p.csrf,
    body,
    headers: { 'idempotency-key': `k_${u()}` },
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.data.attemptId as string;
}

const attemptRow = (id: string) =>
  env.DB.prepare('SELECT * FROM payment_attempts WHERE id = ?').bind(id).first<Record<string, any>>();
const invoiceRow = (id: string) =>
  env.DB.prepare('SELECT status, balance_minor, amount_paid_minor FROM invoices WHERE id = ?')
    .bind(id)
    .first<{ status: string; balance_minor: number; amount_paid_minor: number }>();
const paymentsFor = async (attemptId: string) =>
  (await env.DB.prepare('SELECT * FROM payments WHERE attempt_id = ?').bind(attemptId).all<Record<string, any>>())
    .results;
const eventsFor = async (attemptId: string, type: string) =>
  (
    await env.DB.prepare('SELECT COUNT(*) AS n FROM payment_events WHERE attempt_id = ? AND event_type = ?')
      .bind(attemptId, type)
      .first<{ n: number }>()
  )?.n ?? 0;

/** Plays the gateway: the mock's state for this attempt becomes `status`. */
async function gatewaySays(attemptId: string, status: string) {
  await env.DB.prepare(
    `UPDATE mock_provider_state SET status = ?, scripted = NULL, settle_at = NULL, paid_minor = amount_minor
     WHERE merchant_reference = ?`,
  )
    .bind(status, attemptId)
    .run();
}

/** A system context whose clock is `minutes` after the attempt was created. */
async function at(attemptId: string, minutes: number) {
  const created = Date.parse((await attemptRow(attemptId))!.created_at);
  const now = new Date(created + minutes * 60_000);
  return createContext({ env, actor: { type: 'system', userId: null }, now: () => now });
}

describe('payment reconciliation (P6.4)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.prepare('DELETE FROM rate_limits').run();
    // Attempts left over from other tests in this file must not use up a run's batch.
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE payment_attempts SET status = 'cancelled', next_check_at = NULL WHERE status IN ('created','initiated','pending','partially_paid')",
      ),
      env.DB.prepare(
        "UPDATE payment_attempts SET last_checked_at = '2999-01-01T00:00:00.000Z' WHERE status IN ('succeeded','disputed')",
      ),
    ]);
  });

  it('is scheduled on the frequent cron', () => {
    expect(SCHEDULE[CRON_FREQUENT]!.map(([name]) => name)).toContain('payment-reconciliation');
  });

  it('missed callback: the cron finds the success, records one payment, and a second run changes nothing', async () => {
    const s = await staff();
    const { invoiceId, portal } = await invoiceFor(s);
    const id = await startPayment(portal, invoiceId, { methodCode: 'ecocash', phone: '0771111111' });
    await gatewaySays(id, 'succeeded');
    // The gateway's callback never reaches us, and the client closed the page (no status polling).

    // Too early for the first check (2 min): nothing happens.
    const early = await reconcilePayments(await at(id, 1));
    expect(early.checked).toBe(0);
    expect((await attemptRow(id))!.status).toBe('initiated');

    const ctx = await at(id, 3);
    const r1 = await reconcilePayments(ctx);
    expect(r1).toMatchObject({ checked: 1, failures: 0 });
    expect((await attemptRow(id))!.status).toBe('succeeded');
    expect(await paymentsFor(id)).toHaveLength(1);
    expect(await invoiceRow(invoiceId)).toMatchObject({ status: 'paid', balance_minor: 0, amount_paid_minor: 30_000 });

    const [r2, r3] = await Promise.all([reconcilePayments(ctx), reconcilePayments(ctx)]);
    expect(r2.checked + r3.checked).toBe(0);
    expect(await paymentsFor(id)).toHaveLength(1);
  });

  it('backoff: a pending attempt is checked, then left alone until its next slot (2, 5, 10 … minutes)', async () => {
    const s = await staff();
    const { invoiceId, portal } = await invoiceFor(s);
    const id = await startPayment(portal, invoiceId);
    await gatewaySays(id, 'pending');

    expect((await reconcilePayments(await at(id, 3))).checked).toBe(1);
    let row = await attemptRow(id);
    expect(row).toMatchObject({ status: 'pending', check_count: 1 });
    const next = Date.parse(row!.next_check_at);
    expect(next - Date.parse(row!.last_checked_at)).toBe(5 * 60_000);

    expect((await reconcilePayments(await at(id, 6))).checked).toBe(0); // not due yet (due at minute 8)
    expect((await reconcilePayments(await at(id, 9))).checked).toBe(1);
    row = await attemptRow(id);
    expect(row).toMatchObject({ status: 'pending', check_count: 2 });
    expect(Date.parse(row!.next_check_at) - Date.parse(row!.last_checked_at)).toBe(10 * 60_000);
    expect(await eventsFor(id, 'status_check')).toBe(2);
  });

  it('expiry: past its lifetime the attempt gets one final check, then is closed as expired with an alert', async () => {
    const s = await staff();
    const { invoiceId, portal } = await invoiceFor(s);
    const id = await startPayment(portal, invoiceId);
    await gatewaySays(id, 'pending');

    const r = await reconcilePayments(await at(id, 72 * 60 + 1));
    expect(r).toMatchObject({ checked: 1, expired: 1 });
    const row = await attemptRow(id);
    expect(row).toMatchObject({ status: 'expired', next_check_at: null });
    expect(row!.failure_reason).toContain('expired');
    expect(await eventsFor(id, 'status_check')).toBe(1);
    expect(await eventsFor(id, 'reconcile')).toBe(1);
    expect(await invoiceRow(invoiceId)).toMatchObject({ balance_minor: 30_000 });
    const alert = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM notifications WHERE entity_id = ? AND type = 'payment.failed'",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(alert!.n).toBeGreaterThan(0);

    // A success at the final check wins over expiry.
    const two = await invoiceFor(s);
    const id2 = await startPayment(two.portal, two.invoiceId);
    await gatewaySays(id2, 'succeeded');
    expect(await reconcilePayments(await at(id2, 72 * 60 + 1))).toMatchObject({ checked: 1, expired: 0 });
    expect((await attemptRow(id2))!.status).toBe('succeeded');
  });

  it('never started: an attempt stuck in "created" without a gateway reference is closed after 30 minutes', async () => {
    const s = await staff();
    const { invoiceId, portal } = await invoiceFor(s);
    const id = await startPayment(portal, invoiceId);
    await env.DB.prepare(
      "UPDATE payment_attempts SET status = 'created', provider_reference = NULL, poll_url = NULL, next_check_at = NULL WHERE id = ?",
    )
      .bind(id)
      .run();
    expect((await reconcilePayments(await at(id, 20))).neverStarted).toBe(0);
    expect((await reconcilePayments(await at(id, 31))).neverStarted).toBe(1);
    expect(await attemptRow(id)).toMatchObject({
      status: 'error',
      failure_reason: 'The payment did not start with the gateway',
    });
  });

  it('late reversal: a payment reversed days later is found by the daily re-check of settled payments', async () => {
    const s = await staff();
    const { invoiceId, portal } = await invoiceFor(s);
    const id = await startPayment(portal, invoiceId);
    await gatewaySays(id, 'succeeded');
    await reconcilePayments(await at(id, 3));
    expect(await invoiceRow(invoiceId)).toMatchObject({ status: 'paid' });

    await gatewaySays(id, 'reversed');
    expect((await reconcilePayments(await at(id, 60))).recheckedSettled).toBe(0); // checked < 24 h ago
    expect((await reconcilePayments(await at(id, 3 * 24 * 60))).recheckedSettled).toBe(1);
    expect((await attemptRow(id))!.status).toBe('reversed');
    expect((await paymentsFor(id))[0]!.status).toBe('reversed');
    expect(await invoiceRow(invoiceId)).toMatchObject({ balance_minor: 30_000, amount_paid_minor: 0 });

    // Unchanged succeeded payments are re-checked at most once a day, and not after 7 days.
    const two = await invoiceFor(s);
    const id2 = await startPayment(two.portal, two.invoiceId);
    await gatewaySays(id2, 'succeeded');
    await reconcilePayments(await at(id2, 3));
    expect((await reconcilePayments(await at(id2, 25 * 60))).recheckedSettled).toBe(1);
    expect((await reconcilePayments(await at(id2, 26 * 60))).recheckedSettled).toBe(0);
    expect((await reconcilePayments(await at(id2, 8 * 24 * 60))).recheckedSettled).toBe(0);
    expect(await paymentsFor(id2)).toHaveLength(1);
  });

  it('admin "Check now": finance applies a missed callback at once, audited; the invoice lists its attempts', async () => {
    const s = await staff();
    const { invoiceId, portal } = await invoiceFor(s);
    const id = await startPayment(portal, invoiceId, { methodCode: 'ecocash', phone: '0771111111' });
    await gatewaySays(id, 'succeeded');

    // Not for the client, nor for staff without payments.view.
    const asClient = await api(`/api/v1/admin/payments/attempts/${id}/check`, {
      cookie: portal.cookie,
      csrf: portal.csrf,
      body: {},
    });
    expect([401, 403]).toContain(asClient.status);
    const support = await staff(['support_staff']);
    expect((await A(support, `/payments/attempts/${id}/check`, {})).status).toBe(403);
    expect((await A(s, `/payments/attempts/att_missing/check`, {})).status).toBe(404);

    const r = await A(s, `/payments/attempts/${id}/check`, {});
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data).toMatchObject({
      id,
      status: 'succeeded',
      amount: '$300.00',
      methodCode: 'ecocash',
      testMode: true,
    });
    expect(r.body.data.paymentId).toEqual(expect.any(String));
    expect(JSON.stringify(r.body)).not.toMatch(/poll_?url|mock:\/\/|signing|instructions/i);
    expect(await paymentsFor(id)).toHaveLength(1);
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'payment.attempt_checked' AND entity_id = ?",
    )
      .bind(id)
      .first<{ n: number }>();
    expect(audit!.n).toBe(1);

    // Again: idempotent, still one payment.
    expect((await A(s, `/payments/attempts/${id}/check`, {})).body.data.status).toBe('succeeded');
    expect(await paymentsFor(id)).toHaveLength(1);

    const list = await api(`/api/v1/admin/payments/attempts?invoiceId=${invoiceId}`, { cookie: s.cookie });
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({ id, status: 'succeeded', checkCount: expect.any(Number) });
    expect(
      (await api(`/api/v1/admin/payments/attempts?invoiceId=${invoiceId}`, { cookie: support.cookie })).status,
    ).toBe(403);
  });
});
