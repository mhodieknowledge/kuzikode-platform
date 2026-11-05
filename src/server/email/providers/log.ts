import type { Logger } from '../../lib/logger';
import type { EmailMessage, EmailProvider } from '../provider';

/** Development/test adapter: no network. Messages are kept in email_logs (viewable in /admin/dev/mailbox). */
export function logProvider(logger: Logger): EmailProvider {
  return {
    name: 'log',
    async send(message: EmailMessage, opts: { idempotencyKey: string }) {
      logger.info('email (log provider)', {
        to: message.to,
        subject: message.subject,
        idempotencyKey: opts.idempotencyKey,
      });
      return { providerMessageId: `log_${opts.idempotencyKey.slice(0, 80)}` };
    },
  };
}
