export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'INTERNAL';

export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PROVIDER_ERROR: 502,
  INTERNAL: 500,
};

const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Some fields need attention.',
  UNAUTHENTICATED: 'Please sign in to continue.',
  FORBIDDEN: 'You do not have permission to do that.',
  NOT_FOUND: 'Not found.',
  CONFLICT: 'This action conflicts with the current state. Refresh and try again.',
  RATE_LIMITED: 'Too many requests. Please wait and try again.',
  PROVIDER_ERROR: 'An external service did not respond as expected. Please try again.',
  INTERNAL: 'Something went wrong on our side.',
};

export type FieldErrors = Record<string, string[]>;

/** Typed, safe-to-show application error. `message` must never contain SQL, secrets or provider payloads. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields: FieldErrors | undefined;
  readonly retryAfterSeconds: number | undefined;
  /** Internal detail for logs only (never sent to the client). */
  readonly detail: string | undefined;
  /** Safe machine-readable reason the UI can act on (e.g. 'mfa_required'). */
  readonly reason: string | undefined;

  constructor(
    code: ErrorCode,
    message?: string,
    opts: { fields?: FieldErrors; retryAfterSeconds?: number; detail?: string; reason?: string; cause?: unknown } = {},
  ) {
    super(message ?? DEFAULT_MESSAGE[code], opts.cause === undefined ? undefined : { cause: opts.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.fields = opts.fields;
    this.retryAfterSeconds = opts.retryAfterSeconds;
    this.detail = opts.detail;
    this.reason = opts.reason;
  }
}

export const validationError = (fields: FieldErrors, message?: string) =>
  new AppError('VALIDATION_FAILED', message, { fields });
export const unauthenticated = (message?: string) => new AppError('UNAUTHENTICATED', message);
export const forbidden = (message?: string, detail?: string) =>
  new AppError('FORBIDDEN', message, detail === undefined ? {} : { detail });
export const notFound = (message?: string) => new AppError('NOT_FOUND', message);
export const conflict = (message?: string, detail?: string) =>
  new AppError('CONFLICT', message, detail === undefined ? {} : { detail });
export const rateLimited = (retryAfterSeconds: number) =>
  new AppError('RATE_LIMITED', undefined, { retryAfterSeconds });
export const providerError = (detail: string, cause?: unknown) =>
  new AppError('PROVIDER_ERROR', undefined, { detail, cause });

export interface ErrorBody {
  error: { code: ErrorCode; message: string; fields?: FieldErrors; reason?: string };
  requestId: string;
}

/** Maps any thrown value to a safe HTTP status + JSON body. Unknown errors become INTERNAL with a generic message. */
export function toErrorResponse(
  err: unknown,
  requestId: string,
): { status: number; body: ErrorBody; headers: Record<string, string> } {
  const appErr = err instanceof AppError ? err : new AppError('INTERNAL');
  const body: ErrorBody = { error: { code: appErr.code, message: appErr.message }, requestId };
  if (appErr.fields) body.error.fields = appErr.fields;
  if (appErr.reason) body.error.reason = appErr.reason;
  const headers: Record<string, string> = {};
  if (appErr.retryAfterSeconds !== undefined) headers['Retry-After'] = String(Math.ceil(appErr.retryAfterSeconds));
  return { status: appErr.status, body, headers };
}

/** Converts a Zod error's issues into the `fields` map used by forms. */
export function zodIssuesToFields(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.length ? issue.path.map(String).join('.') : '_';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}
