import type { MiddlewareHandler } from 'hono';
import { createContext, newRequestId, type RequestContext } from '../context';

export type ApiEnv = { Bindings: Env; Variables: { ctx: RequestContext; requestId: string } };

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Assigns a request ID (honours a well-formed incoming X-Request-Id) and builds the RequestContext. */
export const requestContext = (): MiddlewareHandler<ApiEnv> => async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : newRequestId();
  c.set('requestId', requestId);
  let waitUntil: ((p: Promise<unknown>) => void) | undefined;
  try {
    const ec = c.executionCtx;
    waitUntil = (p) => ec.waitUntil(p);
  } catch {
    waitUntil = undefined;
  }
  c.set(
    'ctx',
    createContext({
      env: c.env,
      request: c.req.raw,
      requestId,
      route: c.req.path,
      ...(waitUntil ? { waitUntil } : {}),
    }),
  );
  c.header('X-Request-Id', requestId);
  await next();
};
