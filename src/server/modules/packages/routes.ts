import { Hono } from 'hono';
import { z } from 'zod';
import { addonSchema, packageLinesSchema, packageOrderSchema, packageSchema } from '../../../shared/schemas/packages';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody } from '../../middleware/validate';
import * as svc from './service';

const ok = { data: { ok: true } };
const approveSchema = z
  .object({
    ids: z
      .array(z.string().regex(/^pkg_[A-Za-z0-9_]+$/))
      .max(200)
      .default([]),
  })
  .strict();

/** `/api/v1/admin/packages`: packages, features and add-ons (packages.manage); price approval (packages.price_review). */
export function packageRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  // The quotation editor's "Add package" picker and line builder (quotations.create, no catalogue rights needed).
  r.get('/picker', requirePermission('quotations.create'), async (c) =>
    c.json({ data: await svc.packagePicker(c.var.ctx) }),
  );
  r.post('/:id/quote-lines', requirePermission('quotations.create'), async (c) =>
    c.json({ data: await svc.packageQuoteLines(c.var.ctx, c.req.param('id'), await jsonBody(c, packageLinesSchema)) }),
  );
  r.post('/approve-prices', requirePermission('packages.price_review'), async (c) => {
    const { ids } = await jsonBody(c, approveSchema);
    return c.json({ data: { approved: await svc.approvePrices(c.var.ctx, ids) } });
  });

  const m = new Hono<ApiEnv>();
  m.use('*', requirePermission('packages.manage'));
  m.get('/', async (c) => c.json({ data: await svc.listPackagesAdmin(c.var.ctx) }));
  m.post('/', async (c) => c.json({ data: await svc.createPackage(c.var.ctx, await jsonBody(c, packageSchema)) }, 201));
  m.post('/order', async (c) => {
    const { tab, ids } = await jsonBody(c, packageOrderSchema);
    await svc.reorderPackages(c.var.ctx, tab, ids);
    return c.json(ok);
  });
  m.post('/addons', async (c) =>
    c.json({ data: await svc.createAddon(c.var.ctx, await jsonBody(c, addonSchema)) }, 201),
  );
  m.put('/addons/:id', async (c) => {
    await svc.updateAddon(c.var.ctx, c.req.param('id'), await jsonBody(c, addonSchema));
    return c.json(ok);
  });
  m.delete('/addons/:id', async (c) => {
    await svc.deleteAddon(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });
  m.get('/:id', async (c) => c.json({ data: await svc.getPackageAdmin(c.var.ctx, c.req.param('id')) }));
  m.put('/:id', async (c) => {
    await svc.updatePackage(c.var.ctx, c.req.param('id'), await jsonBody(c, packageSchema));
    return c.json(ok);
  });
  m.delete('/:id', async (c) => {
    await svc.deletePackage(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });
  r.route('/', m);
  return r;
}
