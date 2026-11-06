import { Hono } from 'hono';
import {
  categorySchema,
  expenseListQuery,
  expenseReportQuery,
  expenseSchema,
  expenseVoidSchema,
} from '../../../shared/schemas/expenses';
import { validationError } from '../../lib/errors';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import * as svc from './service';

const ok = { data: { ok: true } };
const MAX_MULTIPART_BYTES = 11 * 1024 * 1024;

/** `/api/v1/admin/expenses`. */
export function expenseRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  r.get('/', requirePermission('expenses.view'), async (c) =>
    c.json({ data: await svc.listExpenses(c.var.ctx, query(c, expenseListQuery)) }),
  );
  r.get('/report', requirePermission('expenses.view'), async (c) =>
    c.json({ data: await svc.expenseReport(c.var.ctx, query(c, expenseReportQuery)) }),
  );
  r.get('/export.csv', requirePermission('expenses.view'), async (c) => {
    const { page: _p, ...filter } = query(c, expenseListQuery);
    const csv = await svc.exportCsv(c.var.ctx, filter);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="expenses-${c.var.ctx.now().toISOString().slice(0, 10)}.csv"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  });
  r.get('/categories', requirePermission('expenses.view'), async (c) =>
    c.json({ data: await svc.listCategories(c.var.ctx) }),
  );
  r.post('/categories', requirePermission('expenses.manage'), async (c) =>
    c.json({ data: await svc.saveCategory(c.var.ctx, null, await jsonBody(c, categorySchema)) }, 201),
  );
  r.put('/categories/:cid', requirePermission('expenses.manage'), async (c) =>
    c.json({ data: await svc.saveCategory(c.var.ctx, c.req.param('cid'), await jsonBody(c, categorySchema)) }),
  );
  r.delete('/categories/:cid', requirePermission('expenses.manage'), async (c) => {
    await svc.deleteCategory(c.var.ctx, c.req.param('cid'));
    return c.json(ok);
  });
  r.post('/', requirePermission('expenses.manage'), async (c) =>
    c.json({ data: await svc.createExpense(c.var.ctx, await jsonBody(c, expenseSchema)) }, 201),
  );
  r.get('/:id', requirePermission('expenses.view'), async (c) =>
    c.json({ data: await svc.getExpense(c.var.ctx, c.req.param('id')) }),
  );
  r.put('/:id', requirePermission('expenses.manage'), async (c) => {
    await svc.updateExpense(c.var.ctx, c.req.param('id'), await jsonBody(c, expenseSchema));
    return c.json(ok);
  });
  r.post('/:id/void', requirePermission('expenses.manage'), async (c) => {
    const { reason } = await jsonBody(c, expenseVoidSchema);
    await svc.voidExpense(c.var.ctx, c.req.param('id'), reason);
    return c.json(ok);
  });
  r.post('/:id/receipt', requirePermission('expenses.manage'), async (c) => {
    if (Number(c.req.header('content-length') ?? '0') > MAX_MULTIPART_BYTES)
      throw validationError({ file: ['Files must be 10 MB or smaller.'] });
    const form = await c.req.formData().catch(() => {
      throw validationError({ file: ['Send the file as multipart/form-data.'] });
    });
    const file = form.get('file');
    if (!(file instanceof File)) throw validationError({ file: ['Choose a receipt to upload.'] });
    const res = await svc.attachReceipt(c.var.ctx, c.req.param('id'), {
      bytes: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
    });
    return c.json({ data: res }, 201);
  });
  return r;
}
