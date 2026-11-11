import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { CRON_NIGHTLY, SCHEDULE } from '../../src/server/jobs/scheduled';
import { decryptString, encryptString } from '../../src/server/lib/crypto';
import { openData, reencryptColumn } from '../../src/server/lib/data-keys';
import { createStaff } from '../helpers/factories';

const OLD = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));
const NEW = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));

/** A context whose config uses the given keys (the cached config object is copied, not mutated). */
function ctxWith(current: string, previous?: string) {
  const ctx = createContext({ env, actor: { type: 'system', userId: null } });
  return { ...ctx, config: { ...ctx.config, dataEncryptionKey: current, dataEncryptionKeyPrevious: previous } };
}

describe('DATA_ENCRYPTION_KEY rotation', () => {
  it('reads old-key data while the previous key is set, then the nightly job moves it to the new key', async () => {
    const u = await createStaff(['admin']);
    const enc = await encryptString(OLD, 'JBSWY3DPEHPK3PXP', 'totp-secret');
    const now = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO user_mfa (user_id, totp_secret_enc, enabled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(u.id, enc, now, now, now)
      .run();

    // Without the previous key, data under the old key can't be read.
    await expect(openData(ctxWith(NEW), enc, 'totp-secret')).rejects.toThrow();
    // During the rotation it can.
    const rotating = ctxWith(NEW, OLD);
    expect(await openData(rotating, enc, 'totp-secret')).toBe('JBSWY3DPEHPK3PXP');

    // Not rotating: the job does nothing.
    expect(await reencryptColumn(ctxWith(NEW), 'totp')).toEqual({ reencrypted: 0, unreadable: 0 });

    const first = await reencryptColumn(rotating, 'totp');
    expect(first.reencrypted).toBeGreaterThanOrEqual(1);
    const row = await env.DB.prepare('SELECT totp_secret_enc FROM user_mfa WHERE user_id = ?')
      .bind(u.id)
      .first<{ totp_secret_enc: string }>();
    expect(row!.totp_secret_enc).not.toBe(enc);
    expect(await decryptString(NEW, row!.totp_secret_enc, 'totp-secret')).toBe('JBSWY3DPEHPK3PXP');
    // Once moved, the previous key can be removed and the value still opens.
    expect(await openData(ctxWith(NEW), row!.totp_secret_enc, 'totp-secret')).toBe('JBSWY3DPEHPK3PXP');

    // Second run: nothing left under the old key for this user, and the run was audited.
    const again = await reencryptColumn(rotating, 'totp');
    const still = await env.DB.prepare('SELECT totp_secret_enc FROM user_mfa WHERE user_id = ?')
      .bind(u.id)
      .first<{ totp_secret_enc: string }>();
    expect(still!.totp_secret_enc).toBe(row!.totp_secret_enc);
    expect(again.reencrypted).toBe(0);
    const audit = await env.DB.prepare(
      "SELECT count(*) AS n FROM audit_logs WHERE action = 'security.data_reencrypted' AND entity_type = 'user_mfa'",
    ).first<{ n: number }>();
    expect(audit!.n).toBeGreaterThanOrEqual(1);
  });

  it('counts values that neither key opens and leaves them untouched', async () => {
    const u = await createStaff(['admin']);
    const foreign = await encryptString(btoa(String.fromCharCode(...new Uint8Array(32).fill(1))), 'x', 'totp-secret');
    const now = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO user_mfa (user_id, totp_secret_enc, enabled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(u.id, foreign, now, now, now)
      .run();
    const res = await reencryptColumn(ctxWith(NEW, OLD), 'totp');
    expect(res.unreadable).toBeGreaterThanOrEqual(1);
    const row = await env.DB.prepare('SELECT totp_secret_enc FROM user_mfa WHERE user_id = ?')
      .bind(u.id)
      .first<{ totp_secret_enc: string }>();
    expect(row!.totp_secret_enc).toBe(foreign);
  });

  it('pages through every row, not only the first page', async () => {
    const now = new Date().toISOString();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const u = await createStaff(['admin']);
      ids.push(u.id);
      await env.DB.prepare(
        'INSERT INTO user_mfa (user_id, totp_secret_enc, enabled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
        .bind(u.id, await encryptString(OLD, `secret-${i}`, 'totp-secret'), now, now, now)
        .run();
    }
    const res = await reencryptColumn(ctxWith(NEW, OLD), 'totp', 1);
    expect(res.reencrypted).toBeGreaterThanOrEqual(3);
    for (const [i, id] of ids.entries()) {
      const row = await env.DB.prepare('SELECT totp_secret_enc FROM user_mfa WHERE user_id = ?')
        .bind(id)
        .first<{ totp_secret_enc: string }>();
      expect(await decryptString(NEW, row!.totp_secret_enc, 'totp-secret')).toBe(`secret-${i}`);
    }
  });

  it('runs nightly for TOTP secrets and saved-card tokens', () => {
    const names = SCHEDULE[CRON_NIGHTLY]!.map(([n]) => n);
    expect(names).toEqual(expect.arrayContaining(['reencrypt-totp-secrets', 'reencrypt-card-tokens']));
  });
});
