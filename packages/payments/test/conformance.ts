/**
 * Adapter conformance kit (docs/06 §1). Every adapter runs this suite; passing it is the proof that adapters are
 * interchangeable for the app. An adapter supplies a harness that knows how to make "its gateway" report an outcome
 * (a store for the mock, mocked HTTP responses for real gateways) and how to produce authentic and forged callbacks.
 */
import { describe, expect, it } from 'vitest';
import { ProviderError } from '../src/errors';
import type {
  InboundCallback,
  InitiateInput,
  InitiateResult,
  NormalizedStatus,
  PaymentProvider,
  ProviderConfig,
} from '../src/types';
import { NORMALIZED_STATUSES } from '../src/types';

export interface ConformanceHarness {
  provider: PaymentProvider;
  config: ProviderConfig;
  /** Every credential value in `config` (asserted never to appear in results or error messages). */
  secrets: string[];
  /** An express method that needs a phone, and a phone the gateway accepts. Omit if the adapter has no express flow. */
  express?: { methodCode: string; phone: string };
  /** Make the gateway report `status` for this payment on the next status check. */
  settle(ref: InitiateResult, merchantReference: string, status: 'succeeded' | 'failed' | 'cancelled'): Promise<void>;
  /** A callback the gateway would send for this payment; `forge` = same claim with a wrong or missing signature. */
  callback(
    ref: InitiateResult,
    merchantReference: string,
    status: 'succeeded',
    opts: { forge: boolean },
  ): Promise<InboundCallback>;
}

let seq = 0;
const input = (over: Partial<InitiateInput> = {}): InitiateInput => ({
  merchantReference: `pat_conf_${Date.now().toString(36)}_${++seq}`,
  amountMinor: 1234,
  currency: 'USD',
  description: 'Invoice INV-2026-00001',
  returnUrl: 'https://kuzikode.example/pay/return?attempt=x&t=y',
  resultUrl: 'https://kuzikode.example/api/payments/callbacks/x/y',
  flow: 'redirect',
  ...over,
});

const leaks = (h: ConformanceHarness, value: unknown) => {
  const json = JSON.stringify(value);
  return h.secrets.filter((s) => s.length >= 4 && json.includes(s));
};

export function describeConformance(name: string, makeHarness: () => Promise<ConformanceHarness> | ConformanceHarness) {
  describe(`${name}: PaymentProvider conformance`, () => {
    it('declares a key, a name, credentials and well-formed capabilities', async () => {
      const h = await makeHarness();
      expect(h.provider.key).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(h.provider.displayName.length).toBeGreaterThan(0);
      for (const f of h.provider.credentialFields) {
        expect(f.key).toMatch(/^[a-zA-Z]+$/);
        expect(f.env).toMatch(/^[A-Z][A-Z0-9_]*$/);
      }
      const caps = h.provider.capabilities(h.config);
      expect(caps.flows.length).toBeGreaterThan(0);
      expect(caps.currencies.length).toBeGreaterThan(0);
      for (const c of caps.currencies) expect(c).toMatch(/^[A-Z]{3}$/);
      const codes = new Set<string>();
      for (const m of caps.methods) {
        expect(m.code).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(codes.has(m.code), `duplicate method ${m.code}`).toBe(false);
        codes.add(m.code);
        expect(caps.flows).toContain(m.flow);
        expect(m.name.length).toBeGreaterThan(0);
      }
      expect(typeof caps.refunds).toBe('boolean');
      expect(caps.refunds).toBe(typeof h.provider.refundPayment === 'function');
      if (caps.methods.some((m) => m.needs?.includes('otp'))) expect(typeof h.provider.submitOtp).toBe('function');
    });

    it('starts a redirect payment and reports its outcome with our amount and reference', async () => {
      const h = await makeHarness();
      if (!h.provider.capabilities(h.config).flows.includes('redirect')) return;
      const i = input();
      const res = await h.provider.initiatePayment(h.config, i);
      expect(res.kind).toBe('redirect');
      if (res.kind !== 'redirect') return;
      expect(() => new URL(res.redirectUrl)).not.toThrow();
      expect(leaks(h, res)).toEqual([]);
      await h.settle(res, i.merchantReference, 'succeeded');
      const status = await h.provider.checkPaymentStatus(h.config, {
        ...(res.pollUrl ? { pollUrl: res.pollUrl } : {}),
        ...(res.providerReference ? { providerReference: res.providerReference } : {}),
        merchantReference: i.merchantReference,
      });
      expect(status.status).toBe('succeeded');
      expect(status.amountMinor).toBe(1234);
      if (status.currency) expect(status.currency).toBe('USD');
      if (status.merchantReference) expect(status.merchantReference).toBe(i.merchantReference);
      expect(leaks(h, status)).toEqual([]);
    });

    it('starts an express payment and reports a failure as failed or cancelled, never succeeded', async () => {
      const h = await makeHarness();
      if (!h.express) return;
      const i = input({ flow: 'express', methodCode: h.express.methodCode, phone: h.express.phone });
      const res = await h.provider.initiatePayment(h.config, i);
      expect(res.kind).toBe('express_pending');
      expect(leaks(h, res)).toEqual([]);
      for (const outcome of ['failed', 'cancelled'] as const) {
        const j = input({ flow: 'express', methodCode: h.express.methodCode, phone: h.express.phone });
        const r = await h.provider.initiatePayment(h.config, j);
        await h.settle(r, j.merchantReference, outcome);
        const s = await h.provider.checkPaymentStatus(h.config, {
          ...(r.pollUrl ? { pollUrl: r.pollUrl } : {}),
          ...(r.providerReference ? { providerReference: r.providerReference } : {}),
          merchantReference: j.merchantReference,
        });
        expect(s.status).toBe(outcome);
        expect(NORMALIZED_STATUSES).toContain(s.status);
      }
    });

    it('authenticates callbacks: genuine → authentic, forged → not authentic (claims are never trusted)', async () => {
      const h = await makeHarness();
      const i = input();
      const res = await h.provider.initiatePayment(h.config, i);
      const genuine = await h.provider.parseCallback(
        h.config,
        await h.callback(res, i.merchantReference, 'succeeded', { forge: false }),
      );
      expect(genuine.authentic).toBe(true);
      expect(genuine.claimed.status).toBe('succeeded');
      expect(leaks(h, genuine.claimed)).toEqual([]);
      const forged = await h.provider.parseCallback(
        h.config,
        await h.callback(res, i.merchantReference, 'succeeded', { forge: true }),
      );
      expect(forged.authentic).toBe(false);
      const garbage = await h.provider.parseCallback(h.config, {
        headers: new Headers(),
        body: 'not a callback',
        contentType: 'text/plain',
      });
      expect(garbage.authentic).toBe(false);
      expect(NORMALIZED_STATUSES as readonly NormalizedStatus[]).toContain(garbage.claimed.status);
    });

    it('fails with a safe ProviderError for bad input, without leaking credentials', async () => {
      const h = await makeHarness();
      const bad = input({ amountMinor: 0 });
      const err = await h.provider.initiatePayment(h.config, bad).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ProviderError);
      expect(leaks(h, (err as Error).message)).toEqual([]);
      expect(typeof (err as ProviderError).retryable).toBe('boolean');
    });
  });
}
