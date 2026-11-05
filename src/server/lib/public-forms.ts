/** Shared protection for public (anonymous) form submissions: honeypot, per-IP rate limit, Turnstile. */
import type { RequestContext } from '../context';
import { validationError } from './errors';
import { enforce } from './rate-limit';
import { verifyTurnstile } from './turnstile';

/**
 * Returns false when the honeypot was filled: the caller answers like a success and stores nothing, so bots learn
 * nothing. Throws RATE_LIMITED or a turnstile validation error otherwise.
 */
export async function guardPublicSubmission(
  ctx: RequestContext,
  opts: { honeypot: string | undefined; token: string | undefined; bucket: string; limit?: number },
): Promise<boolean> {
  if (opts.honeypot && opts.honeypot.trim() !== '') {
    ctx.logger.info('public form honeypot triggered', { bucket: opts.bucket });
    return false;
  }
  await enforce(ctx, { key: `${opts.bucket}:ip:${ctx.ip}`, limit: opts.limit ?? 5, windowSeconds: 3600 });
  if (!(await verifyTurnstile(ctx, opts.token))) {
    throw validationError({ turnstile: ['Complete the security check and send again.'] });
  }
  return true;
}
