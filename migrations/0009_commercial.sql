-- Migration 0009: commercial. Generated from docs/04-DATABASE.md. Never edit after it has been applied; add a new migration.
-- 0009 subscriptions, managed services, careers ------------------------------------------
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  package_id TEXT REFERENCES service_packages(id),
  autocharge_method_id TEXT REFERENCES saved_payment_methods(id),
  description TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  currency TEXT NOT NULL REFERENCES currencies(code),
  tax_rate_id TEXT REFERENCES tax_rates(id),
  interval TEXT NOT NULL CHECK (interval IN ('month','year')),
  start_date TEXT NOT NULL,
  next_billing_date TEXT NOT NULL,
  auto_issue INTEGER NOT NULL DEFAULT 0 CHECK (auto_issue IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','ended','at_risk')),
  cancelled_at TEXT, cancel_reason TEXT,
  source_quotation_id TEXT REFERENCES quotations(id),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_subscriptions_billing ON subscriptions(status, next_billing_date);
CREATE INDEX idx_subscriptions_client ON subscriptions(client_id, status);

CREATE TABLE subscription_periods (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (subscription_id, period_start)
);

CREATE TABLE client_assets (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  type TEXT NOT NULL CHECK (type IN ('domain','hosting','email_tenant','ssl','app_store_account','other')),
  name TEXT NOT NULL,
  provider TEXT,
  subscription_id TEXT REFERENCES subscriptions(id),
  renewal_date TEXT,
  auto_renew INTEGER NOT NULL DEFAULT 0 CHECK (auto_renew IN (0,1)),
  billable_to_client INTEGER NOT NULL DEFAULT 1 CHECK (billable_to_client IN (0,1)),
  cost_note TEXT,
  credentials_note TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled','transferred')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (type, name)
);
CREATE INDEX idx_client_assets_client ON client_assets(client_id, status);
CREATE INDEX idx_client_assets_renewal ON client_assets(status, renewal_date);

CREATE TABLE asset_reminders (
  asset_id TEXT NOT NULL REFERENCES client_assets(id),
  kind TEXT NOT NULL CHECK (kind IN ('30d','14d','7d')),
  renewal_date TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (asset_id, kind, renewal_date)
);

CREATE TABLE job_postings (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  location TEXT NOT NULL,
  employment_type TEXT NOT NULL CHECK (employment_type IN ('full_time','part_time','contract','internship','attachment')),
  workplace TEXT NOT NULL CHECK (workplace IN ('onsite','hybrid','remote')),
  salary_min_minor INTEGER, salary_max_minor INTEGER,
  salary_currency TEXT REFERENCES currencies(code),
  salary_period TEXT CHECK (salary_period IS NULL OR salary_period IN ('hour','month','year')),
  show_salary INTEGER NOT NULL DEFAULT 0 CHECK (show_salary IN (0,1)),
  summary TEXT NOT NULL,
  description TEXT,
  responsibilities TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(responsibilities)),
  requirements TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(requirements)),
  nice_to_haves TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(nice_to_haves)),
  offer TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(offer)),
  how_to_apply TEXT,
  custom_questions TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(custom_questions)),
  opens_at TEXT, closes_at TEXT, closed_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed','archived')),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (salary_min_minor IS NULL OR salary_max_minor IS NULL OR salary_min_minor <= salary_max_minor)
);
CREATE INDEX idx_job_postings_status ON job_postings(status, closes_at);

CREATE TABLE job_applications (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  posting_id TEXT REFERENCES job_postings(id),
  full_name TEXT NOT NULL,
  email TEXT, phone TEXT, location TEXT,
  linkedin_url TEXT, portfolio_url TEXT,
  cv_file_id TEXT REFERENCES files(id),
  cover_letter TEXT,
  cover_letter_file_id TEXT REFERENCES files(id),
  answers TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(answers)),
  notice_period TEXT,
  salary_expectation TEXT,
  consent_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','screening','interview','offer','hired','rejected','withdrawn')),
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags)),
  assigned_to TEXT REFERENCES users(id),
  anonymised_at TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_job_applications_posting ON job_applications(posting_id, status);
CREATE INDEX idx_job_applications_created ON job_applications(created_at, anonymised_at);

CREATE TABLE job_application_events (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES job_applications(id),
  actor_id TEXT REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('note','status_change','email_sent','rating','erased')),
  body TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_job_app_events_app ON job_application_events(application_id, created_at);
