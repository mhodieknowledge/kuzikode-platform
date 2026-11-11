export type AppEnvName = 'development' | 'staging' | 'production';

export interface CspOptions {
  /** Extra origins allowed as form targets (e.g. a routed gateway's card hand-off). */
  formActionOrigins?: string[];
  /** Cross-Origin-Opener-Policy for this response (default `same-origin`; see `openerPolicyFor`). */
  openerPolicy?: OpenerPolicy;
}

export type OpenerPolicy = 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none';

/**
 * COOP per page (docs/06 §3b card window). Everything is `same-origin`, except: the checkout pages open the gateway's card
 * window as a popup and need to hear back from it (`same-origin-allow-popups`); the page the card window lands on
 * (`/pay/card-return`) and the mock gateway's card page stand in for a third-party page inside that popup
 * (`unsafe-none`), so the popup keeps its link to the checkout and can close itself. Those pages show no private data
 * beyond the attempt status the signed link already opens.
 */
export function openerPolicyFor(pathname: string): OpenerPolicy {
  if (pathname === '/pay/card-return' || pathname.startsWith('/dev/mock-checkout/')) return 'unsafe-none';
  if (/^\/pay\/[A-Za-z0-9_-]{20,100}$/.test(pathname) || /^\/portal\/invoices\/[^/]+\/pay$/.test(pathname))
    return 'same-origin-allow-popups';
  return 'same-origin';
}

/**
 * HTTP-header CSP. Inline scripts are additionally restricted by the per-page hash-based <meta> CSP that
 * Astro's `security.csp` emits; browsers enforce both policies, so the effective script policy is hashes only.
 */
export function contentSecurityPolicy(opts: CspOptions = {}): string {
  const formAction = ["'self'", 'https://www.paynow.co.zw', ...(opts.formActionOrigins ?? [])];
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    'frame-src https://challenges.cloudflare.com',
    `form-action ${formAction.join(' ')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

/** Security headers applied to every response (docs/07 §8). */
export function securityHeaders(appEnv: AppEnvName, opts: CspOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Security-Policy': contentSecurityPolicy(opts),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': opts.openerPolicy ?? 'same-origin',
    'X-Frame-Options': 'DENY',
  };
  if (appEnv === 'production') headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains';
  return headers;
}

const PRIVATE_PREFIXES = ['/admin', '/portal', '/api', '/q/', '/i/', '/pay', '/dev'];

/** Paths that must never be cached or indexed (docs/03 §6). */
export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : `${p}/`) || pathname.startsWith(p + '?'),
  );
}

export const PRIVATE_HEADERS: Record<string, string> = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

/** Returns a copy of the response with the given headers set (responses from fetch/assets can be immutable). */
export function withHeaders(res: Response, headers: Record<string, string>): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  return out;
}
