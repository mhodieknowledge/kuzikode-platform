import { Hono } from 'hono';
import { z } from 'zod';
import { paymentListQuery, refundSchema } from '../../../shared/schemas/payments';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
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
