-- seeds/dev.sql: CLEARLY FICTIONAL sample data for local development and tests.
-- scripts/seed.ts refuses to apply this file to production. All organisations and people below are invented;
-- emails use the reserved example.com domain.

INSERT OR IGNORE INTO sequences (key, next_value) VALUES ('client', 4);
UPDATE sequences SET next_value = 4 WHERE key = 'client' AND next_value < 4;
INSERT OR IGNORE INTO sequences (key, next_value) VALUES ('invoice:2026', 2), ('quotation:2026', 2), ('receipt:2026', 2), ('project:2026', 2), ('enquiry:2026', 2);

INSERT OR IGNORE INTO clients (id, client_number, type, display_name, legal_name, email, phone, default_currency, payment_terms_days, tags, billing_address)
VALUES
 ('cli_dev_example_trading', 'CL-0001', 'business', 'Example Trading (Pvt) Ltd', 'Example Trading (Private) Limited', 'accounts@example.com', '+263 77 000 0001', 'USD', 14, '["retail"]', '{"line1":"1 Example Street","city":"Harare","country":"Zimbabwe"}'),
 ('cli_dev_sample_clinic', 'CL-0002', 'business', 'Sample Health Clinic', NULL, 'admin@clinic.example.com', '+263 77 000 0002', 'USD', 30, '["healthcare"]', NULL),
 ('cli_dev_demo_person', 'CL-0003', 'individual', 'Demo Person', NULL, 'demo.person@example.com', NULL, 'ZWG', 7, '[]', NULL);

INSERT OR IGNORE INTO client_contacts (id, client_id, name, email, phone, job_title, is_primary, is_billing)
VALUES
 ('con_dev_tendai', 'cli_dev_example_trading', 'Tendai Example', 'tendai@example.com', '+263 77 000 0011', 'Operations Manager', 1, 1),
 ('con_dev_clinic', 'cli_dev_sample_clinic', 'Rudo Sample', 'rudo@clinic.example.com', NULL, 'Practice Manager', 1, 0);

INSERT OR IGNORE INTO leads (id, title, source, status, contact_name, email, organisation, estimated_value_minor, currency, next_follow_up_on)
VALUES ('led_dev_1', 'Online store for a fictional hardware shop', 'website', 'contacted', 'Farai Example', 'farai@example.com', 'Example Hardware', 150000, 'USD', '2026-11-12');

INSERT OR IGNORE INTO enquiries (id, reference, kind, name, email, category, message, consent_at, status)
VALUES ('enq_dev_1', 'ENQ-2026-0001', 'contact', 'Farai Example', 'farai@example.com', 'web-development', 'We would like an online store for our (fictional) hardware shop.', '2026-11-01T08:00:00.000Z', 'triaged');

INSERT OR IGNORE INTO quotations (id, number, client_id, contact_id, title, currency, issue_date, valid_until, discount_type, discount_value, subtotal_minor, discount_minor, tax_minor, total_minor, status, version, sent_at)
VALUES ('quo_dev_1', 'QUO-2026-0001', 'cli_dev_example_trading', 'con_dev_tendai', 'Business website and email', 'USD', '2026-11-01', '2026-12-01', 'none', 0, 112500, 750, 0, 111750, 'sent', 1, '2026-11-01T09:00:00.000Z');
INSERT OR IGNORE INTO quotation_items (id, quotation_id, position, description, quantity_milli, unit_price_minor, discount_type, discount_value, tax_rate_bp, line_subtotal_minor, line_discount_minor, line_tax_minor, line_total_minor)
VALUES
 ('qit_dev_1', 'quo_dev_1', 0, 'Business Website package (up to 12 pages)', 1000, 75000, 'none', 0, 0, 75000, 0, 0, 75000),
 ('qit_dev_2', 'quo_dev_1', 1, 'Business email, 10 mailboxes, 12 months', 10000, 3000, 'none', 0, 0, 30000, 0, 0, 30000),
 ('qit_dev_3', 'quo_dev_1', 2, 'Content upload, extra pages', 3000, 2500, 'percent', 1000, 0, 7500, 750, 0, 6750);

-- Draft first so the line-immutability trigger allows inserting items, then issue.
INSERT OR IGNORE INTO invoices (id, client_id, contact_id, currency, issue_date, due_date, payment_terms_days, subtotal_minor, discount_minor, tax_minor, total_minor, amount_paid_minor, balance_minor, status)
VALUES ('inv_dev_1', 'cli_dev_sample_clinic', 'con_dev_clinic', 'USD', '2026-10-20', '2026-11-19', 30, 40000, 0, 0, 40000, 0, 40000, 'draft');
INSERT INTO invoice_items (id, invoice_id, position, description, quantity_milli, unit_price_minor, line_subtotal_minor, line_discount_minor, line_tax_minor, line_total_minor)
SELECT 'iit_dev_1', 'inv_dev_1', 0, 'Payment gateway integration (Paynow)', 1000, 40000, 40000, 0, 0, 40000
WHERE NOT EXISTS (SELECT 1 FROM invoice_items WHERE id = 'iit_dev_1');
UPDATE invoices SET number = 'INV-2026-00001', status = 'partially_paid', amount_paid_minor = 15000, balance_minor = 25000,
  issued_at = '2026-10-20T10:00:00.000Z',
  client_snapshot = '{"displayName":"Sample Health Clinic","email":"admin@clinic.example.com"}',
  business_snapshot = '{"name":"Kuzikode Technologies"}'
WHERE id = 'inv_dev_1' AND status = 'draft';

INSERT OR IGNORE INTO payments (id, receipt_number, client_id, provider_key, method, amount_minor, currency, received_at, reference, notes)
VALUES ('pay_dev_1', 'RCT-2026-00001', 'cli_dev_sample_clinic', 'manual', 'bank_transfer', 15000, 'USD', '2026-10-25T12:00:00.000Z', 'DEV-TRANSFER-1', 'Fictional deposit');
INSERT OR IGNORE INTO payment_allocations (id, payment_id, invoice_id, amount_minor, currency)
VALUES ('pal_dev_1', 'pay_dev_1', 'inv_dev_1', 15000, 'USD');

INSERT OR IGNORE INTO projects (id, reference, client_id, name, description, status, start_date, target_date, progress_pct)
VALUES ('prj_dev_1', 'PRJ-2026-0001', 'cli_dev_sample_clinic', 'Online payments for the clinic website', 'Fictional sample project.', 'active', '2026-10-21', '2026-11-30', 40);
INSERT OR IGNORE INTO project_milestones (id, project_id, title, due_date, status, client_visible, position)
VALUES
 ('mil_dev_1', 'prj_dev_1', 'Gateway account and test integration', '2026-11-05', 'completed', 1, 0),
 ('mil_dev_2', 'prj_dev_1', 'Go live with EcoCash and cards', '2026-11-30', 'in_progress', 1, 1);

INSERT OR IGNORE INTO expenses (id, category_id, expense_date, vendor, description, amount_minor, currency, payment_method)
VALUES ('exp_dev_1', 'exc_hosting', '2026-11-01', 'Example Cloud Ltd', 'Fictional hosting invoice', 2500, 'USD', 'card');

INSERT OR IGNORE INTO job_postings (id, slug, title, department, location, employment_type, workplace, summary, responsibilities, requirements, offer, status, opens_at, closes_at)
VALUES ('job_dev_1', 'example-junior-developer', 'Junior Web Developer (sample posting)', 'Engineering', 'Harare', 'full_time', 'hybrid',
 'A fictional posting used in development to exercise the careers pages.',
 '["Build and test website features","Fix bugs reported by clients"]',
 '["Some experience with HTML, CSS and JavaScript","Clear written English"]',
 '["Mentoring from senior developers"]',
 'open', '2026-11-01T00:00:00.000Z', '2026-12-31T23:59:59.000Z');
