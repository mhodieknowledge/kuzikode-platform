/**
 * PesePay adapter (alternative gateway). Facts verified on developers.pesepay.com/llms-full.txt (Nov 2026): Encryption
 * guide, Initiate Transaction, Check Payment Status, The result callback, Verifying callbacks, Transaction statuses,
 * Payment method codes, Errors.
 *
 * - Redirect only here: POST /payments/initiate → `redirectUrl`; `paymentMethodCode` preselects the method on PesePay's page.
 * - Bodies are `{ "payload": base64(AES-256-CBC(JSON)) }`, key = the 32-char encryption key (UTF-8), IV = its first 16
 *   characters, PKCS#7. Error responses are plain JSON (`message`, `status`).
 * - Status: GET /payments/check-payment?referenceNumber=… (encrypted response). `SUCCESS` is the only paid status.
 * - Callbacks are plain, UNSIGNED JSON. The `Authorization` header carries our integration key: a cheap filter only, so
 *   `authentic` means "worth confirming"; the status check is the real verification (the app always does it).
 * - Zimbabwe dollars: `ZiG` for EcoCash (and the hosted page), `ZWG` for O'mari. We call both `ZWG`.
 */
import { ProviderError } from '../errors';
import { decimalToMinor, minorToDecimal } from '../money';
import { redact } from '../redact';
import type {
  CredentialField,
  InboundCallback,
  InitiateInput,
  InitiateResult,
  NormalizedStatus,
  PaymentMethodInfo,
  PaymentProvider,
  ProviderConfig,
  ProviderDeps,
  StatusResult,
} from '../types';

const LIVE = 'https://api.pesepay.com/api/payments-engine/v1';
const TEST = 'https://api.test.sandbox.pesepay.com/payments-engine/v1';
const PESEPAY_HOSTS = new Set([
  'api.pesepay.com',
  'api.test.sandbox.pesepay.com',
  'pay.pesepay.com',
  'test.pesepay.com',
]);
const TIMEOUT_MS = 20_000;

const METHODS: PaymentMethodInfo[] = [
  { code: 'ecocash', name: 'EcoCash (on PesePay)', flow: 'redirect' },
  { code: 'innbucks', name: 'InnBucks (on PesePay)', flow: 'redirect' },
  { code: 'omari', name: "O'mari (on PesePay)", flow: 'redirect' },
  { code: 'card', name: 'Visa, Mastercard or Zimswitch (on PesePay)', flow: 'redirect' },
];

/** Our method + currency → PesePay's paymentMethodCode and the currency code that goes with it. */
const METHOD_CODES: Record<string, Record<string, { code: string; currency: string }>> = {
  ecocash: { USD: { code: 'PZW211', currency: 'USD' }, ZWG: { code: 'PZW201', currency: 'ZiG' } },
  innbucks: { USD: { code: 'PZW212', currency: 'USD' } },
  omari: { USD: { code: 'PZW216', currency: 'USD' }, ZWG: { code: 'PZW217', currency: 'ZWG' } },
};
/** With no preselected method (cards: the customer picks Visa / Mastercard / Zimswitch on PesePay's page). */
const PAGE_CURRENCY: Record<string, string> = { USD: 'USD', ZWG: 'ZiG' };

export const PESEPAY_STATUS_MAP: Readonly<Record<string, NormalizedStatus>> = {
  SUCCESS: 'succeeded',
  INITIATED: 'pending',
  PROCESSING: 'pending',
  PENDING: 'pending',
  PARTIALLY_PAID: 'partially_paid',
  FAILED: 'failed',
  DECLINED: 'failed',
  INSUFFICIENT_FUNDS: 'failed',
  AUTHORIZATION_FAILED: 'failed',
  ERROR: 'failed',
  SERVICE_UNAVAILABLE: 'failed',
  CANCELLED: 'cancelled',
  TERMINATED: 'cancelled',
  TIME_OUT: 'expired',
  CLOSED: 'expired',
  CLOSED_PERIOD_ELAPSED: 'expired',
  REVERSED: 'reversed',
};

export const mapPesepayStatus = (s: string): NormalizedStatus | null =>
  PESEPAY_STATUS_MAP[s.trim().toUpperCase()] ?? null;

/** PesePay currency code → ours. */
const ourCurrency = (code: string | undefined) =>
  !code ? undefined : code.toUpperCase() === 'ZIG' || code.toUpperCase() === 'ZWG' ? 'ZWG' : code.toUpperCase();

const enc = new TextEncoder();
const dec = new TextDecoder();

async function aesKey(encryptionKey: string, usage: 'encrypt' | 'decrypt') {
  const raw = enc.encode(encryptionKey);
  if (raw.length !== 32)
    throw new ProviderError('pesepay', 'misconfigured', 'The PesePay encryption key must be 32 characters');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-CBC' }, false, [usage]);
}
const ivOf = (encryptionKey: string) => enc.encode(encryptionKey.slice(0, 16));

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** AES-256-CBC, IV = first 16 characters of the key, PKCS#7 (WebCrypto's padding), base64. */
export async function pesepayEncrypt(data: unknown, encryptionKey: string): Promise<string> {
  const key = await aesKey(encryptionKey, 'encrypt');
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv: ivOf(encryptionKey) },
    key,
    enc.encode(JSON.stringify(data)),
  );
  return toBase64(new Uint8Array(ct));
}

export async function pesepayDecrypt(payload: string, encryptionKey: string): Promise<unknown> {
  const key = await aesKey(encryptionKey, 'decrypt');
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ivOf(encryptionKey) }, key, fromBase64(payload));
  } catch {
    throw new ProviderError('pesepay', 'invalid_response', 'PesePay response could not be decrypted', {
      retryable: false,
    });
  }
  try {
    return JSON.parse(dec.decode(plain)) as unknown;
  } catch {
    throw new ProviderError('pesepay', 'invalid_response', 'PesePay response was not valid JSON', { retryable: false });
  }
}

function credentials(config: ProviderConfig) {
  const integrationKey = config.credentials['integrationKey'];
  const encryptionKey = config.credentials['encryptionKey'];
  if (!integrationKey || !encryptionKey)
    throw new ProviderError('pesepay', 'misconfigured', 'The PesePay integration or encryption key is missing');
  return { integrationKey, encryptionKey };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface PesepayTransaction {
  referenceNumber?: string;
  merchantReference?: string;
  transactionStatus?: string;
  transactionStatusDescription?: string;
  redirectUrl?: string;
  pollUrl?: string;
  amountDetails?: { amount?: number; currencyCode?: string };
}

/** PesePay amounts are JSON numbers with up to 2 decimals; read them back as integer minor units. */
function amountMinor(n: unknown): number | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  return decimalToMinor(n.toFixed(2)) ?? undefined;
}

function safeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && PESEPAY_HOSTS.has(u.hostname.toLowerCase()) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function createPesepayProvider(deps: ProviderDeps = {}): PaymentProvider {
  const doFetch = deps.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const credentialFields: readonly CredentialField[] = [
    { key: 'integrationKey', env: 'INTEGRATION_KEY' },
    { key: 'encryptionKey', env: 'ENCRYPTION_KEY' },
  ];
  const base = (config: ProviderConfig) => (config.mode === 'live' ? LIVE : TEST);

  async function call(config: ProviderConfig, path: string, body?: unknown): Promise<PesepayTransaction> {
    const { integrationKey, encryptionKey } = credentials(config);
    let res: Response;
    try {
      res = await doFetch(`${base(config)}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { authorization: integrationKey, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify({ payload: await pesepayEncrypt(body, encryptionKey) }) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('pesepay', 'network', 'PesePay could not be reached');
    }
    const text = await res.text();
    if (!res.ok) {
      let message = `PesePay answered with HTTP ${res.status}`;
      try {
        const e = JSON.parse(text) as { message?: unknown };
        if (typeof e.message === 'string' && e.message) message = e.message.slice(0, 200);
      } catch {
        /* not JSON */
      }
      if (res.status === 404) throw new ProviderError('pesepay', 'not_found', message, { retryable: false });
      if (res.status >= 500) throw new ProviderError('pesepay', 'gateway_error', message);
      throw new ProviderError(
        'pesepay',
        res.status === 401 || res.status === 403 ? 'misconfigured' : 'invalid_request',
        message,
        {
          retryable: false,
        },
      );
    }
    let envelope: { payload?: unknown };
    try {
      envelope = JSON.parse(text) as { payload?: unknown };
    } catch {
      throw new ProviderError('pesepay', 'invalid_response', 'PesePay sent an unreadable response');
    }
    if (typeof envelope.payload !== 'string')
      throw new ProviderError('pesepay', 'invalid_response', 'PesePay sent no payload');
    const tx = await pesepayDecrypt(envelope.payload, encryptionKey);
    if (!tx || typeof tx !== 'object')
      throw new ProviderError('pesepay', 'invalid_response', 'PesePay sent an empty payload');
    return tx as PesepayTransaction;
  }

  const secretsOf = (config: ProviderConfig) => [
    config.credentials['integrationKey'] ?? '',
    config.credentials['encryptionKey'] ?? '',
  ];

  function toStatus(tx: PesepayTransaction, config: ProviderConfig): StatusResult {
    const providerStatus = String(tx.transactionStatus ?? '');
    const mapped = mapPesepayStatus(providerStatus);
    if (!mapped) deps.logger?.warn('pesepay: unknown status, treated as pending', { providerStatus });
    const amount = amountMinor(tx.amountDetails?.amount);
    const currency = ourCurrency(tx.amountDetails?.currencyCode);
    return {
      status: mapped ?? 'pending',
      providerStatus,
      ...(tx.referenceNumber ? { providerReference: tx.referenceNumber } : {}),
      ...(tx.merchantReference ? { merchantReference: tx.merchantReference } : {}),
      ...(amount !== undefined ? { amountMinor: amount } : {}),
      ...(currency ? { currency } : {}),
      ...(mapped === 'failed' || mapped === 'cancelled' || mapped === 'expired'
        ? { failureReason: (tx.transactionStatusDescription ?? providerStatus).slice(0, 200) }
        : {}),
      raw: redact(tx as Record<string, unknown>, secretsOf(config)),
    };
  }

  return {
    key: 'pesepay',
    displayName: 'PesePay',
    credentialFields,

    capabilities: () => ({
      flows: ['redirect'],
      methods: METHODS,
      currencies: ['USD', 'ZWG'],
      refunds: false,
      statusPolling: true,
      signedCallbacks: false,
      tokenization: false,
      hostedCardFields: false,
    }),

    async initiatePayment(config, input: InitiateInput): Promise<InitiateResult> {
      credentials(config);
      if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0)
        throw new ProviderError('pesepay', 'invalid_request', 'Amount must be a positive whole number of minor units');
      if (input.flow !== 'redirect')
        throw new ProviderError('pesepay', 'not_supported', 'PesePay payments open on its secure page');
      const method = input.methodCode ? METHODS.find((m) => m.code === input.methodCode) : undefined;
      if (input.methodCode && !method)
        throw new ProviderError('pesepay', 'not_supported', 'This payment method is not available');
      const preselect = input.methodCode ? METHOD_CODES[input.methodCode]?.[input.currency] : undefined;
      if (input.methodCode && input.methodCode !== 'card' && !preselect)
        throw new ProviderError('pesepay', 'not_supported', 'This payment method is not available in this currency');
      const currencyCode = preselect?.currency ?? PAGE_CURRENCY[input.currency];
      if (!currencyCode) throw new ProviderError('pesepay', 'not_supported', 'This currency is not supported');

      const tx = await call(config, '/payments/initiate', {
        amountDetails: { amount: Number(minorToDecimal(input.amountMinor)), currencyCode },
        reasonForPayment: input.description.slice(0, 200),
        resultUrl: input.resultUrl,
        returnUrl: input.returnUrl,
        merchantReference: input.merchantReference,
        ...(preselect ? { paymentMethodCode: preselect.code } : {}),
      });
      const redirectUrl = safeUrl(tx.redirectUrl);
      if (!tx.referenceNumber || !redirectUrl)
        throw new ProviderError('pesepay', 'invalid_response', 'PesePay sent no payment page');
      const pollUrl = safeUrl(tx.pollUrl);
      return {
        kind: 'redirect',
        providerReference: tx.referenceNumber,
        redirectUrl,
        ...(pollUrl ? { pollUrl } : {}),
        raw: redact(tx as Record<string, unknown>, secretsOf(config)),
      };
    },

    async checkPaymentStatus(config, ref) {
      const reference =
        ref.providerReference ??
        (ref.pollUrl ? (new URL(ref.pollUrl).searchParams.get('referenceNumber') ?? undefined) : undefined);
      if (!reference) throw new ProviderError('pesepay', 'invalid_request', 'Nothing to look the payment up by');
      return toStatus(
        await call(config, `/payments/check-payment?referenceNumber=${encodeURIComponent(reference)}`),
        config,
      );
    },

    async parseCallback(config, req: InboundCallback) {
      const { integrationKey } = credentials(config);
      let tx: PesepayTransaction = {};
      try {
        const parsed = JSON.parse(req.body) as unknown;
        if (parsed && typeof parsed === 'object') tx = parsed as PesepayTransaction;
      } catch {
        tx = {};
      }
      const header = req.headers.get('authorization') ?? '';
      // Unsigned: the header match is only a filter. The app confirms every callback with checkPaymentStatus.
      const authentic = !!tx.referenceNumber && constantTimeEqual(header, integrationKey);
      const claimed = toStatus(tx, config);
      return { authentic, claimed: tx.transactionStatus ? claimed : { ...claimed, status: 'error' } };
    },
  };
}
