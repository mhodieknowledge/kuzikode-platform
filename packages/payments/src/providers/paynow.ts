/**
 * Paynow adapter (Zimbabwe). Facts verified on developers.paynow.co.zw (Nov 2026): initiate_transaction,
 * express_checkout_transactions, status_update, polling_status, generating_hash, validating_hash, test_mode.
 *
 * - Redirect: POST /interface/initiatetransaction (form-encoded). Used only for card entry on Paynow's secure page.
 * - Express: POST /interface/remotetransaction with `method` (+ `phone`), `authemail` required. InnBucks returns
 *   `authorizationcode` + `authorizationexpires`; O'mari returns `otpreference` + `remoteotpurl` (POST id, otp, status, hash).
 * - Hash: values of all fields except `hash`, in message order (URL-decoded when inbound), + integration key, UTF-8,
 *   SHA-512, uppercase hex. Every response and status update is verified in constant time before use.
 * - Status: empty POST to the poll URL; without one, POST /interface/trace with our `merchanttrace` (sent on express).
 * - Paynow sends no currency: an integration is tied to one currency, so the app routes per currency (one account each).
 */
import { ProviderError } from '../errors';
import { decimalToMinor, minorToDecimal } from '../money';
import { redact } from '../redact';
import type {
  CardScheme,
  CardTokenResult,
  CredentialField,
  InboundCallback,
  InitiateInput,
  InitiateResult,
  NormalizedStatus,
  PaymentMethodInfo,
  PaymentProvider,
  ProviderCapabilities,
  ProviderConfig,
  ProviderDeps,
  StatusResult,
} from '../types';

const BASE = 'https://www.paynow.co.zw/interface';
/** Hosts Paynow's poll and OTP URLs may point to; anything else is refused (no requests to arbitrary URLs). */
const PAYNOW_HOSTS = new Set(['www.paynow.co.zw', 'paynow.co.zw', 'staging.paynow.co.zw']);
const TIMEOUT_MS = 20_000;

const METHODS: PaymentMethodInfo[] = [
  { code: 'ecocash', name: 'EcoCash', flow: 'express', needs: ['phone'] },
  { code: 'onemoney', name: 'OneMoney', flow: 'express', needs: ['phone'] },
  { code: 'innbucks', name: 'InnBucks', flow: 'express' },
  { code: 'omari', name: "O'mari", flow: 'express', needs: ['phone', 'otp'] },
  { code: 'card', name: 'Visa, Mastercard or Zimswitch', flow: 'redirect' },
];

/** Paynow status → normalized. "Paid", "Awaiting Delivery" and "Delivered" all mean the money is paid. */
export const PAYNOW_STATUS_MAP: Readonly<Record<string, NormalizedStatus>> = {
  paid: 'succeeded',
  'awaiting delivery': 'succeeded',
  delivered: 'succeeded',
  created: 'pending',
  sent: 'pending',
  cancelled: 'cancelled',
  failed: 'failed',
  disputed: 'disputed',
  refunded: 'refunded',
};

export function mapPaynowStatus(status: string): NormalizedStatus | null {
  return PAYNOW_STATUS_MAP[status.trim().toLowerCase()] ?? null;
}

const enc = new TextEncoder();

/** SHA-512 of the values (in order) + integration key, uppercase hex. */
export async function paynowHash(values: readonly string[], integrationKey: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-512', enc.encode(values.join('') + integrationKey)));
  return [...digest]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** A Paynow message (`a=1&b=2`): ordered pairs, keys compared case-insensitively. */
export interface PaynowMessage {
  pairs: [string, string][];
  get(key: string): string | undefined;
}

export function parsePaynowMessage(body: string): PaynowMessage {
  const pairs: [string, string][] = [];
  for (const part of body.trim().split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const k = i < 0 ? part : part.slice(0, i);
    const v = i < 0 ? '' : part.slice(i + 1);
    const decode = (s: string) => {
      try {
        return decodeURIComponent(s.replace(/\+/g, ' '));
      } catch {
        return s;
      }
    };
    pairs.push([decode(k), decode(v)]);
  }
  return {
    pairs,
    get: (key) => pairs.find(([k]) => k.toLowerCase() === key.toLowerCase())?.[1],
  };
}

/** True when the message's `hash` matches its other values + the key (validating_hash). */
export async function verifyPaynowMessage(msg: PaynowMessage, integrationKey: string): Promise<boolean> {
  const given = msg.get('hash');
  if (!given) return false;
  const values = msg.pairs.filter(([k]) => k.toLowerCase() !== 'hash').map(([, v]) => v);
  return constantTimeEqual(await paynowHash(values, integrationKey), given.toUpperCase());
}

/** Form-encodes ordered fields and appends `status=Message` and the hash (generating_hash). */
export async function signPaynowRequest(fields: [string, string][], integrationKey: string): Promise<string> {
  const all: [string, string][] = [...fields, ['status', 'Message']];
  const hash = await paynowHash(
    all.map(([, v]) => v),
    integrationKey,
  );
  return [...all, ['hash', hash] as [string, string]]
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** InnBucks `authorizationexpires` ("d-MMM-yyyy HH:mm", Harare time, UTC+2) → ISO; null when unreadable. */
export function parsePaynowDateTime(s: string): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[2]!.toLowerCase());
  if (month < 0) return null;
  const utc = Date.UTC(Number(m[3]), month, Number(m[1]), Number(m[4]) - 2, Number(m[5]));
  return Number.isNaN(utc) ? null : new Date(utc).toISOString();
}

/** `tokenexpiry` ("D-MMM-YYYY", e.g. 31-Dec-2027) → ISO end of that day (UTC); null when unreadable. */
export function parsePaynowDate(s: string): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[2]!.toLowerCase());
  if (month < 0) return null;
  const d = new Date(Date.UTC(Number(m[3]), month, Number(m[1]), 23, 59, 59));
  return d.getUTCMonth() === month ? d.toISOString() : null;
}

/** The reusable card token in a verified status update / poll answer (tokenized payments only). */
export function paynowCardToken(msg: PaynowMessage): CardTokenResult | undefined {
  const token = msg.get('token')?.trim();
  if (!token) return undefined;
  const channel = msg.get('paymentchannel')?.trim() || null;
  const digits = (msg.get('paymentinstrument') ?? '').replace(/\D/g, '');
  const scheme: CardScheme = /zimswitch/i.test(channel ?? '') ? 'zimswitch' : 'vmc';
  return {
    token,
    expiresAt: parsePaynowDate(msg.get('tokenexpiry') ?? ''),
    scheme,
    brand: channel ? channel.slice(0, 40) : null,
    last4: digits.length >= 4 ? digits.slice(-4) : null,
  };
}

function credentials(config: ProviderConfig) {
  const integrationId = config.credentials['integrationId'];
  const integrationKey = config.credentials['integrationKey'];
  if (!integrationId || !integrationKey)
    throw new ProviderError('paynow', 'misconfigured', 'The Paynow integration ID or key is missing');
  return { integrationId, integrationKey };
}

function paynowUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new ProviderError('paynow', 'invalid_request', 'Invalid Paynow URL');
  }
  if (u.protocol !== 'https:' || !PAYNOW_HOSTS.has(u.hostname.toLowerCase()))
    throw new ProviderError('paynow', 'invalid_request', 'Refusing a URL that is not on Paynow');
  return u.toString();
}

export function createPaynowProvider(deps: ProviderDeps = {}): PaymentProvider {
  const doFetch = deps.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const credentialFields: readonly CredentialField[] = [
    { key: 'integrationId', env: 'INTEGRATION_ID' },
    { key: 'integrationKey', env: 'INTEGRATION_KEY' },
  ];

  async function post(url: string, body: string): Promise<string> {
    let res: Response;
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new ProviderError('paynow', 'network', 'Paynow could not be reached');
    }
    if (!res.ok) throw new ProviderError('paynow', 'gateway_error', `Paynow answered with HTTP ${res.status}`);
    return res.text();
  }

  /** Parses a response; `Error` → ProviderError; anything else must carry a valid hash. */
  async function verified(body: string, integrationKey: string): Promise<PaynowMessage> {
    const msg = parsePaynowMessage(body);
    const status = msg.get('status') ?? '';
    if (status.toLowerCase() === 'error') {
      const error = (msg.get('error') ?? 'Paynow refused the request').slice(0, 200);
      const declined = /insufficient|declin|balance|limit|cancel/i.test(error);
      throw new ProviderError('paynow', declined ? 'declined' : 'invalid_request', error, { retryable: false });
    }
    if (!(await verifyPaynowMessage(msg, integrationKey)))
      throw new ProviderError('paynow', 'invalid_response', 'Paynow response failed hash verification', {
        retryable: true,
      });
    return msg;
  }

  const secretsOf = (config: ProviderConfig) => [
    config.credentials['integrationKey'] ?? '',
    config.credentials['integrationId'] ?? '',
  ];
  const rawOf = (msg: PaynowMessage, config: ProviderConfig) =>
    redact(Object.fromEntries(msg.pairs) as Record<string, unknown>, secretsOf(config));

  function toStatus(msg: PaynowMessage, config: ProviderConfig): StatusResult {
    const providerStatus = msg.get('status') ?? '';
    const mapped = mapPaynowStatus(providerStatus);
    if (!mapped) deps.logger?.warn('paynow: unknown status, treated as pending', { providerStatus });
    const amount = msg.get('amount');
    const amountMinor = amount === undefined ? null : decimalToMinor(amount);
    const providerReference = msg.get('paynowreference');
    const merchantReference = msg.get('reference');
    const cardToken = mapped === 'succeeded' ? paynowCardToken(msg) : undefined;
    return {
      status: mapped ?? 'pending',
      providerStatus,
      ...(providerReference ? { providerReference } : {}),
      ...(merchantReference ? { merchantReference } : {}),
      ...(amountMinor !== null ? { amountMinor } : {}),
      ...(mapped === 'failed' || mapped === 'cancelled' ? { failureReason: `Paynow status: ${providerStatus}` } : {}),
      ...(cardToken ? { cardToken } : {}),
      raw: rawOf(msg, config),
    };
  }

  return {
    key: 'paynow',
    displayName: 'Paynow',
    credentialFields,

    capabilities: (config): ProviderCapabilities => ({
      flows: ['redirect', 'express'],
      methods: METHODS,
      currencies: ['USD', 'ZWG'],
      refunds: false,
      statusPolling: true,
      signedCallbacks: true,
      tokenization: config.options?.['tokenizationEnabled'] === true,
      hostedCardFields: false,
    }),

    async initiatePayment(config, input: InitiateInput): Promise<InitiateResult> {
      const { integrationId, integrationKey } = credentials(config);
      if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
        throw new ProviderError('paynow', 'invalid_request', 'Amount must be a positive whole number of minor units');
      const method = input.methodCode ? METHODS.find((m) => m.code === input.methodCode) : undefined;
      if (input.methodCode && !method)
        throw new ProviderError('paynow', 'not_supported', 'This payment method is not available');
      const tokenization = config.options?.['tokenizationEnabled'] === true;
      const saved = input.cardToken;
      if (saved) {
        // Saved card: express checkout with the token (express_checkout_transactions, method vmc / zimswitch).
        if (!tokenization)
          throw new ProviderError('paynow', 'not_supported', 'Saved cards are not enabled for this account');
        if (input.flow !== 'express' || input.methodCode !== 'card' || !saved.token)
          throw new ProviderError('paynow', 'invalid_request', 'A saved card is paid by express checkout');
      } else if (method && method.flow !== input.flow)
        throw new ProviderError('paynow', 'invalid_request', 'This payment method does not support that flow');
      const express = input.flow === 'express';
      const testEmail = config.mode === 'test' ? (config.options?.['testAuthEmail'] as string | undefined) : undefined;
      const authemail = testEmail ?? input.customer?.email;
      if (express && !authemail)
        throw new ProviderError('paynow', 'invalid_request', 'An e-mail address is needed for this payment method');
      if (express && method?.needs?.includes('phone') && !input.phone)
        throw new ProviderError('paynow', 'invalid_request', 'A mobile number is needed for this payment method');

      const fields: [string, string][] = [
        ['id', integrationId],
        ['reference', input.merchantReference],
        ['amount', minorToDecimal(input.amountMinor)],
        ['additionalinfo', input.description.slice(0, 200)],
        ['returnurl', input.returnUrl],
        ['resulturl', input.resultUrl],
      ];
      if (authemail) fields.push(['authemail', authemail]);
      if (!express && input.tokenize && tokenization) fields.push(['tokenize', 'true']);
      if (express) {
        fields.push(['method', saved ? saved.scheme : (input.methodCode ?? '')]);
        if (saved) fields.push(['token', saved.token]);
        else if (input.phone) fields.push(['phone', input.phone]);
        // Required for card tokens: a unique trace prevents a double debit when a request times out.
        fields.push(['merchanttrace', input.merchantReference.slice(0, 32)]);
      }
      const body = await signPaynowRequest(fields, integrationKey);
      const msg = await verified(
        await post(`${BASE}/${express ? 'remotetransaction' : 'initiatetransaction'}`, body),
        integrationKey,
      );
      const pollUrl = msg.get('pollurl');
      const providerReference = msg.get('paynowreference');
      const refs = {
        ...(providerReference ? { providerReference } : {}),
        ...(pollUrl ? { pollUrl: paynowUrl(pollUrl) } : {}),
      };
      const raw = rawOf(msg, config);

      if (!express) {
        const browserUrl = msg.get('browserurl');
        if (!browserUrl) throw new ProviderError('paynow', 'invalid_response', 'Paynow sent no payment page');
        return { kind: 'redirect', redirectUrl: paynowUrl(browserUrl), ...refs, raw };
      }
      if (saved) {
        return {
          kind: 'express_pending',
          ...refs,
          customerInstructions: 'Charging your saved card. This usually takes a few seconds.',
          raw,
        };
      }
      if (input.methodCode === 'innbucks') {
        const code = msg.get('authorizationcode');
        const expires = parsePaynowDateTime(msg.get('authorizationexpires') ?? '');
        return {
          kind: 'express_pending',
          ...refs,
          customerInstructions: 'Open the InnBucks app and approve the payment with this code.',
          ...(code ? { authorizationCode: code } : {}),
          ...(expires ? { authorizationExpiresAt: expires } : {}),
          raw,
        };
      }
      if (input.methodCode === 'omari') {
        const otpReference = msg.get('otpreference');
        const submitUrl = msg.get('remoteotpurl');
        if (!otpReference || !submitUrl)
          throw new ProviderError('paynow', 'invalid_response', "Paynow sent no O'mari code step");
        return {
          kind: 'express_pending',
          ...refs,
          customerInstructions: `Enter the one-time code sent to your phone (reference ${otpReference}).`,
          otpRequired: { otpReference, submitUrl: paynowUrl(submitUrl) },
          raw,
        };
      }
      return {
        kind: 'express_pending',
        ...refs,
        customerInstructions: `Check your phone: approve the ${method?.name ?? 'payment'} prompt and enter your PIN.`,
        raw,
      };
    },

    async checkPaymentStatus(config, ref) {
      const { integrationId, integrationKey } = credentials(config);
      let body: string;
      if (ref.pollUrl) {
        body = await post(paynowUrl(ref.pollUrl), '');
      } else if (ref.merchantReference) {
        const trace = await signPaynowRequest(
          [
            ['id', integrationId],
            ['merchanttrace', ref.merchantReference.slice(0, 32)],
          ],
          integrationKey,
        );
        body = await post(`${BASE}/trace`, trace);
      } else {
        throw new ProviderError('paynow', 'invalid_request', 'Nothing to look the payment up by');
      }
      const msg = await verified(body, integrationKey);
      if ((msg.get('status') ?? '').toLowerCase() === 'notfound')
        throw new ProviderError('paynow', 'not_found', 'Paynow has no such payment', { retryable: false });
      return toStatus(msg, config);
    },

    async parseCallback(config, req: InboundCallback) {
      const { integrationKey } = credentials(config);
      const msg = parsePaynowMessage(req.body);
      const authentic = msg.pairs.length > 1 && (await verifyPaynowMessage(msg, integrationKey));
      const claimed = toStatus(msg, config);
      return { authentic, claimed: msg.get('status') ? claimed : { ...claimed, status: 'error' } };
    },

    async submitOtp(config, input) {
      const { integrationId, integrationKey } = credentials(config);
      const body = await signPaynowRequest(
        [
          ['id', integrationId],
          ['otp', input.otp],
        ],
        integrationKey,
      );
      return toStatus(await verified(await post(paynowUrl(input.submitUrl), body), integrationKey), config);
    },
  };
}
