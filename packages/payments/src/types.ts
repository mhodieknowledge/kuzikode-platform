/**
 * The gateway-independent contract (docs/06 §1). The app talks only to `PaymentProvider`; every gateway detail lives in an
 * adapter under `providers/`. Nothing in this package imports the app: fetch, clock and logger are injected.
 */

/** Open union: a new adapter adds its key here. */
export type ProviderKey = 'paynow' | 'pesepay' | 'mock' | (string & {});
/** `express` = the customer pays without leaving our page (USSD push, code, OTP); `redirect` = a gateway page (card entry). */
export type CheckoutFlow = 'redirect' | 'express';
export type MethodNeed = 'phone' | 'otp' | 'token';

export interface PaymentMethodInfo {
  /** Our method code, the same across gateways: `ecocash`, `onemoney`, `innbucks`, `omari`, `card`… */
  code: string;
  name: string;
  flow: CheckoutFlow;
  needs?: MethodNeed[];
}

export interface ProviderCapabilities {
  flows: CheckoutFlow[];
  methods: PaymentMethodInfo[];
  /** Currency codes as we use them (`USD`, `ZWG`); the adapter maps them to the gateway's codes. */
  currencies: string[];
  refunds: boolean;
  statusPolling: boolean;
  signedCallbacks: boolean;
  tokenization: boolean;
  hostedCardFields: boolean;
}

/** Built by the app from a provider account plus its Worker secrets. */
export interface ProviderConfig {
  accountId: string;
  mode: 'test' | 'live';
  credentials: Record<string, string>;
  options?: Record<string, unknown>;
}

/** A credential the adapter needs; the app reads it from the secret `<ACCOUNT_SECRET_PREFIX>_<env>`. */
export interface CredentialField {
  key: string;
  env: string;
  /** Used only in local development when the secret is missing (the mock adapter's signing key). */
  devDefault?: string;
}

/** A provider payload with secrets removed and personal data masked (see `redact`). Safe to store and log. */
export type Redacted = Readonly<Record<string, unknown>> & { readonly __redacted: true };

export interface InitiateInput {
  /** Ours, unique per attempt. */
  merchantReference: string;
  amountMinor: number;
  currency: string;
  description: string;
  returnUrl: string;
  resultUrl: string;
  flow: CheckoutFlow;
  methodCode?: string;
  phone?: string;
  customer?: { email?: string; phone?: string; name?: string };
}

export type InitiateResult =
  | { kind: 'redirect'; providerReference?: string; redirectUrl: string; pollUrl?: string; raw: Redacted }
  | {
      kind: 'express_pending';
      providerReference?: string;
      pollUrl?: string;
      customerInstructions?: string;
      authorizationCode?: string;
      authorizationExpiresAt?: string;
      otpRequired?: { otpReference: string; submitUrl: string };
      raw: Redacted;
    };

export type NormalizedStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'partially_paid'
  | 'disputed'
  | 'refunded'
  | 'reversed'
  | 'error';

export const NORMALIZED_STATUSES: readonly NormalizedStatus[] = [
  'pending',
  'succeeded',
  'failed',
  'cancelled',
  'expired',
  'partially_paid',
  'disputed',
  'refunded',
  'reversed',
  'error',
];

export interface StatusResult {
  status: NormalizedStatus;
  providerStatus: string;
  providerReference?: string;
  merchantReference?: string;
  amountMinor?: number;
  currency?: string;
  failureReason?: string;
  raw: Redacted;
}

export interface StatusRef {
  pollUrl?: string;
  providerReference?: string;
  merchantReference?: string;
}

export interface InboundCallback {
  headers: Headers;
  body: string;
  contentType: string;
}

export interface PaymentProvider {
  readonly key: ProviderKey;
  readonly displayName: string;
  /** Secrets this adapter needs (read by the app from Worker secrets, never stored in the database). */
  readonly credentialFields: readonly CredentialField[];
  capabilities(config: ProviderConfig): ProviderCapabilities;
  initiatePayment(config: ProviderConfig, input: InitiateInput): Promise<InitiateResult>;
  checkPaymentStatus(config: ProviderConfig, ref: StatusRef): Promise<StatusResult>;
  /** Parse and authenticate an inbound callback. Returns what it CLAIMS; the app must confirm via checkPaymentStatus. */
  parseCallback(config: ProviderConfig, req: InboundCallback): Promise<{ authentic: boolean; claimed: StatusResult }>;
  submitOtp?(config: ProviderConfig, input: { submitUrl: string; otp: string }): Promise<StatusResult>;
  refundPayment?(
    config: ProviderConfig,
    input: { providerReference: string; amountMinor: number },
  ): Promise<{ status: 'pending' | 'completed' | 'failed'; providerReference?: string }>;
}

export interface PaymentsLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

/** What every adapter factory receives. All optional, so adapters work in Workers and Node 18+ alike. */
export interface ProviderDeps {
  fetch?: typeof fetch;
  now?: () => Date;
  logger?: PaymentsLogger;
}
