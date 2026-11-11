import { Hono } from 'hono';
import type { ApiEnv } from '../../middleware/request-context';
import { enforce } from '../../lib/rate-limit';
import { notFound, unauthenticated, validationError } from '../../lib/errors';
import { MAX_WEBHOOK_BODY_BYTES, applyResendEvent, verifyResendWebhook } from './service';

/** `/api/webhooks` — provider webhooks (no cookies, so no CSRF; each provider has its own signature check). */
export function webhookRoutes() {
  const r = new Hono<ApiEnv>();
  r.post('/resend', async (c) => {
    const ctx = c.var.ctx;
    await enforce(ctx, { key: `webhook:resend:ip:${ctx.ip}`, limit: 1200, windowSeconds: 3600 });
    const secret = ctx.config.resendWebhookSecret;
    if (!secret) {
      ctx.logger.warn('resend webhook received but RESEND_WEBHOOK_SECRET is not set');
      throw notFound();
    }
    if (Number(c.req.header('content-length') ?? '0') > MAX_WEBHOOK_BODY_BYTES)
      throw validationError({}, 'Payload too large');
    const body = await c.req.text();
    if (body.length > MAX_WEBHOOK_BODY_BYTES) throw validationError({}, 'Payload too large');
    const verified = await verifyResendWebhook(secret, c.req.raw.headers, body, ctx.now());
    if (!verified.ok) {
      ctx.logger.warn('resend webhook rejected', { reason: verified.reason });
      throw unauthenticated('Invalid webhook signature');
    }
    return c.json({ data: await applyResendEvent(ctx, body) });
  });
  return r;
}
