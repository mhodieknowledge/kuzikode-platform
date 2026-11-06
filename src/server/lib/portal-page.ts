/**
 * Guard for Astro portal pages (P5.1). Resolves the portal session and decides where the visitor must go:
 * no session → /portal/login; must change password → /portal/password; 2FA on but not verified → /portal/mfa.
 * Every portal page is then scoped by `auth.clientIds` on the server (docs/07 §5); an account linked to no client
 * sees only its own profile.
 */
import type { RequestContext } from '../context';
import { csrfToken, resolveSession, type AuthState } from '../modules/auth/service';
import { seeOther } from './admin-page';

export type PortalStage = 'password' | 'mfa' | 'ready';

export function portalStage(auth: AuthState): PortalStage {
  if (auth.user.mustChangePassword) return 'password';
  if (auth.mfa.enabled && !auth.session.mfaVerified) return 'mfa';
  return 'ready';
}

const STAGE_PATH: Record<Exclude<PortalStage, 'ready'>, string> = {
  password: '/portal/password',
  mfa: '/portal/mfa',
};

/** Only same-site portal paths are allowed as a post-login destination. */
export function safePortalNext(next: string | null | undefined): string {
  return next && /^\/portal(\/[A-Za-z0-9/_\-.?=&%]*)?$/.test(next) && !next.startsWith('//') ? next : '/portal';
}

export interface PortalPage {
  auth: AuthState;
  csrfToken: string;
  /** Names of the clients this account can see (empty until staff link the account). */
  clients: { id: string; name: string }[];
}

export async function loadPortalPage(
  ctx: RequestContext,
  request: Request,
  opts: { allowStage?: Exclude<PortalStage, 'ready'> } = {},
): Promise<PortalPage | Response> {
  const url = new URL(request.url);
  const auth = await resolveSession(ctx, request.headers.get('cookie'), 'portal');
  if (!auth || auth.user.userType !== 'client') {
    return seeOther(`/portal/login?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
  }
  ctx.auth = auth;
  ctx.actor = { type: 'client', userId: auth.user.id };
  const stage = portalStage(auth);
  if (stage !== 'ready' && stage !== opts.allowStage) return seeOther(STAGE_PATH[stage]);
  if (stage === 'ready' && opts.allowStage) return seeOther('/portal');
  const clients = auth.clientIds.length
    ? (
        await ctx.db
          .prepare(
            `SELECT id, display_name AS name FROM clients WHERE id IN (${auth.clientIds.map(() => '?').join(', ')}) ORDER BY display_name`,
          )
          .bind(...auth.clientIds)
          .all<{ id: string; name: string }>()
      ).results
    : [];
  return { auth, csrfToken: await csrfToken(auth), clients };
}

/** For the sign-in page: an already signed-in, verified portal user goes straight on. */
export async function portalAlreadySignedIn(ctx: RequestContext, request: Request): Promise<boolean> {
  const auth = await resolveSession(ctx, request.headers.get('cookie'), 'portal');
  return !!auth && portalStage(auth) === 'ready';
}
