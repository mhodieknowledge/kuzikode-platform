import { Hono } from 'hono';
import { z } from 'zod';
import { respondSchema } from '../../../shared/schemas/quotations';
import { enforce } from '../../lib/rate-limit';
import { csrfProtect, requireAuth, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import { documentPdf } from '../documents/service';
import { fileResponse } from '../files/service';
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
  return r;
}
