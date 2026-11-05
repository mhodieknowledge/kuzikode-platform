import type { APIRoute } from 'astro';
import { listPosts, renderRss } from '../../server/modules/cms';

export const GET: APIRoute = async ({ locals }) => {
  const { ctx } = locals;
  return new Response(renderRss(ctx, await listPosts(ctx)), {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
};
