import { Hono } from 'hono';
import {
  quotationListQuery,
  quotationSchema,
  respondSchema,
  sendQuotationSchema,
  voidSchema,
} from '../../../shared/schemas/quotations';
import { enforce } from '../../lib/rate-limit';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import * as svc from './service';

const ok = { data: { ok: true } };

/** `/api/v1/admin/quotations`. */
export function quotationRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  r.get('/', requirePermission('quotations.view'), async (c) =>
    c.json({ data: await svc.listQuotations(c.var.ctx, query(c, quotationListQuery)) }),
  );
  r.get('/options', requirePermission('quotations.view'), async (c) =>
    c.json({ data: await svc.editorOptions(c.var.ctx) }),
  );
  r.post('/', requirePermission('quotations.create'), async (c) =>
    c.json({ data: await svc.createQuotation(c.var.ctx, await jsonBody(c, quotationSchema)) }, 201),
  );
  r.get('/:id', requirePermission('quotations.view'), async (c) => {
    const data = await svc.getQuotation(c.var.ctx, c.req.param('id'));
    const link = data.quotation.status === 'draft' ? null : await svc.publicLink(c.var.ctx, data.quotation.id);
    return c.json({ data: { ...data, publicLink: link } });
  });
  r.put('/:id', requirePermission('quotations.update'), async (c) => {
    await svc.updateQuotation(c.var.ctx, c.req.param('id'), await jsonBody(c, quotationSchema));
    return c.json(ok);
  });
  r.delete('/:id', requirePermission('quotations.update'), async (c) => {
    await svc.deleteDraft(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });
  r.post('/:id/send', requirePermission('quotations.send'), async (c) => {
    const body = await jsonBody(c, sendQuotationSchema);
    return c.json({ data: await svc.sendQuotation(c.var.ctx, c.req.param('id'), { message: body.message }) });
  });
  r.post('/:id/duplicate', requirePermission('quotations.create'), async (c) =>
    c.json({ data: await svc.duplicateQuotation(c.var.ctx, c.req.param('id')) }, 201),
  );
  r.post('/:id/revise', requirePermission('quotations.update'), async (c) =>
    c.json({ data: await svc.reviseQuotation(c.var.ctx, c.req.param('id')) }, 201),
  );
  r.post('/:id/response', requirePermission('quotations.update'), async (c) => {
    await svc.recordResponse(c.var.ctx, c.req.param('id'), await jsonBody(c, respondSchema));
    return c.json(ok);
  });
  r.post('/:id/void', requirePermission('quotations.void'), async (c) => {
    const { reason } = await jsonBody(c, voidSchema);
    await svc.voidQuotation(c.var.ctx, c.req.param('id'), reason);
    return c.json(ok);
  });
  r.post('/:id/convert', requirePermission('invoices.create'), async (c) => {
    const res = await svc.convertToInvoice(c.var.ctx, c.req.param('id'));
    return c.json({ data: res }, res.created ? 201 : 200);
  });
  return r;
}

/** `/api/v1/public/quotations/:token/respond` — the client's accept/reject from the public link. */
export function publicQuotationRoutes() {
  const r = new Hono<ApiEnv>();
  r.post('/quotations/:token/respond', csrfProtect(), async (c) => {
    const ctx = c.var.ctx;
    await enforce(ctx, { key: `quotation-respond:ip:${ctx.ip}`, limit: 20, windowSeconds: 3600 });
    const status = await svc.respondPublic(ctx, c.req.param('token'), await jsonBody(c, respondSchema));
    return c.json({ data: { status } });
  });
  return r;
}
