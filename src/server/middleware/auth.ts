import type { MiddlewareHandler } from 'hono';
import type { Audience } from '../../shared/schemas/auth';
import type { Permission } from '../../shared/permissions';
import { AppError, forbidden, unauthenticated } from '../lib/errors';
import { originAllowed, resolveSession, verifyCsrf } from '../modules/auth/service';
import type { ApiEnv } from './request-context';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Resolves the audience's session cookie into ctx.auth / ctx.actor. Does not require a session. */
export const withAuth =
  (audience: Audience): MiddlewareHandler<ApiEnv> =>
  async (c, next) => {
    const ctx = c.var.ctx;
    const auth = await resolveSession(ctx, c.req.header('cookie') ?? null, audience);
    if (auth) {
      ctx.auth = auth;
      ctx.actor = { type: audience === 'admin' ? 'staff' : 'client', userId: auth.user.id };
      ctx.logger = ctx.logger.child({ userId: auth.user.id });
    }
    await next();
  };

export interface RequireAuthOptions {
  /** Let users who must change their password reach this route (password change, logout, me). */
  allowPasswordChange?: boolean;
  /** Let users who still need to verify or enrol 2FA reach this route (2FA endpoints, logout, me). */
  allowMfaPending?: boolean;
}

/** 401 without a valid session for the audience. Users flagged must_change_password only reach allowed routes. */
export const requireAuth =
  (audience: Audience, opts: RequireAuthOptions = {}): MiddlewareHandler<ApiEnv> =>
  async (c, next) => {
    const auth = c.var.ctx.auth;
    if (!auth || auth.session.audience !== audience) throw unauthenticated();
    if (auth.user.mustChangePassword && !opts.allowPasswordChange) {
      throw new AppError('FORBIDDEN', 'Change your password to continue.', {
        detail: 'must_change_password',
        reason: 'password_change_required',
      });
    }
    if (!opts.allowMfaPending) {
      if (auth.mfa.enabled && !auth.session.mfaVerified) {
        throw new AppError('FORBIDDEN', 'Enter your two-factor code to continue.', { reason: 'mfa_required' });
      }
      if (auth.mfa.required && !auth.mfa.enabled) {
        throw new AppError('FORBIDDEN', 'Set up two-factor authentication to continue.', {
          reason: 'mfa_enrolment_required',
        });
      }
    }
    await next();
  };

/**
 * docs/07 §3: state-changing requests need a same-origin Origin/Referer; when a session cookie is in play they
 * also need X-CSRF-Token = HMAC(session.csrf_secret, session.id).
 */
export const csrfProtect = (): MiddlewareHandler<ApiEnv> => async (c, next) => {
  if (MUTATING.has(c.req.method)) {
    const ctx = c.var.ctx;
    if (!originAllowed(ctx, c.req.raw.headers)) throw forbidden('This request was blocked.', 'origin mismatch');
    if (ctx.auth && !(await verifyCsrf(ctx.auth, c.req.header('x-csrf-token')))) {
      throw forbidden('Your session token is missing or out of date. Refresh the page and try again.', 'csrf');
    }
  }
  await next();
};

/** Coarse permission gate for admin routes (services still check ownership/state). */
export const requirePermission =
  (...permissions: Permission[]): MiddlewareHandler<ApiEnv> =>
  async (c, next) => {
    const auth = c.var.ctx.auth;
    if (!auth) throw unauthenticated();
    if (!permissions.every((p) => auth.permissions.has(p)))
      throw forbidden(undefined, `missing ${permissions.join(',')}`);
    await next();
  };
