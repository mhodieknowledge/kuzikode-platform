/**
 * Managed services register (P4.20, docs/12 §A.4): domains, hosting, email tenants, SSL, app-store accounts. Credentials
 * are never stored, only a note saying where they are kept. A daily cron reminds staff 30, 14 and 7 days before each
 * renewal, and emails the client too when the asset is billable to them. Each reminder is recorded once per renewal date.
 */
import type { RequestContext } from '../../context';
import { Batch, isUniqueViolation, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { addDays, businessDate, daysBetween } from '../../lib/dates';
import { notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { assertCan } from '../../lib/policies';
import type { AssetInput, AssetListQuery } from '../../../shared/schemas/subscriptions';
import { dispatch, enqueue } from '../../jobs/outbox';
import { notifyStaffWithPermission } from '../notifications';

export const ASSET_PAGE_SIZE = 25;

export const ASSET_TYPE_LABELS: Record<string, string> = {
  domain: 'Domain',
  hosting: 'Hosting',
  email_tenant: 'Email',
  ssl: 'SSL certificate',
  app_store_account: 'App store account',
  other: 'Other',
};

export interface AssetRow {
  id: string;
  client_id: string;
  type: AssetInput['type'];
  name: string;
  provider: string | null;
  subscription_id: string | null;
  renewal_date: string | null;
  auto_renew: number;
  billable_to_client: number;
  cost_note: string | null;
  credentials_note: string | null;
  status: AssetInput['status'];
  created_at: string;
  updated_at: string;
}

const escapeLike = (q: string) =>
  `%${q
    .trim()
    .slice(0, 80)
    .replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export async function listAssets(ctx: RequestContext, f: AssetListQuery) {
  assertCan(ctx, 'client_assets.manage');
  const where: string[] = [];
  const params: unknown[] = [];
  const status = f.status ?? 'active';
  if (status !== 'all') {
    where.push('a.status = ?');
    params.push(status);
  }
  if (f.type) {
    where.push('a.type = ?');
    params.push(f.type);
  }
  if (f.clientId) {
    where.push('a.client_id = ?');
    params.push(f.clientId);
  }
  if (f.renewBy) {
    where.push('a.renewal_date IS NOT NULL AND a.renewal_date <= ?');
    params.push(f.renewBy);
  }
  if (f.q) {
    where.push(`(a.name LIKE ? ESCAPE '\\' OR a.provider LIKE ? ESCAPE '\\' OR c.display_name LIKE ? ESCAPE '\\')`);
    params.push(escapeLike(f.q), escapeLike(f.q), escapeLike(f.q));
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [count, rows] = await ctx.db.batch([
    ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM client_assets a JOIN clients c ON c.id = a.client_id ${w}`)
      .bind(...params),
    ctx.db
      .prepare(
        `SELECT a.*, c.display_name AS client_name FROM client_assets a JOIN clients c ON c.id = a.client_id ${w}
         ORDER BY a.renewal_date IS NULL, a.renewal_date, a.name LIMIT ? OFFSET ?`,
      )
      .bind(...params, ASSET_PAGE_SIZE, (f.page - 1) * ASSET_PAGE_SIZE),
  ]);
  const total = ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  return {
    items: (rows?.results ?? []) as (AssetRow & { client_name: string })[],
    total,
    page: f.page,
    pages: Math.max(1, Math.ceil(total / ASSET_PAGE_SIZE)),
  };
}

export async function getAsset(ctx: RequestContext, id: string) {
  assertCan(ctx, 'client_assets.manage');
  const a = await ctx.db
    .prepare(
      `SELECT a.*, c.display_name AS client_name FROM client_assets a JOIN clients c ON c.id = a.client_id WHERE a.id = ?`,
    )
    .bind(id)
    .first<AssetRow & { client_name: string }>();
  if (!a) throw notFound();
  const { results } = await ctx.db
    .prepare(
      'SELECT kind, renewal_date, sent_at FROM asset_reminders WHERE asset_id = ? ORDER BY sent_at DESC LIMIT 12',
    )
    .bind(id)
    .all<{ kind: string; renewal_date: string; sent_at: string }>();
  return { asset: a, reminders: results };
}

async function checkRefs(ctx: RequestContext, input: AssetInput) {
  const [client, sub] = await ctx.db.batch([
    ctx.db.prepare('SELECT id FROM clients WHERE id = ?').bind(input.clientId),
    ctx.db.prepare('SELECT client_id FROM subscriptions WHERE id = ?').bind(input.subscriptionId ?? ''),
  ]);
  const fields: Record<string, string[]> = {};
  if (!(client?.results ?? []).length) fields['clientId'] = ['Choose a client.'];
  const s = ((sub?.results ?? [])[0] as { client_id: string } | undefined) ?? null;
  if (input.subscriptionId && (!s || s.client_id !== input.clientId))
    fields['subscriptionId'] = ["Choose one of this client's subscriptions."];
  if (Object.keys(fields).length) throw validationError(fields);
}

const values = (i: AssetInput) => [
  i.clientId,
  i.type,
  i.name,
  i.provider,
  i.subscriptionId,
  i.renewalDate,
  i.autoRenew ? 1 : 0,
  i.billableToClient ? 1 : 0,
  i.costNote,
  i.credentialsNote,
  i.status,
];
/** Audit shows what changed, never the notes' text (they can hint at where credentials live). */
const auditView = (i: AssetInput) => ({
  clientId: i.clientId,
  type: i.type,
  name: i.name,
  provider: i.provider,
  renewalDate: i.renewalDate,
  status: i.status,
});

async function run(batch: Batch) {
  try {
    await batch.run();
  } catch (err) {
    if (isUniqueViolation(err)) throw validationError({ name: ['This is already in the register.'] });
    throw err;
  }
}

export async function createAsset(ctx: RequestContext, input: AssetInput): Promise<{ id: string }> {
  assertCan(ctx, 'client_assets.manage');
  await checkRefs(ctx, input);
  const id = newId('ast', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await run(
    new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          `INSERT INTO client_assets (id, client_id, type, name, provider, subscription_id, renewal_date, auto_renew, billable_to_client,
             cost_note, credentials_note, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id,
          ...values(input),
          now,
          now,
        ),
      )
      .add(
        auditStmt(ctx, {
          action: 'client_asset.created',
          entityType: 'client_asset',
          entityId: id,
          after: auditView(input),
        }),
      ),
  );
  return { id };
}

export async function updateAsset(ctx: RequestContext, id: string, input: AssetInput): Promise<void> {
  const { asset } = await getAsset(ctx, id);
  await checkRefs(ctx, input);
  await run(
    new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          `UPDATE client_assets SET client_id = ?, type = ?, name = ?, provider = ?, subscription_id = ?, renewal_date = ?, auto_renew = ?,
             billable_to_client = ?, cost_note = ?, credentials_note = ?, status = ?, updated_at = ? WHERE id = ?`,
          ...values(input),
          ctx.now().toISOString(),
          id,
        ),
      )
      .add(
        auditStmt(ctx, {
          action: 'client_asset.updated',
          entityType: 'client_asset',
          entityId: id,
          before: {
            clientId: asset.client_id,
            type: asset.type,
            name: asset.name,
            provider: asset.provider,
            renewalDate: asset.renewal_date,
            status: asset.status,
          },
          after: auditView(input),
        }),
      ),
  );
}

export async function deleteAsset(ctx: RequestContext, id: string): Promise<void> {
  const { asset } = await getAsset(ctx, id);
  await new Batch(ctx.db)
    .sql('DELETE FROM asset_reminders WHERE asset_id = ?', id)
    .sql('DELETE FROM client_assets WHERE id = ?', id)
    .add(
      auditStmt(ctx, {
        action: 'client_asset.deleted',
        entityType: 'client_asset',
        entityId: id,
        before: { name: asset.name, type: asset.type, clientId: asset.client_id },
      }),
    )
    .run();
}

const KINDS = [
  { kind: '7d', days: 7 },
  { kind: '14d', days: 14 },
  { kind: '30d', days: 30 },
] as const;

/**
 * Daily: one reminder per asset and renewal date in each window (≤ 30, ≤ 14, ≤ 7 days). Staff with
 * `client_assets.manage` get a notification; the client gets an email when the asset is billable to them. A reminder
 * row, the notification (dedupe key) and the email (idempotency key) each exist once, so reruns send nothing new.
 */
export async function sendRenewalReminders(ctx: RequestContext): Promise<number> {
  const today = businessDate(ctx.now());
  const { results } = await ctx.db
    .prepare(
      `SELECT a.id, a.type, a.name, a.renewal_date, a.auto_renew, a.billable_to_client, a.client_id,
         COALESCE(k.name, c.display_name) AS contact_name, COALESCE(k.email, c.email) AS contact_email
       FROM client_assets a JOIN clients c ON c.id = a.client_id
       LEFT JOIN client_contacts k ON k.client_id = c.id AND k.is_primary = 1
       WHERE a.status = 'active' AND a.renewal_date BETWEEN ? AND ?
         AND NOT EXISTS (SELECT 1 FROM asset_reminders r WHERE r.asset_id = a.id AND r.renewal_date = a.renewal_date
           AND r.kind = CASE WHEN a.renewal_date <= ? THEN '7d' WHEN a.renewal_date <= ? THEN '14d' ELSE '30d' END)
       ORDER BY a.renewal_date LIMIT 200`,
    )
    .bind(today, addDays(today, 30), addDays(today, 7), addDays(today, 14))
    .all<{
      id: string;
      type: string;
      name: string;
      renewal_date: string;
      auto_renew: number;
      billable_to_client: number;
      client_id: string;
      contact_name: string;
      contact_email: string | null;
    }>();
  const now = ctx.now().toISOString();
  let sent = 0;
  for (const a of results) {
    const days = daysBetween(today, a.renewal_date);
    const kind = KINDS.find((k) => days <= k.days)!.kind;
    const label = ASSET_TYPE_LABELS[a.type] ?? 'Service';
    const when = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(
      new Date(`${a.renewal_date}T00:00:00Z`),
    );
    const job =
      a.billable_to_client === 1 && a.contact_email
        ? enqueue(ctx, {
            type: 'email.send',
            payload: {
              template: 'renewal_reminder',
              to: a.contact_email,
              data: {
                name: a.contact_name,
                item: `${label}: ${a.name}`,
                renewalDate: when,
                days,
                autoRenew: a.auto_renew === 1,
              },
            },
            idempotencyKey: `email:renewal:${a.id}:${a.renewal_date}:${kind}`,
          })
        : null;
    const res = await new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          'INSERT OR IGNORE INTO asset_reminders (asset_id, kind, renewal_date, sent_at) VALUES (?, ?, ?, ?)',
          a.id,
          kind,
          a.renewal_date,
          now,
        ),
        'reminder',
      )
      .add(
        notifyStaffWithPermission(ctx, 'client_assets.manage', {
          type: 'renewal.upcoming',
          title: `${label} ${a.name} renews in ${days} ${days === 1 ? 'day' : 'days'}`,
          body: `${a.contact_name} · ${when}${a.auto_renew === 1 ? ' · auto-renews' : ''}`,
          link: `/admin/assets/${a.id}`,
          entityType: 'client_asset',
          entityId: a.id,
          dedupeKey: `asset_renewal:${a.id}:${a.renewal_date}:${kind}`,
          excludeActor: false,
        }),
      )
      .addAll(job ? [job.stmt] : [])
      .run();
    if (res.changes('reminder') === 1) sent++;
    if (job) dispatch(ctx, [job.id]);
  }
  return sent;
}

/** Subscription renewals and register renewals in the next `days` days (dashboard "upcoming renewals"). */
export async function upcomingRenewals(ctx: RequestContext, days = 30) {
  const today = businessDate(ctx.now());
  const until = addDays(today, days);
  const [subs, assets] = await ctx.db.batch([
    ctx.db
      .prepare(
        `SELECT s.id, s.description AS name, s.next_billing_date AS date, c.display_name AS client FROM subscriptions s
         JOIN clients c ON c.id = s.client_id WHERE s.status IN ('active','at_risk') AND s.next_billing_date BETWEEN ? AND ?`,
      )
      .bind(today, until),
    ctx.db
      .prepare(
        `SELECT a.id, a.name, a.type, a.renewal_date AS date, c.display_name AS client FROM client_assets a
         JOIN clients c ON c.id = a.client_id WHERE a.status = 'active' AND a.renewal_date BETWEEN ? AND ?`,
      )
      .bind(today, until),
  ]);
  const items = [
    ...((subs?.results ?? []) as { id: string; name: string; date: string; client: string }[]).map((s) => ({
      kind: 'subscription' as const,
      ...s,
      href: `/admin/subscriptions/${s.id}`,
    })),
    ...((assets?.results ?? []) as { id: string; name: string; type: string; date: string; client: string }[]).map(
      (a) => ({
        kind: 'asset' as const,
        id: a.id,
        name: `${ASSET_TYPE_LABELS[a.type] ?? 'Service'}: ${a.name}`,
        date: a.date,
        client: a.client,
        href: `/admin/assets/${a.id}`,
      }),
    ),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return items;
}
