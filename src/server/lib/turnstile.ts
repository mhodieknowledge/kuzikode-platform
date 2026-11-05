import type { RequestContext } from '../context';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Cloudflare's documented dummy secrets: always pass / always fail. Emulated locally so tests never hit the network. */
export const TURNSTILE_TEST_SECRETS = {
  pass: '1x0000000000000000000000000000000AA',
  fail: '2x0000000000000000000000000000000AA',
  spent: '3x0000000000000000000000000000000AA',
} as const;

export async function verifyTurnstile(
  ctx: RequestContext,
  token: string | undefined | null,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  const secret = ctx.config.turnstileSecretKey;
  if (secret === TURNSTILE_TEST_SECRETS.pass) return true;
  if (secret === TURNSTILE_TEST_SECRETS.fail || secret === TURNSTILE_TEST_SECRETS.spent) return false;
  try {
    const body = new FormData();
    body.set('secret', secret);
    body.set('response', token);
    if (ctx.ip !== '0.0.0.0') body.set('remoteip', ctx.ip);
    const res = await fetcher(SITEVERIFY, { method: 'POST', body });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    ctx.logger.warn('turnstile verification failed', { err });
    return false;
  }
}
