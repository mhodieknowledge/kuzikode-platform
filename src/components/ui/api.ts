/** Browser API client for islands: JSON in/out, CSRF header from <meta name="csrf-token">, typed errors. */

export interface ApiErrorBody {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
    this.name = 'ApiError';
  }
  get fields(): Record<string, string[]> {
    return this.body.fields ?? {};
  }
}

function csrf(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || undefined;
}

export async function apiFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; idempotencyKey?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
  if (init.body !== undefined && !(init.body instanceof FormData)) headers['content-type'] = 'application/json';
  const token = csrf();
  if (token && method !== 'GET') headers['x-csrf-token'] = token;
  if (init.idempotencyKey) headers['idempotency-key'] = init.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      ...(init.signal ? { signal: init.signal } : {}),
      ...(init.body === undefined
        ? {}
        : { body: init.body instanceof FormData ? init.body : JSON.stringify(init.body) }),
    });
  } catch {
    throw new ApiError(0, {
      code: 'NETWORK',
      message: 'You appear to be offline. Check your connection and try again.',
    });
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const err = (json as { error?: ApiErrorBody } | null)?.error ?? {
      code: 'INTERNAL',
      message: 'Something went wrong on our side.',
    };
    throw new ApiError(res.status, err);
  }
  return json as T;
}

/** A fresh idempotency key per user action (double clicks reuse the same key). */
export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}
