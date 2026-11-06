/**
 * Settings administration (P4.3, PRD §4.2 K). Every change is audited in the same batch and bumps content_version
 * so cached public pages pick it up.
 */
import { isNotificationType, NOTIFICATION_TYPES } from '../../../shared/notifications';
import { NUMBERING_KINDS, SETTING_SECTIONS, sectionSchema, type NumberingKind } from '../../../shared/settings';
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt, auditWhen } from '../../lib/audit';
import { businessYear } from '../../lib/dates';
import { conflict, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { assertCan } from '../../lib/policies';
import { parseFormat, renderNumber, sequenceKey } from '../../lib/sequences';
import { zodIssuesToFields } from '../../lib/errors';
import { dispatch, enqueue } from '../../jobs/outbox';
import { bumpContentVersionStmt, resetCmsCache } from '../cms';

async function readKeys(ctx: RequestContext, keys: string[]): Promise<Record<string, unknown>> {
  const { results } = await ctx.db
    .prepare('SELECT key, value FROM application_settings WHERE key IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(keys))
    .all<{ key: string; value: string }>();
  return Object.fromEntries(results.map((r) => [r.key, JSON.parse(r.value) as unknown]));
}

const upsertStmt = (ctx: RequestContext, key: string, value: unknown) =>
  stmt(
    ctx.db,
    `INSERT INTO application_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    ctx.actor.userId,
    ctx.now().toISOString(),
  );

/** Current values for every section on a settings page. */
export async function settingsPage(ctx: RequestContext, page: 'general' | 'billing' | 'website') {
  assertCan(ctx, 'settings.view');
  const sections = SETTING_SECTIONS.filter((s) => s.page === page);
  const values = await readKeys(
    ctx,
    sections.flatMap((s) => s.fields.map((f) => f.key)),
  );
  return sections.map((s) => ({
    ...s,
    values: Object.fromEntries(s.fields.map((f) => [f.key, values[f.key] ?? null])),
  }));
}

/** Saves one section. Only changed keys are written; returns the keys that changed. */
export async function updateSection(ctx: RequestContext, sectionId: string, input: unknown): Promise<string[]> {
  assertCan(ctx, 'settings.manage');
  const schema = sectionSchema(sectionId);
  if (!schema) throw notFound();
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw validationError(zodIssuesToFields(parsed.error.issues));
  const next = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
  const current = await readKeys(ctx, Object.keys(next));
  const changed = Object.keys(next).filter((k) => JSON.stringify(current[k] ?? null) !== JSON.stringify(next[k]));
  if (changed.length === 0) return [];
  await new Batch(ctx.db)
    .addAll(changed.map((k) => upsertStmt(ctx, k, next[k])))
    .add(bumpContentVersionStmt(ctx.db))
    .add(
      auditStmt(ctx, {
        action: 'settings.updated',
        entityType: 'settings',
        entityId: sectionId,
        before: Object.fromEntries(changed.map((k) => [k, current[k] ?? null])),
        after: Object.fromEntries(changed.map((k) => [k, next[k]])),
      }),
    )
    .run();
  resetCmsCache();
  return changed;
}

// ---------------------------------------------------------------- numbering

export interface NumberingRow {
  kind: NumberingKind;
  label: string;
  format: string;
  sequenceKey: string;
  nextValue: number;
  example: string;
}

export async function numbering(ctx: RequestContext): Promise<NumberingRow[]> {
  assertCan(ctx, 'settings.view');
  const year = businessYear(ctx.now());
  const formats = await readKeys(
    ctx,
    NUMBERING_KINDS.map((k) => `numbering.${k.kind}`),
  );
  const rows = NUMBERING_KINDS.map((k) => {
    const format = String(formats[`numbering.${k.kind}`] ?? '');
    return { ...k, format, key: sequenceKey(k.kind, format, year) };
  });
  const { results } = await ctx.db
    .prepare('SELECT key, next_value FROM sequences WHERE key IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(rows.map((r) => r.key)))
    .all<{ key: string; next_value: number }>();
  const next = new Map(results.map((r) => [r.key, r.next_value]));
  return rows.map((r) => ({
    kind: r.kind,
    label: r.label,
    format: r.format,
    sequenceKey: r.key,
    nextValue: next.get(r.key) ?? 1,
    example: renderNumber(r.format, year, next.get(r.key) ?? 1),
  }));
}

/**
 * Changes a document number format and/or raises the next number (PRD §4.2 K: raising is allowed, lowering is not).
 * The guard is in SQL so a concurrent allocation can't be undercut. Super Administrator only (`numbering.manage`).
 */
export async function updateNumbering(
  ctx: RequestContext,
  kind: string,
  input: { format: string; nextValue: number },
): Promise<void> {
  assertCan(ctx, 'numbering.manage');
  if (!NUMBERING_KINDS.some((k) => k.kind === kind)) throw notFound();
  const year = businessYear(ctx.now());
  try {
    parseFormat(input.format, year);
  } catch (err) {
    throw validationError({ format: [err instanceof Error ? err.message : 'Invalid format.'] });
  }
  if (!/^[A-Za-z0-9{}:/_\-. ]{2,40}$/.test(input.format)) {
    throw validationError({ format: ['Use letters, numbers, - / _ . and the {YYYY}, {YY}, {SEQ:n} tokens.'] });
  }
  const before = (await numbering(ctx)).find((r) => r.kind === kind)!;
  const key = sequenceKey(kind, input.format, year);
  // The raise only happens when it does not lower the sequence; the format change and the audit row are conditional
  // on the sequence now holding the requested value, so a rejected change writes nothing at all.
  const applied = 'EXISTS (SELECT 1 FROM sequences WHERE key = ? AND next_value = ?)';
  const res = await new Batch(ctx.db)
    .add(stmt(ctx.db, 'INSERT OR IGNORE INTO sequences (key, next_value) VALUES (?, 1)', key))
    .add(
      stmt(
        ctx.db,
        'UPDATE sequences SET next_value = ? WHERE key = ? AND next_value <= ?',
        input.nextValue,
        key,
        input.nextValue,
      ),
    )
    .add(
      stmt(
        ctx.db,
        `INSERT INTO application_settings (key, value, updated_by, updated_at) SELECT ?, ?, ?, ? WHERE ${applied}
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        `numbering.${kind}`,
        JSON.stringify(input.format),
        ctx.actor.userId,
        ctx.now().toISOString(),
        key,
        input.nextValue,
      ),
      'format',
    )
    .add(
      auditWhen(
        ctx,
        {
          action: 'numbering.updated',
          entityType: 'numbering',
          entityId: kind,
          before: { format: before.format, nextValue: before.nextValue },
          after: { format: input.format, nextValue: input.nextValue },
        },
        applied,
        key,
        input.nextValue,
      ),
    )
    .run();
  if (res.changes('format') !== 1) {
    const current = await ctx.db
      .prepare('SELECT next_value FROM sequences WHERE key = ?')
      .bind(key)
      .first<{ next_value: number }>();
    throw validationError({
      nextValue: [`The next number can't be lowered. It is already ${current?.next_value ?? 1}.`],
    });
  }
}

// ---------------------------------------------------------------- currencies & taxes

export async function listCurrencies(ctx: RequestContext) {
  assertCan(ctx, 'settings.view');
  const { results } = await ctx.db
    .prepare(
      'SELECT code, name, symbol, minor_digits, active, is_default FROM currencies ORDER BY is_default DESC, code',
    )
    .all<{ code: string; name: string; symbol: string; minor_digits: number; active: number; is_default: number }>();
  return results.map((c) => ({
    code: c.code,
    name: c.name,
    symbol: c.symbol,
    active: c.active === 1,
    isDefault: c.is_default === 1,
  }));
}

export async function updateCurrency(
  ctx: RequestContext,
  code: string,
  input: { active: boolean; isDefault: boolean },
) {
  assertCan(ctx, 'settings.manage');
  const all = await listCurrencies(ctx);
  const cur = all.find((c) => c.code === code);
  if (!cur) throw notFound();
  if (input.isDefault && !input.active) throw validationError({ active: ['The default currency must be active.'] });
  if (cur.isDefault && !input.isDefault) throw conflict('Choose another default currency instead.');
  if (cur.isDefault && !input.active) throw conflict('The default currency must stay active.');
  const stmts = [];
  if (input.isDefault && !cur.isDefault) {
    stmts.push(stmt(ctx.db, 'UPDATE currencies SET is_default = 0 WHERE is_default = 1'));
    stmts.push(upsertStmt(ctx, 'currency.default', code));
  }
  stmts.push(
    stmt(
      ctx.db,
      'UPDATE currencies SET active = ?, is_default = ? WHERE code = ?',
      input.active ? 1 : 0,
      input.isDefault ? 1 : 0,
      code,
    ),
  );
  await new Batch(ctx.db)
    .addAll(stmts)
    .add(
      auditStmt(ctx, {
        action: 'currency.updated',
        entityType: 'currency',
        entityId: code,
        before: { active: cur.active, isDefault: cur.isDefault },
        after: input,
      }),
    )
    .run();
}

export async function listTaxRates(ctx: RequestContext) {
  assertCan(ctx, 'settings.view');
  const { results } = await ctx.db
    .prepare(
      `SELECT t.id, t.name, t.rate_bp, t.inclusive, t.active, t.is_default,
         (EXISTS (SELECT 1 FROM quotation_items WHERE tax_rate_id = t.id) OR EXISTS (SELECT 1 FROM invoice_items WHERE tax_rate_id = t.id)) AS used
       FROM tax_rates t ORDER BY t.active DESC, t.name`,
    )
    .all<{
      id: string;
      name: string;
      rate_bp: number;
      inclusive: number;
      active: number;
      is_default: number;
      used: number;
    }>();
  return results.map((t) => ({
    id: t.id,
    name: t.name,
    rateBp: t.rate_bp,
    inclusive: t.inclusive === 1,
    active: t.active === 1,
    isDefault: t.is_default === 1,
    used: t.used === 1,
  }));
}

/** A tax rate's percentage never changes after creation: create a new rate and deactivate the old one. */
export async function createTaxRate(ctx: RequestContext, input: { name: string; rateBp: number; inclusive: boolean }) {
  assertCan(ctx, 'settings.manage');
  const id = newId('tax', ctx.now().getTime());
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'INSERT INTO tax_rates (id, name, rate_bp, inclusive, active, is_default) VALUES (?, ?, ?, ?, 0, 0)',
        id,
        input.name,
        input.rateBp,
        input.inclusive ? 1 : 0,
      ),
    )
    .add(auditStmt(ctx, { action: 'tax_rate.created', entityType: 'tax_rate', entityId: id, after: input }))
    .run();
  return { id };
}

export async function updateTaxRate(
  ctx: RequestContext,
  id: string,
  input: { name: string; active: boolean; isDefault: boolean },
) {
  assertCan(ctx, 'settings.manage');
  const rate = (await listTaxRates(ctx)).find((t) => t.id === id);
  if (!rate) throw notFound();
  if (input.isDefault && !input.active) throw validationError({ active: ['A default tax rate must be active.'] });
  await new Batch(ctx.db)
    .addAll(
      input.isDefault && !rate.isDefault
        ? [stmt(ctx.db, 'UPDATE tax_rates SET is_default = 0 WHERE is_default = 1')]
        : [],
    )
    .add(
      stmt(
        ctx.db,
        "UPDATE tax_rates SET name = ?, active = ?, is_default = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
        input.name,
        input.active ? 1 : 0,
        input.isDefault ? 1 : 0,
        id,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'tax_rate.updated',
        entityType: 'tax_rate',
        entityId: id,
        before: { name: rate.name, active: rate.active, isDefault: rate.isDefault },
        after: input,
      }),
    )
    .run();
}

// ---------------------------------------------------------------- integrations status

const REQUIRED_SECRETS: Record<string, string[]> = {
  paynow: ['INTEGRATION_ID', 'INTEGRATION_KEY'],
  pesepay: ['INTEGRATION_KEY', 'ENCRYPTION_KEY'],
  mock: [],
};

/** Payment accounts and email status. Secrets are never read out: only whether they are configured. */
export async function integrations(ctx: RequestContext) {
  assertCan(ctx, 'settings.view');
  const env = ctx.env as unknown as Record<string, unknown>;
  const configured = (name: string) => typeof env[name] === 'string' && (env[name] as string).length > 0;
  const { results } = await ctx.db
    .prepare(
      'SELECT id, provider_key, label, mode, secret_prefix, currencies, enabled, status_note FROM payment_provider_accounts ORDER BY label',
    )
    .all<{
      id: string;
      provider_key: string;
      label: string;
      mode: 'test' | 'live';
      secret_prefix: string;
      currencies: string;
      enabled: number;
      status_note: string | null;
    }>();
  const emails = await ctx.db
    .prepare('SELECT to_email, template, status, error, created_at FROM email_logs ORDER BY created_at DESC LIMIT 10')
    .all<{ to_email: string; template: string; status: string; error: string | null; created_at: string }>();
  return {
    payments: results.map((a) => ({
      id: a.id,
      provider: a.provider_key,
      label: a.label,
      mode: a.mode,
      enabled: a.enabled === 1,
      currencies: JSON.parse(a.currencies) as string[],
      note: a.status_note,
      secretsConfigured: (REQUIRED_SECRETS[a.provider_key] ?? []).every((s) => configured(`${a.secret_prefix}_${s}`)),
    })),
    email: {
      provider: ctx.config.emailProvider,
      from: ctx.config.emailFrom,
      resendConfigured: configured('RESEND_API_KEY'),
      recent: emails.results.map((e) => ({
        to: e.to_email.replace(/^(.).*(@.*)$/, '$1…$2'),
        template: e.template,
        status: e.status,
        error: e.error ? e.error.slice(0, 160) : null,
        at: e.created_at,
      })),
    },
  };
}

/** Enables/disables a payment account, renames it or switches test/live. Super Administrator (`payment_settings.manage`). */
export async function updatePaymentAccount(
  ctx: RequestContext,
  id: string,
  input: { label: string; enabled: boolean; mode: 'test' | 'live' },
) {
  assertCan(ctx, 'payment_settings.manage');
  const acct = (await integrations(ctx)).payments.find((a) => a.id === id);
  if (!acct) throw notFound();
  if (input.mode === 'live' && !acct.secretsConfigured) {
    throw validationError({ mode: ["Add this account's Worker secrets before switching it to live."] });
  }
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        "UPDATE payment_provider_accounts SET label = ?, enabled = ?, mode = ?, updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
        input.label,
        input.enabled ? 1 : 0,
        input.mode,
        ctx.actor.userId,
        id,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'payment_account.updated',
        entityType: 'payment_provider_account',
        entityId: id,
        before: { label: acct.label, enabled: acct.enabled, mode: acct.mode },
        after: input,
      }),
    )
    .run();
}

/** Sends a test email to the signed-in staff member through the real provider pipeline. */
export async function sendTestEmail(ctx: RequestContext): Promise<{ to: string }> {
  assertCan(ctx, 'settings.manage');
  const to = ctx.auth!.user.email;
  const job = enqueue(ctx, {
    type: 'email.send',
    payload: { template: 'system_test', to, data: { name: ctx.auth!.user.name, at: ctx.now().toISOString() } },
    idempotencyKey: `email:test:${newId('obx')}`,
  });
  await new Batch(ctx.db)
    .add(job.stmt)
    .add(auditStmt(ctx, { action: 'email.test_sent', entityType: 'settings', entityId: 'email' }))
    .run();
  dispatch(ctx, [job.id]);
  return { to };
}

// ---------------------------------------------------------------- personal notification preferences

export async function notificationPreferences(ctx: RequestContext) {
  const userId = ctx.auth!.user.id;
  const { results } = await ctx.db
    .prepare('SELECT type, in_app, email FROM notification_preferences WHERE user_id = ?')
    .bind(userId)
    .all<{ type: string; in_app: number; email: number }>();
  const saved = new Map(results.map((r) => [r.type, r]));
  return NOTIFICATION_TYPES.map((t) => ({
    ...t,
    inApp: (saved.get(t.type)?.in_app ?? 1) === 1,
    email: (saved.get(t.type)?.email ?? 1) === 1,
  }));
}

export async function setNotificationPreferences(
  ctx: RequestContext,
  prefs: { type: string; inApp: boolean; email: boolean }[],
): Promise<void> {
  const userId = ctx.auth!.user.id;
  const bad = prefs.filter((p) => !isNotificationType(p.type)).map((p) => p.type);
  if (bad.length) throw validationError({ prefs: [`Unknown notification type: ${bad.join(', ')}`] });
  await new Batch(ctx.db)
    .addAll(
      prefs.map((p) =>
        stmt(
          ctx.db,
          `INSERT INTO notification_preferences (user_id, type, in_app, email) VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id, type) DO UPDATE SET in_app = excluded.in_app, email = excluded.email`,
          userId,
          p.type,
          p.inApp ? 1 : 0,
          p.email ? 1 : 0,
        ),
      ),
    )
    .add(auditStmt(ctx, { action: 'notification_preferences.updated', entityType: 'user', entityId: userId }))
    .run();
}

// ---------------------------------------------------------------- logo

/** Sets (or clears, with null) the document/email logo to an uploaded image owned by `system`. */
export async function setLogo(ctx: RequestContext, fileId: string | null): Promise<void> {
  assertCan(ctx, 'settings.manage');
  if (fileId) {
    const f = await ctx.db
      .prepare(
        "SELECT id FROM files WHERE id = ? AND owner_type = 'system' AND mime_type IN ('image/png','image/jpeg','image/webp')",
      )
      .bind(fileId)
      .first<{ id: string }>();
    if (!f) throw validationError({ fileId: ['Upload a PNG, JPEG or WebP image first.'] });
  }
  const before = (await readKeys(ctx, ['branding.logo_file_id']))['branding.logo_file_id'] ?? '';
  await new Batch(ctx.db)
    .add(upsertStmt(ctx, 'branding.logo_file_id', fileId ?? ''))
    .add(
      auditStmt(ctx, {
        action: 'settings.logo_changed',
        entityType: 'settings',
        entityId: 'branding',
        before: { fileId: before },
        after: { fileId: fileId ?? '' },
      }),
    )
    .run();
}

export async function currentLogo(ctx: RequestContext): Promise<string | null> {
  const v = (await readKeys(ctx, ['branding.logo_file_id']))['branding.logo_file_id'];
  return typeof v === 'string' && v ? v : null;
}
