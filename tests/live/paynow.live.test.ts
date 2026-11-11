/**
 * Live payment suite (docs/06 §8, P6.5): real calls to Paynow in TEST mode with Paynow's documented test numbers.
 * Opt-in (`npm run test:payments:live`), never part of `npm run verify` or default CI. Needs the test-mode integration:
 * PAYNOW_USD_INTEGRATION_ID, PAYNOW_USD_INTEGRATION_KEY and PAYNOW_TEST_AUTHEMAIL (the merchant login e-mail Paynow
 * requires as `authemail` in test mode). Without them the Paynow block is skipped and says so.
 *
 * Optional: LIVE_RESULT_URL / LIVE_RETURN_URL point Paynow's status updates at a deployed site (staging) so its result
 * URL is reachable; by default an example URL is used (Paynow still answers; its result POSTs just go nowhere).
 *
 * Test numbers (docs/06 §4): 0771111111 paid after ~5 s, 0773333333 cancelled after ~30 s, 0774444444 refused at once.
 */
import { describe, expect, it } from 'vitest';
import { ProviderError, createPaynowProvider, createPesepayProvider, type ProviderConfig } from '@kuzikode/payments';

const env = process.env;
const paynowReady = !!(env.PAYNOW_USD_INTEGRATION_ID && env.PAYNOW_USD_INTEGRATION_KEY && env.PAYNOW_TEST_AUTHEMAIL);
const pesepayReady = !!(env.PESEPAY_USD_INTEGRATION_KEY && env.PESEPAY_USD_ENCRYPTION_KEY);
const RESULT_URL = env.LIVE_RESULT_URL ?? 'https://example.com/api/payments/callbacks/paynow/live-suite';
const RETURN_URL = env.LIVE_RETURN_URL ?? 'https://example.com/pay/return';
const run = `live${Date.now().toString(36)}`;
console.info(
  `[payments-live] Paynow: ${paynowReady ? 'running' : 'SKIPPED (no test-mode credentials)'} · PesePay: ${pesepayReady ? 'running' : 'SKIPPED (no test credentials)'}`,
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...args: unknown[]) => console.info('[payments-live]', ...args);

/** Polls until the status leaves `pending` or the deadline passes. */
async function pollUntilSettled<T extends { status: string }>(check: () => Promise<T>, ms: number): Promise<T> {
  const deadline = Date.now() + ms;
  let last = await check();
  while (last.status === 'pending' && Date.now() < deadline) {
    await sleep(4000);
    last = await check();
  }
  return last;
}

describe.skipIf(!paynowReady)('Paynow test mode (live)', () => {
  const paynow = createPaynowProvider();
  const config: ProviderConfig = {
    accountId: 'live-suite',
    mode: 'test',
    credentials: {
      integrationId: env.PAYNOW_USD_INTEGRATION_ID ?? '',
      integrationKey: env.PAYNOW_USD_INTEGRATION_KEY ?? '',
    },
    options: { testAuthEmail: env.PAYNOW_TEST_AUTHEMAIL },
  };
  const express = (suffix: string, phone: string) =>
    paynow.initiatePayment(config, {
      merchantReference: `${run}-${suffix}`,
      amountMinor: 100,
      currency: 'USD',
      description: `Kuzikode live test ${suffix}`,
      returnUrl: RETURN_URL,
      resultUrl: RESULT_URL,
      flow: 'express',
      methodCode: 'ecocash',
      phone,
    });

  it('EcoCash 0771111111: prompt sent, then Paid for $1.00 with our reference (poll URL and trace)', async () => {
    const r = await express('ok', '0771111111');
    expect(r.kind).toBe('express_pending');
    expect(r.pollUrl).toMatch(/^https:\/\/www\.paynow\.co\.zw\//);
    const s = await pollUntilSettled(() => paynow.checkPaymentStatus(config, { pollUrl: r.pollUrl! }), 60_000);
    log('0771111111', s.providerStatus, s.amountMinor, s.merchantReference);
    expect(s).toMatchObject({ status: 'succeeded', amountMinor: 100, merchantReference: `${run}-ok` });
    // Reconciliation without a poll URL: trace by our reference.
    const traced = await paynow.checkPaymentStatus(config, { merchantReference: `${run}-ok` });
    expect(traced.status).toBe('succeeded');
  }, 90_000);

  it('EcoCash 0773333333: the payer cancels → cancelled/failed, nothing paid', async () => {
    const r = await express('cancel', '0773333333');
    expect(r.kind).toBe('express_pending');
    const s = await pollUntilSettled(() => paynow.checkPaymentStatus(config, { pollUrl: r.pollUrl! }), 75_000);
    log('0773333333', s.providerStatus);
    expect(['cancelled', 'failed']).toContain(s.status);
  }, 100_000);

  it('EcoCash 0774444444: refused at once for insufficient balance (declined, not retryable)', async () => {
    const err = await express('insufficient', '0774444444').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    log('0774444444', (err as ProviderError).code, (err as ProviderError).message);
    expect((err as ProviderError).code).toBe('declined');
    expect((err as ProviderError).retryable).toBe(false);
  }, 30_000);

  it('redirect (card / Paynow page): verified Paynow URL, then the status is still waiting', async () => {
    const r = await paynow.initiatePayment(config, {
      merchantReference: `${run}-redirect`,
      amountMinor: 250,
      currency: 'USD',
      description: 'Kuzikode live test redirect',
      returnUrl: RETURN_URL,
      resultUrl: RESULT_URL,
      flow: 'redirect',
      methodCode: 'card',
    });
    expect(r.kind).toBe('redirect');
    if (r.kind !== 'redirect') return;
    expect(r.redirectUrl).toMatch(/^https:\/\/www\.paynow\.co\.zw\//);
    const s = await paynow.checkPaymentStatus(config, { pollUrl: r.pollUrl! });
    log('redirect', s.providerStatus); // the URL is not logged: in test mode it carries the merchant e-mail
    expect(s.status).toBe('pending');
  }, 30_000);
});

describe.skipIf(!pesepayReady)('PesePay test environment (live)', () => {
  it('initiate + check payment status', async () => {
    const pesepay = createPesepayProvider();
    const config: ProviderConfig = {
      accountId: 'live-suite',
      mode: 'test',
      credentials: {
        integrationKey: env.PESEPAY_USD_INTEGRATION_KEY ?? '',
        encryptionKey: env.PESEPAY_USD_ENCRYPTION_KEY ?? '',
      },
    };
    const r = await pesepay.initiatePayment(config, {
      merchantReference: `${run}-pp`,
      amountMinor: 100,
      currency: 'USD',
      description: 'Kuzikode live test',
      returnUrl: RETURN_URL,
      resultUrl: RESULT_URL,
      flow: 'redirect',
      methodCode: 'card',
    });
    expect(r.kind).toBe('redirect');
    const s = await pesepay.checkPaymentStatus(config, {
      ...(r.providerReference ? { providerReference: r.providerReference } : {}),
      ...(r.pollUrl ? { pollUrl: r.pollUrl } : {}),
    });
    log('pesepay', s.providerStatus);
    expect(s.status).toBe('pending');
  }, 30_000);
});
