/**
 * Guard for Astro admin pages (P4.1). Resolves the admin session from the cookie and decides where the visitor must go:
 * no session → login; must change password → /admin/password; 2FA to verify → /admin/mfa; 2FA required but not set
 * up → /admin/mfa/setup. Pages then check permissions themselves (`requirePermissionPage`).
 */
import type { Permission } from '../../shared/permissions';
import type { RequestContext } from '../context';
import { csrfToken, resolveSession, type AuthState } from '../modules/auth/service';
import { adminNavFor } from '../modules/admin/navigation';
import { listNotifications } from '../modules/notifications';

/** 303 with mutable headers (Response.redirect's headers are immutable, and the middleware adds security headers). */
export const seeOther = (location: string | URL) =>
  new Response(null, { status: 303, headers: { location: location.toString() } });

export type AdminStage = 'password' | 'mfa' | 'mfa-setup' | 'ready';

export function adminStage(auth: AuthState): AdminStage {
  if (auth.user.mustChangePassword) return 'password';
  if (auth.mfa.enabled && !auth.session.mfaVerified) return 'mfa';
  if (auth.mfa.required && !auth.mfa.enabled) return 'mfa-setup';
  return 'ready';
}

const STAGE_PATH: Record<Exclude<AdminStage, 'ready'>, string> = {
  password: '/admin/password',
  mfa: '/admin/mfa',
  'mfa-setup': '/admin/mfa/setup',
};

/** Only same-site admin paths are allowed as a post-login destination. */
export function safeNext(next: string | null | undefined): string {
  return next && /^\/admin(\/[A-Za-z0-9/_\-.?=&%]*)?$/.test(next) && !next.startsWith('//') ? next : '/admin';
}

export interface AdminPage {
  auth: AuthState;
  csrfToken: string;
  nav: ReturnType<typeof adminNavFor>;
  unread: number;
}

/**
 * For pages inside the shell. Returns a redirect Response when the visitor may not see the page yet.
 * `stage` lets the password/MFA pages themselves load with a pending session.
 */
export async function loadAdminPage(
  ctx: RequestContext,
  request: Request,
  opts: { allowStage?: Exclude<AdminStage, 'ready'>; permission?: Permission } = {},
): Promise<AdminPage | Response> {
  const url = new URL(request.url);
  const auth = await resolveSession(ctx, request.headers.get('cookie'), 'admin');
  if (!auth || auth.user.userType !== 'staff') {
    const next = encodeURIComponent(`${url.pathname}${url.search}`);
    return seeOther(`/admin/login?next=${next}`);
  }
  ctx.auth = auth;
  ctx.actor = { type: 'staff', userId: auth.user.id };
  const stage = adminStage(auth);
  if (stage !== 'ready' && stage !== opts.allowStage) return seeOther(STAGE_PATH[stage]);
  if (stage === 'ready' && opts.allowStage && opts.allowStage !== 'mfa-setup') {
    return seeOther('/admin');
  }
  if (opts.permission && !auth.permissions.has(opts.permission)) {
    return new Response(null, { status: 403, statusText: 'Forbidden' });
  }
  const unread = stage === 'ready' ? (await listNotifications(ctx, auth.user.id, { limit: 1 })).unread : 0;
  return {
    auth,
    csrfToken: await csrfToken(auth),
    nav: stage === 'ready' ? adminNavFor(auth.permissions, url.pathname) : [],
    unread,
  };
}

/** For the login page: an already signed-in, fully verified admin goes straight to the destination. */
export async function adminAlreadySignedIn(ctx: RequestContext, request: Request): Promise<boolean> {
  const auth = await resolveSession(ctx, request.headers.get('cookie'), 'admin');
  return !!auth && adminStage(auth) === 'ready';
}
