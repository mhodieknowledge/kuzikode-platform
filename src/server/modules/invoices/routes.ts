import { Hono } from 'hono';
import { z } from 'zod';
import {
  applyCreditSchema,
  invoiceListQuery,
  invoiceSchema,
  invoiceVoidSchema,
  manualPaymentSchema,
  sendInvoiceSchema,
} from '../../../shared/schemas/invoices';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import { editorProps } from '../quotations/editor';
import * as svc from './service';

const ok = { data: { ok: true } };
const issueSchema = z.object({ send: z.boolean().default(true), message: sendInvoiceSchema.shape.message }).strict();

/** `/api/v1/admin/invoices`. */
export function invoiceRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  r.get('/', requirePermission('invoices.view'), async (c) =>
    c.json({ data: await svc.listInvoices(c.var.ctx, query(c, invoiceListQuery)) }),
  );
  r.get('/options', requirePermission('invoices.create'), async (c) =>
    c.json({ data: await editorProps(c.var.ctx, 'invoices.create') }),
  );
  r.post('/', requirePermission('invoices.create'), async (c) =>
    c.json({ data: await svc.createInvoice(c.var.ctx, await jsonBody(c, invoiceSchema)) }, 201),
  );
  r.get('/:id', requirePermission('invoices.view'), async (c) => {
    const data = await svc.getInvoice(c.var.ctx, c.req.param('id'));
    const link = data.invoice.status === 'draft' ? null : await svc.publicLink(c.var.ctx, data.invoice.id);
    return c.json({ data: { ...data, publicLink: link } });
  });
  r.put('/:id', requirePermission('invoices.update'), async (c) => {
    await svc.updateInvoice(c.var.ctx, c.req.param('id'), await jsonBody(c, invoiceSchema));
    return c.json(ok);
  });
  r.delete('/:id', requirePermission('invoices.update'), async (c) => {
    await svc.deleteDraft(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });
  r.post('/:id/issue', requirePermission('invoices.issue'), async (c) => {
    const body = await jsonBody(c, issueSchema);
    return c.json({ data: await svc.issueInvoice(c.var.ctx, c.req.param('id'), body) });
  });
  r.post('/:id/send', requirePermission('invoices.send'), async (c) => {
    const body = await jsonBody(c, sendInvoiceSchema);
    return c.json({ data: await svc.sendInvoice(c.var.ctx, c.req.param('id'), body) });
  });
  r.post('/:id/payments', requirePermission('payments.record_manual'), async (c) =>
    c.json(
      { data: await svc.recordManualPayment(c.var.ctx, c.req.param('id'), await jsonBody(c, manualPaymentSchema)) },
      201,
    ),
  );
  r.post('/:id/apply-credit', requirePermission('payments.record_manual'), async (c) => {
    const { amountMinor } = await jsonBody(c, applyCreditSchema);
    return c.json({ data: await svc.applyCredit(c.var.ctx, c.req.param('id'), amountMinor) });
  });
  r.post('/:id/void', requirePermission('invoices.void'), async (c) => {
    const { reason } = await jsonBody(c, invoiceVoidSchema);
    await svc.voidInvoice(c.var.ctx, c.req.param('id'), reason);
    return c.json(ok);
  });
  return r;
}
