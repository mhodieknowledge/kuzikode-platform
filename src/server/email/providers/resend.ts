import { EmailProviderError, type EmailMessage, type EmailProvider, type SendResult } from '../provider';

const ENDPOINT = 'https://api.resend.com/emails';

/** Resend REST adapter (POST /emails with Idempotency-Key; keys ≤ 256 chars, valid 24 h). */
export function resendProvider(apiKey: string, fetcher: typeof fetch = fetch): EmailProvider {
  return {
    name: 'resend',
    async send(message: EmailMessage, opts: { idempotencyKey: string }): Promise<SendResult> {
      const body: Record<string, unknown> = {
        from: message.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      };
      if (message.replyTo) body['reply_to'] = message.replyTo;
      if (message.tags) {
        body['tags'] = Object.entries(message.tags).map(([name, value]) => ({
          name,
          value: value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256),
        }));
      }
      let res: Response;
      try {
        res = await fetcher(ENDPOINT, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
            'idempotency-key': opts.idempotencyKey.slice(0, 256),
          },
          body: JSON.stringify(body),
        });
      } catch (err) {
        throw new EmailProviderError(
          `Resend request failed: ${err instanceof Error ? err.message : 'network error'}`,
          true,
        );
      }
      const text = await res.text();
      let data: { id?: string; message?: string; name?: string } = {};
      try {
        data = text ? (JSON.parse(text) as typeof data) : {};
      } catch {
        /* non-JSON error body */
      }
      if (res.ok && data.id) return { providerMessageId: data.id };
      const retryable = res.status === 429 || res.status === 409 || res.status >= 500;
      throw new EmailProviderError(
        `Resend ${res.status} ${data.name ?? ''}: ${(data.message ?? 'unexpected response').slice(0, 300)}`,
        retryable,
        res.status,
      );
    },
  };
}
