import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashPassword } from '../../src/server/lib/crypto';
import { E2E_PASSWORD, E2E_USERS } from './users';

const wrangler = (...args: string[]) => execFileSync('npx', ['wrangler', ...args], { stdio: 'pipe' });
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

/**
 * Prepares the LOCAL D1 used by `wrangler dev` (never a remote database):
 * - per-IP rate limits are cleared (state persists between local runs and every request comes from localhost);
 * - fixed e2e staff accounts are (re)created with a known password and no sessions or failed-login history;
 * - a fixed website enquiry is reset to untriaged.
 */
export default async function globalSetup() {
  wrangler('d1', 'migrations', 'apply', 'DB', '--local');
  // Idempotent: roles and permissions must exist before the accounts get their roles (fresh CI database).
  execFileSync('node', ['scripts/seed.ts', '--env', 'local'], { stdio: 'pipe' });
  const hash = await hashPassword(E2E_PASSWORD);
  const now = new Date().toISOString();
  const ids = Object.values(E2E_USERS)
    .map((u) => q(u.id))
    .join(',');
  const sql = [
    'DELETE FROM rate_limits;',
    `DELETE FROM sessions WHERE user_id IN (${ids});`,
    `DELETE FROM user_roles WHERE user_id IN (${ids});`,
    `DELETE FROM user_backup_codes WHERE user_id IN (${ids});`,
    `DELETE FROM user_mfa WHERE user_id IN (${ids});`,
    ...Object.values(E2E_USERS).flatMap((u) => [
      `INSERT INTO users (id, email, name, user_type, password_hash, status, must_change_password, email_verified_at)
       VALUES (${q(u.id)}, ${q(u.email)}, ${q(u.name)}, 'staff', ${q(hash)}, 'active', ${u.mustChange ? 1 : 0}, ${q(now)})
       ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, status = 'active',
         must_change_password = excluded.must_change_password, name = excluded.name,
         failed_login_count = 0, locked_until = NULL;`,
      `INSERT INTO user_roles (user_id, role_id) SELECT ${q(u.id)}, id FROM roles WHERE key = ${q(u.role)};`,
    ]),
    // A fixed website enquiry for leads.spec, reset to untriaged on every run (avoids the public form's rate limit).
    `INSERT INTO enquiries (id, reference, kind, name, email, phone, organisation, category, service_id, budget_range, message, consent_at, status)
     VALUES ('enq_e2e_lead', 'ENQ-E2E-0001', 'contact', 'Tendai Moyo', 'tendai@harare-bakery.example', '+263 77 123 4567',
       'Harare Bakery', 'web-development', (SELECT id FROM services WHERE slug = 'e-commerce'), '$1,500 – $5,000',
       'We would like an online shop for our bakery with EcoCash payments and delivery booking.', ${q(now)}, 'new')
     ON CONFLICT(id) DO UPDATE SET status = 'new', lead_id = NULL, updated_at = ${q(now)};`,
  ].join('\n');
  const dir = mkdtempSync(join(tmpdir(), 'kz-e2e-'));
  try {
    const file = join(dir, 'setup.sql');
    writeFileSync(file, sql);
    wrangler('d1', 'execute', 'DB', '--local', '--file', file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
