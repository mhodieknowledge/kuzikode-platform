-- Migration 0006: payments. Generated from docs/04-DATABASE.md. Never edit after it has been applied; add a new migration.
-- 0006 payments --------------------------------------------------------------------------
CREATE TABLE payment_provider_accounts (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL,
  label TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('test','live')),
  secret_prefix TEXT NOT NULL CHECK (secret_prefix GLOB '[A-Z]*' AND secret_prefix NOT GLOB '*[^A-Z0-9_]*'),
  currencies TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(currencies)),
  enabled_methods TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(enabled_methods)),
  options TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(options)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  status_note TEXT,
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE payment_routes (
  id TEXT PRIMARY KEY,
  app_key TEXT NOT NULL,
  currency TEXT NOT NULL,
  method_code TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES payment_provider_accounts(id),
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_payment_routes_lookup ON payment_routes(app_key, currency, method_code, priority);

CREATE TABLE payment_attempts (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  initiated_by_user_id TEXT REFERENCES users(id),
  provider_key TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES payment_provider_accounts(id),
  flow TEXT NOT NULL CHECK (flow IN ('redirect','express')),
  method_code TEXT,
  payer_phone_masked TEXT,
  saved_method_id TEXT REFERENCES saved_payment_methods(id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL REFERENCES currencies(code),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','initiated','pending','partially_paid','succeeded','disputed','refunded','failed','cancelled','expired','reversed','error')),
  merchant_reference TEXT NOT NULL UNIQUE,
  provider_reference TEXT,
  redirect_url TEXT, poll_url TEXT,
  instructions TEXT CHECK (instructions IS NULL OR json_valid(instructions)),
  provider_status_raw TEXT,
  failure_reason TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  expires_at TEXT,
  last_checked_at TEXT,
  next_check_at TEXT,
  check_count INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX uq_payment_attempts_provider_ref ON payment_attempts(account_id, provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX idx_payment_attempts_invoice ON payment_attempts(invoice_id, created_at);
CREATE INDEX idx_payment_attempts_status ON payment_attempts(status, next_check_at);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients(id),
  provider_key TEXT NOT NULL,
  account_id TEXT REFERENCES payment_provider_accounts(id),
  method TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL REFERENCES currencies(code),
  received_at TEXT NOT NULL,
  attempt_id TEXT UNIQUE REFERENCES payment_attempts(id),
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','reversed','refunded','partially_refunded')),
  recorded_by TEXT REFERENCES users(id),
  reference TEXT,
  notes TEXT,
  receipt_file_id TEXT REFERENCES files(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX uq_payments_provider_ref ON payments(provider_key, account_id, provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX idx_payments_client ON payments(client_id, received_at);
CREATE INDEX idx_payments_received ON payments(received_at);
CREATE TRIGGER trg_payments_no_delete BEFORE DELETE ON payments
BEGIN SELECT RAISE(ABORT, 'payments cannot be deleted'); END;

CREATE TABLE saved_payment_methods (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  created_by_user_id TEXT REFERENCES users(id),
  account_id TEXT NOT NULL REFERENCES payment_provider_accounts(id),
  provider_key TEXT NOT NULL,
  method TEXT NOT NULL,
  token_enc TEXT,
  brand TEXT, masked TEXT,
  token_expiry TEXT,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  autocharge_consent_at TEXT, autocharge_consent_by TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','removed')),
  removed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (status = 'removed' OR token_enc IS NOT NULL)
);
CREATE INDEX idx_saved_methods_client ON saved_payment_methods(client_id, status);

CREATE TABLE payment_allocations (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL REFERENCES currencies(code),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX idx_allocations_invoice ON payment_allocations(invoice_id);
CREATE TRIGGER trg_allocations_no_delete BEFORE DELETE ON payment_allocations
BEGIN SELECT RAISE(ABORT, 'payment allocations cannot be deleted'); END;
CREATE TRIGGER trg_client_credits_no_delete BEFORE DELETE ON client_credits
BEGIN SELECT RAISE(ABORT, 'client credit entries cannot be deleted'); END;

CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,
  provider_key TEXT NOT NULL,
  account_id TEXT,
  attempt_id TEXT REFERENCES payment_attempts(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('initiate_request','initiate_response','callback_received','callback_rejected','status_check','status_change','reconcile','error','unmatched')),
  provider_reference TEXT,
  dedupe_hash TEXT NOT NULL UNIQUE,
  payload_redacted TEXT CHECK (payload_redacted IS NULL OR json_valid(payload_redacted)),
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_payment_events_attempt ON payment_events(attempt_id, received_at);
CREATE INDEX idx_payment_events_type ON payment_events(event_type, received_at);

CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL REFERENCES currencies(code),
  reason TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('provider','manual')),
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded','pending','completed','failed')),
  credit_note_id TEXT REFERENCES credit_notes(id),
  recorded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_refunds_payment ON refunds(payment_id);

CREATE TABLE mock_provider_state (
  reference TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  method_code TEXT,
  result_url TEXT, return_url TEXT,
  otp TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
