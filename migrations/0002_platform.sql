-- Migration 0002: platform. Generated from docs/04-DATABASE.md. Never edit after it has been applied; add a new migration.
-- 0002 platform: settings, reference data, files, outbox, notifications, audit -----------
CREATE TABLE application_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL CHECK (json_valid(value)),
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE currencies (
  code TEXT PRIMARY KEY CHECK (length(code) = 3 AND code = upper(code)),
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  minor_digits INTEGER NOT NULL CHECK (minor_digits BETWEEN 0 AND 4),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1))
);
CREATE UNIQUE INDEX uq_currencies_default ON currencies(is_default) WHERE is_default = 1;

CREATE TABLE tax_rates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rate_bp INTEGER NOT NULL CHECK (rate_bp BETWEEN 0 AND 10000),
  inclusive INTEGER NOT NULL DEFAULT 0 CHECK (inclusive IN (0,1)),
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sequences (
  key TEXT PRIMARY KEY,
  next_value INTEGER NOT NULL CHECK (next_value >= 1)
);

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('client','project','invoice','quotation','credit_note','payment','expense','media','support','careers','enquiry','system')),
  owner_id TEXT,
  uploaded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_files_owner ON files(owner_type, owner_id);

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL UNIQUE REFERENCES files(id),
  alt_text TEXT NOT NULL CHECK (length(trim(alt_text)) > 0),
  width INTEGER, height INTEGER,
  caption TEXT,
  folder TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE outbox (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  available_at TEXT NOT NULL,
  locked_until TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_outbox_status_available ON outbox(status, available_at);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  entity_type TEXT, entity_id TEXT,
  dedupe_key TEXT UNIQUE,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, read_at, created_at);

CREATE TABLE notification_preferences (
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  in_app INTEGER NOT NULL DEFAULT 1 CHECK (in_app IN (0,1)),
  email INTEGER NOT NULL DEFAULT 1 CHECK (email IN (0,1)),
  PRIMARY KEY (user_id, type)
);

CREATE TABLE email_logs (
  id TEXT PRIMARY KEY,
  outbox_id TEXT UNIQUE REFERENCES outbox(id),
  to_email TEXT NOT NULL,
  template TEXT NOT NULL,
  subject TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','bounced','complained','failed')),
  error TEXT,
  html TEXT,
  text TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_email_logs_provider_msg ON email_logs(provider_message_id);
CREATE INDEX idx_email_logs_created ON email_logs(created_at);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('staff','client','system','provider','public')),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before TEXT CHECK (before IS NULL OR json_valid(before)),
  after TEXT CHECK (after IS NULL OR json_valid(after)),
  ip TEXT, user_agent TEXT, request_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id, created_at);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE TRIGGER trg_audit_logs_no_update BEFORE UPDATE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;
CREATE TRIGGER trg_audit_logs_no_delete BEFORE DELETE ON audit_logs
BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;

CREATE TABLE backups (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes INTEGER,
  sha256 TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  verified_at TEXT
);
