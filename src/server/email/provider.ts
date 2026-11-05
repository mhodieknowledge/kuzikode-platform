export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  from: string;
  replyTo?: string;
  tags?: Record<string, string>;
}

export interface SendResult {
  providerMessageId: string;
}

/** Email provider abstraction (docs/02). Implementations must honour the idempotency key. */
export interface EmailProvider {
  readonly name: 'resend' | 'log';
  send(message: EmailMessage, opts: { idempotencyKey: string }): Promise<SendResult>;
}

/** A provider failure. `retryable` false means retrying cannot succeed (bad request, unverified domain…). */
export class EmailProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'EmailProviderError';
  }
}
