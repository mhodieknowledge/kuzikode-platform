import { exports } from 'cloudflare:workers';

export const ORIGIN = 'http://localhost:8787';

export interface ApiOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
  csrf?: string;
  origin?: string | null;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  headers: Headers;
  setCookie: string | null;
}

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...opts.headers };
  if (opts.origin !== null) headers['origin'] = opts.origin ?? ORIGIN;
  if (opts.cookie) headers['cookie'] = opts.cookie;
  if (opts.csrf) headers['x-csrf-token'] = opts.csrf;
  const res = await exports.default.fetch(`${ORIGIN}${path}`, {
    method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body, headers: res.headers, setCookie: res.headers.get('set-cookie') };
}

/** `name=value` part of a Set-Cookie header. */
export const cookiePair = (setCookie: string | null) => (setCookie ?? '').split(';')[0] ?? '';

export interface Session {
  cookie: string;
  csrf: string;
}

export async function login(audience: 'admin' | 'portal', email: string, password: string): Promise<Session> {
  const res = await api(`/api/v1/auth/${audience}/login`, { body: { email, password } });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = cookiePair(res.setCookie);
  const me = await api(`/api/v1/auth/${audience}/me`, { cookie });
  return { cookie, csrf: me.body.data.csrfToken };
}
