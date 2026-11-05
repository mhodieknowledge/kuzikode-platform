-- Migration 0003: crm. Generated from docs/04-DATABASE.md. Never edit after it has been applied; add a new migration.
-- 0003 clients, CRM, enquiries -----------------------------------------------------------
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  client_number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('individual','business')),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 200),
  legal_name TEXT,
  email TEXT, phone TEXT, website TEXT, tax_number TEXT,
  billing_address TEXT CHECK (billing_address IS NULL OR json_valid(billing_address)),
  physical_address TEXT CHECK (physical_address IS NULL OR json_valid(physical_address)),
  default_currency TEXT NOT NULL REFERENCES currencies(code),
  payment_terms_days INTEGER NOT NULL DEFAULT 14 CHECK (payment_terms_days BETWEEN 0 AND 365),
  notes TEXT,
  tags TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  archived_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_clients_status_name ON clients(status, display_name);
CREATE INDEX idx_clients_email ON clients(email);

CREATE TABLE client_contacts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  email TEXT, phone TEXT, job_title TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  is_billing INTEGER NOT NULL DEFAULT 0 CHECK (is_billing IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_client_contacts_client ON client_contacts(client_id);
CREATE UNIQUE INDEX uq_client_contacts_primary ON client_contacts(client_id) WHERE is_primary = 1;

CREATE TABLE client_user_access (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('owner','member','billing')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (client_id, user_id)
);
CREATE INDEX idx_cua_user_status ON client_user_access(user_id, status);

CREATE TABLE client_notes (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_client_notes_client ON client_notes(client_id, created_at);

CREATE TABLE client_credits (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  currency TEXT NOT NULL REFERENCES currencies(code),
  amount_minor INTEGER NOT NULL CHECK (amount_minor <> 0),
  source_type TEXT NOT NULL CHECK (source_type IN ('overpayment','credit_note','refund','applied','adjustment')),
  source_id TEXT,
  note TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_client_credits_client_currency ON client_credits(client_id, currency);

CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('website','referral','manual','social','other')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','proposal_sent','won','lost')),
  contact_name TEXT, email TEXT, phone TEXT, organisation TEXT,
  assigned_to TEXT REFERENCES users(id),
  estimated_value_minor INTEGER CHECK (estimated_value_minor IS NULL OR estimated_value_minor >= 0),
  currency TEXT REFERENCES currencies(code),
  next_follow_up_on TEXT,
  lost_reason TEXT,
  notes TEXT,
  client_id TEXT REFERENCES clients(id),
  converted_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (estimated_value_minor IS NULL OR currency IS NOT NULL)
);
CREATE INDEX idx_leads_status ON leads(status, created_at);
CREATE INDEX idx_leads_assigned ON leads(assigned_to, status);
CREATE INDEX idx_leads_follow_up ON leads(next_follow_up_on);
CREATE INDEX idx_leads_client ON leads(client_id);

CREATE TABLE enquiries (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'contact' CHECK (kind IN ('contact','wizard','consultation','product_interest')),
  name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, organisation TEXT,
  category TEXT NOT NULL,
  service_id TEXT REFERENCES services(id),
  package_id TEXT REFERENCES service_packages(id),
  product_id TEXT REFERENCES products(id),
  budget_range TEXT,
  message TEXT NOT NULL,
  brief TEXT CHECK (brief IS NULL OR json_valid(brief)),
  attachment_file_id TEXT REFERENCES files(id),
  consent_at TEXT NOT NULL,
  ip_hash TEXT, user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','triaged','spam','closed')),
  lead_id TEXT REFERENCES leads(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_enquiries_status ON enquiries(status, created_at);
CREATE INDEX idx_enquiries_kind ON enquiries(kind, created_at);
CREATE INDEX idx_enquiries_lead ON enquiries(lead_id);

CREATE TABLE lead_services (
  lead_id TEXT NOT NULL REFERENCES leads(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  PRIMARY KEY (lead_id, service_id)
);

CREATE TABLE lead_activities (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  user_id TEXT REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('note','call','email','meeting','status_change','follow_up')),
  body TEXT,
  due_on TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_lead_activities_lead ON lead_activities(lead_id, created_at);
CREATE INDEX idx_lead_activities_due ON lead_activities(due_on, completed_at);
