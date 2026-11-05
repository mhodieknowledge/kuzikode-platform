/**
 * Edge cache for public pages (docs/03 §6). The cache key includes content_version, so publishing anything in the
 * CMS makes every old entry unreachable — no purge API needed. It also includes the build ID, so a deploy does the same.
 */
import type { RequestContext } from '../context';
import { contentVersion } from '../modules/cms';
import { sha256Hex } from './crypto';
import { isPrivatePath } from './security-headers';

export const PUBLIC_CACHE_CONTROL = 'public, max-age=0, s-maxage=300';
const CACHEABLE_TYPES = /^(text\/html|application\/xml|text\/plain|application\/rss\+xml)/;
const MAX_QUERY_LENGTH = 200;

export function isCacheableRequest(req: Request): boolean {
  if (req.method !== 'GET') return false;
  const url = new URL(req.url);
  if (isPrivatePath(url.pathname) || url.pathname.startsWith('/media/')) return false;
  if (url.search.length > MAX_QUERY_LENGTH) return false;
  // Requests carrying a session cookie may be personalised later; never serve or store them from the shared cache.
  const cookie = req.headers.get('cookie') ?? '';
  return !/kz_(admin|portal)/.test(cookie);
}

/** Build identifier injected by Vite at build time (absent in unit/integration tests). */
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__.slice(0, 64) : 'dev';

function cacheKey(req: Request, version: number): Request {
  const url = new URL(req.url);
  const build = encodeURIComponent(BUILD_ID);
  return new Request(`${url.origin}/__page-cache/${build}/v${version}${url.pathname}${url.search}`, { method: 'GET' });
}

/** Serves from / stores into the edge cache around `render`. */
export async function withPageCache(
  ctx: RequestContext,
  req: Request,
  render: () => Promise<Response>,
  cache: Cache | undefined = (globalThis as { caches?: { default?: Cache } }).caches?.default,
): Promise<Response> {
  if (!cache || !isCacheableRequest(req)) return render();
  let version: number;
  try {
    version = await contentVersion(ctx);
  } catch {
    return render();
  }
  const key = cacheKey(req, version);
  const hit = await cache.match(key).catch(() => undefined);
  if (hit) return conditional(req, hit, 'HIT');

  const res = await render();
  const type = res.headers.get('content-type') ?? '';
  if (
    res.status !== 200 ||
    res.headers.has('set-cookie') ||
    !CACHEABLE_TYPES.test(type) ||
    /no-store|private/.test(res.headers.get('cache-control') ?? '')
  ) {
    return res;
  }
  const body = await res.arrayBuffer();
  const out = new Response(body, res);
  out.headers.set('Cache-Control', PUBLIC_CACHE_CONTROL);
  out.headers.set('ETag', `"${(await sha256Hex(new Uint8Array(body))).slice(0, 32)}"`);
  out.headers.set('X-Content-Version', String(version));
  ctx.waitUntil(cache.put(key, out.clone()).catch(() => undefined));
  return conditional(req, out, 'MISS');
}

function conditional(req: Request, res: Response, state: 'HIT' | 'MISS'): Response {
  const etag = res.headers.get('etag');
  const out =
    etag && req.headers.get('if-none-match') === etag
      ? new Response(null, { status: 304, headers: res.headers })
      : new Response(res.body, res);
  out.headers.set('X-Cache', state);
  return out;
}
