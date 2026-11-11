import type { RequestContext } from '../context';
import { Batch } from '../db/client';
import { auditStmt } from './audit';
import { decryptWithRotation, encryptString } from './crypto';

/** Decrypts data encrypted with DATA_ENCRYPTION_KEY, or with DATA_ENCRYPTION_KEY_PREVIOUS during a key rotation. */
export async function openData(ctx: RequestContext, payload: string, purpose: string): Promise<string> {
  const { plaintext } = await decryptWithRotation(
    { current: ctx.config.dataEncryptionKey, previous: ctx.config.dataEncryptionKeyPrevious },
    payload,
    purpose,
  );
  return plaintext;
}

/** Encrypted columns. Fixed list: table and column names are never taken from input. */
export const ENCRYPTED_COLUMNS = {
  totp: { table: 'user_mfa', id: 'user_id', column: 'totp_secret_enc', purpose: 'totp-secret' },
  cardTokens: { table: 'saved_payment_methods', id: 'id', column: 'token_enc', purpose: 'saved_card_token' },
} as const;

export type EncryptedColumn = keyof typeof ENCRYPTED_COLUMNS;

/**
 * Key rotation step (nightly while DATA_ENCRYPTION_KEY_PREVIOUS is set): re-encrypts values still under the previous key
 * with the current one. A value is only replaced if it hasn't changed meanwhile. Returns how many were moved, and how many
 * could be read with neither key (left untouched and counted, never logged).
 */
export async function reencryptColumn(
  ctx: RequestContext,
  which: EncryptedColumn,
  pageSize = 200,
): Promise<{ reencrypted: number; unreadable: number }> {
  if (!ctx.config.dataEncryptionKeyPrevious) return { reencrypted: 0, unreadable: 0 };
  const c = ENCRYPTED_COLUMNS[which];
  const keys = { current: ctx.config.dataEncryptionKey, previous: ctx.config.dataEncryptionKeyPrevious };
  const batch = new Batch(ctx.db);
  let reencrypted = 0;
  let unreadable = 0;
  // Keyset pagination over every row, `pageSize` at a time.
  let after = '';
  for (;;) {
    const { results } = await ctx.db
      .prepare(
        `SELECT ${c.id} AS id, ${c.column} AS value FROM ${c.table}
         WHERE ${c.column} IS NOT NULL AND ${c.id} > ? ORDER BY ${c.id} LIMIT ?`,
      )
      .bind(after, pageSize)
      .all<{ id: string; value: string }>();
    for (const row of results) {
      let res: { plaintext: string; rotated: boolean };
      try {
        res = await decryptWithRotation(keys, row.value, c.purpose);
      } catch {
        unreadable++;
        continue;
      }
      if (!res.rotated) continue;
      const next = await encryptString(ctx.config.dataEncryptionKey, res.plaintext, c.purpose);
      batch.sql(`UPDATE ${c.table} SET ${c.column} = ? WHERE ${c.id} = ? AND ${c.column} = ?`, next, row.id, row.value);
      reencrypted++;
    }
    if (results.length < pageSize) break;
    after = results[results.length - 1]!.id;
  }
  if (reencrypted > 0) {
    batch.add(
      auditStmt(ctx, {
        action: 'security.data_reencrypted',
        entityType: c.table,
        after: { count: reencrypted, unreadable },
        actorType: 'system',
        actorUserId: null,
      }),
    );
    await batch.run();
  }
  if (unreadable > 0) ctx.logger.warn('encrypted values readable with neither key', { table: c.table, unreadable });
  return { reencrypted, unreadable };
}
