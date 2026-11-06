import { Hono } from 'hono';
import { z } from 'zod';
import { respondSchema } from '../../../shared/schemas/quotations';
import {
  cancellationRequestSchema,
  portalNewSupportSchema,
  portalSupportReplySchema,
} from '../../../shared/schemas/support';
import { validationError } from '../../lib/errors';
import { enforce } from '../../lib/rate-limit';
import { csrfProtect, requireAuth, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import type { Context } from 'hono';
import type { z as Z } from 'zod';
import { jsonBody, query } from '../../middleware/validate';
import { documentPdf } from '../documents/service';
import { fileResponse } from '../files/service';
import * as invoices from '../invoices/portal';
import * as payments from '../payments/portal';
import * as projects from '../projects/portal';
import * as quotations from '../quotations/service';
import * as services from '../subscriptions/portal';
import * as support from '../support/portal';
import { portalOverview } from './service';

const messageSchema = z.object({ body: z.string().trim().min(1, 'Write a message.').max(5000) }).strict();
const listQuery = z.object({ show: z.enum(['open', 'all']).default('all') }).strict();

const MAX_MULTIPART_BYTES = 26 * 1024 * 1024;

/**
 * Support forms come as JSON, or as multipart with the same fields plus up to 5 `files`. Field errors are reported
 * like JSON validation errors.
 */
async function supportBody<S extends Z.ZodTypeAny>(
  c: Context<ApiEnv>,
  schema: S,
): Promise<{ data: Z.output<S>; files: support.UploadedFile[] }> {
  if (!(c.req.header('content-type') ?? '').startsWith('multipart/form-data'))
    return { data: await jsonBody(c, schema), files: [] };
  if (Number(c.req.header('content-length') ?? '0') > MAX_MULTIPART_BYTES)
    throw validationError({ files: ['Attachments are too large.'] });
  const form = await c.req.formData().catch(() => {
    throw validationError({ files: ['Send the form as multipart/form-data.'] });
  });
  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k !== 'files' && typeof v === 'string' && v !== '') fields[k] = v;
  const parsed = schema.safeParse(fields);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) (errors[String(i.path[0] ?? 'body')] ??= []).push(i.message);
    throw validationError(errors);
  }
  const files: support.UploadedFile[] = [];
  for (const f of form.getAll('files'))
    if (f instanceof File && f.size > 0) files.push({ bytes: new Uint8Array(await f.arrayBuffer()), filename: f.name });
  return { data: parsed.data, files };
}

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

  r.get('/projects', async (c) => c.json({ data: await projects.listPortalProjects(c.var.ctx) }));
  r.get('/projects/:id', async (c) => c.json({ data: await projects.getPortalProject(c.var.ctx, c.req.param('id')) }));
  r.post('/projects/:id/messages', async (c) =>
    c.json(
      {
        data: await projects.postPortalMessage(c.var.ctx, c.req.param('id'), (await jsonBody(c, messageSchema)).body),
      },
      201,
    ),
  );

  r.get('/support', async (c) => c.json({ data: await support.listPortalRequests(c.var.ctx, query(c, listQuery)) }));
  r.post('/support', async (c) => {
    const { data, files } = await supportBody(c, portalNewSupportSchema);
    return c.json({ data: await support.createPortalRequest(c.var.ctx, data, files) }, 201);
  });
  r.get('/support/:id', async (c) => c.json({ data: await support.getPortalRequest(c.var.ctx, c.req.param('id')) }));
  r.post('/support/:id/messages', async (c) => {
    const { data, files } = await supportBody(c, portalSupportReplySchema);
    return c.json({ data: await support.replyPortal(c.var.ctx, c.req.param('id'), data.body, files) }, 201);
  });
  r.post('/support/:id/resolve', async (c) =>
    c.json({ data: await support.resolvePortal(c.var.ctx, c.req.param('id')) }),
  );

  r.get('/services', async (c) => c.json({ data: await services.listPortalServices(c.var.ctx) }));
  r.post('/services/subscriptions/:id/cancellation', async (c) => {
    const { reason } = await jsonBody(c, cancellationRequestSchema);
    const res = await services.requestCancellation(c.var.ctx, c.req.param('id'), reason);
    return c.json({ data: res }, res.existing ? 200 : 201);
  });
  return r;
}
