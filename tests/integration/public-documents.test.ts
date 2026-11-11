/**
 * P5.8 public document pages: the tokens behind `/q/:token`, `/i/:token` and the signed `/pay/return` link, their
 * private headers and the shared page rate limit. (The Astro pages themselves render in the e2e suite.)
 */
import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { documentToken, paymentReturnUrl, verifyPaymentReturn } from '../../src/server/lib/public-links';
import { publicDocumentPageLimit } from '../../src/server/lib/rate-limit';
import { quotationIdForToken } from '../../src/server/modules/documents/service';
import { getPublicInvoice, invoiceIdForToken } from '../../src/server/modules/invoices';
import { getPublicQuotation } from '../../src/server/modules/quotations';
import { getPublicAttempt } from '../../src/server/modules/payments';
import { ORIGIN, api, login, type Session } from '../helpers/api';
import { createStaff } from '../helpers/factories';
import { isPdf } from '../helpers/pdf-text';
import { seedBase } from '../helpers/seed';

const u = () => Math.random().toString(36).slice(2, 8);
const A = (s: Session, path: string, body?: unknown) =>
  api(`/api/v1/admin${path}`, { cookie: s.cookie, csrf: s.csrf, ...(body === undefined ? {} : { body }) });

async function staff() {
  const x = await createStaff(['admin']);
  return login('admin', x.email, x.password);
}

async function client(s: Session) {
  const c = await A(s, '/clients', {
    type: 'business',
    displayName: `Public Docs ${u()}`,
    email: `pd-${u()}@example.com`,
    defaultCurrency: 'USD',
    paymentTermsDays: 14,
    tags: [],
  });
  return c.body.data.id as string;
}

const line = { description: 'Website', quantity: '1', unitPriceMinor: 50_000, discountType: 'none', discountValue: 0 };

async function invoice(s: Session, clientId: string, issue = true) {
  const d = await A(s, '/invoices', { clientId, currency: 'USD', items: [line] });
  const id = d.body.data.id as string;
  if (issue) expect((await A(s, `/invoices/${id}/issue`, { send: false })).status).toBe(200);
  return id;
}

async function attempt(clientId: string, invoiceId: string, status: string) {
  const id = `pat_${u()}`;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO payment_provider_accounts (id, provider_key, label, mode, secret_prefix) VALUES ('ppa_test_public', 'mock', 'Mock', 'test', 'MOCK')`,
  ).run();
  await env.DB.prepare(
    `INSERT INTO payment_attempts (id, invoice_id, client_id, provider_key, account_id, flow, method_code, payer_phone_masked,
       amount_minor, currency, status, merchant_reference, idempotency_key, failure_reason, provider_status_raw, poll_url)
     VALUES (?, ?, ?, 'mock', 'ppa_test_public', 'express', 'ecocash', '077****111', 50000, 'USD', ?, ?, ?,
       'Insufficient balance on 0771111111', 'status=Failed&hash=ABC', 'https://provider.example/poll/secret')`,
  )
    .bind(id, invoiceId, clientId, status, id, `idem-${id}`)
    .run();
  return id;
}

const ctx = () => createContext({ env });
const sigOf = (url: string) => new URL(url).searchParams.get('t')!;
const fetchRaw = (path: string) => exports.default.fetch(`${ORIGIN}${path}`);

describe('public document links (P5.8)', () => {
  beforeEach(() => seedBase());

  it('quotation and invoice tokens open only their own issued document', async () => {
    const s = await staff();
    const clientId = await client(s);
    const issued = await invoice(s, clientId);
    const draft = await invoice(s, clientId, false);
    const q = await A(s, '/quotations', { clientId, currency: 'USD', title: 'Website', items: [line] });
    expect(q.status, JSON.stringify(q.body)).toBe(201);
    const quotationId = q.body.data.id as string;
    expect((await A(s, `/quotations/${quotationId}/send`, {})).status).toBe(200);

    const c = ctx();
    const invToken = (await documentToken(c, 'invoice', issued)).token;
    const quoToken = (await documentToken(c, 'quotation', quotationId)).token;
    expect(await invoiceIdForToken(c, invToken)).toBe(issued);
    expect((await getPublicInvoice(c, invToken))?.invoice.id).toBe(issued);
    expect(await quotationIdForToken(c, quoToken)).toBe(quotationId);
    expect((await getPublicQuotation(c, quoToken))?.quotation.id).toBe(quotationId);

    // A token for another kind, a draft, a one-character change, malformed and oversized tokens: nothing.
    expect(await invoiceIdForToken(c, quoToken)).toBeNull();
    expect(await quotationIdForToken(c, invToken)).toBeNull();
    expect(await invoiceIdForToken(c, (await documentToken(c, 'invoice', draft)).token)).toBeNull();
    const flipped = invToken.slice(0, -1) + (invToken.endsWith('A') ? 'B' : 'A');
    for (const bad of [flipped, 'short', `${invToken}'--`, '../../etc/passwd', 'x'.repeat(101), '']) {
      expect(await invoiceIdForToken(c, bad)).toBeNull();
      expect(await getPublicInvoice(c, bad)).toBeNull();
      expect(await getPublicQuotation(c, bad)).toBeNull();
    }

    // Public PDFs: private, never indexed; bad tokens are 404 with the same headers.
    for (const path of [`/api/v1/public/invoices/${invToken}/pdf`, `/api/v1/public/quotations/${quoToken}/pdf`]) {
      const res = await fetchRaw(path);
      expect(res.status).toBe(200);
      expect(isPdf(new Uint8Array(await res.arrayBuffer()))).toBe(true);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
      expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    }
    const missing = await fetchRaw(`/api/v1/public/invoices/${flipped}/pdf`);
    expect(missing.status).toBe(404);
    expect(missing.headers.get('cache-control')).toBe('private, no-store');
    expect(missing.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('/pay/return: signed per attempt, status only, receipt once paid, provider details never leak', async () => {
    const s = await staff();
    const clientId = await client(s);
    const invoiceId = await invoice(s, clientId);
    const waiting = await attempt(clientId, invoiceId, 'pending');
    const failed = await attempt(clientId, invoiceId, 'failed');
    const done = await attempt(clientId, invoiceId, 'succeeded');
    await env.DB.prepare(
      `INSERT INTO payments (id, receipt_number, client_id, provider_key, method, amount_minor, currency, received_at, attempt_id)
       VALUES (?, ?, ?, 'mock', 'ecocash', 50000, 'USD', ?, ?)`,
    )
      .bind(`pay_${u()}`, `RCT-PD-${u()}`, clientId, new Date().toISOString(), done)
      .run();
    const c = ctx();
    const url = await paymentReturnUrl(c, waiting);
    expect(url).toMatch(new RegExp(`^${c.config.siteOrigin}/pay/return\\?attempt=${waiting}&t=[A-Za-z0-9_-]{43}$`));
    const sig = sigOf(url);
    expect(await verifyPaymentReturn(c, waiting, sig)).toBe(true);
    expect(await verifyPaymentReturn(c, failed, sig)).toBe(false);
    expect(await verifyPaymentReturn(c, waiting, sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A'))).toBe(false);
    expect(await verifyPaymentReturn(c, `${waiting}' OR 1=1`, sig)).toBe(false);

    const status = await api(`/api/v1/public/payment-attempts/${waiting}?t=${sig}`);
    expect(status.status).toBe(200);
    expect(status.headers.get('cache-control')).toBe('private, no-store');
    expect(status.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(status.body.data).toMatchObject({ phase: 'waiting', amountMinor: 50_000, payment: null });
    expect(status.body.data.links).toEqual({
      status: `/api/v1/public/payment-attempts/${waiting}?t=${sig}`,
      invoice: `/i/${(await documentToken(c, 'invoice', invoiceId)).token}`,
      receipt: null,
    });
    expect((await api(`/api/v1/public/payment-attempts/${waiting}/receipt?t=${sig}`)).status).toBe(404);

    // Without the signature, with another attempt's signature, or for an unknown attempt: 404 alike.
    expect((await api(`/api/v1/public/payment-attempts/${waiting}`)).status).toBe(404);
    expect((await api(`/api/v1/public/payment-attempts/${failed}?t=${sig}`)).status).toBe(404);
    expect((await api(`/api/v1/public/payment-attempts/pat_nope?t=${sig}`)).status).toBe(404);

    const f = await api(`/api/v1/public/payment-attempts/${failed}?t=${sigOf(await paymentReturnUrl(c, failed))}`);
    expect(f.body.data.phase).toBe('failed');
    const raw = JSON.stringify([status.body, f.body]);
    for (const secret of ['Insufficient', '0771111111', 'hash=ABC', 'provider.example', 'ppa_test_public']) {
      expect(raw).not.toContain(secret);
    }

    // Reading the status never changes the attempt (the browser return is never proof of payment).
    expect(
      (
        await env.DB.prepare('SELECT status FROM payment_attempts WHERE id = ?')
          .bind(waiting)
          .first<{ status: string }>()
      )?.status,
    ).toBe('pending');

    const doneSig = sigOf(await paymentReturnUrl(c, done));
    const ok = await getPublicAttempt(c, done, doneSig);
    expect(ok?.phase).toBe('succeeded');
    expect(ok?.links.receipt).toBe(`/api/v1/public/payment-attempts/${done}/receipt?t=${doneSig}`);
    const receipt = await fetchRaw(ok!.links.receipt!);
    expect(receipt.status).toBe(200);
    expect(receipt.headers.get('content-type')).toBe('application/pdf');
    expect(receipt.headers.get('cache-control')).toBe('private, no-store');
    expect(receipt.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(isPdf(new Uint8Array(await receipt.arrayBuffer()))).toBe(true);
  });

  it('public token pages share a per-IP rate limit', async () => {
    const c = createContext({
      env,
      request: new Request(`${ORIGIN}/i/x`, {
        headers: { 'cf-connecting-ip': `203.0.113.${Math.floor(Math.random() * 200)}` },
      }),
    });
    await env.DB.prepare('DELETE FROM rate_limits WHERE key = ?').bind(`document-page:ip:${c.ip}`).run();
    for (let i = 0; i < 300; i++) expect(await publicDocumentPageLimit(c)).toBeNull();
    const res = await publicDocumentPageLimit(c);
    expect(res?.status).toBe(429);
    expect(res?.headers.get('retry-after')).toBeTruthy();
  });
});
