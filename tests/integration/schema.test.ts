import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

const db = env.DB;
const run = (sql: string, ...params: unknown[]) =>
  db
    .prepare(sql)
    .bind(...params)
    .run();

async function seedMinimal() {
  await db.batch([
    db.prepare(
      "INSERT OR IGNORE INTO currencies (code, name, symbol, minor_digits, active, is_default) VALUES ('USD','US Dollar','$',2,1,1)",
    ),
    db.prepare(
      "INSERT OR IGNORE INTO currencies (code, name, symbol, minor_digits, active, is_default) VALUES ('ZWG','Zimbabwe Gold','ZWG',2,1,0)",
    ),
    db.prepare(
      "INSERT OR IGNORE INTO clients (id, client_number, type, display_name, default_currency) VALUES ('cli_1','CL-0001','business','Example Trading (Pvt) Ltd','USD')",
    ),
  ]);
}

describe('schema constraints', () => {
  beforeEach(seedMinimal);

  it('has every table from docs/04', async () => {
    const { results } = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{ name: string }>();
    const names = new Set(results.map((r) => r.name));
    for (const t of [
      'users',
      'sessions',
      'auth_tokens',
      'roles',
      'permissions',
      'role_permissions',
      'user_roles',
      'rate_limits',
      'idempotency_keys',
      'clients',
      'client_contacts',
      'client_user_access',
      'client_notes',
      'client_credits',
      'enquiries',
      'leads',
      'lead_services',
      'lead_activities',
      'service_categories',
      'services',
      'quotations',
      'quotation_items',
      'invoices',
      'invoice_items',
      'invoice_status_history',
      'credit_notes',
      'credit_note_items',
      'invoice_reminders',
      'payment_provider_accounts',
      'payment_routes',
      'payment_attempts',
      'payments',
      'saved_payment_methods',
      'payment_allocations',
      'payment_events',
      'refunds',
      'projects',
      'project_members',
      'project_milestones',
      'project_tasks',
      'project_updates',
      'project_files',
      'project_messages',
      'expense_categories',
      'expenses',
      'support_requests',
      'support_messages',
      'support_attachments',
      'files',
      'media_assets',
      'website_pages',
      'website_sections',
      'portfolio_projects',
      'portfolio_media',
      'products',
      'announcements',
      'team_members',
      'application_settings',
      'currencies',
      'tax_rates',
      'sequences',
      'outbox',
      'notifications',
      'notification_preferences',
      'email_logs',
      'audit_logs',
      'backups',
      'service_packages',
      'package_features',
      'package_addons',
      'subscriptions',
      'subscription_periods',
      'client_assets',
      'asset_reminders',
      'job_postings',
      'job_applications',
      'job_application_events',
      'posts',
      'post_categories',
      'post_tags',
      'post_tag_links',
      'industries',
      'industry_services',
      'faqs',
      'testimonials',
      'technologies',
      'newsletter_subscribers',
      'time_entries',
      'user_mfa',
      'user_backup_codes',
      'mock_provider_state',
    ]) {
      expect(names.has(t), t).toBe(true);
    }
  });

  it('enforces unique lower-case emails', async () => {
    await run("INSERT INTO users (id, email, name, user_type) VALUES ('usr_a','a@example.com','A','staff')");
    await expect(
      run("INSERT INTO users (id, email, name, user_type) VALUES ('usr_b','a@example.com','B','staff')"),
    ).rejects.toThrow(/UNIQUE/);
    await expect(
      run("INSERT INTO users (id, email, name, user_type) VALUES ('usr_c','Upper@Example.com','C','staff')"),
    ).rejects.toThrow(/CHECK/);
  });

  it('enforces foreign keys', async () => {
    await expect(
      run(
        "INSERT INTO clients (id, client_number, type, display_name, default_currency) VALUES ('cli_x','CL-9','business','X','EUR')",
      ),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  it('enforces enum checks', async () => {
    await expect(
      run("INSERT INTO invoices (id, client_id, currency, status) VALUES ('inv_bad','cli_1','USD','unpaid')"),
    ).rejects.toThrow(/CHECK/);
    await expect(
      run("INSERT INTO invoices (id, client_id, currency, status) VALUES ('inv_nonum','cli_1','USD','issued')"),
    ).rejects.toThrow(/CHECK/);
  });

  it('allows only one primary contact per client', async () => {
    await run("INSERT INTO client_contacts (id, client_id, name, is_primary) VALUES ('con_1','cli_1','P1',1)");
    await expect(
      run("INSERT INTO client_contacts (id, client_id, name, is_primary) VALUES ('con_2','cli_1','P2',1)"),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('makes audit_logs append-only', async () => {
    await run("INSERT INTO audit_logs (id, actor_type, action) VALUES ('aud_1','system','test.created')");
    await expect(run("UPDATE audit_logs SET action='x' WHERE id='aud_1'")).rejects.toThrow(/append-only/);
    await expect(run("DELETE FROM audit_logs WHERE id='aud_1'")).rejects.toThrow(/append-only/);
  });

  it('locks invoice lines after issue and blocks deleting issued invoices', async () => {
    await run("INSERT INTO invoices (id, client_id, currency) VALUES ('inv_1','cli_1','USD')");
    await run(
      "INSERT INTO invoice_items (id, invoice_id, position, description, quantity_milli, unit_price_minor, line_subtotal_minor, line_discount_minor, line_tax_minor, line_total_minor) VALUES ('iit_1','inv_1',0,'Website',1000,75000,75000,0,0,75000)",
    );
    await run("UPDATE invoices SET status='issued', number='INV-2026-00001' WHERE id='inv_1'");
    await expect(run("UPDATE invoice_items SET unit_price_minor=1 WHERE id='iit_1'")).rejects.toThrow(/immutable/);
    await expect(run("DELETE FROM invoice_items WHERE id='iit_1'")).rejects.toThrow(/immutable/);
    await expect(
      run(
        "INSERT INTO invoice_items (id, invoice_id, position, description, quantity_milli, unit_price_minor, line_subtotal_minor, line_discount_minor, line_tax_minor, line_total_minor) VALUES ('iit_2','inv_1',1,'Extra',1000,1,1,0,0,1)",
      ),
    ).rejects.toThrow(/immutable/);
    await expect(run("DELETE FROM invoices WHERE id='inv_1'")).rejects.toThrow(/cannot be deleted/);
  });

  it('prevents converting one quotation into two invoices', async () => {
    await run("INSERT INTO quotations (id, client_id, title, currency) VALUES ('quo_1','cli_1','Website','USD')");
    await run(
      "INSERT INTO invoices (id, client_id, currency, source_quotation_id) VALUES ('inv_a','cli_1','USD','quo_1')",
    );
    await expect(
      run("INSERT INTO invoices (id, client_id, currency, source_quotation_id) VALUES ('inv_b','cli_1','USD','quo_1')"),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('rejects testimonials without consent', async () => {
    await expect(
      run(
        "INSERT INTO testimonials (id, client_id, author_name, quote, consent_obtained, consent_date) VALUES ('tst_1','cli_1','A','Good',0,'2026-11-05')",
      ),
    ).rejects.toThrow(/CHECK/);
  });

  it('guards payments, allocations and services pricing', async () => {
    await run(
      "INSERT INTO payments (id, receipt_number, client_id, provider_key, method, amount_minor, currency, received_at) VALUES ('pay_1','RCT-2026-00001','cli_1','manual','cash',100,'USD','2026-11-05T00:00:00Z')",
    );
    await expect(run("DELETE FROM payments WHERE id='pay_1'")).rejects.toThrow(/cannot be deleted/);
    await expect(
      run(
        "INSERT INTO payments (id, receipt_number, client_id, provider_key, method, amount_minor, currency, received_at) VALUES ('pay_2','RCT-2026-00002','cli_1','manual','cash',0,'USD','2026-11-05T00:00:00Z')",
      ),
    ).rejects.toThrow(/CHECK/);
    await run(
      "INSERT INTO service_categories (id, slug, name, summary) VALUES ('scat_1','web-development','Web','Web')",
    );
    await expect(
      run(
        "INSERT INTO services (id, category_id, slug, name, summary, pricing_model) VALUES ('svc_1','scat_1','sites','Sites','x','fixed')",
      ),
    ).rejects.toThrow(/CHECK/);
    await expect(
      run("INSERT INTO service_categories (id, slug, name, summary) VALUES ('scat_2','Bad Slug','x','x')"),
    ).rejects.toThrow(/CHECK/);
  });
});
