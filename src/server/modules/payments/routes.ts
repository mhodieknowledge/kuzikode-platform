import { Hono } from 'hono';
import { z } from 'zod';
import {
  IDEMPOTENCY_KEY,
  attemptOtpSchema,
  publicBankTransferNoticeSchema,
  paymentAccountCreateSchema,
  paymentAccountUpdateSchema,
  paymentListQuery,
  paymentRouteSchema,
  publicPayInvoiceSchema,
  refundSchema,
} from '../../../shared/schemas/payments';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { Context } from 'hono';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import { enforce } from '../../lib/rate-limit';
import { forbidden, notFound, validationError } from '../../lib/errors';
import { isSuperAdmin } from '../../lib/policies';
import { verifyTurnstile } from '../../lib/turnstile';
import { paymentReturnUrl } from '../../lib/public-links';
import { invoiceIdForToken } from '../invoices/service';
import * as orchestration from './orchestration';
import * as config from './admin-config';
import { documentPdf } from '../documents/service';
import { fileResponse } from '../files/service';
import { getPublicAttempt } from './portal';
import { reportBankTransfer } from './checkout';
import * as svc from './service';

const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1) }).strict();

/** `/api/v1/admin/payments`. */
export function paymentRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  // Gateway configuration: Super Admin only (checked here before the body is read, and again in the service).
  r.use('/config/*', async (c, next) => {
    if (!isSuperAdmin(c.var.ctx)) throw forbidden('Only a Super Administrator can change payment gateways.');
    await next();
  });
  r.use('/config', async (c, next) => {
    if (!isSuperAdmin(c.var.ctx)) throw forbidden('Only a Super Administrator can change payment gateways.');
    await next();
  });
  r.get('/config', requirePermission('settings.manage'), async (c) =>
    c.json({ data: await config.paymentConfig(c.var.ctx) }),
  );
  r.post('/config/accounts', requirePermission('settings.manage'), async (c) =>
    c.json({ data: await config.createPaymentAccount(c.var.ctx, await jsonBody(c, paymentAccountCreateSchema)) }, 201),
  );
  r.patch('/config/accounts/:id', requirePermission('settings.manage'), async (c) => {
    await config.updatePaymentAccount(c.var.ctx, c.req.param('id'), await jsonBody(c, paymentAccountUpdateSchema));
    return c.json({ data: { ok: true } });
  });
  r.post('/config/routes', requirePermission('settings.manage'), async (c) =>
    c.json({ data: await config.createPaymentRoute(c.var.ctx, await jsonBody(c, paymentRouteSchema)) }, 201),
  );
  r.patch('/config/routes/:id', requirePermission('settings.manage'), async (c) => {
    await config.updatePaymentRoute(c.var.ctx, c.req.param('id'), await jsonBody(c, paymentRouteSchema));
    return c.json({ data: { ok: true } });
  });
  r.delete('/config/routes/:id', requirePermission('settings.manage'), async (c) => {
    await config.deletePaymentRoute(c.var.ctx, c.req.param('id'));
    return c.json({ data: { ok: true } });
  });
  r.get('/', requirePermission('payments.view'), async (c) =>
    c.json({ data: await svc.listPayments(c.var.ctx, query(c, paymentListQuery)) }),
  );
  r.get('/unmatched', requirePermission('payments.view'), async (c) =>
    c.json({ data: await svc.listUnmatched(c.var.ctx, query(c, pageQuery).page) }),
  );
  r.get('/:id', requirePermission('payments.view'), async (c) =>
    c.json({ data: await svc.getPayment(c.var.ctx, c.req.param('id')) }),
  );
  r.post('/:id/refunds', requirePermission('payments.refund'), async (c) =>
    c.json({ data: await svc.recordRefund(c.var.ctx, c.req.param('id'), await jsonBody(c, refundSchema)) }, 201),
  );
  return r;
}

const signatureQuery = z.object({ t: z.string().max(200).default('') }).strict();

/**
 * `/api/v1/public/payment-attempts/:id?t=<sig>` — status (polled by `/pay/return`) and the receipt once paid. The
 * signature from the gateway return link is the only key; wrong or missing → 404, same as an unknown attempt.
 */
export function publicPaymentRoutes() {
  const r = new Hono<ApiEnv>();
  const load = async (ctx: ApiEnv['Variables']['ctx'], id: string, t: string) => {
    await enforce(ctx, { key: `pay-return:ip:${ctx.ip}`, limit: 300, windowSeconds: 3600 });
    const attempt = await getPublicAttempt(ctx, id, t);
    if (!attempt) throw notFound();
    return attempt;
  };
  r.get('/payment-attempts/:id', async (c) => {
    const ctx = c.var.ctx;
    const t = query(c, signatureQuery).t;
    const before = await load(ctx, c.req.param('id'), t);
    // While waiting, ask the gateway (at most once per 5 s per attempt); the browser return itself proves nothing.
    if (before.phase === 'waiting') await orchestration.checkAttempt(ctx, before.id);
    return c.json({ data: before.phase === 'waiting' ? await load(ctx, before.id, t) : before });
  });
  r.post('/payment-attempts/:id/otp', csrfProtect(), async (c) => {
    const ctx = c.var.ctx;
    await enforce(ctx, { key: `pay-otp:ip:${ctx.ip}`, limit: 20, windowSeconds: 3600 });
    const a = await load(ctx, c.req.param('id'), query(c, signatureQuery).t);
    const { otp } = await jsonBody(c, attemptOtpSchema);
    return c.json({ data: await orchestration.submitAttemptOtp(ctx, a.id, otp) });
  });

  // Paying from the public invoice link (/i/:token → checkout).
  const invoiceFor = async (ctx: ApiEnv['Variables']['ctx'], token: string) => {
    const id = await invoiceIdForToken(ctx, token);
    if (!id) throw notFound();
    return id;
  };
  r.get('/invoices/:token/payment-options', async (c) => {
    const ctx = c.var.ctx;
    await enforce(ctx, { key: `pay-options:ip:${ctx.ip}`, limit: 120, windowSeconds: 3600 });
    return c.json({
      data: await orchestration.invoicePaymentOptions(ctx, await invoiceFor(ctx, c.req.param('token'))),
    });
  });
  r.post('/invoices/:token/pay', csrfProtect(), async (c) => {
    const ctx = c.var.ctx;
    await enforce(ctx, { key: `pay-start:ip:${ctx.ip}`, limit: 20, windowSeconds: 3600 });
    const invoiceId = await invoiceFor(ctx, c.req.param('token'));
    const body = await jsonBody(c, publicPayInvoiceSchema);
    if (!(await verifyTurnstile(ctx, body.turnstileToken)))
      throw validationError({ turnstile: ['Complete the security check and try again.'] });
    const start = await orchestration.initiateInvoicePayment(ctx, invoiceId, {
      methodCode: body.methodCode,
      phone: body.phone,
      idempotencyKey: idempotencyKey(c),
    });
    const statusPage = new URL(await paymentReturnUrl(ctx, start.attemptId));
    // The checkout polls and posts the OTP with the same signature the gateway return link carries.
    const base = `/api/v1/public/payment-attempts/${encodeURIComponent(start.attemptId)}`;
    const q = `?t=${encodeURIComponent(statusPage.searchParams.get('t') ?? '')}`;
    return c.json(
      {
        data: {
          ...start,
          statusPage: `${statusPage.pathname}${statusPage.search}`,
          statusUrl: `${base}${q}`,
          otpUrl: `${base}/otp${q}`,
        },
      },
      201,
    );
  });
  r.post('/invoices/:token/bank-transfer-notice', csrfProtect(), async (c) => {
    const ctx = c.var.ctx;
    await enforce(ctx, { key: `pay-notice:ip:${ctx.ip}`, limit: 10, windowSeconds: 3600 });
    const invoiceId = await invoiceFor(ctx, c.req.param('token'));
    const { turnstileToken, ...body } = await jsonBody(c, publicBankTransferNoticeSchema);
    if (!(await verifyTurnstile(ctx, turnstileToken)))
      throw validationError({ turnstile: ['Complete the security check and try again.'] });
    return c.json({ data: await reportBankTransfer(ctx, invoiceId, body) });
  });
  r.get('/payment-attempts/:id/receipt', async (c) => {
    const ctx = c.var.ctx;
    const attempt = await load(ctx, c.req.param('id'), query(c, signatureQuery).t);
    if (!attempt.payment) throw notFound();
    const pdf = await documentPdf(ctx, 'receipt', attempt.payment.id);
    const res = await fileResponse(ctx, pdf.file!);
    res.headers.set('x-robots-tag', 'noindex, nofollow');
    return res;
  });
  return r;
}

/** The `Idempotency-Key` header every "Pay" request carries (docs/06 §3). */
export function idempotencyKey(c: Context<ApiEnv>): string {
  const key = c.req.header('idempotency-key') ?? '';
  if (!IDEMPOTENCY_KEY.test(key))
    throw validationError({ idempotencyKey: ['Missing or invalid Idempotency-Key header.'] });
  return key;
}

/**
 * `POST /api/payments/callbacks/:provider/:accountId` — gateway status updates. Not a browser endpoint: no session, no
 * CSRF; authenticity is the adapter's job and the result is confirmed with a status check. Always answers 200 (the body
 * says nothing about the outcome), so gateways stop resending and probes learn nothing.
 */
export function paymentCallbackRoutes() {
  const r = new Hono<ApiEnv>();
  r.post('/:provider/:accountId', async (c) => {
    const ctx = c.var.ctx;
    await enforce(ctx, { key: `pay-callback:ip:${ctx.ip}`, limit: 600, windowSeconds: 3600 });
    const length = Number(c.req.header('content-length') ?? '0');
    const body = length > 65_536 ? '' : (await c.req.text()).slice(0, 65_536);
    const provider = c.req.param('provider');
    const accountId = c.req.param('accountId');
    if (/^[a-z][a-z0-9_]{1,30}$/.test(provider) && /^[A-Za-z0-9_-]{1,64}$/.test(accountId) && body) {
      try {
        await orchestration.handleCallback(ctx, provider, accountId, {
          headers: c.req.raw.headers,
          body,
          contentType: c.req.header('content-type') ?? '',
        });
      } catch (err) {
        // Logged for finance; reconciliation picks the attempt up again. The gateway still gets 200.
        ctx.logger.error('payment callback processing failed', { provider, accountId, err });
      }
    }
    return c.text('OK', 200);
  });
  return r;
}
