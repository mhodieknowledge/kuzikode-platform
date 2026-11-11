#!/usr/bin/env node
/**
 * Migration check (P7.6, docs/08 §5): every migration applies to an EMPTY local D1 in order, and afterwards wrangler reports
 * nothing pending. Uses a throwaway --persist-to directory, so the developer's local database is never touched.
 * Run: `npm run check:migrations` (CI runs it after verify).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'kz-migrations-'));
const wrangler = (...args) =>
  execFileSync('npx', ['wrangler', 'd1', 'migrations', ...args, 'DB', '--local', '--persist-to', dir], {
    encoding: 'utf8',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
try {
  const applied = wrangler('apply');
  const count = new Set(applied.match(/\d{4}_[\w-]+\.sql/g) ?? []).size;
  const pending = wrangler('list');
  if (!/No migrations to apply/.test(pending)) {
    console.error(`Migrations still pending after applying to an empty database:\n${pending}`);
    process.exit(1);
  }
  console.log(`Migration check passed: ${count} migrations applied to an empty database, nothing pending.`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
