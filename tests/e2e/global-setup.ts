import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashPassword } from '../../src/server/lib/crypto';
import { E2E_PASSWORD, E2E_PORTAL_USER, E2E_USERS } from './users';

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
    // portal specs: one linked client account, sessions and 2FA reset; leftover self-registrations are removed.
    `INSERT INTO clients (id, client_number, type, display_name, default_currency, email)
     VALUES (${q(E2E_PORTAL_USER.clientId)}, 'CL-E2E-PORTAL', 'business', ${q(E2E_PORTAL_USER.clientName)}, 'USD', 'hello@borrowdale-florists.example')
     ON CONFLICT(id) DO NOTHING;`,
    `INSERT INTO users (id, email, name, user_type, password_hash, status, must_change_password, email_verified_at)
     VALUES (${q(E2E_PORTAL_USER.id)}, ${q(E2E_PORTAL_USER.email)}, ${q(E2E_PORTAL_USER.name)}, 'client', ${q(hash)}, 'active', 0, ${q(now)})
     ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, status = 'active', name = excluded.name,
       phone = NULL, must_change_password = 0, failed_login_count = 0, locked_until = NULL;`,
    `DELETE FROM sessions WHERE user_id = ${q(E2E_PORTAL_USER.id)};`,
    `DELETE FROM user_mfa WHERE user_id = ${q(E2E_PORTAL_USER.id)};`,
    `INSERT INTO client_user_access (id, client_id, user_id, role, status)
     VALUES ('cua_e2e_portal', ${q(E2E_PORTAL_USER.clientId)}, ${q(E2E_PORTAL_USER.id)}, 'owner', 'active')
     ON CONFLICT(client_id, user_id) DO UPDATE SET status = 'active';`,
    // portal overview fixtures: two open USD invoices (one overdue), one sent quotation, one active project with a
    // client-visible milestone and update (fixed ids; never touched by other specs).
    `INSERT INTO invoices (id, number, client_id, currency, status, issue_date, due_date, total_minor, amount_paid_minor, balance_minor, issued_at)
     VALUES ('inv_e2e_portal_1', 'INV-E2E-P001', ${q(E2E_PORTAL_USER.clientId)}, 'USD', 'issued', '2026-10-01', '2099-12-31', 120000, 0, 120000, '2026-10-01T08:00:00.000Z'),
            ('inv_e2e_portal_2', 'INV-E2E-P002', ${q(E2E_PORTAL_USER.clientId)}, 'USD', 'partially_paid', '2026-08-01', '2026-08-31', 45000, 20000, 25000, '2026-08-01T08:00:00.000Z')
     ON CONFLICT(id) DO NOTHING;`,
    // The portal quotation spec accepts it, so it is reset to "sent" on every run.
    `INSERT INTO quotations (id, number, client_id, title, currency, status, issue_date, valid_until, subtotal_minor, total_minor, sent_at,
       client_snapshot, business_snapshot)
     VALUES ('quo_e2e_portal_1', 'QUO-E2E-P001', ${q(E2E_PORTAL_USER.clientId)}, 'Online ordering website', 'USD', 'sent', '2026-10-20', '2099-12-31', 250000, 250000, '2026-10-20T09:00:00.000Z',
       ${q(JSON.stringify({ name: E2E_PORTAL_USER.clientName, email: 'hello@borrowdale-florists.example' }))}, ${q(JSON.stringify({ name: 'Kuzikode Technologies' }))})
     ON CONFLICT(id) DO UPDATE SET status = 'sent', viewed_at = NULL, accepted_at = NULL, accepted_by_name = NULL, accepted_ip = NULL,
       accepted_user_agent = NULL, rejected_at = NULL, rejection_reason = NULL, client_snapshot = excluded.client_snapshot,
       business_snapshot = excluded.business_snapshot, subtotal_minor = excluded.subtotal_minor;`,
    `INSERT INTO quotation_items (id, quotation_id, position, description, quantity_milli, unit_price_minor, line_subtotal_minor, line_discount_minor, line_tax_minor, line_total_minor)
     VALUES ('qti_e2e_portal_1', 'quo_e2e_portal_1', 1, 'Online ordering website with EcoCash checkout', 1000, 250000, 250000, 0, 0, 250000)
     ON CONFLICT(id) DO NOTHING;`,
    `INSERT INTO projects (id, reference, client_id, name, status, currency, progress_pct, progress_mode, target_date)
     VALUES ('prj_e2e_portal', 'PRJ-E2E-PORTAL', ${q(E2E_PORTAL_USER.clientId)}, 'Brand refresh', 'active', 'USD', 60, 'manual', '2099-06-30')
     ON CONFLICT(id) DO NOTHING;`,
    `INSERT INTO project_milestones (id, project_id, title, due_date, status, client_visible)
     VALUES ('mil_e2e_portal', 'prj_e2e_portal', 'Logo sign-off', '2099-01-15', 'in_progress', 1) ON CONFLICT(id) DO NOTHING;`,
    `INSERT INTO project_updates (id, project_id, author_id, body, visibility, created_at)
     VALUES ('pup_e2e_portal', 'prj_e2e_portal', 'usr_e2e_admin', 'The first logo concepts are ready for your feedback.', 'client', '2026-10-25T10:00:00.000Z')
     ON CONFLICT(id) DO NOTHING;`,
    // Divisions left behind by an interrupted services.spec run (it normally deletes its own).
    "DELETE FROM services WHERE category_id IN (SELECT id FROM service_categories WHERE slug GLOB 'workshops-[0-9]*');",
    "DELETE FROM service_categories WHERE slug GLOB 'workshops-[0-9]*';",
    // quotations.spec uses a tax line; the seed ships VAT inactive until the owner confirms registration.
    "UPDATE tax_rates SET active = 1 WHERE id = 'tax_vat';",
    // time.spec: a client and an active project with the time e2e user on the team; unbilled time is reset each run.
    `INSERT INTO clients (id, client_number, type, display_name, default_currency, email)
     VALUES ('cli_e2e_time', 'CL-E2E-TIME', 'business', 'Mbare Motors (e2e)', 'USD', 'accounts@mbare-motors.example')
     ON CONFLICT(id) DO NOTHING;`,
    `INSERT INTO projects (id, reference, client_id, name, status, currency)
     VALUES ('prj_e2e_time', 'PRJ-E2E-TIME', 'cli_e2e_time', 'Parts catalogue', 'active', 'USD') ON CONFLICT(id) DO NOTHING;`,
    "INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES ('prj_e2e_time', 'usr_e2e_time', 'lead');",
    "DELETE FROM time_entries WHERE project_id = 'prj_e2e_time' AND invoice_id IS NULL;",
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
