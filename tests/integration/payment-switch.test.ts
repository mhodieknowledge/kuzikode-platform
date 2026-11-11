/**
 * docs/06 §8: switching a route from Paynow to PesePay changes new attempts only; the in-flight Paynow attempt still
 * reconciles on its own account. Both real adapters run against faked gateway HTTP (global fetch stubbed).
 */
import { env } from 'cloudflare:workers';
import { paynowHash, pesepayDecrypt, pesepayEncrypt } from '@kuzikode/payments';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContext } from '../../src/server/context';
import { checkAttempt, initiateInvoicePayment } from '../../src/server/modules/payments';
import { api, login, type Session } from '../helpers/api';
import { createStaff } from '../helpers/factories';
import { seedBase } from '../helpers/seed';

const PAYNOW_KEY = 'paynow-int-key-switch-test';
const PESE_INT = 'pesepay-int-key-switch-test';
const PESE_ENC = '0123456789abcdef0123456789ABCDEF';
const secrets = {
  PAYNOW_USD_INTEGRATION_ID: '30001',
  PAYNOW_USD_INTEGRATION_KEY: PAYNOW_KEY,
  PAYNOW_TEST_AUTHEMAIL: 'merchant@kuzikode.example',
  PESEPAY_MAIN_INTEGRATION_KEY: PESE_INT,
  PESEPAY_MAIN_ENCRYPTION_KEY: PESE_ENC,
};
const ctxWith = () => createContext({ env: { ...env, ...secrets } as unknown as Env });

const calls: string[] = [];
const paynowStatus = new Map<string, string>();

async function paynowReply(fields: [string, string][]) {
  const hash = await paynowHash(
    fields.map(([, v]) => v),
    PAYNOW_KEY,
  );
  return [...fields, ['hash', hash]].map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&');
}

const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(String(input));
  calls.push(`${url.hostname}${url.pathname}`);
  if (url.hostname === 'www.paynow.co.zw' && url.pathname === '/interface/initiatetransaction') {
    const form = new URLSearchParams(String(init?.body));
    const ref = form.get('reference')!;
    paynowStatus.set(ref, 'Created');
    return new Response(
      await paynowReply([
        ['status', 'Ok'],
        ['browserurl', `https://www.paynow.co.zw/Payment/ConfirmPayment/${ref}`],
        ['pollurl', `https://www.paynow.co.zw/Interface/CheckPayment/?guid=${ref}`],
      ]),
    );
  }
  if (url.hostname === 'www.paynow.co.zw' && url.pathname === '/Interface/CheckPayment/') {
    const ref = url.searchParams.get('guid')!;
    return new Response(
      await paynowReply([
        ['reference', ref],
        ['paynowreference', `PN-${ref}`],
        ['amount', '500.00'],
        ['status', paynowStatus.get(ref) ?? 'Created'],
        ['pollurl', url.toString()],
      ]),
    );
  }
  if (url.hostname === 'api.test.sandbox.pesepay.com' && url.pathname.endsWith('/payments/initiate')) {
    const body = (await pesepayDecrypt(JSON.parse(String(init?.body)).payload, PESE_ENC)) as Record<string, unknown>;
    const ref = `PP-${String(body['merchantReference'])}`;
    return new Response(
      JSON.stringify({
        payload: await pesepayEncrypt(
          {
            referenceNumber: ref,
            redirectUrl: `https://pay.pesepay.com/#/pesepay-payments?referenceNumber=${ref}`,
            pollUrl: `https://api.test.sandbox.pesepay.com/payments-engine/v1/payments/check-payment?referenceNumber=${ref}`,
          },
          PESE_ENC,
        ),
      }),
    );
  }
  return new Response('not faked', { status: 599 });
};

describe('switching gateways is data, not code (P6.3b)', () => {
  beforeEach(async () => {
    await seedBase();
    calls.length = 0;
    vi.stubGlobal('fetch', fakeFetch);
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await env.DB.prepare(
      "UPDATE payment_routes SET account_id = 'ppa_paynow_usd' WHERE id = 'prt_platform_usd_paynow'",
    ).run();
  });

  it('Paynow → PesePay: only new attempts move; the Paynow attempt reconciles on Paynow', async () => {
    const x = await createStaff(['admin']);
    const s: Session = await login('admin', x.email, x.password);
    const A = (path: string, body: unknown) => api(`/api/v1/admin${path}`, { cookie: s.cookie, csrf: s.csrf, body });
    const c = await A('/clients', {
      type: 'business',
      displayName: 'Switch Ltd',
      email: 'switch@example.com',
      defaultCurrency: 'USD',
      paymentTermsDays: 14,
      tags: [],
    });
    const d = await A('/invoices', {
      clientId: c.body.data.id,
      currency: 'USD',
      items: [{ description: 'Site', quantity: '1', unitPriceMinor: 50_000, discountType: 'none', discountValue: 0 }],
    });
    const invoiceId = d.body.data.id as string;
    expect((await A(`/invoices/${invoiceId}/issue`, { send: false })).status).toBe(200);

    const ctx = ctxWith();
    const first = await initiateInvoicePayment(ctx, invoiceId, { methodCode: 'card', idempotencyKey: 'switch-key-1' });
    expect(first.redirectUrl).toMatch(/^https:\/\/www\.paynow\.co\.zw\//);
    const a1 = await env.DB.prepare('SELECT account_id, provider_key FROM payment_attempts WHERE id = ?')
      .bind(first.attemptId)
      .first();
    expect(a1).toEqual({ account_id: 'ppa_paynow_usd', provider_key: 'paynow' });

    // The owner switches USD to PesePay: one row changes.
    await env.DB.prepare(
      "UPDATE payment_routes SET account_id = 'ppa_pesepay_main' WHERE id = 'prt_platform_usd_paynow'",
    ).run();
    const second = await initiateInvoicePayment(ctx, invoiceId, { methodCode: 'card', idempotencyKey: 'switch-key-2' });
    expect(second.attemptId).not.toBe(first.attemptId);
    expect(second.redirectUrl).toMatch(/^https:\/\/pay\.pesepay\.com\//);
    const a2 = await env.DB.prepare('SELECT account_id, provider_key FROM payment_attempts WHERE id = ?')
      .bind(second.attemptId)
      .first();
    expect(a2).toEqual({ account_id: 'ppa_pesepay_main', provider_key: 'pesepay' });

    // The customer had paid on the Paynow page: reconciliation asks Paynow (not PesePay) and records it there.
    paynowStatus.set(first.attemptId, 'Paid');
    calls.length = 0;
    expect((await checkAttempt(ctx, first.attemptId, { force: true })).status).toBe('succeeded');
    expect(calls).toEqual(['www.paynow.co.zw/Interface/CheckPayment/']);
    const pay = await env.DB.prepare('SELECT account_id, provider_key, amount_minor FROM payments WHERE attempt_id = ?')
      .bind(first.attemptId)
      .first();
    expect(pay).toEqual({ account_id: 'ppa_paynow_usd', provider_key: 'paynow', amount_minor: 50_000 });
  });
});
