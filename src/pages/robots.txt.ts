import type { APIRoute } from 'astro';
import { renderRobots } from '../server/modules/cms';

export const GET: APIRoute = ({ locals }) =>
  new Response(renderRobots(locals.ctx), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
