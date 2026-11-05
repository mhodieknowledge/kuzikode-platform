import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateBackupCodes,
  hotp,
  otpauthUri,
  totp,
  verifyTotp,
} from '../../src/server/lib/totp';

// RFC 6238 Appendix B (SHA-1 seed "12345678901234567890"), truncated to 6 digits.
const SEED = base32Encode(new TextEncoder().encode('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('time %i → %s', async (t, code) => {
    expect(await totp(SEED, t * 1000)).toBe(code);
  });

  it('matches RFC 4226 HOTP vectors', async () => {
    const key = new TextEncoder().encode('12345678901234567890') as Uint8Array<ArrayBuffer>;
    expect(await hotp(key, 0)).toBe('755224');
    expect(await hotp(key, 9)).toBe('520489');
  });

  it('accepts ±1 step and rejects replays', async () => {
    const t = 1_700_000_000_000;
    const prev = await totp(SEED, t - 30_000);
    const step = await verifyTotp(SEED, prev, t, null);
    expect(step).toBe(Math.floor(t / 30_000) - 1);
    expect(await verifyTotp(SEED, prev, t, step)).toBeNull();
    expect(await verifyTotp(SEED, await totp(SEED, t - 90_000), t, null)).toBeNull();
    expect(await verifyTotp(SEED, 'abcdef', t, null)).toBeNull();
  });

  it('round-trips base32 and builds an otpauth URI', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 255]);
    expect([...base32Decode(base32Encode(bytes))]).toEqual([...bytes]);
    expect(otpauthUri('ABC', 'a@example.com')).toBe(
      'otpauth://totp/Kuzikode%3Aa%40example.com?secret=ABC&issuer=Kuzikode&algorithm=SHA1&digits=6&period=30',
    );
  });

  it('generates 10 distinct backup codes', () => {
    const codes = generateBackupCodes();
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
  });
});
