import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { createContext } from './server/context';
import { isPrivatePath, PRIVATE_HEADERS, securityHeaders } from './server/lib/security-headers';

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
  const res = await next();
  const headers: Record<string, string> = { ...securityHeaders(ctx.config.appEnv), 'X-Request-Id': ctx.requestId };
  if (isPrivatePath(context.url.pathname)) Object.assign(headers, PRIVATE_HEADERS);
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
});
