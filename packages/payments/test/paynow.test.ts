import { describe, expect, it } from 'vitest';
import { ProviderError } from '../src/errors';
import {
  createPaynowProvider,
  mapPaynowStatus,
  parsePaynowDate,
  parsePaynowDateTime,
  parsePaynowMessage,
  paynowHash,
  signPaynowRequest,
  verifyPaynowMessage,
} from '../src/providers/paynow';
import type { ProviderConfig } from '../src/types';
import { describeConformance } from './conformance';

const DOCS_KEY = '3e9fed89-60e1-4ce5-ab6e-6b1eb2d4f977';

describe('Paynow hashing (docs vectors)', () => {
  it('outbound: generating_hash example', async () => {
    const values = [
      '1201',
      'TEST REF',
      '99.99',
      'A test ticket transaction',
      'http://www.google.com/search?q=returnurl',
      'http://www.google.com/search?q=resulturl',
      'Message',
    ];
    expect(await paynowHash(values, DOCS_KEY)).toBe(
      '2A033FC38798D913D42ECB786B9B19645ADEDBDE788862032F1BD82CF3B92DEF84F316385D5B40DBB35F1A4FD7D5BFE73835174136463CDD48C9366B0749C689',
    );
  });

  it('inbound: validating_hash example (URL-decoded values, hash excluded)', async () => {
    const body =
      'status=Ok&browserurl=https%3a%2f%2fstaging.paynow.co.zw%2fPayment%2fConfirmPayment%2f9510&pollurl=https%3a%2f%2fstaging.paynow.co.zw%2fInterface%2fCheckPayment%2f%3fguid%3dc7ed41da-0159-46da-b428-69549f770413&paynowreference=9510&hash=750DD0B0DF374678707BB5AF915AF81C228B9058AD57BB7120569EC68BBB9C2EFC1B26C6375D2BC562AC909B3CD6B2AF1D42E1A5E479FFAC8F4FB3FDCE71DF4D';
    const msg = parsePaynowMessage(body);
    expect(msg.get('pollurl')).toBe(
      'https://staging.paynow.co.zw/Interface/CheckPayment/?guid=c7ed41da-0159-46da-b428-69549f770413',
    );
    expect(await verifyPaynowMessage(msg, DOCS_KEY)).toBe(true);
    expect(await verifyPaynowMessage(msg, 'another-key')).toBe(false);
    expect(await verifyPaynowMessage(parsePaynowMessage(body.replace('9510&hash', '9511&hash')), DOCS_KEY)).toBe(false);
    expect(await verifyPaynowMessage(parsePaynowMessage('status=Ok'), DOCS_KEY)).toBe(false);
  });

  it('keys are case-insensitive and + is a space', () => {
    const msg = parsePaynowMessage('Status=Awaiting+Delivery&BrowserUrl=x');
    expect(msg.get('status')).toBe('Awaiting Delivery');
    expect(msg.get('browserurl')).toBe('x');
  });

  it('signs requests: fields in order, then status=Message, then hash', async () => {
    const body = await signPaynowRequest(
      [
        ['id', '1201'],
        ['reference', 'TEST REF'],
      ],
      DOCS_KEY,
    );
    const msg = parsePaynowMessage(body);
    expect(msg.pairs.map(([k]) => k)).toEqual(['id', 'reference', 'status', 'hash']);
    expect(await verifyPaynowMessage(msg, DOCS_KEY)).toBe(true);
  });
});

describe('Paynow statuses and formats', () => {
  it.each([
    ['Paid', 'succeeded'],
    ['Awaiting Delivery', 'succeeded'],
    ['Delivered', 'succeeded'],
    ['Created', 'pending'],
    ['Sent', 'pending'],
    ['Cancelled', 'cancelled'],
    ['Failed', 'failed'],
    ['Disputed', 'disputed'],
    ['Refunded', 'refunded'],
  ])('%s → %s', (s, n) => expect(mapPaynowStatus(s)).toBe(n));

  it('unknown statuses are not mapped (the adapter treats them as pending, never paid)', () => {
    expect(mapPaynowStatus('Ok')).toBeNull();
    expect(mapPaynowStatus('Something New')).toBeNull();
  });

  it('InnBucks expiry is Harare time', () => {
    expect(parsePaynowDateTime('5-Nov-2026 14:30')).toBe('2026-11-05T12:30:00.000Z');
    expect(parsePaynowDateTime('31-Foo-2026 10:00')).toBeNull();
  });
});

// ---------------------------------------------------------------- a fake Paynow for the adapter tests

const KEY = 'unit-test-paynow-key-9f8e7d';
const config: ProviderConfig = {
  accountId: 'ppa_paynow_usd',
  mode: 'test',
  credentials: { integrationId: '20001', integrationKey: KEY },
  options: { testAuthEmail: 'merchant@kuzikode.example' },
};

interface Sent {
  url: string;
  body: string;
}

function fakePaynow(opts: { key?: string } = {}) {
  const key = opts.key ?? KEY;
  type T = { status: string; amount: string; reference: string; paynowref: string; tokenize?: boolean };
  const state = new Map<string, T>();
  const sent: Sent[] = [];
  let seq = 9000;
  const reply = async (fields: [string, string][]) => {
    const hash = await paynowHash(
      fields.map(([, v]) => v),
      key,
    );
    return [...fields, ['hash', hash] as [string, string]].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  };
  const statusMsg = (t: T) =>
    reply([
      ['reference', t.reference],
      ['paynowreference', t.paynowref],
      ['amount', t.amount],
      ['status', t.status],
      ['pollurl', `https://www.paynow.co.zw/Interface/CheckPayment/?guid=${t.paynowref}`],
      ...((t.tokenize && t.status === 'Paid'
        ? [
            ['token', `{11111111-2222-3333-4444-${t.paynowref.padStart(12, '0')}}`],
            ['tokenexpiry', '31-May-2027'],
            ['paymentchannel', 'Visa'],
            ['paymentinstrument', '411111******1111'],
          ]
        : []) as [string, string][]),
    ]);
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = String(init?.body ?? '');
    sent.push({ url, body });
    const msg = parsePaynowMessage(body);
    if (url.endsWith('/interface/initiatetransaction') || url.endsWith('/interface/remotetransaction')) {
      if (!(await verifyPaynowMessage(msg, KEY))) return new Response('status=Error&error=Invalid+hash');
      if (msg.get('amount') === '0.00') return new Response('status=Error&error=Invalid+amount+field');
      if (msg.get('phone') === '0774444444' || msg.get('token')?.includes('44444444'))
        return new Response('status=Error&error=Insufficient+balance');
      const paynowref = String(++seq);
      const t: T = {
        status: 'Created',
        amount: msg.get('amount')!,
        reference: msg.get('reference')!,
        paynowref,
        tokenize: msg.get('tokenize') === 'true' || !!msg.get('token'),
      };
      state.set(paynowref, t);
      const poll = `https://www.paynow.co.zw/Interface/CheckPayment/?guid=${paynowref}`;
      if (url.endsWith('initiatetransaction'))
        return new Response(
          await reply([
            ['status', 'Ok'],
            ['browserurl', `https://www.paynow.co.zw/Payment/ConfirmPayment/${paynowref}`],
            ['pollurl', poll],
            ['paynowreference', paynowref],
          ]),
        );
      const method = msg.get('method');
      const extra: [string, string][] =
        method === 'innbucks'
          ? [
              ['authorizationcode', '123456789'],
              ['authorizationexpires', '5-Nov-2026 14:30'],
            ]
          : method === 'omari'
            ? [
                ['otpreference', 'OTP-77'],
                ['remoteotpurl', `https://www.paynow.co.zw/interface/remoteotp?ref=${paynowref}`],
              ]
            : [];
      return new Response(await reply([['status', 'Ok'], ['pollurl', poll], ['paynowreference', paynowref], ...extra]));
    }
    if (url.includes('/Interface/CheckPayment/')) {
      const t = state.get(new URL(url).searchParams.get('guid') ?? '');
      return new Response(t ? await statusMsg(t) : await reply([['status', 'NotFound']]));
    }
    if (url.endsWith('/interface/trace')) {
      const t = [...state.values()].find((x) => x.reference.slice(0, 32) === msg.get('merchanttrace'));
      return new Response(t ? await statusMsg(t) : await reply([['status', 'NotFound']]));
    }
    if (url.includes('/interface/remoteotp')) {
      const t = state.get(new URL(url).searchParams.get('ref') ?? '')!;
      if (msg.get('otp') !== '012345') return new Response('status=Error&error=Invalid+OTP');
      t.status = 'Paid';
      return new Response(await statusMsg(t));
    }
    return new Response('not found', { status: 404 });
  }) as typeof globalThis.fetch;
  return { fetch, state, sent, statusMsg, reply };
}

describeConformance('paynow', () => {
  const fake = fakePaynow();
  const provider = createPaynowProvider({ fetch: fake.fetch });
  const toPaynow = { succeeded: 'Paid', failed: 'Failed', cancelled: 'Cancelled' } as const;
  return {
    provider,
    config,
    secrets: [KEY],
    express: { methodCode: 'ecocash', phone: '0771111111' },
    async settle(res, _ref, status) {
      fake.state.get(res.providerReference!)!.status = toPaynow[status];
    },
    async callback(res, _merchantReference, status, { forge }) {
      const t = { ...fake.state.get(res.providerReference!)!, status: toPaynow[status] };
      const signed = await fakePaynow({ key: forge ? 'wrong-key-123' : KEY }).statusMsg(t);
      return { headers: new Headers(), body: signed, contentType: 'application/x-www-form-urlencoded' };
    },
  };
});

const input = (over: Record<string, unknown> = {}) => ({
  merchantReference: 'att_01TEST',
  amountMinor: 1234,
  currency: 'USD',
  description: 'Invoice INV-2026-00001',
  returnUrl: 'https://kuzikode.example/pay/return?attempt=att_01TEST&t=x',
  resultUrl: 'https://kuzikode.example/api/payments/callbacks/paynow/ppa_paynow_usd',
  flow: 'express' as const,
  methodCode: 'ecocash',
  phone: '0771111111',
  ...over,
});

describe('Paynow adapter', () => {
  it('express: authemail from test mode, merchanttrace, 2-dp amount, hash; EcoCash instructions', async () => {
    const fake = fakePaynow();
    const p = createPaynowProvider({ fetch: fake.fetch });
    const res = await p.initiatePayment(config, input());
    expect(res.kind).toBe('express_pending');
    const sent = parsePaynowMessage(fake.sent[0]!.body);
    expect(fake.sent[0]!.url).toBe('https://www.paynow.co.zw/interface/remotetransaction');
    expect(sent.pairs.map(([k]) => k)).toEqual([
      'id',
      'reference',
      'amount',
      'additionalinfo',
      'returnurl',
      'resulturl',
      'authemail',
      'method',
      'phone',
      'merchanttrace',
      'status',
      'hash',
    ]);
    expect(sent.get('amount')).toBe('12.34');
    expect(sent.get('authemail')).toBe('merchant@kuzikode.example');
    expect(res.kind === 'express_pending' && res.customerInstructions).toContain('EcoCash');
    expect(JSON.stringify(res)).not.toContain(KEY);
  });

  it('live mode uses the customer e-mail; express without any e-mail is refused', async () => {
    const fake = fakePaynow();
    const p = createPaynowProvider({ fetch: fake.fetch });
    const live = { ...config, mode: 'live' as const };
    await p.initiatePayment(live, input({ customer: { email: 'client@example.com' } }));
    expect(parsePaynowMessage(fake.sent[0]!.body).get('authemail')).toBe('client@example.com');
    await expect(p.initiatePayment(live, input())).rejects.toMatchObject({ code: 'invalid_request' });
  });

  it('InnBucks code + expiry; O’mari OTP step and submission', async () => {
    const fake = fakePaynow();
    const p = createPaynowProvider({ fetch: fake.fetch });
    const inn = await p.initiatePayment(config, input({ methodCode: 'innbucks', phone: undefined }));
    expect(inn).toMatchObject({
      kind: 'express_pending',
      authorizationCode: '123456789',
      authorizationExpiresAt: '2026-11-05T12:30:00.000Z',
    });
    const om = await p.initiatePayment(config, input({ methodCode: 'omari', merchantReference: 'att_02' }));
    if (om.kind !== 'express_pending' || !om.otpRequired) throw new Error('expected an OTP step');
    expect(om.otpRequired.otpReference).toBe('OTP-77');
    await expect(p.submitOtp!(config, { submitUrl: om.otpRequired.submitUrl, otp: '999999' })).rejects.toMatchObject({
      message: 'Invalid OTP',
    });
    const ok = await p.submitOtp!(config, { submitUrl: om.otpRequired.submitUrl, otp: '012345' });
    expect(ok).toMatchObject({ status: 'succeeded', amountMinor: 1234, merchantReference: 'att_02' });
    const otpSent = parsePaynowMessage(fake.sent.at(-1)!.body);
    expect(otpSent.pairs.map(([k]) => k)).toEqual(['id', 'otp', 'status', 'hash']);
  });

  it('errors: insufficient balance is declined (not retryable); a bad response hash is refused', async () => {
    const p = createPaynowProvider({ fetch: fakePaynow().fetch });
    await expect(p.initiatePayment(config, input({ phone: '0774444444' }))).rejects.toMatchObject({
      code: 'declined',
      retryable: false,
      message: 'Insufficient balance',
    });
    const forged = createPaynowProvider({ fetch: fakePaynow({ key: 'not-our-key' }).fetch });
    // The fake answers with a hash under another key: we must not trust the redirect URL.
    await expect(
      forged.initiatePayment(config, input({ flow: 'redirect', methodCode: 'card', phone: undefined })),
    ).rejects.toMatchObject({ code: 'invalid_response' });
    const down = createPaynowProvider({
      fetch: (async () => {
        throw new TypeError('network down');
      }) as typeof fetch,
    });
    await expect(down.initiatePayment(config, input())).rejects.toMatchObject({ code: 'network', retryable: true });
    const http500 = createPaynowProvider({
      fetch: (async () => new Response('oops', { status: 502 })) as typeof fetch,
    });
    await expect(http500.initiatePayment(config, input())).rejects.toMatchObject({ code: 'gateway_error' });
  });

  it('status by trace when there is no poll URL; NotFound → not_found', async () => {
    const fake = fakePaynow();
    const p = createPaynowProvider({ fetch: fake.fetch });
    await p.initiatePayment(config, input({ merchantReference: 'att_TRACE' }));
    const s = await p.checkPaymentStatus(config, { merchantReference: 'att_TRACE' });
    expect(s).toMatchObject({ status: 'pending', providerStatus: 'Created', amountMinor: 1234 });
    expect(fake.sent.at(-1)!.url).toBe('https://www.paynow.co.zw/interface/trace');
    await expect(p.checkPaymentStatus(config, { merchantReference: 'att_NONE' })).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('never sends requests to non-Paynow URLs (poll and OTP URLs are pinned)', async () => {
    const fake = fakePaynow();
    const p = createPaynowProvider({ fetch: fake.fetch });
    for (const pollUrl of ['https://evil.example/poll', 'http://www.paynow.co.zw/x', 'not a url']) {
      await expect(p.checkPaymentStatus(config, { pollUrl })).rejects.toBeInstanceOf(ProviderError);
    }
    await expect(p.submitOtp!(config, { submitUrl: 'https://evil.example/otp', otp: '1' })).rejects.toBeInstanceOf(
      ProviderError,
    );
    expect(fake.sent).toHaveLength(0);
  });

  it('unknown gateway statuses become pending, never paid; callbacks without a status are not trusted', async () => {
    const fake = fakePaynow();
    const p = createPaynowProvider({ fetch: fake.fetch });
    const res = await p.initiatePayment(config, input({ flow: 'redirect', methodCode: 'card', phone: undefined }));
    fake.state.get(res.providerReference!)!.status = 'Something New';
    expect((await p.checkPaymentStatus(config, { pollUrl: res.pollUrl! })).status).toBe('pending');
    const cb = await p.parseCallback(config, { headers: new Headers(), body: 'hash=ABC', contentType: '' });
    expect(cb.authentic).toBe(false);
  });

  it('tokenized card entry: tokenize=true only when enabled; the paid status carries the token (never in raw)', async () => {
    const fake = fakePaynow();
    const p = createPaynowProvider({ fetch: fake.fetch });
    const card = input({ flow: 'redirect', methodCode: 'card', phone: undefined, tokenize: true });
    await p.initiatePayment(config, card);
    expect(parsePaynowMessage(fake.sent[0]!.body).get('tokenize')).toBeUndefined();
    const tok = { ...config, options: { ...config.options, tokenizationEnabled: true } };
    const res = await p.initiatePayment(tok, { ...card, merchantReference: 'att_TOK' });
    const sent = parsePaynowMessage(fake.sent[1]!.body);
    expect(sent.pairs.map(([k]) => k)).toEqual([
      'id',
      'reference',
      'amount',
      'additionalinfo',
      'returnurl',
      'resulturl',
      'authemail',
      'tokenize',
      'status',
      'hash',
    ]);
    expect(sent.get('tokenize')).toBe('true');
    const pending = await p.checkPaymentStatus(tok, { pollUrl: res.pollUrl! });
    expect(pending.cardToken).toBeUndefined();
    fake.state.get(res.providerReference!)!.status = 'Paid';
    const paid = await p.checkPaymentStatus(tok, { pollUrl: res.pollUrl! });
    expect(paid.cardToken).toEqual({
      token: `{11111111-2222-3333-4444-${res.providerReference!.padStart(12, '0')}}`,
      expiresAt: '2027-05-31T23:59:59.000Z',
      scheme: 'vmc',
      brand: 'Visa',
      last4: '1111',
    });
    expect(JSON.stringify(paid.raw)).not.toContain('11111111-2222');
    expect(JSON.stringify(paid.raw)).not.toContain('411111');
  });

  it('saved card: express vmc + token + merchanttrace; refused without tokenization; insufficient → declined', async () => {
    const fake = fakePaynow();
    const p = createPaynowProvider({ fetch: fake.fetch });
    const saved = input({
      methodCode: 'card',
      phone: undefined,
      cardToken: { token: '{11111111-1111-1111-1111-111111111111}', scheme: 'vmc' },
    });
    await expect(p.initiatePayment(config, saved)).rejects.toMatchObject({ code: 'not_supported' });
    const tok = { ...config, options: { ...config.options, tokenizationEnabled: true } };
    const res = await p.initiatePayment(tok, saved);
    expect(res).toMatchObject({ kind: 'express_pending', customerInstructions: expect.stringContaining('saved card') });
    const sent = parsePaynowMessage(fake.sent[0]!.body);
    expect(fake.sent[0]!.url).toBe('https://www.paynow.co.zw/interface/remotetransaction');
    expect(sent.pairs.map(([k]) => k)).toEqual([
      'id',
      'reference',
      'amount',
      'additionalinfo',
      'returnurl',
      'resulturl',
      'authemail',
      'method',
      'token',
      'merchanttrace',
      'status',
      'hash',
    ]);
    expect(sent.get('method')).toBe('vmc');
    expect(sent.get('merchanttrace')).toBe('att_01TEST');
    expect(JSON.stringify(res)).not.toContain('11111111-1111');
    await expect(
      p.initiatePayment(tok, {
        ...saved,
        cardToken: { token: '{44444444-4444-4444-4444-444444444444}', scheme: 'zimswitch' },
      }),
    ).rejects.toMatchObject({ code: 'declined' });
    expect(parsePaynowMessage(fake.sent[1]!.body).get('method')).toBe('zimswitch');
    await expect(p.initiatePayment(tok, { ...saved, flow: 'redirect' })).rejects.toMatchObject({
      code: 'invalid_request',
    });
  });

  it('token expiry format D-MMM-YYYY', () => {
    expect(parsePaynowDate('31-Dec-2027')).toBe('2027-12-31T23:59:59.000Z');
    expect(parsePaynowDate('1-Feb-2027')).toBe('2027-02-01T23:59:59.000Z');
    expect(parsePaynowDate('31-Feb-2027')).toBeNull();
    expect(parsePaynowDate('2027-12-31')).toBeNull();
  });

  it('declares its secrets and honest capabilities', () => {
    const p = createPaynowProvider();
    expect(p.credentialFields.map((f) => f.env)).toEqual(['INTEGRATION_ID', 'INTEGRATION_KEY']);
    const caps = p.capabilities(config);
    expect(caps).toMatchObject({ refunds: false, tokenization: false, hostedCardFields: false });
    expect(p.capabilities({ ...config, options: { tokenizationEnabled: true } }).tokenization).toBe(true);
    expect(p.refundPayment).toBeUndefined();
  });
});
