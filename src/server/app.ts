import { Hono } from 'hono';
import { ConfigError } from './config';
import { AppError, toErrorResponse } from './lib/errors';
import { createLogger } from './lib/logger';
import { PRIVATE_HEADERS, securityHeaders } from './lib/security-headers';
import { apiHeaders } from './middleware/headers';
import { requestContext, type ApiEnv } from './middleware/request-context';

export function createApp() {
  const app = new Hono<ApiEnv>();

  app.use('*', requestContext());
  app.use('*', apiHeaders());

  app.get('/api/health', (c) => c.json({ data: { status: 'ok' } }));

  app.notFound((c) => {
    const requestId = c.var.requestId ?? 'unknown';
    const { status, body } = toErrorResponse(new AppError('NOT_FOUND'), requestId);
    return c.json(body, status as 404);
  });

  app.onError((err, c) => {
    const requestId = c.var.requestId ?? 'unknown';
    const logger = c.var.ctx?.logger ?? createLogger({ requestId });
    if (err instanceof AppError) {
      if (err.status >= 500) logger.error('request failed', { code: err.code, detail: err.detail });
      else logger.info('request rejected', { code: err.code, detail: err.detail });
    } else {
      logger.error('unhandled error', { err: err instanceof ConfigError ? err.message : err });
    }
    const { status, body, headers } = toErrorResponse(err, requestId);
    const res = c.json(body, status as 500);
    const appEnv = c.var.ctx?.config.appEnv ?? 'production';
    for (const [k, v] of Object.entries({ ...securityHeaders(appEnv), ...PRIVATE_HEADERS, ...headers }))
      res.headers.set(k, v);
    res.headers.set('X-Request-Id', requestId);
    return res;
  });

  return app;
}
