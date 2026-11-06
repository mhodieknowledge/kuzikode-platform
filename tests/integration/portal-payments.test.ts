import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { businessDate } from '../../src/server/lib/dates';
import { api, login, type Session } from '../helpers/api';
import { createPortalUser, createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

const u = () => Math.random().toString(36).slice(2, 8);
const A = (s: Session, path: string, body?: unknown) =>
  api(`/api/v1/admin${path}`, { cookie: s.cookie, csrf: s.csrf, ...(body === undefined ? {} : { body }) });
const P = (s: Session, path: string) => api(`/api/v1/portal${path}`, { cookie: s.cookie });

async function staff() {
  const x = await createStaff(['admin']);
  return login('admin', x.email, x.password);
}

async function clientWithInvoice(s: Session, name: string) {
  const c = await A(s, '/clients', {
    type: 'business',
    displayName: name,
    email: `a-${u()}@example.com`,
    defaultCurrency: 'USD',
    paymentTermsDays: 14,
    tags: [],
  });
  const clientId = c.body.data.id as string;
  const d = await A(s, '/invoices', {
    clientId,
    currency: 'USD',
    items: [{ description: 'Website', quantity: '1', unitPriceMinor: 50_000, discountType: 'none', discountValue: 0 }],
  });
  const invoiceId = d.body.data.id as string;
  expect((await A(s, `/invoices/${invoiceId}/issue`, { send: false })).status).toBe(200);
  return { clientId, invoiceId };
}

async function attempt(clientId: string, invoiceId: string, status: string, over: Record<string, string | null> = {}) {
  const id = `pat_${u()}`;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO payment_provider_accounts (id, provider_key, label, mode, secret_prefix) VALUES ('ppa_test_portal', 'mock', 'Mock', 'test', 'MOCK')`,
  ).run();
  await env.DB.prepare(
    `INSERT INTO payment_attempts (id, invoice_id, client_id, provider_key, account_id, flow, method_code, payer_phone_masked,
       amount_minor, currency, status, merchant_reference, idempotency_key, failure_reason, provider_status_raw, poll_url)
     VALUES (?, ?, ?, 'mock', 'ppa_test_portal', 'express', 'ecocash', '077****111', 50000, 'USD', ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      invoiceId,
      clientId,
      status,
      id,
      `idem-${id}`,
      over['failure_reason'] ?? null,
      over['raw'] ?? null,
      'https://provider.example/poll/secret',
    )
    .run();
  return id;
}

describe('portal payments, receipts and attempt status (P5.5)', () => {
  beforeEach(() => seedBase());

  it('lists payments with the invoices they paid; receipts download; other clients see nothing', async () => {
    const s = await staff();
    const a = await clientWithInvoice(s, 'Payer Ltd');
    const b = await clientWithInvoice(s, 'Other Ltd');
    const pay = await A(s, `/invoices/${a.invoiceId}/payments`, {
      amountMinor: 20_000,
      method: 'bank_transfer',
      receivedOn: businessDate(new Date()),
      reference: 'FT2611060001',
    });
    expect(pay.status, JSON.stringify(pay.body)).toBe(201);
    await A(s, `/invoices/${b.invoiceId}/payments`, {
      amountMinor: 5_000,
      method: 'cash',
      receivedOn: businessDate(new Date()),
    });
    const user = await createPortalUser([a.clientId], { role: 'billing' });
    const p = await login('portal', user.email, user.password);

    const list = await P(p, '/payments');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    const payment = list.body.data[0];
    expect(payment).toMatchObject({ amountMinor: 20_000, method: 'bank_transfer', status: 'completed' });
    expect(payment.invoices).toEqual([expect.objectContaining({ id: a.invoiceId, amountMinor: 20_000 })]);

    const receipt = await P(p, `/payments/${payment.id}/receipt`);
    expect(receipt.status).toBe(200);
    expect(receipt.headers.get('content-type')).toBe('application/pdf');

    const otherUser = await createPortalUser([b.clientId]);
    const o = await login('portal', otherUser.email, otherUser.password);
    expect((await P(o, `/payments/${payment.id}/receipt`)).status).toBe(404);
    expect((await P(o, '/payments')).body.data.map((x: { id: string }) => x.id)).not.toContain(payment.id);
  });

  it('attempt status: waiting / succeeded (with receipt) / failed in client wording; provider details never leak', async () => {
    const s = await staff();
    const a = await clientWithInvoice(s, 'Attempt Ltd');
    const waiting = await attempt(a.clientId, a.invoiceId, 'pending');
    const failed = await attempt(a.clientId, a.invoiceId, 'failed', {
      failure_reason: 'Insufficient balance on wallet 0771111111',
      raw: 'status=Failed&hash=ABC',
    });
    const done = await attempt(a.clientId, a.invoiceId, 'succeeded');
    await env.DB.prepare(
      `INSERT INTO payments (id, receipt_number, client_id, provider_key, method, amount_minor, currency, received_at, attempt_id)
       VALUES (?, ?, ?, 'mock', 'ecocash', 50000, 'USD', ?, ?)`,
    )
      .bind(`pay_${u()}`, `RCT-AT-${u()}`, a.clientId, new Date().toISOString(), done)
      .run();
    const user = await createPortalUser([a.clientId]);
    const p = await login('portal', user.email, user.password);

    const w = await P(p, `/payment-attempts/${waiting}`);
    expect(w.status).toBe(200);
    expect(w.body.data).toMatchObject({
      phase: 'waiting',
      method: 'ecocash',
      payerPhone: '077****111',
      amountMinor: 50_000,
      payment: null,
    });
    const f = await P(p, `/payment-attempts/${failed}`);
    expect(f.body.data.phase).toBe('failed');
    expect(f.body.data.message).toBe('The payment did not go through. Nothing was taken from your account.');
    const raw = JSON.stringify([w.body, f.body]);
    for (const secret of ['Insufficient', '0771111111', 'hash=ABC', 'provider.example', 'ppa_test_portal']) {
      expect(raw).not.toContain(secret);
    }
    const ok = await P(p, `/payment-attempts/${done}`);
    expect(ok.body.data.phase).toBe('succeeded');
    expect(ok.body.data.payment.receiptNumber).toMatch(/^RCT-AT-/);

    // Another client, a "member" contact and staff sessions can't read it.
    const other = await clientWithInvoice(s, 'Nosy Ltd');
    const o = await createPortalUser([other.clientId]);
    expect((await P(await login('portal', o.email, o.password), `/payment-attempts/${done}`)).status).toBe(404);
    const member = await createPortalUser([a.clientId], { role: 'member' });
    expect((await P(await login('portal', member.email, member.password), `/payment-attempts/${done}`)).status).toBe(
      404,
    );
    expect((await api(`/api/v1/portal/payment-attempts/${done}`, { cookie: s.cookie })).status).toBe(401);
  });
});
