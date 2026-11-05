import { describe, expect, it } from 'vitest';
import { idTimestamp, newId, randomToken } from '../../src/server/lib/ids';

describe('ids', () => {
  it('creates prefixed, 26-char sortable ids', () => {
    const id = newId('inv', 1_700_000_000_000);
    expect(id).toMatch(/^inv_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(idTimestamp(id)).toBe(1_700_000_000_000);
    expect(newId('inv', 1) < newId('inv', 2)).toBe(true);
  });

  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newId('cli')));
    expect(ids.size).toBe(2000);
  });

  it('makes 43-char url-safe tokens from 32 bytes', () => {
    const t = randomToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
