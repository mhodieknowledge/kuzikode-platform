import { Hono } from 'hono';
import { z } from 'zod';
import { paymentListQuery, refundSchema } from '../../../shared/schemas/payments';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import { enforce } from '../../lib/rate-limit';
import { notFound } from '../../lib/errors';
import { documentPdf } from '../documents/service';
import { fileResponse } from '../files/service';
import { getPublicAttempt } from './portal';
import * as svc from './service';

const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(10_000).default(1) }).strict();

/** `/api/v1/admin/payments`. */
export function paymentRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
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
  r.get('/payment-attempts/:id', async (c) =>
    c.json({ data: await load(c.var.ctx, c.req.param('id'), query(c, signatureQuery).t) }),
  );
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
