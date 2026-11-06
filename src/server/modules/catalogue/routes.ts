import { Hono } from 'hono';
import { categorySchema, reorderSchema, serviceSchema } from '../../../shared/schemas/catalogue';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody } from '../../middleware/validate';
import * as svc from './service';

const ok = { data: { ok: true } };

/** `/api/v1/admin/catalogue`: divisions and services (services.manage). */
export function catalogueRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect(), requirePermission('services.manage'));
  r.get('/', async (c) => c.json({ data: await svc.listCatalogue(c.var.ctx) }));

  r.post('/categories', async (c) =>
    c.json({ data: await svc.createCategory(c.var.ctx, await jsonBody(c, categorySchema)) }, 201),
  );
  r.post('/categories/order', async (c) => {
    const { ids } = await jsonBody(c, reorderSchema);
    await svc.reorder(c.var.ctx, { kind: 'categories' }, ids);
    return c.json(ok);
  });
  r.get('/categories/:id', async (c) => c.json({ data: await svc.getCategoryAdmin(c.var.ctx, c.req.param('id')) }));
  r.put('/categories/:id', async (c) => {
    await svc.updateCategory(c.var.ctx, c.req.param('id'), await jsonBody(c, categorySchema));
    return c.json(ok);
  });
  r.delete('/categories/:id', async (c) => {
    await svc.deleteCategory(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });
  r.post('/categories/:id/services/order', async (c) => {
    const { ids } = await jsonBody(c, reorderSchema);
    await svc.reorder(c.var.ctx, { kind: 'services', categoryId: c.req.param('id') }, ids);
    return c.json(ok);
  });

  r.post('/services', async (c) =>
    c.json({ data: await svc.createService(c.var.ctx, await jsonBody(c, serviceSchema)) }, 201),
  );
  r.get('/services/:id', async (c) => c.json({ data: await svc.getServiceAdmin(c.var.ctx, c.req.param('id')) }));
  r.put('/services/:id', async (c) => {
    await svc.updateService(c.var.ctx, c.req.param('id'), await jsonBody(c, serviceSchema));
    return c.json(ok);
  });
  r.delete('/services/:id', async (c) => {
    await svc.deleteService(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });
  return r;
}
