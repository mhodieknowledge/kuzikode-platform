import { Hono } from 'hono';
import {
  assetListQuery,
  assetSchema,
  cancelSubscriptionSchema,
  subscriptionListQuery,
  subscriptionSchema,
} from '../../../shared/schemas/subscriptions';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody, query } from '../../middleware/validate';
import * as assets from './assets';
import * as svc from './service';

const ok = { data: { ok: true } };

/** `/api/v1/admin/subscriptions`. */
export function subscriptionRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  r.get('/', requirePermission('subscriptions.view'), async (c) =>
    c.json({ data: await svc.listSubscriptions(c.var.ctx, query(c, subscriptionListQuery)) }),
  );
  r.post('/', requirePermission('subscriptions.manage'), async (c) =>
    c.json({ data: await svc.createSubscription(c.var.ctx, await jsonBody(c, subscriptionSchema)) }, 201),
  );
  r.get('/:id', requirePermission('subscriptions.view'), async (c) =>
    c.json({ data: await svc.getSubscription(c.var.ctx, c.req.param('id')) }),
  );
  r.put('/:id', requirePermission('subscriptions.manage'), async (c) => {
    await svc.updateSubscription(c.var.ctx, c.req.param('id'), await jsonBody(c, subscriptionSchema));
    return c.json(ok);
  });
  r.post('/:id/pause', requirePermission('subscriptions.manage'), async (c) => {
    await svc.pauseSubscription(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });
  r.post('/:id/resume', requirePermission('subscriptions.manage'), async (c) => {
    await svc.resumeSubscription(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });
  r.post('/:id/cancel', requirePermission('subscriptions.manage'), async (c) => {
    await svc.cancelSubscription(c.var.ctx, c.req.param('id'), await jsonBody(c, cancelSubscriptionSchema));
    return c.json(ok);
  });
  return r;
}

/** `/api/v1/admin/assets`: the managed services register (client_assets.manage). */
export function assetRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect(), requirePermission('client_assets.manage'));
  r.get('/', async (c) => c.json({ data: await assets.listAssets(c.var.ctx, query(c, assetListQuery)) }));
  r.post('/', async (c) => c.json({ data: await assets.createAsset(c.var.ctx, await jsonBody(c, assetSchema)) }, 201));
  r.get('/:id', async (c) => c.json({ data: await assets.getAsset(c.var.ctx, c.req.param('id')) }));
  r.put('/:id', async (c) => {
    await assets.updateAsset(c.var.ctx, c.req.param('id'), await jsonBody(c, assetSchema));
    return c.json(ok);
  });
  r.delete('/:id', async (c) => {
    await assets.deleteAsset(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });
  return r;
}
