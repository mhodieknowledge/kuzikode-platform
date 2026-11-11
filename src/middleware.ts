import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { createContext } from './server/context';
import { isPrivatePath, openerPolicyFor, PRIVATE_HEADERS, securityHeaders } from './server/lib/security-headers';
import { resolveSession } from './server/modules/auth/service';

/** Builds the request context for pages and applies security / cache headers to every page response. */
export const onRequest = defineMiddleware(async (context, next) => {
  const cf = context.locals.cfContext;
  const ctx = createContext({
    env,
    request: context.request,
    route: context.url.pathname,
    ...(cf ? { waitUntil: (p: Promise<unknown>) => cf.waitUntil(p) } : {}),
  });
  context.locals.ctx = ctx;
  // CMS draft preview: only for signed-in staff who may edit the website (docs/08: drafts never leak publicly).
  if (context.url.searchParams.get('preview') === '1' && !isPrivatePath(context.url.pathname)) {
    const auth = await resolveSession(ctx, context.request.headers.get('cookie'), 'admin').catch(() => null);
    const careersPage = context.url.pathname.startsWith('/careers/');
    if (
      auth &&
      auth.user.userType === 'staff' &&
      (auth.permissions.has('cms.manage') || (careersPage && auth.permissions.has('careers.view')))
    )
      ctx.preview = true;
  }
  const res = await next();
  if (ctx.preview) {
    res.headers.set('Cache-Control', 'private, no-store');
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  const headers: Record<string, string> = {
    ...securityHeaders(ctx.config.appEnv, { openerPolicy: openerPolicyFor(context.url.pathname) }),
    'X-Request-Id': ctx.requestId,
  };
  if (isPrivatePath(context.url.pathname)) Object.assign(headers, PRIVATE_HEADERS);
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
});
