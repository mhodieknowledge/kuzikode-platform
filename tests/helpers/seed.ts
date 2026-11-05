import { env } from 'cloudflare:workers';
import baseSql from '../../seeds/base.sql?raw';
import nonprodSql from '../../seeds/nonprod.sql?raw';

/** Splits a seed file into statements. Seed files keep one statement per line (or per `;`-terminated block). */
export function statements(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  for (const line of sql.split('\n')) {
    if (!buf && (line.startsWith('--') || line.trim() === '')) continue;
    buf += (buf ? '\n' : '') + line;
    if (/;\s*$/.test(line)) {
      out.push(buf);
      buf = '';
    }
  }
  return out;
}

export async function applySeed(sql: string, db: D1Database = env.DB): Promise<void> {
  const stmts = statements(sql).map((s) => db.prepare(s));
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
}

/** Applies the production-safe base seed plus the non-production extras (mock gateway). Idempotent. */
export async function seedBase(db: D1Database = env.DB): Promise<void> {
  await applySeed(baseSql, db);
  await applySeed(nonprodSql, db);
}
