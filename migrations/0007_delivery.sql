-- Migration 0007: delivery. Generated from docs/04-DATABASE.md. Never edit after it has been applied; add a new migration.
-- 0007 delivery: projects, expenses, support, time --------------------------------------
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients(id),
  source_quotation_id TEXT UNIQUE REFERENCES quotations(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  start_date TEXT, target_date TEXT, completed_at TEXT,
  budget_minor INTEGER CHECK (budget_minor IS NULL OR budget_minor >= 0),
  currency TEXT REFERENCES currencies(code),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  progress_mode TEXT NOT NULL DEFAULT 'auto' CHECK (progress_mode IN ('auto','manual')),
  internal_notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (budget_minor IS NULL OR currency IS NOT NULL)
);
CREATE INDEX idx_projects_client ON projects(client_id, status);
CREATE INDEX idx_projects_status ON projects(status, target_date);

CREATE TABLE project_members (
  project_id TEXT NOT NULL REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead','member')),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX idx_project_members_user ON project_members(user_id);

CREATE TABLE project_milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  client_visible INTEGER NOT NULL DEFAULT 1 CHECK (client_visible IN (0,1)),
  position INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  invoice_id TEXT REFERENCES invoices(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_milestones_project ON project_milestones(project_id, position);
CREATE INDEX idx_milestones_due ON project_milestones(status, due_date);

CREATE TABLE project_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  milestone_id TEXT REFERENCES project_milestones(id),
  title TEXT NOT NULL,
  description TEXT,
  assignee_id TEXT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  due_date TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_tasks_project ON project_tasks(project_id, status, position);
CREATE INDEX idx_tasks_assignee ON project_tasks(assignee_id, status);

CREATE TABLE project_updates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('internal','client')),
  notified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_project_updates_project ON project_updates(project_id, visibility, created_at);

CREATE TABLE project_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  file_id TEXT NOT NULL REFERENCES files(id),
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('deliverable','attachment','internal')),
  client_visible INTEGER NOT NULL DEFAULT 0 CHECK (client_visible IN (0,1)),
  uploaded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_project_files_project ON project_files(project_id, client_visible);

CREATE TABLE project_messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  author_user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  read_by_staff_at TEXT, read_by_client_at TEXT
);
CREATE INDEX idx_project_messages_project ON project_messages(project_id, created_at);

CREATE TABLE expense_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES expense_categories(id),
  expense_date TEXT NOT NULL,
  vendor TEXT,
  description TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL REFERENCES currencies(code),
  payment_method TEXT, reference TEXT,
  project_id TEXT REFERENCES projects(id),
  client_id TEXT REFERENCES clients(id),
  receipt_file_id TEXT REFERENCES files(id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded','void')),
  void_reason TEXT,
  recorded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_expenses_date ON expenses(status, expense_date);
CREATE INDEX idx_expenses_category ON expenses(category_id, expense_date);
CREATE INDEX idx_expenses_project ON expenses(project_id);

CREATE TABLE support_requests (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL REFERENCES clients(id),
  opened_by TEXT NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','awaiting_client','resolved','closed')),
  assigned_to TEXT REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  last_message_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_support_client ON support_requests(client_id, status);
CREATE INDEX idx_support_status ON support_requests(status, updated_at);
CREATE INDEX idx_support_assigned ON support_requests(assigned_to, status);

CREATE TABLE support_messages (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES support_requests(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  is_internal_note INTEGER NOT NULL DEFAULT 0 CHECK (is_internal_note IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_support_messages_req ON support_messages(request_id, created_at);

CREATE TABLE support_attachments (
  message_id TEXT NOT NULL REFERENCES support_messages(id),
  file_id TEXT NOT NULL REFERENCES files(id),
  PRIMARY KEY (message_id, file_id)
);

CREATE TABLE time_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  task_id TEXT REFERENCES project_tasks(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  entry_date TEXT NOT NULL,
  minutes INTEGER CHECK (minutes IS NULL OR minutes > 0),
  description TEXT,
  billable INTEGER NOT NULL DEFAULT 1 CHECK (billable IN (0,1)),
  rate_minor INTEGER CHECK (rate_minor IS NULL OR rate_minor >= 0),
  currency TEXT REFERENCES currencies(code),
  invoice_id TEXT REFERENCES invoices(id),
  invoice_item_id TEXT REFERENCES invoice_items(id),
  timer_started_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (minutes IS NOT NULL OR timer_started_at IS NOT NULL)
);
CREATE INDEX idx_time_project ON time_entries(project_id, entry_date);
CREATE INDEX idx_time_user ON time_entries(user_id, entry_date);
CREATE INDEX idx_time_unbilled ON time_entries(project_id, billable, invoice_id);
CREATE UNIQUE INDEX uq_time_running_timer ON time_entries(user_id) WHERE timer_started_at IS NOT NULL;
