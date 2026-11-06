import { Hono } from 'hono';
import {
  faqSchema,
  industrySchema,
  newsletterFilterSchema,
  postCategorySchema,
  postSchema,
  technologySchema,
  testimonialSchema,
} from '../../../shared/schemas/content-admin';
import { csrfProtect, requireAuth, requirePermission, withAuth } from '../../middleware/auth';
import type { ApiEnv } from '../../middleware/request-context';
import { jsonBody } from '../../middleware/validate';
import * as content from './content-admin';

const ok = { data: { ok: true } };

/** `/api/v1/admin/content` (P4.22). */
export function contentAdminRoutes() {
  const r = new Hono<ApiEnv>();
  r.use('*', withAuth('admin'), requireAuth('admin'), csrfProtect());
  const manage = requirePermission('content.manage');
  const id = (c: { req: { param: (k: string) => string } }) => c.req.param('id');

  r.get('/posts', manage, async (c) => c.json({ data: await content.listPostsAdmin(c.var.ctx) }));
  r.post('/posts', manage, async (c) =>
    c.json({ data: await content.savePost(c.var.ctx, null, await jsonBody(c, postSchema)) }, 201),
  );
  r.get('/posts/:id', manage, async (c) => c.json({ data: await content.getPostAdmin(c.var.ctx, id(c)) }));
  r.put('/posts/:id', manage, async (c) =>
    c.json({ data: await content.savePost(c.var.ctx, id(c), await jsonBody(c, postSchema)) }),
  );
  r.delete('/posts/:id', manage, async (c) => (await content.deletePost(c.var.ctx, id(c)), c.json(ok)));

  r.get('/post-categories', manage, async (c) => c.json({ data: await content.listPostCategoriesAdmin(c.var.ctx) }));
  r.post('/post-categories', manage, async (c) =>
    c.json({ data: await content.savePostCategory(c.var.ctx, null, await jsonBody(c, postCategorySchema)) }, 201),
  );
  r.put('/post-categories/:id', manage, async (c) =>
    c.json({ data: await content.savePostCategory(c.var.ctx, id(c), await jsonBody(c, postCategorySchema)) }),
  );
  r.delete(
    '/post-categories/:id',
    manage,
    async (c) => (await content.deletePostCategory(c.var.ctx, id(c)), c.json(ok)),
  );

  r.get('/industries', manage, async (c) => c.json({ data: await content.listIndustriesAdmin(c.var.ctx) }));
  r.post('/industries', manage, async (c) =>
    c.json({ data: await content.saveIndustry(c.var.ctx, null, await jsonBody(c, industrySchema)) }, 201),
  );
  r.get('/industries/:id', manage, async (c) => c.json({ data: await content.getIndustryAdmin(c.var.ctx, id(c)) }));
  r.put('/industries/:id', manage, async (c) =>
    c.json({ data: await content.saveIndustry(c.var.ctx, id(c), await jsonBody(c, industrySchema)) }),
  );
  r.delete('/industries/:id', manage, async (c) => (await content.deleteIndustry(c.var.ctx, id(c)), c.json(ok)));

  r.get('/faqs', manage, async (c) => c.json({ data: await content.listFaqsAdmin(c.var.ctx) }));
  r.post('/faqs', manage, async (c) =>
    c.json({ data: await content.saveFaq(c.var.ctx, null, await jsonBody(c, faqSchema)) }, 201),
  );
  r.put('/faqs/:id', manage, async (c) =>
    c.json({ data: await content.saveFaq(c.var.ctx, id(c), await jsonBody(c, faqSchema)) }),
  );
  r.delete('/faqs/:id', manage, async (c) => (await content.deleteFaq(c.var.ctx, id(c)), c.json(ok)));

  r.get('/testimonials', manage, async (c) => c.json({ data: await content.listTestimonialsAdmin(c.var.ctx) }));
  r.post('/testimonials', manage, async (c) =>
    c.json({ data: await content.saveTestimonial(c.var.ctx, null, await jsonBody(c, testimonialSchema)) }, 201),
  );
  r.put('/testimonials/:id', manage, async (c) =>
    c.json({ data: await content.saveTestimonial(c.var.ctx, id(c), await jsonBody(c, testimonialSchema)) }),
  );
  r.delete('/testimonials/:id', manage, async (c) => (await content.deleteTestimonial(c.var.ctx, id(c)), c.json(ok)));

  r.get('/technologies', manage, async (c) => c.json({ data: await content.listTechnologiesAdmin(c.var.ctx) }));
  r.post('/technologies', manage, async (c) =>
    c.json({ data: await content.saveTechnology(c.var.ctx, null, await jsonBody(c, technologySchema)) }, 201),
  );
  r.put('/technologies/:id', manage, async (c) =>
    c.json({ data: await content.saveTechnology(c.var.ctx, id(c), await jsonBody(c, technologySchema)) }),
  );
  r.delete('/technologies/:id', manage, async (c) => (await content.deleteTechnology(c.var.ctx, id(c)), c.json(ok)));

  const filter = (c: { req: { query: (k: string) => string | undefined } }) =>
    newsletterFilterSchema.parse({ status: c.req.query('status'), q: c.req.query('q'), page: c.req.query('page') });
  r.get('/newsletter', requirePermission('newsletter.view'), async (c) =>
    c.json({ data: await content.listSubscribers(c.var.ctx, filter(c)) }),
  );
  r.get('/newsletter/export.csv', requirePermission('newsletter.export'), async (c) => {
    const { status, q } = filter(c);
    const csv = await content.exportSubscribersCsv(c.var.ctx, { status, q });
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="newsletter-subscribers-${c.var.ctx.now().toISOString().slice(0, 10)}.csv"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  });
  return r;
}
