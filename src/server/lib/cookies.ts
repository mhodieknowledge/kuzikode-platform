export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    if (!name || name in out) continue;
    try {
      out[name] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[name] = part.slice(i + 1).trim();
    }
  }
  return out;
}

export interface CookieOptions {
  maxAgeSeconds?: number;
  secure: boolean;
  httpOnly?: boolean;
  sameSite?: 'Lax' | 'Strict';
}

export function serializeCookie(name: string, value: string, opts: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', `SameSite=${opts.sameSite ?? 'Lax'}`];
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.maxAgeSeconds !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAgeSeconds))}`);
  return parts.join('; ');
}

export function clearCookie(name: string, secure: boolean): string {
  return serializeCookie(name, '', { secure, maxAgeSeconds: 0 });
}
