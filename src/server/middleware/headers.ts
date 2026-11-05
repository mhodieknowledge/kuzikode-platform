import type { MiddlewareHandler } from 'hono';
import { PRIVATE_HEADERS, securityHeaders } from '../lib/security-headers';
import type { ApiEnv } from './request-context';

/** Security headers + `private, no-store` + noindex on every API response. */
export const apiHeaders = (): MiddlewareHandler<ApiEnv> => async (c, next) => {
  await next();
  const appEnv = c.var.ctx?.config.appEnv ?? 'production';
  for (const [k, v] of Object.entries({ ...securityHeaders(appEnv), ...PRIVATE_HEADERS })) c.res.headers.set(k, v);
};
