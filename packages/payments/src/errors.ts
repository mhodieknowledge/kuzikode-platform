/**
 * Errors thrown by adapters. `message` is always safe to show or log (no credentials, no raw gateway payload);
 * `retryable` tells the app whether trying again later can help (network, 5xx) or not (declined, bad request).
 */
export type ProviderErrorCode =
  | 'network'
  | 'gateway_error'
  | 'declined'
  | 'invalid_request'
  | 'invalid_response'
  | 'not_supported'
  | 'misconfigured'
  | 'not_found';

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly providerKey: string;

  constructor(providerKey: string, code: ProviderErrorCode, message: string, opts: { retryable?: boolean } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.providerKey = providerKey;
    this.code = code;
    this.retryable = opts.retryable ?? (code === 'network' || code === 'gateway_error');
  }
}

export const isProviderError = (e: unknown): e is ProviderError => e instanceof ProviderError;
