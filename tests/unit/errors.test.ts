import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AppError,
  conflict,
  rateLimited,
  toErrorResponse,
  validationError,
  zodIssuesToFields,
} from '../../src/server/lib/errors';

describe('toErrorResponse', () => {
  it.each([
    ['VALIDATION_FAILED', 422],
    ['UNAUTHENTICATED', 401],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['CONFLICT', 409],
    ['RATE_LIMITED', 429],
    ['PROVIDER_ERROR', 502],
    ['INTERNAL', 500],
  ] as const)('maps %s to HTTP %i', (code, status) => {
    const res = toErrorResponse(new AppError(code), 'req_1');
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(res.body.requestId).toBe('req_1');
  });

  it('hides the message of unknown errors', () => {
    const res = toErrorResponse(new Error('SQLITE_CONSTRAINT: UNIQUE failed: users.email secret=abc'), 'req_2');
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Something went wrong on our side.');
    expect(JSON.stringify(res.body)).not.toContain('SQLITE');
  });

  it('never exposes internal detail', () => {
    const res = toErrorResponse(conflict('Invoice already issued.', 'UPDATE invoices WHERE id=inv_1 changed 0'), 'r');
    expect(JSON.stringify(res.body)).not.toContain('UPDATE');
    expect(res.body.error.message).toBe('Invoice already issued.');
  });

  it('includes field errors and Retry-After', () => {
    expect(toErrorResponse(validationError({ email: ['Required'] }), 'r').body.error.fields).toEqual({
      email: ['Required'],
    });
    expect(toErrorResponse(rateLimited(30.2), 'r').headers['Retry-After']).toBe('31');
  });

  it('converts zod issues to a fields map', () => {
    const r = z.object({ email: z.email(), items: z.array(z.object({ qty: z.number().positive() })) }).safeParse({
      email: 'x',
      items: [{ qty: -1 }],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(zodIssuesToFields(r.error.issues)).sort()).toEqual(['email', 'items.0.qty']);
  });
});
