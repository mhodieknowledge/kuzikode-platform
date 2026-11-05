import type { AppConfig } from './config';
import { getConfig } from './config';
import { createLogger, type Logger } from './lib/logger';
import { newId } from './lib/ids';
import type { ActorType } from './lib/audit';
import type { AuthState } from './modules/auth/service';

export interface Actor {
  type: ActorType;
  userId: string | null;
}

/** Request-scoped context passed as the first argument to every service function. */
export interface RequestContext {
  env: Env;
  config: AppConfig;
  db: D1Database;
  requestId: string;
  ip: string;
  userAgent: string;
  /** Injectable clock: services never call `new Date()` directly. */
  now(): Date;
  logger: Logger;
  waitUntil(promise: Promise<unknown>): void;
  /** Who is acting. Set by the auth middleware; 'public' for anonymous requests, 'system' for cron/queue. */
  actor: Actor;
  /** Resolved session (admin or portal), or null. Set by the auth middleware. */
  auth: AuthState | null;
}

export interface ContextInit {
  env: Env;
  request?: Request;
  requestId?: string;
  waitUntil?: (p: Promise<unknown>) => void;
  now?: () => Date;
  route?: string;
  actor?: Actor;
}

export function newRequestId(): string {
  return newId('req');
}

export function clientIp(request?: Request): string {
  return request?.headers.get('cf-connecting-ip') ?? request?.headers.get('x-real-ip') ?? '0.0.0.0';
}

export function createContext(init: ContextInit): RequestContext {
  const config = getConfig(init.env);
  const requestId = init.requestId ?? newRequestId();
  const logger = createLogger(
    { requestId, ...(init.route ? { route: init.route } : {}) },
    undefined,
    config.appEnv === 'development' ? 'debug' : 'info',
  );
  const waitUntil =
    init.waitUntil ??
    ((p: Promise<unknown>) => {
      p.catch((err: unknown) => logger.error('background task failed', { err }));
    });
  return {
    env: init.env,
    config,
    db: init.env.DB,
    requestId,
    ip: clientIp(init.request),
    userAgent: (init.request?.headers.get('user-agent') ?? '').slice(0, 300),
    now: init.now ?? (() => new Date()),
    logger,
    waitUntil,
    actor: init.actor ?? { type: 'public', userId: null },
    auth: null,
  };
}
