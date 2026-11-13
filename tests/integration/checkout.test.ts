/**
 * P6.3d custom checkout (docs/06 §3b): the page's view (summary, methods, bank details, phone prefill, no gateway
 * internals), the attempt URLs the pay endpoints hand to the page, and "I've paid, notify Kuzikode" (a finance note that
 * marks nothing paid).
 */
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { documentToken } from '../../src/server/lib/public-links';
import { checkoutView } from '../../src/server/modules/payments';
import { resetCmsCache } from '../../src/server/modules/cms/service';
import { api, login, type Session } from '../helpers/api';
import { createPortalUser, createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

const u = () => Math.random().toString(36).slice(2, 10);
const A = (s: Session, path: string, body?: unknown) =>
  api(`/api/v1/admin${path}`, { cookie: s.cookie, csrf: s.csrf, ...(body === undefined ? {} : { body }) });

async function setup(lines = 1) {
  const x = await createStaff(['admin']);
  const s = await login('admin', x.email, x.password);
  const c = await A(s, '/clients', {
    type: 'business',
    displayName: `Checkout ${u()}`,
    email: `c-${u()}@example.com`,
    phone: '+263 77 123 4567',
    defaultCurrency: 'USD',
    paymentTermsDays: 14,
    tags: [],
  });
  expect(c.status, JSON.stringify(c.body)).toBe(201);
  const clientId = c.body.data.id as string;
  const d = await A(s, '/invoices', {
    clientId,
    currency: 'USD',
    items: Array.from({ length: lines }, (_, i) => ({
      description: `Line ${i + 1}`,
      quantity: '1',
      unitPriceMinor: 10_000,
      discountType: 'none',
      discountValue: 0,
    })),
  });
  const invoiceId = d.body.data.id as string;
  expect((await A(s, `/invoices/${invoiceId}/issue`, { send: false })).status).toBe(200);
  const user = await createPortalUser([clientId], { role: 'billing' });
  const portal = await login('portal', user.email, user.password);
  return { s, clientId, invoiceId, portal, userId: user.id };
}

async function setBankDetails(text: string) {
  await env.DB.batch([
    env.DB.prepare("UPDATE application_settings SET value = ? WHERE key = 'documents.bank_details'").bind(
      JSON.stringify(text),
    ),
    env.DB.prepare(
      "UPDATE application_settings SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'content_version'",
    ),
  ]);
  resetCmsCache();
}

const count = async (sql: string, ...params: unknown[]) =>
  (
    await env.DB.prepare(sql)
      .bind(...params)
      .first<{ n: number }>()
  )?.n ?? 0;

describe('checkout page (P6.3d)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.prepare('DELETE FROM rate_limits').run();
  });

  it('view: summary with the first lines, amount due, routed methods, bank details, phone prefill, no gateway internals', async () => {
    const { invoiceId } = await setup(7);
    await setBankDetails('Kuzikode Intelligent Technologies\nCABS, Account 1234567');
    const v = await checkoutView(createContext({ env }), invoiceId);
    expect(v.invoice).toMatchObject({ totalMinor: 70_000, paidMinor: 0, amountDueMinor: 70_000, currency: 'USD' });
    expect(v.invoice.lines).toHaveLength(5);
    expect(v.invoice.moreLines).toBe(2);
    expect(v.invoice.clientName).toMatch(/^Checkout /);
    expect(v.payable).toBe(true);
    expect(v.testMode).toBe(true);
    expect(v.methods.map((m) => m.code)).toEqual(expect.arrayContaining(['ecocash', 'innbucks', 'omari', 'card']));
    expect(v.bankTransfer).toEqual({
      details: 'Kuzikode Intelligent Technologies\nCABS, Account 1234567',
      reference: v.invoice.number,
    });
    expect(v.phone).toBe('0771234567');
    // Nothing about the gateway account reaches the page.
    const json = JSON.stringify(v);
    expect(json).not.toMatch(/ppa_|secret|mock|poll/i);
  });

  it("portal: the signed-in user's own phone wins; a paid invoice has nothing due and no bank panel", async () => {
    const { invoiceId, userId, s } = await setup();
    await setBankDetails('Bank X');
    await env.DB.prepare('UPDATE users SET phone = ? WHERE id = ?').bind('0712 345 678', userId).run();
    const ctx = createContext({ env });
    expect((await checkoutView(ctx, invoiceId, { userId })).phone).toBe('0712345678');

    const paid = await A(s, `/invoices/${invoiceId}/payments`, {
      amountMinor: 10_000,
      method: 'bank_transfer',
      receivedOn: new Date().toISOString().slice(0, 10),
      reference: 'FT1',
    });
    expect(paid.status, JSON.stringify(paid.body)).toBe(201);
    const v = await checkoutView(ctx, invoiceId);
    expect(v.invoice.amountDueMinor).toBe(0);
    expect(v.invoice.paidMinor).toBe(10_000);
    expect(v.payable).toBe(false);
    expect(v.methods).toEqual([]);
    expect(v.bankTransfer).toBeNull();
  });

  it('pay endpoints hand the page its status and OTP URLs (portal and signed public), and they work', async () => {
    const { invoiceId, portal } = await setup();
    const start = await api(`/api/v1/portal/invoices/${invoiceId}/pay`, {
      cookie: portal.cookie,
      csrf: portal.csrf,
      body: { methodCode: 'omari', phone: '0771111111' },
      headers: { 'idempotency-key': `k_${u()}` },
    });
    expect(start.status, JSON.stringify(start.body)).toBe(201);
    const d = start.body.data;
    expect(d.statusUrl).toBe(`/api/v1/portal/payment-attempts/${d.attemptId}`);
    expect(d.otpUrl).toBe(`/api/v1/portal/payment-attempts/${d.attemptId}/otp`);
    expect(d.instructions.otpRequired).toBe(true);
    expect(JSON.stringify(d)).not.toMatch(/mock:\/\/|submitUrl|otpReference/);
    const otp = await api(d.otpUrl, { cookie: portal.cookie, csrf: portal.csrf, body: { otp: '123456' } });
    expect(otp.status, JSON.stringify(otp.body)).toBe(200);
    expect(otp.body.data.phase).toBe('succeeded');
    const st = await api(d.statusUrl, { cookie: portal.cookie });
    expect(st.body.data).toMatchObject({ phase: 'succeeded', payment: { receiptNumber: expect.any(String) } });

    // Public: the URLs carry the signature from the gateway return link.
    const other = await setup();
    const token = (await documentToken(createContext({ env }), 'invoice', other.invoiceId)).token;
    const pub = await api(`/api/v1/public/invoices/${token}/pay`, {
      body: { methodCode: 'innbucks', turnstileToken: 'test' },
      headers: { 'idempotency-key': `pub_${u()}` },
    });
    expect(pub.status, JSON.stringify(pub.body)).toBe(201);
    const p = pub.body.data;
    const t = new URL(`http://x${p.statusPage}`).searchParams.get('t');
    expect(p.statusUrl).toBe(`/api/v1/public/payment-attempts/${p.attemptId}?t=${encodeURIComponent(t!)}`);
    expect(p.otpUrl).toBe(`/api/v1/public/payment-attempts/${p.attemptId}/otp?t=${encodeURIComponent(t!)}`);
    expect(p.instructions.authorizationCode).toMatch(/^\d{9}$/);
    const ps = await api(p.statusUrl);
    expect(ps.status).toBe(200);
    expect(ps.body.data.phase).toBe('waiting');
  });

  it("I've paid (bank transfer): one finance note per invoice per day, audited, nothing marked paid", async () => {
    const { invoiceId, portal, s } = await setup();
    const notice = (body: Record<string, unknown> = { payerName: 'Tendai Moyo', reference: 'FT-991' }) =>
      api(`/api/v1/portal/invoices/${invoiceId}/bank-transfer-notice`, {
        cookie: portal.cookie,
        csrf: portal.csrf,
        body,
      });
    const first = await notice();
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect((await notice()).status).toBe(200);
    const notes = await env.DB.prepare(
      "SELECT DISTINCT title FROM notifications WHERE entity_id = ? AND type = 'payment.reported'",
    )
      .bind(invoiceId)
      .all<{ title: string }>();
    expect(notes.results).toHaveLength(1);
    expect(notes.results[0]!.title).toMatch(/bank transfer for INV-.*from Tendai Moyo, reference FT-991/);
    // Deduplicated per staff user: each finance user got exactly one.
    expect(
      await count(
        "SELECT COUNT(*) - COUNT(DISTINCT user_id) AS n FROM notifications WHERE entity_id = ? AND type = 'payment.reported'",
        invoiceId,
      ),
    ).toBe(0);
    expect(
      await count(
        "SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'payment.bank_transfer_reported' AND entity_id = ?",
        invoiceId,
      ),
    ).toBe(2);
    const inv = await env.DB.prepare('SELECT status, balance_minor FROM invoices WHERE id = ?')
      .bind(invoiceId)
      .first<{ status: string; balance_minor: number }>();
    expect(inv).toEqual({ status: 'issued', balance_minor: 10_000 });
    expect(await count('SELECT COUNT(*) AS n FROM payment_allocations WHERE invoice_id = ?', invoiceId)).toBe(0);

    // Validation, scope and the public link's Turnstile.
    expect((await notice({ payerName: 'x'.repeat(200) })).status).toBe(422);
    const stranger = await setup();
    const cross = await api(`/api/v1/portal/invoices/${invoiceId}/bank-transfer-notice`, {
      cookie: stranger.portal.cookie,
      csrf: stranger.portal.csrf,
      body: {},
    });
    expect(cross.status).toBe(404);
    const token = (await documentToken(createContext({ env }), 'invoice', invoiceId)).token;
    expect((await api(`/api/v1/public/invoices/${token}/bank-transfer-notice`, { body: {} })).status).toBe(422);
    expect(
      (await api(`/api/v1/public/invoices/${token}/bank-transfer-notice`, { body: { turnstileToken: 'test' } })).status,
    ).toBe(200);
    expect(
      (
        await api(`/api/v1/public/invoices/${'A'.repeat(43)}/bank-transfer-notice`, {
          body: { turnstileToken: 'test' },
        })
      ).status,
    ).toBe(404);

    // Once paid there is nothing to report.
    await A(s, `/invoices/${invoiceId}/payments`, {
      amountMinor: 10_000,
      method: 'bank_transfer',
      receivedOn: new Date().toISOString().slice(0, 10),
      reference: 'FT-991',
    });
    expect((await notice()).status).toBe(409);
  });
});
