import { Hono } from 'hono';
import { z } from 'zod';
import { respondSchema } from '../../../shared/schemas/quotations';
import { enforce } from '../../lib/rate-limit';
import { csrfProtect, requireAuth, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import { documentPdf } from '../documents/service';
import { fileResponse } from '../files/service';
import * as invoices from '../invoices/portal';
import * as payments from '../payments/portal';
import * as quotations from '../quotations/service';
import { portalOverview } from './service';

const listQuery = z.object({ show: z.enum(['open', 'all']).default('all') }).strict();

/** `/api/v1/portal/*`: client portal reads and actions, portal sessions only (docs/07 §5). */
export function portalRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('portal'), csrfProtect(), requireAuth('portal'));
  r.get('/overview', async (c) => c.json({ data: await portalOverview(c.var.ctx) }));

  r.get('/quotations', async (c) =>
    c.json({ data: await quotations.listPortalQuotations(c.var.ctx, query(c, listQuery)) }),
  );
  r.get('/quotations/:id', async (c) => {
    const q = await quotations.getPortalQuotation(c.var.ctx, c.req.param('id'));
    const { quotation: row, ...rest } = q;
    return c.json({
      data: {
        ...rest,
        quotation: {
          id: row.id,
          number: row.number,
          title: row.title,
          status: row.status,
          currency: row.currency,
          issueDate: row.issue_date,
          validUntil: row.valid_until,
          subtotalMinor: row.subtotal_minor,
          discountMinor: row.discount_minor,
          taxMinor: row.tax_minor,
          totalMinor: row.total_minor,
          acceptedAt: row.accepted_at,
          acceptedByName: row.accepted_by_name,
        },
      },
    });
  });
  r.post('/quotations/:id/respond', async (c) => {
    const ctx = c.var.ctx;
    await enforce(ctx, { key: `quotation-respond:user:${ctx.auth!.user.id}`, limit: 20, windowSeconds: 3600 });
    const status = await quotations.respondPortal(ctx, c.req.param('id'), await jsonBody(c, respondSchema));
    return c.json({ data: { status } });
  });
  r.get('/quotations/:id/pdf', async (c) => {
    const ctx = c.var.ctx;
    const id = await quotations.portalQuotationId(ctx, c.req.param('id'));
    const pdf = await documentPdf(ctx, 'quotation', id);
    return fileResponse(ctx, pdf.file!);
  });

  r.get('/invoices', async (c) => c.json({ data: await invoices.listPortalInvoices(c.var.ctx, query(c, listQuery)) }));
  r.get('/invoices/:id', async (c) => {
    const d = await invoices.getPortalInvoice(c.var.ctx, c.req.param('id'));
    const i = d.invoice;
    return c.json({
      data: {
        invoice: {
          id: i.id,
          number: i.number,
          status: i.status,
          currency: i.currency,
          issueDate: i.issue_date,
          dueDate: i.due_date,
          subtotalMinor: i.subtotal_minor,
          discountMinor: i.discount_minor,
          taxMinor: i.tax_minor,
          totalMinor: i.total_minor,
          paidMinor: i.amount_paid_minor,
          creditedMinor: i.amount_credited_minor,
          balanceMinor: i.balance_minor,
        },
        items: d.items.map((it) => ({
          description: it.description,
          quantityMilli: it.quantity_milli,
          unitPriceMinor: it.unit_price_minor,
          lineTotalMinor: it.line_total_minor,
        })),
        overdue: d.overdue,
        payments: d.payments,
        creditNotes: d.creditNotes,
        payment: d.payment,
      },
    });
  });
  r.get('/invoices/:id/pdf', async (c) => {
    const ctx = c.var.ctx;
    const pdf = await documentPdf(ctx, 'invoice', await invoices.portalInvoiceId(ctx, c.req.param('id')));
    return fileResponse(ctx, pdf.file!, { inline: c.req.query('inline') === '1' });
  });
  r.get('/credit-notes', async (c) => c.json({ data: await invoices.listPortalCreditNotes(c.var.ctx) }));
  r.get('/credit-notes/:id/pdf', async (c) => {
    const ctx = c.var.ctx;
    const pdf = await documentPdf(ctx, 'credit_note', await invoices.portalCreditNoteId(ctx, c.req.param('id')));
    return fileResponse(ctx, pdf.file!, { inline: c.req.query('inline') === '1' });
  });

  r.get('/payments', async (c) => c.json({ data: await payments.listPortalPayments(c.var.ctx) }));
  r.get('/payments/:id/receipt', async (c) => {
    const ctx = c.var.ctx;
    const pdf = await documentPdf(ctx, 'receipt', await payments.portalPaymentId(ctx, c.req.param('id')));
    return fileResponse(ctx, pdf.file!, { inline: c.req.query('inline') === '1' });
  });
  r.get('/payment-attempts/:id', async (c) =>
    c.json({ data: await payments.getPortalAttempt(c.var.ctx, c.req.param('id')) }),
  );
  return r;
}
