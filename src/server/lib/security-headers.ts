export type AppEnvName = 'development' | 'staging' | 'production';

export interface CspOptions {
  /** Extra origins allowed as form targets (e.g. a routed gateway's card hand-off). */
  formActionOrigins?: string[];
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
    'Cross-Origin-Opener-Policy': 'same-origin',
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
