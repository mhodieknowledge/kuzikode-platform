/**
 * Expenses (P4.13, PRD §4.2 G): expense records with category, amount (minor units + currency), optional
 * project/client link and a receipt file in R2. Records are never deleted: a mistake is voided with a reason.
 * Reports group by category and month per currency; CSV exports carry the "not a statutory accounting system" label.
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt, auditWhen } from '../../lib/audit';
import { conflict, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { assertCan } from '../../lib/policies';
import { minorToDecimalString } from '../../../shared/money';
import type { ExpenseInput, ExpenseListQuery } from '../../../shared/schemas/expenses';
import { storeUpload } from '../files/service';

export const PAGE_SIZE = 25;
export const EXPENSE_DISCLAIMER = 'Expense records. This is not a statutory accounting system.';

export interface ExpenseRow {
  id: string;
  category_id: string;
  expense_date: string;
  vendor: string | null;
  description: string;
  amount_minor: number;
  currency: string;
  payment_method: string | null;
  reference: string | null;
  project_id: string | null;
  client_id: string | null;
  receipt_file_id: string | null;
  notes: string | null;
  status: 'recorded' | 'void';
  void_reason: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

function filterSql(f: Omit<ExpenseListQuery, 'page'>) {
  const where: string[] = [];
  const params: unknown[] = [];
  const status = f.status ?? 'recorded';
  if (status !== 'all') {
    where.push('e.status = ?');
    params.push(status);
  }
  const eq = (col: string, v: unknown) => {
    if (v === undefined) return;
    where.push(`${col} = ?`);
    params.push(v);
  };
  eq('e.category_id', f.categoryId);
  eq('e.currency', f.currency);
  eq('e.project_id', f.projectId);
  eq('e.client_id', f.clientId);
  if (f.from) {
    where.push('e.expense_date >= ?');
    params.push(f.from);
  }
  if (f.to) {
    where.push('e.expense_date <= ?');
    params.push(f.to);
  }
  if (f.q?.trim()) {
    const l = `%${f.q
      .trim()
      .slice(0, 80)
      .replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push("(e.description LIKE ? ESCAPE '\\' OR e.vendor LIKE ? ESCAPE '\\' OR e.reference LIKE ? ESCAPE '\\')");
    params.push(l, l, l);
  }
  return { w: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

const SELECT = `SELECT e.*, c.name AS category, p.reference AS project_reference, p.name AS project_name,
  cl.display_name AS client_name
  FROM expenses e JOIN expense_categories c ON c.id = e.category_id
  LEFT JOIN projects p ON p.id = e.project_id LEFT JOIN clients cl ON cl.id = e.client_id`;

export type ExpenseListItem = ExpenseRow & {
  category: string;
  project_reference: string | null;
  project_name: string | null;
  client_name: string | null;
};

export async function listExpenses(ctx: RequestContext, f: ExpenseListQuery) {
  assertCan(ctx, 'expenses.view');
  const { w, params } = filterSql(f);
  const [count, rows, totals] = await ctx.db.batch([
    ctx.db.prepare(`SELECT COUNT(*) AS n FROM expenses e ${w}`).bind(...params),
    ctx.db
      .prepare(`${SELECT} ${w} ORDER BY e.expense_date DESC, e.created_at DESC LIMIT ? OFFSET ?`)
      .bind(...params, PAGE_SIZE, (f.page - 1) * PAGE_SIZE),
    ctx.db
      .prepare(
        `SELECT e.currency, SUM(e.amount_minor) AS total, COUNT(*) AS n FROM expenses e ${w} GROUP BY e.currency ORDER BY e.currency`,
      )
      .bind(...params),
  ]);
  const total = ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  return {
    total,
    page: f.page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    totals: (totals?.results ?? []) as { currency: string; total: number; n: number }[],
    items: (rows?.results ?? []) as ExpenseListItem[],
  };
}

export async function getExpense(ctx: RequestContext, id: string) {
  assertCan(ctx, 'expenses.view');
  const e = await ctx.db.prepare(`${SELECT} WHERE e.id = ?`).bind(id).first<ExpenseListItem>();
  if (!e) throw notFound();
  const recorder = await ctx.db
    .prepare('SELECT name FROM users WHERE id = ?')
    .bind(e.recorded_by ?? '')
    .first<{ name: string }>();
  return { expense: e, recordedBy: recorder?.name ?? null };
}

async function checkRefs(ctx: RequestContext, input: ExpenseInput) {
  const [cat, cur, prj, cli] = await ctx.db.batch([
    ctx.db.prepare('SELECT id FROM expense_categories WHERE id = ? AND active = 1').bind(input.categoryId),
    ctx.db.prepare('SELECT code FROM currencies WHERE code = ? AND active = 1').bind(input.currency),
    ctx.db.prepare('SELECT id, client_id FROM projects WHERE id = ?').bind(input.projectId ?? ''),
    ctx.db.prepare('SELECT id FROM clients WHERE id = ?').bind(input.clientId ?? ''),
  ]);
  const fields: Record<string, string[]> = {};
  if (!(cat?.results ?? []).length) fields['categoryId'] = ['Choose an active category.'];
  if (!(cur?.results ?? []).length) fields['currency'] = ['Choose an active currency.'];
  const project = (prj?.results ?? [])[0] as { id: string; client_id: string } | undefined;
  if (input.projectId && !project) fields['projectId'] = ['Choose an existing project.'];
  if (input.clientId && !(cli?.results ?? []).length) fields['clientId'] = ['Choose an existing client.'];
  if (project && input.clientId && project.client_id !== input.clientId)
    fields['clientId'] = ['The project belongs to another client.'];
  if (Object.keys(fields).length) throw validationError(fields);
  // A project implies its client.
  return { clientId: input.clientId ?? project?.client_id ?? null };
}

export async function createExpense(ctx: RequestContext, input: ExpenseInput): Promise<{ id: string }> {
  assertCan(ctx, 'expenses.manage');
  const { clientId } = await checkRefs(ctx, input);
  const id = newId('exp', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO expenses (id, category_id, expense_date, vendor, description, amount_minor, currency, payment_method, reference,
           project_id, client_id, notes, status, recorded_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recorded', ?, ?, ?)`,
        id,
        input.categoryId,
        input.expenseDate,
        input.vendor,
        input.description,
        input.amountMinor,
        input.currency,
        input.paymentMethod ?? null,
        input.reference,
        input.projectId ?? null,
        clientId,
        input.notes,
        ctx.actor.userId,
        now,
        now,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'expense.recorded',
        entityType: 'expense',
        entityId: id,
        after: { amountMinor: input.amountMinor, currency: input.currency, categoryId: input.categoryId },
      }),
    )
    .run();
  return { id };
}

export async function updateExpense(ctx: RequestContext, id: string, input: ExpenseInput): Promise<void> {
  assertCan(ctx, 'expenses.manage');
  const before = await ctx.db.prepare('SELECT * FROM expenses WHERE id = ?').bind(id).first<ExpenseRow>();
  if (!before) throw notFound();
  if (before.status === 'void') throw conflict('Void expenses cannot be edited.');
  const { clientId } = await checkRefs(ctx, input);
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE expenses SET category_id = ?, expense_date = ?, vendor = ?, description = ?, amount_minor = ?, currency = ?,
           payment_method = ?, reference = ?, project_id = ?, client_id = ?, notes = ?, updated_at = ?
         WHERE id = ? AND status = 'recorded'`,
        input.categoryId,
        input.expenseDate,
        input.vendor,
        input.description,
        input.amountMinor,
        input.currency,
        input.paymentMethod ?? null,
        input.reference,
        input.projectId ?? null,
        clientId,
        input.notes,
        ctx.now().toISOString(),
        id,
      ),
      'update',
    )
    .add(
      auditStmt(ctx, {
        action: 'expense.updated',
        entityType: 'expense',
        entityId: id,
        before: { amountMinor: before.amount_minor, currency: before.currency, categoryId: before.category_id },
        after: { amountMinor: input.amountMinor, currency: input.currency, categoryId: input.categoryId },
      }),
    )
    .run();
  if (res.changes('update') !== 1) throw conflict('Void expenses cannot be edited.');
}

export async function voidExpense(ctx: RequestContext, id: string, reason: string): Promise<void> {
  assertCan(ctx, 'expenses.manage');
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        "UPDATE expenses SET status = 'void', void_reason = ?, updated_at = ? WHERE id = ? AND status = 'recorded'",
        reason,
        now,
        id,
      ),
      'void',
    )
    .add(
      auditWhen(
        ctx,
        { action: 'expense.voided', entityType: 'expense', entityId: id, after: { reason } },
        "EXISTS (SELECT 1 FROM expenses WHERE id = ? AND status = 'void' AND updated_at = ?)",
        id,
        now,
      ),
    )
    .run();
  if (res.changes('void') !== 1) {
    const exists = await ctx.db.prepare('SELECT id FROM expenses WHERE id = ?').bind(id).first();
    if (!exists) throw notFound();
    throw conflict('This expense is already void.');
  }
}

/** Attaches (or replaces) the receipt. The previous receipt file stays in R2 for the audit trail. */
export async function attachReceipt(
  ctx: RequestContext,
  id: string,
  file: { bytes: Uint8Array<ArrayBuffer>; filename: string },
): Promise<{ fileId: string }> {
  assertCan(ctx, 'expenses.manage');
  const e = await ctx.db
    .prepare('SELECT id, status, receipt_file_id FROM expenses WHERE id = ?')
    .bind(id)
    .first<ExpenseRow>();
  if (!e) throw notFound();
  if (e.status === 'void') throw conflict('Void expenses cannot be changed.');
  const stored = await storeUpload(ctx, {
    bytes: file.bytes,
    filename: file.filename,
    purpose: 'receipt',
    ownerType: 'expense',
    ownerId: id,
  });
  await new Batch(ctx.db)
    .add(stored.stmt)
    .add(
      stmt(
        ctx.db,
        'UPDATE expenses SET receipt_file_id = ?, updated_at = ? WHERE id = ?',
        stored.id,
        ctx.now().toISOString(),
        id,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'expense.receipt_attached',
        entityType: 'expense',
        entityId: id,
        before: { fileId: e.receipt_file_id },
        after: { fileId: stored.id },
      }),
    )
    .run();
  return { fileId: stored.id };
}

// ---------------------------------------------------------------- categories

export async function listCategories(ctx: RequestContext) {
  assertCan(ctx, 'expenses.view');
  const { results } = await ctx.db
    .prepare(
      `SELECT c.id, c.name, c.description, c.active, (SELECT COUNT(*) FROM expenses e WHERE e.category_id = c.id) AS used
       FROM expense_categories c ORDER BY c.active DESC, c.name`,
    )
    .all<{ id: string; name: string; description: string | null; active: number; used: number }>();
  return results;
}

export async function saveCategory(
  ctx: RequestContext,
  id: string | null,
  input: { name: string; description: string | null; active: boolean },
): Promise<{ id: string }> {
  assertCan(ctx, 'expenses.manage');
  const dupe = await ctx.db
    .prepare('SELECT id FROM expense_categories WHERE lower(name) = lower(?) AND id <> ?')
    .bind(input.name, id ?? '')
    .first();
  if (dupe) throw validationError({ name: ['A category with this name exists.'] });
  const cid = id ?? newId('exc', ctx.now().getTime());
  const res = await new Batch(ctx.db)
    .add(
      id
        ? stmt(
            ctx.db,
            'UPDATE expense_categories SET name = ?, description = ?, active = ? WHERE id = ?',
            input.name,
            input.description,
            input.active ? 1 : 0,
            id,
          )
        : stmt(
            ctx.db,
            'INSERT INTO expense_categories (id, name, description, active) VALUES (?, ?, ?, ?)',
            cid,
            input.name,
            input.description,
            input.active ? 1 : 0,
          ),
      'save',
    )
    .add(
      auditStmt(ctx, {
        action: id ? 'expense_category.updated' : 'expense_category.created',
        entityType: 'expense_category',
        entityId: cid,
        after: input,
      }),
    )
    .run();
  if (res.changes('save') !== 1) throw notFound();
  return { id: cid };
}

/** Unused categories can be deleted; used ones can only be deactivated (records keep their category). */
export async function deleteCategory(ctx: RequestContext, id: string): Promise<void> {
  assertCan(ctx, 'expenses.manage');
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'DELETE FROM expense_categories WHERE id = ? AND NOT EXISTS (SELECT 1 FROM expenses WHERE category_id = ?)',
        id,
        id,
      ),
      'delete',
    )
    .add(auditStmt(ctx, { action: 'expense_category.deleted', entityType: 'expense_category', entityId: id }))
    .run();
  if (res.changes('delete') !== 1) throw conflict('This category is used by expenses. Deactivate it instead.');
}

// ---------------------------------------------------------------- reports & export

/** Totals by category and by month (YYYY-MM), per currency, for recorded expenses in the range. */
export async function expenseReport(
  ctx: RequestContext,
  range: { from?: string | undefined; to?: string | undefined },
) {
  assertCan(ctx, 'expenses.view');
  const { w, params } = filterSql({ status: 'recorded', from: range.from, to: range.to });
  const [byCategory, byMonth, totals] = await ctx.db.batch([
    ctx.db
      .prepare(
        `SELECT c.name AS category, e.currency, SUM(e.amount_minor) AS total, COUNT(*) AS n
         FROM expenses e JOIN expense_categories c ON c.id = e.category_id ${w}
         GROUP BY c.name, e.currency ORDER BY e.currency, total DESC`,
      )
      .bind(...params),
    ctx.db
      .prepare(
        `SELECT substr(e.expense_date, 1, 7) AS month, e.currency, SUM(e.amount_minor) AS total, COUNT(*) AS n
         FROM expenses e ${w} GROUP BY month, e.currency ORDER BY month DESC, e.currency`,
      )
      .bind(...params),
    ctx.db
      .prepare(
        `SELECT e.currency, SUM(e.amount_minor) AS total, COUNT(*) AS n FROM expenses e ${w} GROUP BY e.currency ORDER BY e.currency`,
      )
      .bind(...params),
  ]);
  return {
    byCategory: (byCategory?.results ?? []) as { category: string; currency: string; total: number; n: number }[],
    byMonth: (byMonth?.results ?? []) as { month: string; currency: string; total: number; n: number }[],
    totals: (totals?.results ?? []) as { currency: string; total: number; n: number }[],
  };
}

/** RFC 4180 cell; values that a spreadsheet would run as a formula are prefixed with an apostrophe. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportCsv(ctx: RequestContext, f: Omit<ExpenseListQuery, 'page'>): Promise<string> {
  assertCan(ctx, 'expenses.view');
  const { w, params } = filterSql(f);
  const { results } = await ctx.db
    .prepare(`${SELECT} ${w} ORDER BY e.expense_date, e.created_at LIMIT 20000`)
    .bind(...params)
    .all<ExpenseListItem>();
  const digits = new Map(
    (
      await ctx.db.prepare('SELECT code, minor_digits FROM currencies').all<{ code: string; minor_digits: number }>()
    ).results.map((c) => [c.code, c.minor_digits]),
  );
  const header = [
    'Date',
    'Category',
    'Vendor',
    'Description',
    'Amount',
    'Currency',
    'Payment method',
    'Reference',
    'Project',
    'Client',
    'Status',
    'Void reason',
  ];
  const lines = [
    csvCell(EXPENSE_DISCLAIMER),
    header.map(csvCell).join(','),
    ...results.map((e) =>
      [
        e.expense_date,
        e.category,
        e.vendor,
        e.description,
        minorToDecimalString(e.amount_minor, digits.get(e.currency) ?? 2),
        e.currency,
        e.payment_method,
        e.reference,
        e.project_reference,
        e.client_name,
        e.status,
        e.void_reason,
      ]
        .map(csvCell)
        .join(','),
    ),
  ];
  await auditStmt(ctx, {
    action: 'expense.exported',
    entityType: 'expense',
    after: { rows: results.length },
  }).run();
  return `${lines.join('\r\n')}\r\n`;
}

/** Choices for the expense form. */
export async function formOptions(ctx: RequestContext) {
  assertCan(ctx, 'expenses.manage');
  const [categories, currencies, projects, clients] = await ctx.db.batch([
    ctx.db.prepare('SELECT id, name FROM expense_categories WHERE active = 1 ORDER BY name'),
    ctx.db.prepare('SELECT code, minor_digits FROM currencies WHERE active = 1 ORDER BY is_default DESC, code'),
    ctx.db.prepare(
      "SELECT id, reference || ' · ' || name AS label FROM projects WHERE status IN ('planning','active','on_hold') ORDER BY reference DESC LIMIT 500",
    ),
    ctx.db.prepare(
      "SELECT id, display_name AS name FROM clients WHERE status = 'active' ORDER BY display_name LIMIT 2000",
    ),
  ]);
  return {
    categories: (categories?.results ?? []) as { id: string; name: string }[],
    currencies: (currencies?.results ?? []) as { code: string; minor_digits: number }[],
    projects: (projects?.results ?? []) as { id: string; label: string }[],
    clients: (clients?.results ?? []) as { id: string; name: string }[],
  };
}
