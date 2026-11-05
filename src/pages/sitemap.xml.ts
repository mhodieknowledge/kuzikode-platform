import type { APIRoute } from 'astro';
import { renderSitemap, sitemapEntries } from '../server/modules/cms';
import { listOpenPostings } from '../server/modules/careers';

export const GET: APIRoute = async ({ locals }) => {
  const { ctx } = locals;
  const [entries, careers] = await Promise.all([sitemapEntries(ctx), listOpenPostings(ctx)]);
  const all = [
    ...entries,
    { path: '/careers' },
    ...careers.all.map((p) => ({ path: `/careers/${p.slug}`, lastmod: p.updatedAt })),
  ];
  return new Response(renderSitemap(ctx, all), {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=3600' },
  });
};
