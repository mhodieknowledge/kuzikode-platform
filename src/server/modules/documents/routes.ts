import { Hono } from 'hono';
import { notFound } from '../../lib/errors';
import { assertCan } from '../../lib/policies';
import { enforce } from '../../lib/rate-limit';
import { requireAuth, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import type { DocumentKind } from '../../pdf';
import { downloadAudit, fileResponse } from '../files/service';
import { DOCUMENT_KINDS, VIEW_PERMISSION, documentPdf, pdfResponse, quotationIdForToken } from './service';

const KIND_PATH: Record<string, DocumentKind> = {
  quotations: 'quotation',
  invoices: 'invoice',
  'credit-notes': 'credit_note',
  receipts: 'receipt',
};

/** `/api/v1/admin/documents/:kind/:id/pdf` — staff download (stored PDF, audited) or draft preview. */
export function documentRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'));
  r.get('/:kind/:id/pdf', async (c) => {
    const ctx = c.var.ctx;
    const kind = KIND_PATH[c.req.param('kind')];
    if (!kind || !DOCUMENT_KINDS.includes(kind)) throw notFound();
    assertCan(ctx, VIEW_PERMISSION[kind]);
    const pdf = await documentPdf(ctx, kind, c.req.param('id'));
    const inline = c.req.query('inline') === '1';
    if (pdf.bytes) return pdfResponse(pdf.bytes, pdf.filename, { inline });
    await downloadAudit(ctx, pdf.file!).run();
    return fileResponse(ctx, pdf.file!, { inline });
  });
  return r;
}

/** `/api/v1/public/quotations/:token/pdf` — the client's download from the public link. */
export function publicDocumentRoutes() {
  const r = new Hono<ApiEnv>();
  r.get('/quotations/:token/pdf', async (c) => {
    const ctx = c.var.ctx;
    await enforce(ctx, { key: `document-pdf:ip:${ctx.ip}`, limit: 60, windowSeconds: 3600 });
    const id = await quotationIdForToken(ctx, c.req.param('token'));
    if (!id) throw notFound();
    const pdf = await documentPdf(ctx, 'quotation', id);
    const res = await fileResponse(ctx, pdf.file!);
    res.headers.set('x-robots-tag', 'noindex, nofollow');
    return res;
  });
  return r;
}
