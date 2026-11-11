/**
 * Backup manifest and restore verification for D1 (docs/09 §7).
 *   node scripts/d1-manifest.mjs create <database-name> <out.json>     row count per table + money checksums
 *   node scripts/d1-manifest.mjs verify <database-name> <manifest.json> compare a restored database with the manifest
 * <database-name> is the D1 name (kuzikode-prod-db, kuzikode-staging-db, kuzikode-restore-test); queries run with --remote.
 * The manifest holds table names, row counts and per-currency totals only (no row data). It is encrypted with the backup.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const TABLES_SQL =
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name";

export const CHECKSUM_SQL = {
  invoices:
    'SELECT currency, count(*) AS n, coalesce(sum(total_minor), 0) AS total_minor, coalesce(sum(amount_paid_minor), 0) AS paid_minor FROM invoices GROUP BY currency ORDER BY currency',
  payments:
    'SELECT currency, count(*) AS n, coalesce(sum(amount_minor), 0) AS amount_minor FROM payments GROUP BY currency ORDER BY currency',
};

/** @param {string[]} tables */
export function countsSql(tables) {
  if (!tables.every((t) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(t))) throw new Error('Unexpected table name');
  // One row of scalar subqueries: D1 allows at most 5 terms in a compound SELECT, so no UNION ALL.
  return `SELECT ${tables.map((t) => `(SELECT count(*) FROM "${t}") AS "${t}"`).join(', ')}`;
}

/**
 * @typedef {{ createdAt: string, database: string, tables: Record<string, number>, checksums: Record<string, unknown[]> }} Manifest
 * @param {string} database
 * @param {(sql: string) => Record<string, unknown>[]} query
 * @param {Date} [now]
 * @returns {Manifest}
 */
export function buildManifest(database, query, now = new Date()) {
  const tables = query(TABLES_SQL).map((r) => String(r.name));
  /** @type {Record<string, number>} */
  const counts = {};
  // Keep each statement well under D1's limits: count in chunks of 40 tables.
  for (let i = 0; i < tables.length; i += 40) {
    const [row] = query(countsSql(tables.slice(i, i + 40)));
    for (const [t, n] of Object.entries(row ?? {})) counts[t] = Number(n);
  }
  /** @type {Record<string, unknown[]>} */
  const checksums = {};
  for (const [name, sql] of Object.entries(CHECKSUM_SQL)) if (tables.includes(name)) checksums[name] = query(sql);
  return { createdAt: now.toISOString(), database, tables: counts, checksums };
}

/** @param {Manifest} expected @param {Manifest} actual @returns {string[]} differences */
export function compareManifests(expected, actual) {
  const diffs = [];
  for (const [t, n] of Object.entries(expected.tables)) {
    if (!(t in actual.tables)) diffs.push(`table ${t} missing`);
    else if (actual.tables[t] !== n) diffs.push(`table ${t}: ${actual.tables[t]} rows, expected ${n}`);
  }
  for (const t of Object.keys(actual.tables)) if (!(t in expected.tables)) diffs.push(`unexpected table ${t}`);
  for (const [name, rows] of Object.entries(expected.checksums)) {
    if (JSON.stringify(actual.checksums[name] ?? null) !== JSON.stringify(rows))
      diffs.push(`checksum ${name} differs: ${JSON.stringify(actual.checksums[name])} vs ${JSON.stringify(rows)}`);
  }
  return diffs;
}

/** @param {string} database @returns {(sql: string) => Record<string, unknown>[]} */
export function remoteQuery(database) {
  return (sql) => {
    const out = execFileSync(
      'npx',
      ['wrangler', 'd1', 'execute', database, '--remote', '--json', '--yes', '--command', sql],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return JSON.parse(out.slice(out.indexOf('[')))[0]?.results ?? [];
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, database, file] = process.argv.slice(2);
  try {
    if (!database || !/^kuzikode-[a-z0-9-]+$/.test(database) || !file) throw new Error('Usage: see the header');
    const manifest = buildManifest(database, remoteQuery(database));
    const rows = Object.values(manifest.tables).reduce((a, b) => a + b, 0);
    if (cmd === 'create') {
      writeFileSync(file, JSON.stringify(manifest, null, 2), { mode: 0o600 });
      console.log(`Manifest: ${Object.keys(manifest.tables).length} tables, ${rows} rows`);
    } else if (cmd === 'verify') {
      const expected = /** @type {Manifest} */ (JSON.parse(readFileSync(file, 'utf8')));
      const diffs = compareManifests(expected, manifest);
      for (const d of diffs) console.error(`✗ ${d}`);
      console.log(
        diffs.length
          ? `Restore verification FAILED (${diffs.length} differences)`
          : `Restore verified: ${Object.keys(manifest.tables).length} tables, ${rows} rows, checksums match (backup taken ${expected.createdAt})`,
      );
      process.exit(diffs.length ? 1 : 0);
    } else throw new Error('Command must be create or verify');
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
