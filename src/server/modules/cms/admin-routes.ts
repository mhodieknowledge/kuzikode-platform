import { Hono } from 'hono';
import {
  announcementSchema,
  mediaMetaSchema,
  pageMetaSchema,
  portfolioSchema,
  productSchema,
  sectionDraftSchema,
  sectionMoveSchema,
  sectionVisibleSchema,
} from '../../../shared/schemas/cms-admin';
import { validationError } from '../../lib/errors';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody } from '../../middleware/validate';
import { z } from 'zod';
import * as cms from './admin';

const ok = { data: { ok: true } };
const statusSchema = z.object({ status: z.enum(['draft', 'published']) }).strict();

/** `/api/v1/admin/cms`. */
export function cmsAdminRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  const manage = requirePermission('cms.manage');

  r.get('/pages', manage, async (c) => c.json({ data: await cms.listPages(c.var.ctx) }));
  r.get('/pages/:key', manage, async (c) => c.json({ data: await cms.getPageAdmin(c.var.ctx, c.req.param('key')) }));
  r.put('/pages/:key', manage, async (c) => {
    await cms.savePageMeta(c.var.ctx, c.req.param('key'), await jsonBody(c, pageMetaSchema));
    return c.json(ok);
  });
  r.put('/pages/:key/sections/:section', manage, async (c) => {
    const { content } = await jsonBody(c, sectionDraftSchema);
    await cms.saveSectionDraft(c.var.ctx, c.req.param('key'), c.req.param('section'), content);
    return c.json(ok);
  });
  r.post('/pages/:key/sections/:section/visibility', manage, async (c) => {
    const { visible } = await jsonBody(c, sectionVisibleSchema);
    await cms.setSectionVisible(c.var.ctx, c.req.param('key'), c.req.param('section'), visible);
    return c.json(ok);
  });
  r.post('/pages/:key/sections/:section/move', manage, async (c) => {
    const { direction } = await jsonBody(c, sectionMoveSchema);
    await cms.moveSection(c.var.ctx, c.req.param('key'), c.req.param('section'), direction);
    return c.json(ok);
  });
  r.post('/pages/:key/publish', manage, async (c) => {
    await cms.publishPage(c.var.ctx, c.req.param('key'));
    return c.json(ok);
  });
  r.post('/pages/:key/discard', manage, async (c) => {
    await cms.discardChanges(c.var.ctx, c.req.param('key'));
    return c.json(ok);
  });

  r.get('/portfolio', manage, async (c) => c.json({ data: await cms.listPortfolioAdmin(c.var.ctx) }));
  r.post('/portfolio', manage, async (c) =>
    c.json({ data: await cms.savePortfolio(c.var.ctx, null, await jsonBody(c, portfolioSchema)) }, 201),
  );
  r.get('/portfolio/:id', manage, async (c) =>
    c.json({ data: await cms.getPortfolioAdmin(c.var.ctx, c.req.param('id')) }),
  );
  r.put('/portfolio/:id', manage, async (c) =>
    c.json({ data: await cms.savePortfolio(c.var.ctx, c.req.param('id'), await jsonBody(c, portfolioSchema)) }),
  );
  r.post('/portfolio/:id/status', manage, async (c) => {
    const { status } = await jsonBody(c, statusSchema);
    await cms.setPortfolioStatus(c.var.ctx, c.req.param('id'), status);
    return c.json(ok);
  });
  r.delete('/portfolio/:id', manage, async (c) => {
    await cms.deletePortfolio(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });

  r.get('/products', manage, async (c) => c.json({ data: await cms.listProductsAdmin(c.var.ctx) }));
  r.post('/products', manage, async (c) =>
    c.json({ data: await cms.saveProduct(c.var.ctx, null, await jsonBody(c, productSchema)) }, 201),
  );
  r.put('/products/:id', manage, async (c) =>
    c.json({ data: await cms.saveProduct(c.var.ctx, c.req.param('id'), await jsonBody(c, productSchema)) }),
  );

  r.get('/announcements', manage, async (c) => c.json({ data: await cms.listAnnouncementsAdmin(c.var.ctx) }));
  r.post('/announcements', manage, async (c) =>
    c.json({ data: await cms.saveAnnouncement(c.var.ctx, null, await jsonBody(c, announcementSchema)) }, 201),
  );
  r.put('/announcements/:id', manage, async (c) =>
    c.json({ data: await cms.saveAnnouncement(c.var.ctx, c.req.param('id'), await jsonBody(c, announcementSchema)) }),
  );
  r.delete('/announcements/:id', manage, async (c) => {
    await cms.deleteAnnouncement(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });

  r.get('/media', async (c) => c.json({ data: await cms.listMedia(c.var.ctx, c.req.query('q')) }));
  r.post('/media', requirePermission('media.manage'), async (c) => {
    if (Number(c.req.header('content-length') ?? '0') > 6 * 1024 * 1024)
      throw validationError({ file: ['Images must be 5 MB or smaller.'] });
    const form = await c.req.formData().catch(() => {
      throw validationError({ file: ['Send the image as multipart/form-data.'] });
    });
    const meta = mediaMetaSchema.safeParse({
      altText: form.get('altText') ?? '',
      caption: form.get('caption') || null,
      folder: form.get('folder') || null,
    });
    if (!meta.success) throw validationError({ altText: [meta.error.issues[0]?.message ?? 'Check the fields.'] });
    const file = form.get('file');
    if (!(file instanceof File)) throw validationError({ file: ['Choose an image.'] });
    const res = await cms.uploadMedia(
      c.var.ctx,
      { bytes: new Uint8Array(await file.arrayBuffer()), filename: file.name },
      meta.data,
    );
    return c.json({ data: res }, 201);
  });
  r.put('/media/:id', requirePermission('media.manage'), async (c) => {
    await cms.updateMedia(c.var.ctx, c.req.param('id'), await jsonBody(c, mediaMetaSchema));
    return c.json(ok);
  });
  r.delete('/media/:id', requirePermission('media.manage'), async (c) => {
    await cms.deleteMedia(c.var.ctx, c.req.param('id'));
    return c.json(ok);
  });
  return r;
}
