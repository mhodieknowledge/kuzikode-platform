/**
 * Mock gateway for development and tests (docs/06 §6). Never routed in production (the app enforces it; see README).
 *
 * - Redirect flow: `redirectUrl` is the app's hosted mock page (`options.checkoutBaseUrl`/<reference>), where a person
 *   picks Succeed / Fail / Cancel / Partial / Timeout / Dispute (the app calls `settleMockPayment`).
 * - Express flow simulates the gateway's test numbers: phone ending 1111111 → paid after 5 s, 2222222 → paid after 30 s,
 *   3333333 → cancelled after 30 s, 4444444 → refused at once (insufficient balance). Any other number → paid after 5 s.
 *   InnBucks returns an authorization code; O'mari asks for an OTP (`123456` pays, anything else fails).
 * - Callbacks are JSON signed with HMAC-SHA256 (`credentials.signingKey`), so the app's callback path is exercised exactly
 *   like a real gateway's.
 * State lives in a `MockStore` the app provides (D1 in the app, a Map in tests).
 */
import { ProviderError } from '../errors';
import { redact } from '../redact';
import type {
  CredentialField,
  InboundCallback,
  InitiateInput,
  InitiateResult,
  NormalizedStatus,
  PaymentProvider,
  ProviderCapabilities,
  ProviderConfig,
  ProviderDeps,
  StatusRef,
  StatusResult,
} from '../types';

export interface MockPaymentState {
  reference: string;
  accountId: string;
  merchantReference: string;
  amountMinor: number;
  /** Amount actually "paid" (differs from amountMinor only for a partial payment). */
  paidMinor: number;
  currency: string;
  status: NormalizedStatus;
  methodCode: string | null;
  resultUrl: string | null;
  returnUrl: string | null;
  /** Express simulation: the status the payment reaches at `settleAt`. */
  scripted: NormalizedStatus | null;
  settleAt: string | null;
  otpReference: string | null;
  createdAt: string;
}

export interface MockStore {
  get(reference: string): Promise<MockPaymentState | null>;
  save(state: MockPaymentState): Promise<void>;
}

/** In-memory store for tests and scripts. */
export function memoryMockStore(): MockStore & { states: Map<string, MockPaymentState> } {
  const states = new Map<string, MockPaymentState>();
  return {
    states,
    get: async (reference) => (states.has(reference) ? { ...states.get(reference)! } : null),
    save: async (state) => {
      states.set(state.reference, { ...state });
    },
  };
}

export const MOCK_DEV_SIGNING_KEY = 'mock-gateway-dev-signing-key-not-a-secret';
export const MOCK_OTP = '123456';
/** The outcomes a person can pick on the mock hosted page. */
export const MOCK_OUTCOMES = ['succeeded', 'failed', 'cancelled', 'partially_paid', 'expired', 'disputed'] as const;
export type MockOutcome = (typeof MOCK_OUTCOMES)[number];

const METHODS: ProviderCapabilities['methods'] = [
  { code: 'ecocash', name: 'EcoCash', flow: 'express', needs: ['phone'] },
  { code: 'onemoney', name: 'OneMoney', flow: 'express', needs: ['phone'] },
  { code: 'innbucks', name: 'InnBucks', flow: 'express' },
  { code: 'omari', name: "O'mari", flow: 'express', needs: ['phone', 'otp'] },
  { code: 'card', name: 'Bank card', flow: 'redirect' },
];
const SCRIPT: Record<string, { status: NormalizedStatus; afterSeconds: number } | 'refuse'> = {
  '1111111': { status: 'succeeded', afterSeconds: 5 },
  '2222222': { status: 'succeeded', afterSeconds: 30 },
  '3333333': { status: 'cancelled', afterSeconds: 30 },
  '4444444': 'refuse',
};

const enc = new TextEncoder();
async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface MockCallbackPayload {
  reference: string;
  merchantReference: string;
  status: NormalizedStatus;
  amountMinor: number;
  currency: string;
}
const signedFields = (p: MockCallbackPayload) =>
  [p.reference, p.merchantReference, p.status, p.amountMinor, p.currency].join('|');

/** The body (JSON) of a mock callback, signed with the account's signing key. */
export async function signMockCallback(config: ProviderConfig, payload: MockCallbackPayload): Promise<string> {
  const signature = await hmacHex(signingKey(config), signedFields(payload));
  return JSON.stringify({ ...payload, signature });
}

function signingKey(config: ProviderConfig): string {
  const key = config.credentials['signingKey'];
  if (!key) throw new ProviderError('mock', 'misconfigured', 'The mock gateway has no signing key');
  return key;
}

const statusOf = (s: MockPaymentState, raw?: Record<string, unknown>): StatusResult => ({
  status: s.status,
  providerStatus: s.status.toUpperCase(),
  providerReference: s.reference,
  merchantReference: s.merchantReference,
  amountMinor: s.status === 'pending' ? s.amountMinor : s.paidMinor,
  currency: s.currency,
  ...(s.status === 'failed' ? { failureReason: 'Payment declined by the mock gateway' } : {}),
  raw: redact(raw ?? { reference: s.reference, status: s.status, amountMinor: s.paidMinor, currency: s.currency }),
});

export interface MockProviderOptions extends ProviderDeps {
  store: MockStore;
}

export function createMockProvider(opts: MockProviderOptions): PaymentProvider & {
  /** What the hosted mock page does when a person picks an outcome. Returns the new state. */
  settle(config: ProviderConfig, reference: string, outcome: MockOutcome): Promise<MockPaymentState>;
} {
  const now = opts.now ?? (() => new Date());
  const store = opts.store;
  const credentialFields: readonly CredentialField[] = [
    { key: 'signingKey', env: 'SIGNING_KEY', devDefault: MOCK_DEV_SIGNING_KEY },
  ];

  async function load(config: ProviderConfig, ref: StatusRef): Promise<MockPaymentState> {
    const reference = ref.providerReference ?? ref.pollUrl?.replace(/^mock:\/\/poll\//, '') ?? '';
    const state = reference ? await store.get(reference) : null;
    if (!state || state.accountId !== config.accountId)
      throw new ProviderError('mock', 'not_found', 'Unknown payment reference');
    return state;
  }

  async function advance(state: MockPaymentState): Promise<MockPaymentState> {
    if (state.status === 'pending' && state.scripted && state.settleAt && now().toISOString() >= state.settleAt) {
      const next: MockPaymentState = { ...state, status: state.scripted, scripted: null, settleAt: null };
      await store.save(next);
      return next;
    }
    return state;
  }

  return {
    key: 'mock',
    displayName: 'Mock gateway (test only)',
    credentialFields,

    capabilities: () => ({
      flows: ['redirect', 'express'],
      methods: METHODS,
      currencies: ['USD', 'ZWG'],
      refunds: true,
      statusPolling: true,
      signedCallbacks: true,
      tokenization: false,
      hostedCardFields: false,
    }),

    async initiatePayment(config, input: InitiateInput): Promise<InitiateResult> {
      signingKey(config);
      if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
        throw new ProviderError('mock', 'invalid_request', 'Amount must be a positive whole number of minor units');
      const method = input.methodCode ? METHODS.find((m) => m.code === input.methodCode) : undefined;
      if (input.methodCode && !method)
        throw new ProviderError('mock', 'not_supported', 'This payment method is not available');
      if (method && method.flow !== input.flow)
        throw new ProviderError('mock', 'invalid_request', 'This payment method does not support that flow');
      const reference = `mock_${input.merchantReference}`;
      const base: MockPaymentState = {
        reference,
        accountId: config.accountId,
        merchantReference: input.merchantReference,
        amountMinor: input.amountMinor,
        paidMinor: input.amountMinor,
        currency: input.currency,
        status: 'pending',
        methodCode: input.methodCode ?? null,
        resultUrl: input.resultUrl,
        returnUrl: input.returnUrl,
        scripted: null,
        settleAt: null,
        otpReference: null,
        createdAt: now().toISOString(),
      };
      const pollUrl = `mock://poll/${reference}`;

      if (input.flow === 'redirect') {
        const baseUrl = String(config.options?.['checkoutBaseUrl'] ?? 'https://mock.invalid/checkout');
        await store.save(base);
        const redirectUrl = `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(reference)}`;
        return { kind: 'redirect', providerReference: reference, redirectUrl, pollUrl, raw: redact({ reference }) };
      }

      const needsPhone = method ? (method.needs?.includes('phone') ?? false) : true;
      const digits = (input.phone ?? '').replace(/\D/g, '');
      if (needsPhone && digits.length < 9)
        throw new ProviderError('mock', 'invalid_request', 'A valid mobile number is needed for this method');
      const script = SCRIPT[digits.slice(-7)] ?? { status: 'succeeded' as const, afterSeconds: 5 };
      if (script === 'refuse')
        throw new ProviderError('mock', 'declined', 'Insufficient balance', { retryable: false });

      if (input.methodCode === 'omari') {
        const otpReference = `otp_${reference}`;
        await store.save({ ...base, otpReference });
        return {
          kind: 'express_pending',
          providerReference: reference,
          pollUrl,
          customerInstructions: 'Enter the one-time code sent to your phone.',
          otpRequired: { otpReference, submitUrl: `mock://otp/${reference}` },
          raw: redact({ reference, otpReference }),
        };
      }
      const settleAt = new Date(now().getTime() + script.afterSeconds * 1000).toISOString();
      await store.save({ ...base, scripted: script.status, settleAt });
      if (input.methodCode === 'innbucks') {
        const code = String(
          Number.parseInt(reference.replace(/\D/g, '').slice(-9) || '0', 10) % 1_000_000_000,
        ).padStart(9, '0');
        return {
          kind: 'express_pending',
          providerReference: reference,
          pollUrl,
          customerInstructions: 'Open the InnBucks app and approve the payment with this code.',
          authorizationCode: code,
          authorizationExpiresAt: new Date(now().getTime() + 30 * 60_000).toISOString(),
          raw: redact({ reference, authorizationcode: code }),
        };
      }
      return {
        kind: 'express_pending',
        providerReference: reference,
        pollUrl,
        customerInstructions: `Check your phone: approve the ${method?.name ?? 'payment'} prompt and enter your PIN.`,
        raw: redact({ reference, phone: input.phone ?? '' }),
      };
    },

    async checkPaymentStatus(config, ref) {
      return statusOf(await advance(await load(config, ref)));
    },

    async parseCallback(config, req: InboundCallback) {
      let body: Partial<MockCallbackPayload> & { signature?: string } = {};
      try {
        body = JSON.parse(req.body) as typeof body;
      } catch {
        body = {};
      }
      const claimed: StatusResult = {
        status: (typeof body.status === 'string' ? body.status : 'error') as NormalizedStatus,
        providerStatus: String(body.status ?? ''),
        ...(typeof body.reference === 'string' ? { providerReference: body.reference } : {}),
        ...(typeof body.merchantReference === 'string' ? { merchantReference: body.merchantReference } : {}),
        ...(typeof body.amountMinor === 'number' ? { amountMinor: body.amountMinor } : {}),
        ...(typeof body.currency === 'string' ? { currency: body.currency } : {}),
        raw: redact(body as Record<string, unknown>),
      };
      const complete =
        typeof body.signature === 'string' &&
        typeof body.reference === 'string' &&
        typeof body.merchantReference === 'string' &&
        typeof body.status === 'string' &&
        typeof body.amountMinor === 'number' &&
        typeof body.currency === 'string';
      if (!complete) return { authentic: false, claimed };
      const expected = await hmacHex(signingKey(config), signedFields(body as MockCallbackPayload));
      return { authentic: constantTimeEqual(expected, body.signature!), claimed };
    },

    async submitOtp(config, input) {
      const reference = input.submitUrl.replace(/^mock:\/\/otp\//, '');
      const state = await load(config, { providerReference: reference });
      if (state.status !== 'pending' || !state.otpReference)
        throw new ProviderError('mock', 'invalid_request', 'This payment is not waiting for a code');
      const next: MockPaymentState = {
        ...state,
        status: input.otp.trim() === MOCK_OTP ? 'succeeded' : 'failed',
        otpReference: null,
      };
      await store.save(next);
      return statusOf(next);
    },

    async refundPayment(config, input) {
      const state = await load(config, { providerReference: input.providerReference });
      if (state.status !== 'succeeded') return { status: 'failed' };
      await store.save({ ...state, status: input.amountMinor >= state.paidMinor ? 'refunded' : state.status });
      return { status: 'completed', providerReference: `refund_${state.reference}` };
    },

    async settle(config, reference, outcome) {
      const state = await load(config, { providerReference: reference });
      if (state.status !== 'pending')
        throw new ProviderError('mock', 'invalid_request', 'This payment has already been completed');
      const next: MockPaymentState = {
        ...state,
        status: outcome,
        paidMinor: outcome === 'partially_paid' ? Math.max(1, Math.floor(state.amountMinor / 2)) : state.amountMinor,
        scripted: null,
        settleAt: null,
      };
      await store.save(next);
      return next;
    },
  };
}
