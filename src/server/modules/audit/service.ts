/**
 * Audit log viewer, CSV export and full data export (P4.18, PRD §4.2 K). Staff with `audit.view` but without
 * `users.manage` (Finance) see finance entities only (docs/07 §5). Data export (`data.export`, Super Admin) returns
 * every business table per module as JSON or one table as CSV, with secret-bearing tables left out and secret-looking
 * columns removed. Every export writes an audit row.
 */
import type { RequestContext } from '../../context';
import { auditStmt } from '../../lib/audit';
import { toCsv } from '../../lib/csv';
import { notFound } from '../../lib/errors';
import { assertCan, can } from '../../lib/policies';
import type { AuditQuery } from '../../../shared/schemas/reports';

export const FINANCE_ENTITIES = [
  'invoice',
  'credit_note',
  'payment',
  'refund',
  'quotation',
  'expense',
  'subscription',
  'report',
  'time_entry',
  'project',
] as const;

export const AUDIT_PAGE_SIZE = 50;
const HARARE = '+2 hours';

function auditWhere(ctx: RequestContext, q: Omit<AuditQuery, 'page'>) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (!can(ctx, 'users.manage')) {
    where.push(`a.entity_type IN (${FINANCE_ENTITIES.map(() => '?').join(', ')})`);
    params.push(...FINANCE_ENTITIES);
  }
  if (q.actor) {
    where.push('a.actor_user_id = ?');
    params.push(q.actor);
  }
  if (q.entityType) {
    where.push('a.entity_type = ?');
    params.push(q.entityType);
  }
  if (q.entityId) {
    where.push('a.entity_id = ?');
    params.push(q.entityId);
  }
  if (q.action) {
    // "invoice." matches every invoice action; a full name matches exactly.
    if (q.action.endsWith('.')) {
      where.push('a.action LIKE ?');
      params.push(`${q.action}%`);
    } else {
      where.push('a.action = ?');
      params.push(q.action);
    }
  }
  if (q.from) {
    where.push(`date(datetime(a.created_at, '${HARARE}')) >= ?`);
    params.push(q.from);
  }
  if (q.to) {
    where.push(`date(datetime(a.created_at, '${HARARE}')) <= ?`);
    params.push(q.to);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export interface AuditRow {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_type: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before: string | null;
  after: string | null;
  ip: string | null;
  request_id: string | null;
}

const SELECT = `SELECT a.id, a.created_at, a.actor_user_id, u.name AS actor_name, a.actor_type, a.action, a.entity_type,
  a.entity_id, a.before, a.after, a.ip, a.request_id FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id`;

export async function listAudit(ctx: RequestContext, q: AuditQuery) {
  assertCan(ctx, 'audit.view');
  const w = auditWhere(ctx, q);
  const { results } = await ctx.db
    .prepare(`${SELECT} ${w.sql} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`)
    .bind(...w.params, AUDIT_PAGE_SIZE + 1, (q.page - 1) * AUDIT_PAGE_SIZE)
    .all<AuditRow>();
  return {
    items: results.slice(0, AUDIT_PAGE_SIZE),
    hasMore: results.length > AUDIT_PAGE_SIZE,
    financeOnly: !can(ctx, 'users.manage'),
  };
}

/** Filter options for the viewer: actors and entity types present in the log (scoped like the list). */
export async function auditFilters(ctx: RequestContext) {
  assertCan(ctx, 'audit.view');
  const w = auditWhere(ctx, {});
  const [actors, types] = await Promise.all([
    ctx.db
      .prepare(
        `SELECT DISTINCT a.actor_user_id AS id, u.name FROM audit_logs a JOIN users u ON u.id = a.actor_user_id ${w.sql} ORDER BY u.name LIMIT 500`,
      )
      .bind(...w.params)
      .all<{ id: string; name: string }>(),
    ctx.db
      .prepare(
        `SELECT DISTINCT a.entity_type AS t FROM audit_logs a ${w.sql} ${w.sql ? 'AND' : 'WHERE'} a.entity_type IS NOT NULL ORDER BY t`,
      )
      .bind(...w.params)
      .all<{ t: string }>(),
  ]);
  return { actors: actors.results, entityTypes: types.results.map((t) => t.t) };
}

export async function exportAuditCsv(ctx: RequestContext, q: Omit<AuditQuery, 'page'>): Promise<string> {
  assertCan(ctx, 'audit.view');
  const w = auditWhere(ctx, q);
  const { results } = await ctx.db
    .prepare(`${SELECT} ${w.sql} ORDER BY a.created_at, a.id LIMIT 50000`)
    .bind(...w.params)
    .all<AuditRow>();
  await auditStmt(ctx, {
    action: 'audit.exported',
    entityType: 'audit_log',
    entityId: 'export',
    after: { ...q, rows: results.length },
  }).run();
  return toCsv([
    ['Time (UTC)', 'Actor', 'Actor type', 'Action', 'Entity type', 'Entity id', 'Before', 'After', 'IP', 'Request id'],
    ...results.map((r) => [
      r.created_at,
      r.actor_name ?? r.actor_user_id ?? '',
      r.actor_type,
      r.action,
      r.entity_type,
      r.entity_id,
      r.before,
      r.after,
      r.ip,
      r.request_id,
    ]),
  ]);
}

// ---------------------------------------------------------------- data export

/** Business tables per module. Tables holding credentials or session secrets are never exported. */
export const EXPORT_MODULES: Record<string, { label: string; tables: string[] }> = {
  clients: {
    label: 'Clients',
    tables: ['clients', 'client_contacts', 'client_notes', 'client_credits', 'client_user_access'],
  },
  sales: {
    label: 'Leads, enquiries & quotations',
    tables: ['enquiries', 'leads', 'lead_services', 'lead_activities', 'quotations', 'quotation_items'],
  },
  invoicing: {
    label: 'Invoices & credit notes',
    tables: [
      'invoices',
      'invoice_items',
      'invoice_status_history',
      'credit_notes',
      'credit_note_items',
      'invoice_reminders',
    ],
  },
  payments: {
    label: 'Payments',
    tables: ['payments', 'payment_allocations', 'payment_attempts', 'refunds', 'payment_routes'],
  },
  projects: {
    label: 'Projects & time',
    tables: [
      'projects',
      'project_members',
      'project_milestones',
      'project_tasks',
      'project_updates',
      'project_messages',
      'project_files',
      'time_entries',
    ],
  },
  expenses: { label: 'Expenses', tables: ['expense_categories', 'expenses'] },
  support: { label: 'Support', tables: ['support_requests', 'support_messages', 'support_attachments'] },
  subscriptions: {
    label: 'Subscriptions & managed services',
    tables: ['subscriptions', 'subscription_periods', 'client_assets', 'asset_reminders'],
  },
  catalogue: {
    label: 'Services & packages',
    tables: ['service_categories', 'services', 'service_packages', 'package_features', 'package_addons'],
  },
  website: {
    label: 'Website content',
    tables: [
      'website_pages',
      'website_sections',
      'portfolio_projects',
      'portfolio_media',
      'products',
      'announcements',
      'team_members',
      'post_categories',
      'posts',
      'post_tags',
      'post_tag_links',
      'industries',
      'industry_services',
      'faqs',
      'testimonials',
      'technologies',
      'media_assets',
      'newsletter_subscribers',
    ],
  },
  careers: { label: 'Careers', tables: ['job_postings', 'job_applications', 'job_application_events'] },
  staff: { label: 'Staff & roles', tables: ['users', 'roles', 'role_permissions', 'user_roles'] },
  system: {
    label: 'Settings, files & logs',
    tables: [
      'application_settings',
      'currencies',
      'tax_rates',
      'sequences',
      'files',
      'notifications',
      'notification_preferences',
      'email_logs',
      'audit_logs',
    ],
  },
};

/** Columns never exported, whatever the table: hashes, tokens, secrets, encrypted values, raw provider payloads. */
const SECRET_COLUMN = /(hash|secret|token|password|cipher|encrypted|credential|_iv$|^iv$|otp|raw_|payload|signature)/i;

const safeTable = (module: string, table: string) => {
  const m = EXPORT_MODULES[module];
  if (!m || !m.tables.includes(table)) throw notFound();
  return table;
};

async function tableRows(ctx: RequestContext, table: string) {
  // `table` is from the fixed whitelist above, never from user input directly.
  const { results } = await ctx.db.prepare(`SELECT * FROM ${table} LIMIT 50000`).all<Record<string, unknown>>();
  return results.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !SECRET_COLUMN.test(k))));
}

export async function exportModuleJson(ctx: RequestContext, module: string) {
  assertCan(ctx, 'data.export');
  const m = EXPORT_MODULES[module];
  if (!m) throw notFound();
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of m.tables) tables[t] = await tableRows(ctx, t);
  await auditStmt(ctx, {
    action: 'data.exported',
    entityType: 'data_export',
    entityId: module,
    after: { format: 'json', tables: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])) },
  }).run();
  return { module, exportedAt: ctx.now().toISOString(), tables };
}

export async function exportTableCsv(ctx: RequestContext, module: string, table: string): Promise<string> {
  assertCan(ctx, 'data.export');
  const rows = await tableRows(ctx, safeTable(module, table));
  await auditStmt(ctx, {
    action: 'data.exported',
    entityType: 'data_export',
    entityId: `${module}.${table}`,
    after: { format: 'csv', rows: rows.length },
  }).run();
  if (rows.length === 0) return toCsv([['(no rows)']]);
  const cols = Object.keys(rows[0]!);
  return toCsv([cols, ...rows.map((r) => cols.map((c) => r[c]))]);
}
