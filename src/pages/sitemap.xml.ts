import type { APIRoute } from 'astro';
import { renderSitemap, sitemapEntries } from '../server/modules/cms';

export const GET: APIRoute = async ({ locals }) =>
  new Response(renderSitemap(locals.ctx, await sitemapEntries(locals.ctx)), {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=3600' },
  });
