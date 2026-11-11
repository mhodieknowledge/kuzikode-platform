import { execFileSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashPassword } from '../../src/server/lib/crypto';
import { E2E_PASSWORD, E2E_PORTAL_SUPPORT_USER, E2E_PORTAL_USER, E2E_USERS } from './users';

/** `documentToken(ctx, kind, id).hash` with the local development HMAC secret (tests run without `.dev.vars`). */
const publicTokenHash = (kind: string, id: string) =>
  createHash('sha256')
    .update(
      createHmac('sha256', 'dev-only-hmac-secret-not-for-production-use-0001')
        .update(`${kind}:${id}`)
        .digest('base64url'),
    )
    .digest('hex');

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
  const clientSnap = JSON.stringify({ name: E2E_PORTAL_USER.clientName, email: 'hello@borrowdale-florists.example' });
  const businessSnap = JSON.stringify({ name: 'Kuzikode Technologies' });
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
    `INSERT INTO users (id, email, name, user_type, password_hash, status, must_change_password, email_verified_at)
     VALUES (${q(E2E_PORTAL_SUPPORT_USER.id)}, ${q(E2E_PORTAL_SUPPORT_USER.email)}, ${q(E2E_PORTAL_SUPPORT_USER.name)}, 'client', ${q(hash)}, 'active', 0, ${q(now)})
     ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, status = 'active', failed_login_count = 0, locked_until = NULL;`,
    `DELETE FROM sessions WHERE user_id = ${q(E2E_PORTAL_SUPPORT_USER.id)};`,
    `INSERT INTO client_user_access (id, client_id, user_id, role, status)
     VALUES ('cua_e2e_portal_support', ${q(E2E_PORTAL_USER.clientId)}, ${q(E2E_PORTAL_SUPPORT_USER.id)}, 'owner', 'active')
     ON CONFLICT(client_id, user_id) DO UPDATE SET status = 'active';`,
    // portal overview fixtures: two open USD invoices (one overdue), one sent quotation, one active project with a
    // client-visible milestone and update (fixed ids; never touched by other specs).
    // Invoices are inserted as drafts, given their lines (lines are locked after issue), then issued.
    `INSERT INTO invoices (id, number, client_id, currency, status, issue_date, due_date, subtotal_minor, total_minor, amount_paid_minor, balance_minor, issued_at,
       client_snapshot, business_snapshot)
     VALUES ('inv_e2e_portal_1', 'INV-E2E-P001', ${q(E2E_PORTAL_USER.clientId)}, 'USD', 'draft', '2026-10-01', '2099-12-31', 120000, 120000, 0, 120000, '2026-10-01T08:00:00.000Z', ${q(clientSnap)}, ${q(businessSnap)}),
            ('inv_e2e_portal_2', 'INV-E2E-P002', ${q(E2E_PORTAL_USER.clientId)}, 'USD', 'draft', '2026-08-01', '2026-08-31', 45000, 45000, 20000, 25000, '2026-08-01T08:00:00.000Z', ${q(clientSnap)}, ${q(businessSnap)})
     ON CONFLICT(id) DO NOTHING;`,
    `INSERT INTO invoice_items (id, invoice_id, position, description, quantity_milli, unit_price_minor, line_subtotal_minor, line_discount_minor, line_tax_minor, line_total_minor)
     SELECT 'iti_e2e_portal_1', 'inv_e2e_portal_1', 1, 'Brand refresh: logo and colour system', 1000, 120000, 120000, 0, 0, 120000
     WHERE (SELECT status FROM invoices WHERE id = 'inv_e2e_portal_1') = 'draft'
     ON CONFLICT(id) DO NOTHING;`,
    `INSERT INTO invoice_items (id, invoice_id, position, description, quantity_milli, unit_price_minor, line_subtotal_minor, line_discount_minor, line_tax_minor, line_total_minor)
     SELECT 'iti_e2e_portal_2', 'inv_e2e_portal_2', 1, 'Website care plan (3 months)', 3000, 15000, 45000, 0, 0, 45000
     WHERE (SELECT status FROM invoices WHERE id = 'inv_e2e_portal_2') = 'draft'
     ON CONFLICT(id) DO NOTHING;`,
    `UPDATE invoices SET status = CASE id WHEN 'inv_e2e_portal_1' THEN 'issued' ELSE 'partially_paid' END
     WHERE id IN ('inv_e2e_portal_1', 'inv_e2e_portal_2') AND status = 'draft';`,
    // Public link hash (same derivation as documentToken with the dev HMAC secret), for /pay/return → /i/:token (P5.8).
    `UPDATE invoices SET public_token_hash = ${q(publicTokenHash('invoice', 'inv_e2e_portal_2'))} WHERE id = 'inv_e2e_portal_2';`,
    `INSERT INTO payments (id, receipt_number, client_id, provider_key, method, amount_minor, currency, received_at, reference)
     VALUES ('pay_e2e_portal_1', 'RCT-E2E-P001', ${q(E2E_PORTAL_USER.clientId)}, 'manual', 'bank_transfer', 20000, 'USD', '2026-08-20T10:00:00.000Z', 'FT-E2E-1')
     ON CONFLICT(id) DO NOTHING;`,
    `INSERT INTO payment_allocations (id, payment_id, invoice_id, amount_minor, currency)
     VALUES ('pal_e2e_portal_1', 'pay_e2e_portal_1', 'inv_e2e_portal_2', 20000, 'USD') ON CONFLICT(id) DO NOTHING;`,
    `INSERT INTO payment_provider_accounts (id, provider_key, label, mode, secret_prefix)
     VALUES ('ppa_e2e_mock', 'mock', 'Mock (e2e)', 'test', 'MOCK') ON CONFLICT(id) DO NOTHING;`,
    // mock gateway hosted page (P6.1): one pending redirect payment, reset to pending on every run.
    `INSERT INTO mock_provider_state (reference, account_id, merchant_reference, amount_minor, paid_minor, currency, status, method_code, result_url, return_url)
     VALUES ('mock_pat_e2e_checkout', 'ppa_e2e_mock', 'pat_e2e_checkout', 4500, 4500, 'USD', 'pending', 'card', NULL, '/contact')
     ON CONFLICT(reference) DO UPDATE SET status = 'pending', paid_minor = 4500, scripted = NULL, settle_at = NULL;`,
    `INSERT INTO payment_attempts (id, invoice_id, client_id, provider_key, account_id, flow, method_code, payer_phone_masked, amount_minor, currency, status, merchant_reference, idempotency_key)
     VALUES ('pat_e2e_portal_failed', 'inv_e2e_portal_2', ${q(E2E_PORTAL_USER.clientId)}, 'mock', 'ppa_e2e_mock', 'express', 'ecocash', '077****111', 25000, 'USD', 'failed', 'pat_e2e_portal_failed', 'e2e-portal-failed')
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
    // portal support + services (P5.7): one active subscription and one managed domain; the client's support requests
    // from earlier runs are removed so the list starts empty.
    `INSERT INTO subscriptions (id, client_id, description, quantity_milli, unit_price_minor, currency, interval, start_date, next_billing_date, status)
     VALUES ('sub_e2e_portal', ${q(E2E_PORTAL_USER.clientId)}, 'Website care plan', 1000, 15000, 'USD', 'month', '2026-09-01', '2099-12-01', 'active')
     ON CONFLICT(id) DO NOTHING;`,
    `INSERT INTO client_assets (id, client_id, type, name, provider, renewal_date, auto_renew)
     VALUES ('ast_e2e_portal', ${q(E2E_PORTAL_USER.clientId)}, 'domain', 'e2e-portal-client.co.zw', 'ZISPA', '2099-03-01', 1)
     ON CONFLICT(id) DO NOTHING;`,
    `DELETE FROM support_attachments WHERE message_id IN (SELECT m.id FROM support_messages m JOIN support_requests r ON r.id = m.request_id
     WHERE r.client_id = ${q(E2E_PORTAL_USER.clientId)});`,
    `DELETE FROM support_messages WHERE request_id IN (SELECT id FROM support_requests WHERE client_id = ${q(E2E_PORTAL_USER.clientId)});`,
    `DELETE FROM notifications WHERE entity_type = 'support_request' AND entity_id IN (SELECT id FROM support_requests WHERE client_id = ${q(E2E_PORTAL_USER.clientId)});`,
    `DELETE FROM support_requests WHERE client_id = ${q(E2E_PORTAL_USER.clientId)};`,
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
