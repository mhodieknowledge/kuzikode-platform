-- seeds/nonprod.sql: development and staging only (scripts/seed.ts never applies it to production).
-- Mock payment account (labelled TEST PAYMENT everywhere) and visible package prices.
INSERT OR IGNORE INTO payment_provider_accounts (id, provider_key, label, mode, secret_prefix, currencies, enabled_methods, options, enabled, status_note)
VALUES ('ppa_mock', 'mock', 'Mock gateway (test only)', 'test', 'MOCK', '["USD","ZWG"]', '[]', '{}', 1, 'Development and staging only. No real money moves.');
-- Fallback routes: used when the Paynow account has no credentials (local dev) and for ZWG, which has no live route yet.
INSERT OR IGNORE INTO payment_routes (id, app_key, currency, method_code, account_id, priority, enabled)
VALUES ('prt_platform_any_mock', 'kuzikode-platform', '*', '*', 'ppa_mock', 900, 1);
UPDATE application_settings SET value = 'true' WHERE key = 'pricing.show_prices';
