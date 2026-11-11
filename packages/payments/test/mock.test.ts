import { describe, expect, it } from 'vitest';
import { ProviderError } from '../src/errors';
import { createMockProvider, memoryMockStore, MOCK_OTP, signMockCallback } from '../src/providers/mock';
import type { ProviderConfig } from '../src/types';
import { describeConformance } from './conformance';

const config: ProviderConfig = {
  accountId: 'ppa_mock',
  mode: 'test',
  credentials: { signingKey: 'unit-test-signing-key-123' },
  options: { checkoutBaseUrl: 'http://localhost:8787/dev/mock-checkout' },
};

function setup(start = new Date('2026-11-11T10:00:00Z')) {
  let now = start;
  const store = memoryMockStore();
  const provider = createMockProvider({ store, now: () => now });
  return { store, provider, tick: (seconds: number) => (now = new Date(now.getTime() + seconds * 1000)) };
}

describeConformance('mock', () => {
  const { provider } = setup();
  return {
    provider,
    config,
    secrets: ['unit-test-signing-key-123'],
    express: { methodCode: 'ecocash', phone: '0771111111' },
    async settle(res, _ref, status) {
      await provider.settle(config, res.providerReference!, status);
    },
    async callback(res, merchantReference, status, { forge }) {
      const body = await signMockCallback(
        forge ? { ...config, credentials: { signingKey: 'wrong-key-0000' } } : config,
        { reference: res.providerReference!, merchantReference, status, amountMinor: 1234, currency: 'USD' },
      );
      return { headers: new Headers({ 'content-type': 'application/json' }), body, contentType: 'application/json' };
    },
  };
});

const express = (over: Record<string, string> = {}) => ({
  merchantReference: `pat_${Math.random().toString(36).slice(2)}`,
  amountMinor: 5000,
  currency: 'USD',
  description: 'Invoice',
  returnUrl: 'https://x.example/r',
  resultUrl: 'https://x.example/c',
  flow: 'express' as const,
  methodCode: 'ecocash',
  phone: '0771111111',
  ...over,
});

describe('mock gateway simulation', () => {
  it('follows the test numbers: success after 5 s, cancelled after 30 s, insufficient refused at once', async () => {
    const { provider, tick } = setup();
    const ok = await provider.initiatePayment(config, express());
    const cancel = await provider.initiatePayment(config, express({ phone: '0773333333' }));
    expect((await provider.checkPaymentStatus(config, { pollUrl: ok.pollUrl! })).status).toBe('pending');
    tick(5);
    expect((await provider.checkPaymentStatus(config, { pollUrl: ok.pollUrl! })).status).toBe('succeeded');
    expect((await provider.checkPaymentStatus(config, { pollUrl: cancel.pollUrl! })).status).toBe('pending');
    tick(25);
    expect((await provider.checkPaymentStatus(config, { pollUrl: cancel.pollUrl! })).status).toBe('cancelled');
    const refused = await provider.initiatePayment(config, express({ phone: '0774444444' })).catch((e) => e);
    expect(refused).toBeInstanceOf(ProviderError);
    expect(refused).toMatchObject({ code: 'declined', retryable: false, message: 'Insufficient balance' });
  });

  it('InnBucks returns a code with an expiry; O’mari needs the OTP', async () => {
    const { provider } = setup();
    const inn = await provider.initiatePayment(config, express({ methodCode: 'innbucks', phone: '' }));
    expect(inn.kind).toBe('express_pending');
    if (inn.kind === 'express_pending') {
      expect(inn.authorizationCode).toMatch(/^\d{9}$/);
      expect(inn.authorizationExpiresAt).toBe('2026-11-11T10:30:00.000Z');
    }
    const om = await provider.initiatePayment(config, express({ methodCode: 'omari' }));
    if (om.kind !== 'express_pending' || !om.otpRequired) throw new Error('expected an OTP step');
    const wrong = await provider.initiatePayment(config, express({ methodCode: 'omari' }));
    if (wrong.kind !== 'express_pending' || !wrong.otpRequired) throw new Error('expected an OTP step');
    expect((await provider.submitOtp!(config, { submitUrl: om.otpRequired.submitUrl, otp: MOCK_OTP })).status).toBe(
      'succeeded',
    );
    expect((await provider.submitOtp!(config, { submitUrl: wrong.otpRequired.submitUrl, otp: '000000' })).status).toBe(
      'failed',
    );
    await expect(provider.submitOtp!(config, { submitUrl: om.otpRequired.submitUrl, otp: MOCK_OTP })).rejects.toThrow(
      ProviderError,
    );
  });

  it('hosted page outcomes: partial pays half; a settled payment cannot be settled again; refunds', async () => {
    const { provider } = setup();
    const r = await provider.initiatePayment(config, { ...express(), flow: 'redirect', methodCode: 'card' });
    expect(r.kind === 'redirect' && r.redirectUrl).toBe(
      `http://localhost:8787/dev/mock-checkout/${encodeURIComponent(r.providerReference!)}`,
    );
    await provider.settle(config, r.providerReference!, 'partially_paid');
    const s = await provider.checkPaymentStatus(config, { providerReference: r.providerReference! });
    expect(s).toMatchObject({ status: 'partially_paid', amountMinor: 2500 });
    await expect(provider.settle(config, r.providerReference!, 'succeeded')).rejects.toThrow(ProviderError);

    const paid = await provider.initiatePayment(config, { ...express(), flow: 'redirect', methodCode: 'card' });
    await provider.settle(config, paid.providerReference!, 'succeeded');
    expect(
      await provider.refundPayment!(config, { providerReference: paid.providerReference!, amountMinor: 5000 }),
    ).toEqual({
      status: 'completed',
      providerReference: `refund_${paid.providerReference}`,
    });
    expect((await provider.checkPaymentStatus(config, { providerReference: paid.providerReference! })).status).toBe(
      'refunded',
    );
  });

  it('is scoped to its account and refuses unknown methods, wrong flows and missing keys', async () => {
    const { provider } = setup();
    const r = await provider.initiatePayment(config, express());
    await expect(
      provider.checkPaymentStatus({ ...config, accountId: 'ppa_other' }, { pollUrl: r.pollUrl! }),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(provider.initiatePayment(config, express({ methodCode: 'bitcoin' }))).rejects.toMatchObject({
      code: 'not_supported',
    });
    await expect(provider.initiatePayment(config, { ...express(), flow: 'redirect' })).rejects.toMatchObject({
      code: 'invalid_request',
    });
    await expect(provider.initiatePayment({ ...config, credentials: {} }, express())).rejects.toMatchObject({
      code: 'misconfigured',
    });
  });
});
