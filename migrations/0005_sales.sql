-- Migration 0005: sales. Generated from docs/04-DATABASE.md. Never edit after it has been applied; add a new migration.
-- 0005 quotations, invoices, credit notes ------------------------------------------------
CREATE TABLE quotations (
  id TEXT PRIMARY KEY,
  number TEXT UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients(id),
  contact_id TEXT REFERENCES client_contacts(id),
  lead_id TEXT REFERENCES leads(id),
  enquiry_id TEXT REFERENCES enquiries(id),
  title TEXT NOT NULL,
  intro_html TEXT,
  currency TEXT NOT NULL REFERENCES currencies(code),
  issue_date TEXT, valid_until TEXT,
  payment_terms TEXT, notes TEXT, terms TEXT,
  discount_type TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none','percent','amount')),
  discount_value INTEGER NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  subtotal_minor INTEGER NOT NULL DEFAULT 0, discount_minor INTEGER NOT NULL DEFAULT 0,
  tax_minor INTEGER NOT NULL DEFAULT 0, total_minor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','accepted','rejected','expired','void')),
  version INTEGER NOT NULL DEFAULT 1,
  parent_quotation_id TEXT REFERENCES quotations(id),
  superseded_by_id TEXT REFERENCES quotations(id),
  public_token_hash TEXT UNIQUE,
  sent_at TEXT, viewed_at TEXT,
  accepted_at TEXT, accepted_by_name TEXT, accepted_ip TEXT, accepted_user_agent TEXT,
  rejected_at TEXT, rejection_reason TEXT,
  voided_at TEXT, void_reason TEXT,
  client_snapshot TEXT CHECK (client_snapshot IS NULL OR json_valid(client_snapshot)),
  business_snapshot TEXT CHECK (business_snapshot IS NULL OR json_valid(business_snapshot)),
  pdf_file_id TEXT REFERENCES files(id),
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_quotations_client ON quotations(client_id, created_at);
CREATE INDEX idx_quotations_status ON quotations(status, valid_until);

CREATE TABLE quotation_items (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id),
  position INTEGER NOT NULL,
  service_id TEXT REFERENCES services(id),
  package_id TEXT REFERENCES service_packages(id),
  description TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  discount_type TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none','percent','amount')),
  discount_value INTEGER NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  tax_rate_id TEXT REFERENCES tax_rates(id),
  tax_rate_bp INTEGER NOT NULL DEFAULT 0 CHECK (tax_rate_bp BETWEEN 0 AND 10000),
  tax_inclusive INTEGER NOT NULL DEFAULT 0 CHECK (tax_inclusive IN (0,1)),
  is_recurring INTEGER NOT NULL DEFAULT 0 CHECK (is_recurring IN (0,1)),
  recurring_interval TEXT CHECK (recurring_interval IS NULL OR recurring_interval IN ('month','year')),
  period_start TEXT, period_end TEXT,
  line_subtotal_minor INTEGER NOT NULL, line_discount_minor INTEGER NOT NULL,
  line_tax_minor INTEGER NOT NULL, line_total_minor INTEGER NOT NULL
);
CREATE INDEX idx_quotation_items_q ON quotation_items(quotation_id, position);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  number TEXT UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients(id),
  contact_id TEXT REFERENCES client_contacts(id),
  project_id TEXT REFERENCES projects(id),
  subscription_id TEXT REFERENCES subscriptions(id),
  source_quotation_id TEXT UNIQUE REFERENCES quotations(id),
  currency TEXT NOT NULL REFERENCES currencies(code),
  issue_date TEXT, due_date TEXT,
  payment_terms_days INTEGER,
  notes TEXT, terms TEXT,
  discount_type TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none','percent','amount')),
  discount_value INTEGER NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  subtotal_minor INTEGER NOT NULL DEFAULT 0, discount_minor INTEGER NOT NULL DEFAULT 0,
  tax_minor INTEGER NOT NULL DEFAULT 0, total_minor INTEGER NOT NULL DEFAULT 0 CHECK (total_minor >= 0),
  amount_paid_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_paid_minor >= 0),
  amount_credited_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_credited_minor >= 0),
  balance_minor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','partially_paid','paid','overdue','void')),
  flagged INTEGER NOT NULL DEFAULT 0 CHECK (flagged IN (0,1)),
  issued_at TEXT, issued_by TEXT REFERENCES users(id),
  voided_at TEXT, voided_by TEXT REFERENCES users(id), void_reason TEXT,
  public_token_hash TEXT UNIQUE,
  client_snapshot TEXT CHECK (client_snapshot IS NULL OR json_valid(client_snapshot)),
  business_snapshot TEXT CHECK (business_snapshot IS NULL OR json_valid(business_snapshot)),
  pdf_file_id TEXT REFERENCES files(id),
  last_reminder_at TEXT,
  reminder_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (status = 'draft' OR status = 'void' OR number IS NOT NULL)
);
CREATE INDEX idx_invoices_status_due ON invoices(status, due_date);
CREATE INDEX idx_invoices_client ON invoices(client_id, created_at);
CREATE INDEX idx_invoices_project ON invoices(project_id);
CREATE INDEX idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX idx_invoices_issued ON invoices(issued_at);

CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  position INTEGER NOT NULL,
  service_id TEXT REFERENCES services(id),
  package_id TEXT REFERENCES service_packages(id),
  description TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  discount_type TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none','percent','amount')),
  discount_value INTEGER NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  tax_rate_id TEXT REFERENCES tax_rates(id),
  tax_rate_bp INTEGER NOT NULL DEFAULT 0 CHECK (tax_rate_bp BETWEEN 0 AND 10000),
  tax_inclusive INTEGER NOT NULL DEFAULT 0 CHECK (tax_inclusive IN (0,1)),
  period_start TEXT, period_end TEXT,
  line_subtotal_minor INTEGER NOT NULL, line_discount_minor INTEGER NOT NULL,
  line_tax_minor INTEGER NOT NULL, line_total_minor INTEGER NOT NULL
);
CREATE INDEX idx_invoice_items_inv ON invoice_items(invoice_id, position);
-- Issued invoice lines are immutable (corrections go through credit notes).
CREATE TRIGGER trg_invoice_items_locked_update BEFORE UPDATE ON invoice_items
WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) <> 'draft'
BEGIN SELECT RAISE(ABORT, 'invoice lines are immutable after issue'); END;
CREATE TRIGGER trg_invoice_items_locked_delete BEFORE DELETE ON invoice_items
WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) <> 'draft'
BEGIN SELECT RAISE(ABORT, 'invoice lines are immutable after issue'); END;
CREATE TRIGGER trg_invoice_items_locked_insert BEFORE INSERT ON invoice_items
WHEN (SELECT status FROM invoices WHERE id = NEW.invoice_id) <> 'draft'
BEGIN SELECT RAISE(ABORT, 'invoice lines are immutable after issue'); END;
CREATE TRIGGER trg_invoices_no_delete BEFORE DELETE ON invoices
WHEN OLD.status <> 'draft' OR OLD.number IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'issued invoices cannot be deleted'); END;

CREATE TABLE invoice_status_history (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  from_status TEXT, to_status TEXT NOT NULL,
  reason TEXT,
  actor_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_invoice_status_history_inv ON invoice_status_history(invoice_id, created_at);

CREATE TABLE credit_notes (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  client_id TEXT NOT NULL REFERENCES clients(id),
  currency TEXT NOT NULL REFERENCES currencies(code),
  reason TEXT NOT NULL,
  subtotal_minor INTEGER NOT NULL, tax_minor INTEGER NOT NULL,
  total_minor INTEGER NOT NULL CHECK (total_minor > 0),
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','void')),
  applied_to TEXT NOT NULL CHECK (applied_to IN ('invoice','client_credit','refund')),
  pdf_file_id TEXT REFERENCES files(id),
  public_token_hash TEXT UNIQUE,
  issued_by TEXT REFERENCES users(id),
  issued_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_credit_notes_invoice ON credit_notes(invoice_id);
CREATE INDEX idx_credit_notes_client ON credit_notes(client_id, issued_at);
CREATE TRIGGER trg_credit_notes_no_delete BEFORE DELETE ON credit_notes
BEGIN SELECT RAISE(ABORT, 'credit notes cannot be deleted'); END;

CREATE TABLE credit_note_items (
  id TEXT PRIMARY KEY,
  credit_note_id TEXT NOT NULL REFERENCES credit_notes(id),
  invoice_item_id TEXT REFERENCES invoice_items(id),
  description TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  tax_rate_bp INTEGER NOT NULL DEFAULT 0,
  line_tax_minor INTEGER NOT NULL DEFAULT 0,
  line_total_minor INTEGER NOT NULL
);
CREATE INDEX idx_credit_note_items_cn ON credit_note_items(credit_note_id);

CREATE TABLE invoice_reminders (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  kind TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  outbox_id TEXT REFERENCES outbox(id),
  UNIQUE (invoice_id, kind)
);
