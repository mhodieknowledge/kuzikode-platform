import { createCipheriv } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createPesepayProvider, mapPesepayStatus, pesepayDecrypt, pesepayEncrypt } from '../src/providers/pesepay';
import type { ProviderConfig } from '../src/types';
import { describeConformance } from './conformance';

const ENC_KEY = 'abcdef0123456789ABCDEF0123456789'; // 32 characters, as PesePay issues them
const INT_KEY = 'pesepay-integration-key-test-001';
const config: ProviderConfig = {
  accountId: 'ppa_pesepay_main',
  mode: 'test',
  credentials: { integrationKey: INT_KEY, encryptionKey: ENC_KEY },
};

describe('PesePay encryption (docs/Encryption guide)', () => {
  it('matches the Node.js reference implementation from the docs byte for byte', async () => {
    const body = {
      amountDetails: { amount: 10, currencyCode: 'USD' },
      reasonForPayment: 'Order #1042 — running shoes',
    };
    const cipher = createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENC_KEY, 'utf8'),
      Buffer.from(ENC_KEY.substring(0, 16), 'utf8'),
    );
    let expected = cipher.update(JSON.stringify(body), 'utf8', 'base64');
    expected += cipher.final('base64');
    expect(await pesepayEncrypt(body, ENC_KEY)).toBe(expected);
    expect(await pesepayDecrypt(expected, ENC_KEY)).toEqual(body);
  });

  it('refuses a wrong key length and unreadable payloads', async () => {
    await expect(pesepayEncrypt({}, 'short')).rejects.toMatchObject({ code: 'misconfigured' });
    await expect(pesepayDecrypt('bm90IGVuY3J5cHRlZA==', ENC_KEY)).rejects.toMatchObject({ code: 'invalid_response' });
  });
});

describe('PesePay statuses', () => {
  it.each([
    ['SUCCESS', 'succeeded'],
    ['INITIATED', 'pending'],
    ['PROCESSING', 'pending'],
    ['PENDING', 'pending'],
    ['PARTIALLY_PAID', 'partially_paid'],
    ['FAILED', 'failed'],
    ['DECLINED', 'failed'],
    ['INSUFFICIENT_FUNDS', 'failed'],
    ['AUTHORIZATION_FAILED', 'failed'],
    ['ERROR', 'failed'],
    ['SERVICE_UNAVAILABLE', 'failed'],
    ['CANCELLED', 'cancelled'],
    ['TERMINATED', 'cancelled'],
    ['TIME_OUT', 'expired'],
    ['CLOSED', 'expired'],
    ['CLOSED_PERIOD_ELAPSED', 'expired'],
    ['REVERSED', 'reversed'],
  ])('%s → %s', (s, n) => expect(mapPesepayStatus(s)).toBe(n));

  it('unknown statuses are not mapped (pending, never paid)', () => expect(mapPesepayStatus('NEW_THING')).toBeNull());
});

// ---------------------------------------------------------------- a fake PesePay

function fakePesepay() {
  const txs = new Map<string, Record<string, unknown>>();
  const sent: { url: string; method: string; auth: string | null; body: Record<string, unknown> | null }[] = [];
  let seq = 0;
  const reply = async (tx: unknown) => new Response(JSON.stringify({ payload: await pesepayEncrypt(tx, ENC_KEY) }));
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    const body = init?.body
      ? ((await pesepayDecrypt(JSON.parse(String(init.body)).payload, ENC_KEY)) as Record<string, unknown>)
      : null;
    sent.push({ url: url.toString(), method: init?.method ?? 'GET', auth: headers.get('authorization'), body });
    if (headers.get('authorization') !== INT_KEY)
      return new Response(
        JSON.stringify({ message: 'Integration key for the application is not valid', status: '403' }),
        {
          status: 403,
        },
      );
    if (url.pathname.endsWith('/payments/initiate')) {
      const amount = (body!['amountDetails'] as { amount: number }).amount;
      if (amount > 5000)
        return new Response(JSON.stringify({ message: 'Amount above the limit', status: '400' }), { status: 400 });
      const ref = `20261111-${++seq}`;
      const tx = {
        referenceNumber: ref,
        merchantReference: body!['merchantReference'],
        transactionStatus: 'INITIATED',
        amountDetails: body!['amountDetails'],
        redirectUrl: `https://pay.pesepay.com/#/pesepay-payments?referenceNumber=${ref}`,
        pollUrl: `https://api.test.sandbox.pesepay.com/payments-engine/v1/payments/check-payment?referenceNumber=${ref}`,
      };
      txs.set(ref, tx);
      return reply(tx);
    }
    if (url.pathname.endsWith('/payments/check-payment')) {
      const tx = txs.get(url.searchParams.get('referenceNumber') ?? '');
      if (!tx)
        return new Response(JSON.stringify({ message: 'Transaction not found', status: '404' }), { status: 404 });
      return reply({
        referenceNumber: tx['referenceNumber'],
        transactionStatus: tx['transactionStatus'],
        amountDetails: tx['amountDetails'],
      });
    }
    return new Response('{}', { status: 404 });
  }) as typeof globalThis.fetch;
  return { fetch, txs, sent };
}

describeConformance('pesepay', () => {
  const fake = fakePesepay();
  const provider = createPesepayProvider({ fetch: fake.fetch });
  const map = { succeeded: 'SUCCESS', failed: 'FAILED', cancelled: 'CANCELLED' } as const;
  return {
    provider,
    config,
    secrets: [INT_KEY, ENC_KEY],
    async settle(res, _ref, status) {
      fake.txs.get(res.providerReference!)!['transactionStatus'] = map[status];
    },
    async callback(res, _ref, status, { forge }) {
      const tx = fake.txs.get(res.providerReference!)!;
      return {
        headers: new Headers({ authorization: forge ? 'guessed-key' : INT_KEY, 'content-type': 'application/json' }),
        body: JSON.stringify({ ...tx, transactionStatus: map[status] }),
        contentType: 'application/json',
      };
    },
  };
});

const input = (over: Record<string, unknown> = {}) => ({
  merchantReference: 'att_PP1',
  amountMinor: 1050,
  currency: 'USD',
  description: 'Invoice INV-2026-00002',
  returnUrl: 'https://kuzikode.example/pay/return?attempt=att_PP1&t=x',
  resultUrl: 'https://kuzikode.example/api/payments/callbacks/pesepay/ppa_pesepay_main',
  flow: 'redirect' as const,
  ...over,
});

describe('PesePay adapter', () => {
  it('initiate: encrypted body with our amount, reference and the method/currency codes; sandbox in test mode', async () => {
    const fake = fakePesepay();
    const p = createPesepayProvider({ fetch: fake.fetch });
    const res = await p.initiatePayment(config, input({ methodCode: 'ecocash' }));
    expect(res.kind).toBe('redirect');
    const sent = fake.sent[0]!;
    expect(sent.url).toBe('https://api.test.sandbox.pesepay.com/payments-engine/v1/payments/initiate');
    expect(sent.auth).toBe(INT_KEY);
    expect(sent.body).toMatchObject({
      amountDetails: { amount: 10.5, currencyCode: 'USD' },
      merchantReference: 'att_PP1',
      paymentMethodCode: 'PZW211',
    });
    await p.initiatePayment(config, input({ methodCode: 'ecocash', currency: 'ZWG' }));
    expect(fake.sent[1]!.body).toMatchObject({ amountDetails: { currencyCode: 'ZiG' }, paymentMethodCode: 'PZW201' });
    await p.initiatePayment(config, input({ methodCode: 'omari', currency: 'ZWG' }));
    expect(fake.sent[2]!.body).toMatchObject({ amountDetails: { currencyCode: 'ZWG' }, paymentMethodCode: 'PZW217' });
    await p.initiatePayment(config, input({ methodCode: 'card' }));
    expect(fake.sent[3]!.body).not.toHaveProperty('paymentMethodCode');
    await expect(p.initiatePayment(config, input({ methodCode: 'innbucks', currency: 'ZWG' }))).rejects.toMatchObject({
      code: 'not_supported',
    });
    await expect(p.initiatePayment(config, input({ flow: 'express', methodCode: 'ecocash' }))).rejects.toMatchObject({
      code: 'not_supported',
    });
  });

  it('live mode uses the production API', async () => {
    const fake = fakePesepay();
    const p = createPesepayProvider({ fetch: fake.fetch });
    await p.initiatePayment({ ...config, mode: 'live' }, input()).catch(() => undefined);
    expect(fake.sent[0]!.url).toBe('https://api.pesepay.com/api/payments-engine/v1/payments/initiate');
  });

  it('status: amount back in minor units, ZiG reported as ZWG, failure text kept for finance', async () => {
    const fake = fakePesepay();
    const p = createPesepayProvider({ fetch: fake.fetch });
    const res = await p.initiatePayment(config, input({ methodCode: 'ecocash', currency: 'ZWG', amountMinor: 1029 }));
    const tx = fake.txs.get(res.providerReference!)!;
    tx['transactionStatus'] = 'INSUFFICIENT_FUNDS';
    tx['transactionStatusDescription'] = 'Insufficient funds';
    const s = await p.checkPaymentStatus(config, { providerReference: res.providerReference! });
    expect(s).toMatchObject({ status: 'failed', amountMinor: 1029, currency: 'ZWG' });
    // Looked up by the poll URL's reference too.
    expect((await p.checkPaymentStatus(config, { pollUrl: res.pollUrl! })).providerReference).toBe(
      res.providerReference,
    );
  });

  it('errors: plain JSON messages, 404 not found, 403 misconfigured, network retryable', async () => {
    const fake = fakePesepay();
    const p = createPesepayProvider({ fetch: fake.fetch });
    await expect(p.initiatePayment(config, input({ amountMinor: 600_000 }))).rejects.toMatchObject({
      code: 'invalid_request',
      message: 'Amount above the limit',
      retryable: false,
    });
    await expect(p.checkPaymentStatus(config, { providerReference: 'nope' })).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(
      p.initiatePayment({ ...config, credentials: { ...config.credentials, integrationKey: 'other' } }, input()),
    ).rejects.toMatchObject({ code: 'misconfigured' });
    const down = createPesepayProvider({
      fetch: (async () => {
        throw new TypeError('offline');
      }) as typeof fetch,
    });
    await expect(down.initiatePayment(config, input())).rejects.toMatchObject({ code: 'network', retryable: true });
  });

  it('callbacks: no Authorization header → not trusted; secrets never in raw', async () => {
    const p = createPesepayProvider({ fetch: fakePesepay().fetch });
    const body = JSON.stringify({
      referenceNumber: 'r1',
      transactionStatus: 'SUCCESS',
      amountDetails: { amount: 1, currencyCode: 'USD' },
    });
    const none = await p.parseCallback(config, { headers: new Headers(), body, contentType: 'application/json' });
    expect(none.authentic).toBe(false);
    expect(none.claimed.status).toBe('succeeded');
    const ok = await p.parseCallback(config, {
      headers: new Headers({ authorization: INT_KEY }),
      body,
      contentType: 'application/json',
    });
    expect(ok.authentic).toBe(true);
    expect(JSON.stringify(ok)).not.toContain(INT_KEY);
  });
});
