import type { Context, MiddlewareHandler } from 'hono';
import type { z } from 'zod';
import { validationError, zodIssuesToFields } from '../lib/errors';
import type { ApiEnv } from './request-context';

const MAX_JSON_BYTES = 256 * 1024;

/** Parses + validates the JSON body with a Zod schema. Errors become VALIDATION_FAILED with a fields map. */
export async function jsonBody<S extends z.ZodType>(c: Context<ApiEnv>, schema: S): Promise<z.infer<S>> {
  const len = Number(c.req.header('content-length') ?? '0');
  if (len > MAX_JSON_BYTES) throw validationError({ _: ['Request is too large.'] });
  let raw: unknown;
  try {
    const text = await c.req.text();
    if (text.length > MAX_JSON_BYTES) throw new Error('too large');
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw validationError({ _: ['Request body must be valid JSON.'] });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw validationError(zodIssuesToFields(parsed.error.issues));
  return parsed.data;
}

export function query<S extends z.ZodType>(c: Context<ApiEnv>, schema: S): z.infer<S> {
  const parsed = schema.safeParse(c.req.query());
  if (!parsed.success) throw validationError(zodIssuesToFields(parsed.error.issues));
  return parsed.data;
}

export type Validated = MiddlewareHandler<ApiEnv>;
