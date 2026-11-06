import { describe, expect, it } from 'vitest';
import { createLogger, maskEmail, maskPhone, redact, REDACTED } from '../../src/server/lib/logger';

describe('redact', () => {
  it('replaces sensitive keys at any depth', () => {
    const out = redact({
      password: 'hunter2hunter2',
      user: { passwordHash: 'pbkdf2$...', name: 'Ann' },
      headers: { Authorization: 'Bearer x', cookie: 'a=b' },
      paynow: { integrationKey: 'k', hash: 'ABC', token: '{1111}' },
      list: [{ apiKey: 'zz', ok: 1 }],
    }) as Record<string, any>;
    expect(out.password).toBe(REDACTED);
    expect(out.user.passwordHash).toBe(REDACTED);
    expect(out.user.name).toBe('Ann');
    expect(out.headers.Authorization).toBe(REDACTED);
    expect(out.headers.cookie).toBe(REDACTED);
    expect(out.paynow).toEqual({ integrationKey: REDACTED, hash: REDACTED, token: REDACTED });
    expect(out.list[0]).toEqual({ apiKey: REDACTED, ok: 1 });
  });

  it('masks emails and phone numbers inside strings', () => {
    expect(maskEmail('contact jane.doe@example.com now')).toBe('contact j***@example.com now');
    expect(maskPhone('call 0771111111')).toBe('call ***111');
    expect(maskPhone('+263 77 123 4567')).toBe('***567');
    expect(redact('pay from 0773333333 by a@b.co')).toBe('pay from ***333 by a***@b.co');
  });

  it('keeps ISO dates readable', () => {
    expect(redact({ consentDate: '2026-10-01', at: '2026-10-01T09:00:00Z' })).toEqual({
      consentDate: '2026-10-01',
      at: '2026-10-01T09:00:00Z',
    });
  });

  it('keeps short numbers like amounts', () => {
    expect(maskPhone('amount 75000')).toBe('amount 75000');
  });
});

describe('createLogger', () => {
  it('writes one redacted JSON line per call with base fields', () => {
    const lines: string[] = [];
    const log = createLogger({ requestId: 'req_x' }, (_l, line) => lines.push(line));
    log.child({ route: '/api/x' }).warn('login failed', { email: 'owner@example.com', password: 'p' });
    const entry = JSON.parse(lines[0]!);
    expect(entry).toMatchObject({ level: 'warn', msg: 'login failed', requestId: 'req_x', route: '/api/x' });
    expect(entry.email).toBe('o***@example.com');
    expect(entry.password).toBe(REDACTED);
  });

  it('respects the minimum level', () => {
    const lines: string[] = [];
    createLogger({}, (_l, line) => lines.push(line), 'info').debug('hidden');
    expect(lines).toHaveLength(0);
  });
});
