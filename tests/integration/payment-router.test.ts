/**
 * P6.1 app router (docs/06 §2) and the mock gateway's hosted page service (§6): route selection, skips, the methods a
 * checkout offers, credential status, and the mock never being reachable with a production configuration.
 */
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { AppError } from '../../src/server/lib/errors';
import {
  accountConfig,
  credentialStatus,
  getAccount,
  getMockCheckout,
  paymentMethodOptions,
  resolveRoute,
  settleMockCheckout,
} from '../../src/server/modules/payments';
import { seedBase } from '../helpers/seed';

const u = () => Math.random().toString(36).slice(2, 8);
type Over = Record<string, string>;
const ctxWith = (over: Over = {}) => createContext({ env: { ...env, ...over } as unknown as Env });

async function account(
  id: string,
  prefix: string,
  over: { currencies?: string[]; methods?: string[]; enabled?: 0 | 1 } = {},
) {
  await env.DB.prepare(
    `INSERT INTO payment_provider_accounts (id, provider_key, label, mode, secret_prefix, currencies, enabled_methods, enabled)
     VALUES (?, 'mock', ?, 'test', ?, ?, ?, ?)`,
  )
    .bind(
      id,
      `Mock ${id}`,
      prefix,
      JSON.stringify(over.currencies ?? []),
      JSON.stringify(over.methods ?? []),
      over.enabled ?? 1,
    )
    .run();
}
async function route(app: string, currency: string, method: string, accountId: string, priority: number, enabled = 1) {
  await env.DB.prepare(
    `INSERT INTO payment_routes (id, app_key, currency, method_code, account_id, priority, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(`prt_${u()}`, app, currency, method, accountId, priority, enabled)
    .run();
}

async function expectNotFound(p: Promise<unknown>) {
  const err = await p.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe('NOT_FOUND');
}

describe('payment router (P6.1)', () => {
  beforeEach(() => seedBase());

  it('most specific route wins, then priority; unusable accounts are skipped; no route → null', async () => {
    const app = `app-${u()}`;
    const [wild, wild2, usd, inn, off, zwgOnly, noInn] = ['w1', 'w2', 'usd', 'inn', 'off', 'zwg', 'noinn'].map(
      (x) => `ppa_${x}_${u()}`,
    ) as [string, string, string, string, string, string, string];
    await account(wild, 'MOCKW');
    await account(wild2, 'MOCKX');
    await account(usd, 'MOCKU');
    await account(inn, 'MOCKI');
    await account(off, 'MOCKO', { enabled: 0 });
    await account(zwgOnly, 'MOCKZ', { currencies: ['ZWG'] });
    await account(noInn, 'MOCKN', { methods: ['ecocash'] });
    await route(app, '*', '*', wild, 200);
    await route(app, '*', '*', wild2, 100); // same specificity, lower priority → preferred
    await route(app, 'USD', '*', off, 1); // account disabled → skipped
    await route(app, 'USD', '*', zwgOnly, 2); // account doesn't take USD → skipped
    await route(app, 'USD', '*', usd, 500); // exact currency beats the wildcards despite its priority
    await route(app, 'USD', 'innbucks', noInn, 1); // account doesn't offer InnBucks → skipped
    await route(app, 'USD', 'innbucks', inn, 900);
    await route(app, 'USD', 'ecocash', usd, 50, 0); // route disabled → ignored

    const ctx = ctxWith();
    expect((await resolveRoute(ctx, { appKey: app, currency: 'USD' }))?.account.id).toBe(usd);
    expect((await resolveRoute(ctx, { appKey: app, currency: 'USD', methodCode: 'innbucks' }))?.account.id).toBe(inn);
    expect((await resolveRoute(ctx, { appKey: app, currency: 'USD', methodCode: 'ecocash' }))?.account.id).toBe(usd);
    expect((await resolveRoute(ctx, { appKey: app, currency: 'ZWG' }))?.account.id).toBe(wild2);
    expect(await resolveRoute(ctx, { appKey: app, currency: 'EUR' })).toBeNull(); // the mock takes USD/ZWG only
    expect(await resolveRoute(ctx, { appKey: app, currency: 'USD', methodCode: 'bitcoin' })).toBeNull();
    expect(await resolveRoute(ctx, { appKey: `none-${u()}`, currency: 'USD' })).toBeNull();

    const options = await paymentMethodOptions(ctx, { appKey: app, currency: 'USD' });
    expect(Object.fromEntries(options.map((o) => [o.code, o.accountId]))).toEqual({
      innbucks: inn,
      ecocash: usd,
      onemoney: usd,
      omari: usd,
      card: usd,
    });
    expect(options.every((o) => o.testMode)).toBe(true);
    expect(await paymentMethodOptions(ctx, { appKey: `none-${u()}`, currency: 'USD' })).toEqual([]);
  });

  it('outside development an account needs its own secrets; status shows names, never values', async () => {
    const app = `app-${u()}`;
    const a = `ppa_a_${u()}`;
    const b = `ppa_b_${u()}`;
    await account(a, 'MOCKSA');
    await account(b, 'MOCKSB');
    await route(app, 'USD', '*', a, 1);
    await route(app, 'USD', '*', b, 2);

    // Development: the mock's dev signing key fills in.
    expect((await resolveRoute(ctxWith(), { appKey: app, currency: 'USD' }))?.account.id).toBe(a);
    // Staging: A has no secret → skipped; B has one → chosen, with that key in its config only.
    const staging = ctxWith({ APP_ENV: 'staging', MOCKSB_SIGNING_KEY: 'staging-signing-key-b' });
    const r = await resolveRoute(staging, { appKey: app, currency: 'USD' });
    expect(r?.account.id).toBe(b);
    expect(r?.config.credentials).toEqual({ signingKey: 'staging-signing-key-b' });
    const accA = (await getAccount(staging, a))!;
    expect(accountConfig(staging, accA)).toBeNull();
    expect(credentialStatus(staging, accA)).toEqual({
      fields: [{ name: 'MOCKSA_SIGNING_KEY', present: false }],
      complete: false,
    });
    const statusB = credentialStatus(staging, (await getAccount(staging, b))!);
    expect(statusB.complete).toBe(true);
    expect(JSON.stringify(statusB)).not.toContain('staging-signing-key-b');
    // Neither has a secret → no way to pay.
    expect(await resolveRoute(ctxWith({ APP_ENV: 'staging' }), { appKey: app, currency: 'USD' })).toBeNull();
  });

  it('the mock gateway is unreachable with a production configuration, whatever the flag or secrets say', async () => {
    const app = `app-${u()}`;
    const a = `ppa_p_${u()}`;
    await account(a, 'MOCKP');
    await route(app, '*', '*', a, 1);
    const dev = ctxWith();
    const r = await resolveRoute(dev, { appKey: app, currency: 'USD' });
    const started = await r!.provider.initiatePayment(r!.config, {
      merchantReference: `pat_${u()}`,
      amountMinor: 1000,
      currency: 'USD',
      description: 'Invoice',
      returnUrl: `${dev.config.siteOrigin}/pay/return?attempt=x&t=y`,
      resultUrl: `${dev.config.siteOrigin}/api/payments/callbacks/mock/${a}`,
      flow: 'redirect',
      methodCode: 'card',
    });

    const prod = ctxWith({
      APP_ENV: 'production',
      PAYMENTS_MOCK_ENABLED: 'true',
      MOCKP_SIGNING_KEY: 'a-real-looking-secret',
    });
    expect(prod.config.mockPaymentsEnabled).toBe(false);
    expect(await resolveRoute(prod, { appKey: app, currency: 'USD' })).toBeNull();
    expect(await paymentMethodOptions(prod, { appKey: app, currency: 'USD' })).toEqual([]);
    expect(accountConfig(prod, (await getAccount(prod, a))!)).toBeNull();
    await expectNotFound(getMockCheckout(prod, started.providerReference!));
    await expectNotFound(settleMockCheckout(prod, started.providerReference!, 'succeeded'));
    // The same holds when the flag is off outside production.
    const off = ctxWith({ PAYMENTS_MOCK_ENABLED: 'false' });
    expect(await resolveRoute(off, { appKey: app, currency: 'USD' })).toBeNull();
    await expectNotFound(getMockCheckout(off, started.providerReference!));
  });

  it('mock hosted page: shows the payment, settles once, and the outcome is what a status check returns', async () => {
    const app = `app-${u()}`;
    const a = `ppa_m_${u()}`;
    await account(a, 'MOCKM');
    await route(app, '*', '*', a, 1);
    const ctx = ctxWith();
    const r = (await resolveRoute(ctx, { appKey: app, currency: 'USD', methodCode: 'card' }))!;
    const returnUrl = `${ctx.config.siteOrigin}/pay/return?attempt=pat_x&t=sig`;
    const res = await r.provider.initiatePayment(r.config, {
      merchantReference: `pat_${u()}`,
      amountMinor: 12_345,
      currency: 'USD',
      description: 'Invoice',
      returnUrl,
      resultUrl: `${ctx.config.siteOrigin}/api/payments/callbacks/mock/${a}`,
      flow: 'redirect',
      methodCode: 'card',
    });
    expect(res.kind === 'redirect' && res.redirectUrl).toBe(
      `${ctx.config.siteOrigin}/dev/mock-checkout/${res.providerReference}`,
    );
    const view = await getMockCheckout(ctx, res.providerReference!);
    expect(view).toEqual({
      reference: res.providerReference,
      amount: '$123.45',
      status: 'pending',
      method: 'card',
      returnUrl: '/pay/return?attempt=pat_x&t=sig',
    });

    await expect(settleMockCheckout(ctx, res.providerReference!, 'steal')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    const done = await settleMockCheckout(ctx, res.providerReference!, 'partially_paid');
    expect(done.status).toBe('partially_paid');
    const status = await r.provider.checkPaymentStatus(r.config, { providerReference: res.providerReference! });
    expect(status).toMatchObject({ status: 'partially_paid', amountMinor: 6172, currency: 'USD' });
    await expect(settleMockCheckout(ctx, res.providerReference!, 'succeeded')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    await expectNotFound(getMockCheckout(ctx, 'mock_unknown'));

    // A return URL on another site is never offered as a redirect.
    const ext = await r.provider.initiatePayment(r.config, {
      merchantReference: `pat_${u()}`,
      amountMinor: 100,
      currency: 'USD',
      description: 'Invoice',
      returnUrl: 'https://evil.example/phish',
      resultUrl: 'https://evil.example/cb',
      flow: 'redirect',
      methodCode: 'card',
    });
    expect((await getMockCheckout(ctx, ext.providerReference!)).returnUrl).toBeNull();
  });

  it('the seeded Paynow USD account is used once its secrets exist; test auth e-mail comes from a secret', async () => {
    // No Paynow secrets: the seeded USD route is skipped and the mock fallback takes the payment (development).
    expect((await resolveRoute(ctxWith(), { currency: 'USD' }))?.account.id).toBe('ppa_mock');
    const ctx = ctxWith({
      PAYNOW_USD_INTEGRATION_ID: '20001',
      PAYNOW_USD_INTEGRATION_KEY: 'paynow-test-key',
      PAYNOW_TEST_AUTHEMAIL: 'merchant@kuzikode.example',
    });
    const r = await resolveRoute(ctx, { currency: 'USD', methodCode: 'ecocash' });
    expect(r?.account.id).toBe('ppa_paynow_usd');
    expect(r?.provider.key).toBe('paynow');
    expect(r?.config.credentials).toEqual({ integrationId: '20001', integrationKey: 'paynow-test-key' });
    expect(r?.config.options).toMatchObject({ testAuthEmail: 'merchant@kuzikode.example', tokenizationEnabled: false });
    expect(r?.config.options).not.toHaveProperty('testAuthEmailSecret');
    // The seeded account enables EcoCash, OneMoney, InnBucks and cards; O'mari stays off until the merchant has it.
    const codes = (await paymentMethodOptions(ctx, { currency: 'USD' })).map((m) => `${m.code}:${m.accountId}`);
    expect(codes).toEqual(
      expect.arrayContaining([
        'ecocash:ppa_paynow_usd',
        'onemoney:ppa_paynow_usd',
        'innbucks:ppa_paynow_usd',
        'card:ppa_paynow_usd',
      ]),
    );
    expect(codes).toContain('omari:ppa_mock');
    expect(credentialStatus(ctx, (await getAccount(ctx, 'ppa_paynow_usd'))!).complete).toBe(true);
  });
});
