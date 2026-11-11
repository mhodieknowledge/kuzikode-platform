/**
 * P6.2 online payments (docs/06 §3, §8 orchestration tests) through the mock gateway: initiate (idempotency, reuse,
 * refusals), callbacks (genuine, forged, duplicates, claim not confirmed), status checks, amount mismatch, overpayment,
 * dispute / reversal, OTP, route switching, scoping and the payment.failed notification.
 */
import { env, exports } from 'cloudflare:workers';
import { MOCK_DEV_SIGNING_KEY, signMockCallback } from '@kuzikode/payments';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { documentToken } from '../../src/server/lib/public-links';
import { businessDate } from '../../src/server/lib/dates';
import { checkAttempt, settleMockCheckout } from '../../src/server/modules/payments';
import { ORIGIN, api, login, type Session } from '../helpers/api';
import { createPortalUser, createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

const u = () => Math.random().toString(36).slice(2, 10);
const A = (s: Session, path: string, body?: unknown) =>
  api(`/api/v1/admin${path}`, { cookie: s.cookie, csrf: s.csrf, ...(body === undefined ? {} : { body }) });

async function staff() {
  const x = await createStaff(['admin']);
  return login('admin', x.email, x.password);
}

async function invoiceFor(s: Session, amount = 50_000) {
  const c = await A(s, '/clients', {
    type: 'business',
    displayName: `Payer ${u()}`,
    email: `p-${u()}@example.com`,
    defaultCurrency: 'USD',
    paymentTermsDays: 14,
    tags: [],
  });
  const clientId = c.body.data.id as string;
  const d = await A(s, '/invoices', {
    clientId,
    currency: 'USD',
    items: [{ description: 'Website', quantity: '1', unitPriceMinor: amount, discountType: 'none', discountValue: 0 }],
  });
  const invoiceId = d.body.data.id as string;
  expect((await A(s, `/invoices/${invoiceId}/issue`, { send: false })).status).toBe(200);
  const user = await createPortalUser([clientId], { role: 'billing' });
  const portal = await login('portal', user.email, user.password);
  return { clientId, invoiceId, portal };
}

const pay = (p: Session, invoiceId: string, body: Record<string, unknown>, key: string | null = `k_${u()}`) =>
  api(`/api/v1/portal/invoices/${invoiceId}/pay`, {
    cookie: p.cookie,
    csrf: p.csrf,
    body,
    ...(key ? { headers: { 'idempotency-key': key } } : {}),
  });

const attemptRow = (id: string) =>
  env.DB.prepare('SELECT * FROM payment_attempts WHERE id = ?').bind(id).first<Record<string, any>>();
const invoiceRow = (id: string) =>
  env.DB.prepare('SELECT status, balance_minor, amount_paid_minor FROM invoices WHERE id = ?')
    .bind(id)
    .first<{ status: string; balance_minor: number; amount_paid_minor: number }>();
const paymentsFor = async (attemptId: string) =>
  (await env.DB.prepare('SELECT * FROM payments WHERE attempt_id = ?').bind(attemptId).all<Record<string, any>>())
    .results;

/** Plays the gateway: the mock's state for this attempt becomes `status` (and optionally another amount). */
async function gatewaySays(attemptId: string, status: string, paidMinor?: number) {
  await env.DB.prepare(
    `UPDATE mock_provider_state SET status = ?, scripted = NULL, settle_at = NULL, paid_minor = COALESCE(?, amount_minor)
     WHERE merchant_reference = ?`,
  )
    .bind(status, paidMinor ?? null, attemptId)
    .run();
}

async function callback(attemptId: string, status: string, opts: { key?: string; amountMinor?: number } = {}) {
  const a = await attemptRow(attemptId);
  const body = await signMockCallback(
    { accountId: a!.account_id, mode: 'test', credentials: { signingKey: opts.key ?? MOCK_DEV_SIGNING_KEY } },
    {
      reference: a!.provider_reference,
      merchantReference: attemptId,
      status: status as 'succeeded',
      amountMinor: opts.amountMinor ?? a!.amount_minor,
      currency: a!.currency,
    },
  );
  return exports.default.fetch(`${ORIGIN}/api/payments/callbacks/mock/${a!.account_id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

const notificationsFor = async (entityId: string, type: string) =>
  (
    await env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE entity_id = ? AND type = ?')
      .bind(entityId, type)
      .first<{ n: number }>()
  )?.n ?? 0;

describe('online payments (P6.2)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.prepare('DELETE FROM rate_limits').run(); // every test signs several people in from one IP
  });

  it('options, then an express payment: instructions only, then a genuine callback is confirmed and applied once', async () => {
    const s = await staff();
    const { invoiceId, portal, clientId } = await invoiceFor(s);
    const opts = await api(`/api/v1/portal/invoices/${invoiceId}/payment-options`, { cookie: portal.cookie });
    expect(opts.status).toBe(200);
    expect(opts.body.data).toMatchObject({ amountDueMinor: 50_000, currency: 'USD', payable: true, testMode: true });
    expect(opts.body.data.methods.map((m: { code: string }) => m.code)).toEqual(
      expect.arrayContaining(['ecocash', 'onemoney', 'innbucks', 'omari', 'card']),
    );

    const start = await pay(portal, invoiceId, { methodCode: 'ecocash', phone: '+263 77 111 1111' });
    expect(start.status, JSON.stringify(start.body)).toBe(201);
    const id = start.body.data.attemptId as string;
    expect(start.body.data).toMatchObject({
      phase: 'waiting',
      flow: 'express',
      redirectUrl: null,
      testMode: true,
      statusPage: `/portal/payments/attempts/${id}`,
    });
    expect(start.body.data.instructions.text).toContain('approve the EcoCash prompt');
    const row = await attemptRow(id);
    expect(row).toMatchObject({
      status: 'initiated',
      amount_minor: 50_000,
      payer_phone_masked: '077****111',
      account_id: 'ppa_mock',
      client_id: clientId,
    });
    expect(JSON.stringify(start.body)).not.toMatch(/poll|mock:\/\/|signing/i);

    // Five identical callbacks at once → exactly one payment; the invoice is paid.
    await gatewaySays(id, 'succeeded');
    const results = await Promise.all(Array.from({ length: 5 }, () => callback(id, 'succeeded')));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const pays = await paymentsFor(id);
    expect(pays).toHaveLength(1);
    expect(pays[0]).toMatchObject({
      amount_minor: 50_000,
      provider_key: 'mock',
      account_id: 'ppa_mock',
      method: 'ecocash',
    });
    expect(await invoiceRow(invoiceId)).toMatchObject({ status: 'paid', balance_minor: 0 });
    expect((await attemptRow(id))?.status).toBe('succeeded');
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'payment.received_online' AND entity_id = ?",
    )
      .bind(invoiceId)
      .first<{ n: number }>();
    expect(audit?.n).toBe(1);
    const status = await api(`/api/v1/portal/payment-attempts/${id}`, { cookie: portal.cookie });
    expect(status.body.data).toMatchObject({ phase: 'succeeded', payment: { receiptNumber: pays[0]!.receipt_number } });
    // Paid: nothing more to pay.
    expect((await pay(portal, invoiceId, { methodCode: 'card' })).status).toBe(409);
  });

  it('idempotency key and reuse: a double click or a second card click within 30 min returns the same attempt', async () => {
    const s = await staff();
    const { invoiceId, portal } = await invoiceFor(s);
    const key = `dbl_${u()}`;
    const [a, b, c] = await Promise.all([
      pay(portal, invoiceId, { methodCode: 'card' }, key),
      pay(portal, invoiceId, { methodCode: 'card' }, key),
      pay(portal, invoiceId, { methodCode: 'card' }, key),
    ]);
    const ids = new Set([a, b, c].map((r) => r.body.data?.attemptId));
    expect(ids.size).toBe(1);
    const d = await pay(portal, invoiceId, { methodCode: 'card' });
    expect(d.body.data.attemptId).toBe(a.body.data.attemptId);
    expect(d.body.data.redirectUrl).toMatch(/\/dev\/mock-checkout\/mock_/);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM payment_attempts WHERE invoice_id = ?')
      .bind(invoiceId)
      .first<{ n: number }>();
    expect(n?.n).toBe(1);
    expect((await pay(portal, invoiceId, { methodCode: 'card' }, null)).status).toBe(422);
    expect((await pay(portal, invoiceId, { methodCode: 'ecocash', phone: '12345' })).status).toBe(422);
    expect((await pay(portal, invoiceId, { methodCode: 'bitcoin' })).status).toBe(422);
  });

  it('refused at once (insufficient balance) → failed in client wording + payment.failed for finance', async () => {
    const s = await staff();
    const { invoiceId, portal } = await invoiceFor(s);
    const res = await pay(portal, invoiceId, { methodCode: 'ecocash', phone: '0774444444' });
    expect(res.status).toBe(201);
    expect(res.body.data.phase).toBe('failed');
    expect(res.body.data.message).toContain('declined');
    const id = res.body.data.attemptId as string;
    expect(await attemptRow(id)).toMatchObject({ status: 'failed', failure_reason: 'Insufficient balance' });
    expect(await notificationsFor(id, 'payment.failed')).toBeGreaterThan(0);
    expect(await invoiceRow(invoiceId)).toMatchObject({ status: 'issued', balance_minor: 50_000 });
  });

  it('forged callback → nothing applied; genuine claim not confirmed by the status check → nothing applied', async () => {
    const s = await staff();
    const { invoiceId, portal } = await invoiceFor(s);
    const id = (await pay(portal, invoiceId, { methodCode: 'card' })).body.data.attemptId as string;
    const forged = await callback(id, 'succeeded', { key: 'attacker-key-000' });
    expect(forged.status).toBe(200);
    expect(await paymentsFor(id)).toHaveLength(0);
    const rejected = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM payment_events WHERE event_type = 'callback_rejected' AND account_id = 'ppa_mock'",
    ).first<{ n: number }>();
    expect(rejected?.n).toBeGreaterThan(0);

    // Authentic callback says paid, but the gateway's status check says pending.
    expect((await callback(id, 'succeeded')).status).toBe(200);
    expect(await paymentsFor(id)).toHaveLength(0);
    expect(await attemptRow(id)).toMatchObject({ status: 'pending' });
    expect(await invoiceRow(invoiceId)).toMatchObject({ balance_minor: 50_000 });

    // Garbage, unknown accounts and unknown references are all 200 with nothing applied.
    for (const path of ['/api/payments/callbacks/mock/ppa_nope', '/api/payments/callbacks/mock/ppa_mock']) {
      const r = await exports.default.fetch(`${ORIGIN}${path}`, { method: 'POST', body: 'status=Paid' });
      expect(r.status).toBe(200);
    }
    const unknown = await signMockCallback(
      { accountId: 'ppa_mock', mode: 'test', credentials: { signingKey: MOCK_DEV_SIGNING_KEY } },
      { reference: 'mock_nope', merchantReference: 'att_nope', status: 'succeeded', amountMinor: 1, currency: 'USD' },
    );
    await exports.default.fetch(`${ORIGIN}/api/payments/callbacks/mock/ppa_mock`, { method: 'POST', body: unknown });
    const unmatched = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM payment_events WHERE event_type = 'unmatched' AND provider_reference = 'mock_nope'",
    ).first<{ n: number }>();
    expect(unmatched?.n).toBe(1);
  });

  it('status check applies a missed callback; amount mismatch → error + review alert, no payment', async () => {
    const s = await staff();
    const one = await invoiceFor(s);
    const id = (await pay(one.portal, one.invoiceId, { methodCode: 'card' })).body.data.attemptId as string;
    await gatewaySays(id, 'succeeded');
    // No callback ever arrives: the portal's status poll asks the gateway.
    const polled = await api(`/api/v1/portal/payment-attempts/${id}`, { cookie: one.portal.cookie });
    expect(polled.body.data.phase).toBe('succeeded');
    expect(await paymentsFor(id)).toHaveLength(1);

    const two = await invoiceFor(s);
    const id2 = (await pay(two.portal, two.invoiceId, { methodCode: 'card' })).body.data.attemptId as string;
    await gatewaySays(id2, 'succeeded', 100);
    const ctx = createContext({ env });
    expect((await checkAttempt(ctx, id2, { force: true })).status).toBe('error');
    expect(await paymentsFor(id2)).toHaveLength(0);
    const review = await env.DB.prepare(
      "SELECT title FROM notifications WHERE entity_id = ? AND type = 'payment.failed' AND title LIKE 'Payment requires review%' LIMIT 1",
    )
      .bind(id2)
      .first<{ title: string }>();
    expect(review?.title).toContain('$1.00');
  });

  it('paid elsewhere meanwhile → allocate up to the balance, the rest becomes client credit', async () => {
    const s = await staff();
    const { invoiceId, portal, clientId } = await invoiceFor(s);
    const id = (await pay(portal, invoiceId, { methodCode: 'card' })).body.data.attemptId as string;
    const manual = await A(s, `/invoices/${invoiceId}/payments`, {
      amountMinor: 20_000,
      method: 'bank_transfer',
      receivedOn: businessDate(new Date()),
    });
    expect(manual.status).toBe(201);
    await gatewaySays(id, 'succeeded');
    await checkAttempt(createContext({ env }), id, { force: true });
    expect(await invoiceRow(invoiceId)).toMatchObject({ status: 'paid', balance_minor: 0, amount_paid_minor: 50_000 });
    const credit = await env.DB.prepare(
      "SELECT SUM(amount_minor) AS n FROM client_credits WHERE client_id = ? AND source_type = 'overpayment'",
    )
      .bind(clientId)
      .first<{ n: number }>();
    expect(credit?.n).toBe(20_000);
  });

  it('disputed keeps the payment; reversed restores the balance and withdraws the credit, once', async () => {
    const s = await staff();
    const { invoiceId, portal } = await invoiceFor(s);
    const id = (await pay(portal, invoiceId, { methodCode: 'card' })).body.data.attemptId as string;
    const ctx = createContext({ env });
    await gatewaySays(id, 'succeeded');
    await checkAttempt(ctx, id, { force: true });
    await gatewaySays(id, 'disputed');
    expect((await checkAttempt(ctx, id, { force: true })).status).toBe('disputed');
    expect((await paymentsFor(id))[0]?.status).toBe('completed');
    await gatewaySays(id, 'reversed');
    expect((await checkAttempt(ctx, id, { force: true })).status).toBe('reversed');
    await checkAttempt(ctx, id, { force: true });
    expect((await paymentsFor(id))[0]?.status).toBe('reversed');
    expect(await invoiceRow(invoiceId)).toMatchObject({ balance_minor: 50_000, amount_paid_minor: 0 });
    const audits = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'payment.reversed'",
    ).first<{ n: number }>();
    expect(audits?.n).toBeGreaterThanOrEqual(1);
    expect(await notificationsFor(id, 'payment.failed')).toBeGreaterThan(0);
  });

  it("O'mari: the OTP step; a wrong code fails, the right one pays (confirmed by a status check)", async () => {
    const s = await staff();
    const { invoiceId, portal } = await invoiceFor(s);
    const start = await pay(portal, invoiceId, { methodCode: 'omari', phone: '0771234567' });
    expect(start.body.data.instructions).toMatchObject({ otpRequired: true });
    expect(JSON.stringify(start.body)).not.toContain('mock://otp');
    const id = start.body.data.attemptId as string;
    const otp = (code: string, attempt = id) =>
      api(`/api/v1/portal/payment-attempts/${attempt}/otp`, {
        cookie: portal.cookie,
        csrf: portal.csrf,
        body: { otp: code },
      });
    expect((await otp('123456')).body.data.phase).toBe('succeeded');
    expect(await paymentsFor(id)).toHaveLength(1);
    expect((await otp('123456')).status).toBe(409);

    const other = await invoiceFor(s);
    const id2 = (await pay(other.portal, other.invoiceId, { methodCode: 'omari', phone: '0771234567' })).body.data
      .attemptId as string;
    const wrong = await api(`/api/v1/portal/payment-attempts/${id2}/otp`, {
      cookie: other.portal.cookie,
      csrf: other.portal.csrf,
      body: { otp: '000000' },
    });
    expect(wrong.body.data.phase).toBe('failed');
    expect(await paymentsFor(id2)).toHaveLength(0);
  });

  it('switching the route changes new attempts only; in-flight ones reconcile on their own account', async () => {
    const s = await staff();
    const { invoiceId, portal } = await invoiceFor(s);
    const first = (await pay(portal, invoiceId, { methodCode: 'card' })).body.data.attemptId as string;
    expect((await attemptRow(first))?.account_id).toBe('ppa_mock');
    const alt = `ppa_alt_${u()}`;
    await env.DB.prepare(
      `INSERT INTO payment_provider_accounts (id, provider_key, label, mode, secret_prefix, currencies) VALUES (?, 'mock', 'Alt', 'test', 'MOCKALT', '["USD"]')`,
    )
      .bind(alt)
      .run();
    await env.DB.prepare(
      `INSERT INTO payment_routes (id, app_key, currency, method_code, account_id, priority) VALUES (?, 'kuzikode-platform', 'USD', 'card', ?, 1)`,
    )
      .bind(`prt_${u()}`, alt)
      .run();
    try {
      // The old attempt fails; a new one goes to the new account.
      await gatewaySays(first, 'failed');
      await checkAttempt(createContext({ env }), first, { force: true });
      const second = (await pay(portal, invoiceId, { methodCode: 'card' })).body.data.attemptId as string;
      expect(second).not.toBe(first);
      expect((await attemptRow(second))?.account_id).toBe(alt);
      expect((await attemptRow(first))?.account_id).toBe('ppa_mock');
      // A late success on the original account is still recorded against it.
      await gatewaySays(first, 'succeeded');
      expect((await checkAttempt(createContext({ env }), first, { force: true })).status).toBe('succeeded');
      expect((await paymentsFor(first))[0]?.account_id).toBe('ppa_mock');
    } finally {
      await env.DB.prepare("DELETE FROM payment_routes WHERE account_id = ? AND method_code = 'card'").bind(alt).run();
    }
  });

  it('scoping: other clients, members and staff cannot pay; the public link needs Turnstile and its own token', async () => {
    const s = await staff();
    const { invoiceId, clientId } = await invoiceFor(s);
    const other = await invoiceFor(s);
    expect((await pay(other.portal, invoiceId, { methodCode: 'card' })).status).toBe(404);
    expect(
      (await api(`/api/v1/portal/invoices/${invoiceId}/payment-options`, { cookie: other.portal.cookie })).status,
    ).toBe(404);
    const member = await createPortalUser([clientId], { role: 'member' });
    expect(
      (await pay(await login('portal', member.email, member.password), invoiceId, { methodCode: 'card' })).status,
    ).toBe(404);

    const token = (await documentToken(createContext({ env }), 'invoice', invoiceId)).token;
    const pub = (body: Record<string, unknown>, t = token) =>
      api(`/api/v1/public/invoices/${t}/pay`, { body, headers: { 'idempotency-key': `pub_${u()}` } });
    expect((await api(`/api/v1/public/invoices/${token}/payment-options`)).body.data.payable).toBe(true);
    expect((await pub({ methodCode: 'card' })).status).toBe(422);
    const ok = await pub({ methodCode: 'card', turnstileToken: 'test' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.statusPage).toMatch(/^\/pay\/return\?attempt=att_[^&]+&t=[A-Za-z0-9_-]{43}$/);
    expect((await pub({ methodCode: 'card', turnstileToken: 'test' }, 'A'.repeat(43))).status).toBe(404);
    // The signed status endpoint asks the gateway while waiting.
    await gatewaySays(ok.body.data.attemptId, 'succeeded');
    const st = await api(
      ok.body.data.statusPage.replace('/pay/return?attempt=', '/api/v1/public/payment-attempts/').replace('&t=', '?t='),
    );
    expect(st.body.data.phase).toBe('succeeded');
  });

  it('mock hosted page: picking Succeed delivers the signed callback and the invoice is paid', async () => {
    const s = await staff();
    const { invoiceId, portal } = await invoiceFor(s);
    const start = await pay(portal, invoiceId, { methodCode: 'card' });
    const reference = (start.body.data.redirectUrl as string).split('/dev/mock-checkout/')[1]!;
    const view = await settleMockCheckout(createContext({ env }), decodeURIComponent(reference), 'succeeded');
    expect(view.returnUrl).toMatch(/^\/pay\/return\?attempt=/);
    expect(await paymentsFor(start.body.data.attemptId)).toHaveLength(1);
    expect(await invoiceRow(invoiceId)).toMatchObject({ status: 'paid' });
  });
});
