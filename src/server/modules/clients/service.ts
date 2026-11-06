/**
 * Clients (P4.4, PRD §4.2 C): CRUD, contacts, notes, tags, archive, credit balances and portal access.
 * Client numbers are allocated gap-free in the same batch as the insert. Every change writes an audit row.
 */
import type { z } from 'zod';
import type { addressSchema, clientSchema, contactSchema } from '../../../shared/schemas/clients';
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt, auditWhen } from '../../lib/audit';
import { businessYear } from '../../lib/dates';
import { conflict, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { assertCan } from '../../lib/policies';
import { numberSqlExpr, sequenceKey, sequenceStatements } from '../../lib/sequences';
import { buildInvitation } from '../auth';
import { dispatch, enqueue } from '../../jobs/outbox';
import { notifyUser } from '../notifications';
import { getSettings, settingText } from '../cms';

type ClientData = z.output<typeof clientSchema>;
type ContactData = z.output<typeof contactSchema>;
type Address = z.output<typeof addressSchema>;

export const CLIENTS_PER_PAGE = 25;

const addressJson = (a: Address | undefined) => {
  if (!a) return null;
  const clean = Object.fromEntries(Object.entries(a).filter(([, v]) => v));
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
};

async function assertCurrency(ctx: RequestContext, code: string) {
  const c = await ctx.db.prepare('SELECT code FROM currencies WHERE code = ? AND active = 1').bind(code).first();
  if (!c) throw validationError({ defaultCurrency: ['Choose an active currency.'] });
}

export interface ClientRow {
  id: string;
  client_number: string;
  type: 'individual' | 'business';
  display_name: string;
  legal_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  tax_number: string | null;
  billing_address: string | null;
  physical_address: string | null;
  default_currency: string;
  payment_terms_days: number;
  notes: string | null;
  tags: string;
  status: 'active' | 'archived';
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

const toClient = (r: ClientRow) => ({
  id: r.id,
  number: r.client_number,
  type: r.type,
  displayName: r.display_name,
  legalName: r.legal_name,
  email: r.email,
  phone: r.phone,
  website: r.website,
  taxNumber: r.tax_number,
  billingAddress: r.billing_address ? (JSON.parse(r.billing_address) as Address) : null,
  physicalAddress: r.physical_address ? (JSON.parse(r.physical_address) as Address) : null,
  defaultCurrency: r.default_currency,
  paymentTermsDays: r.payment_terms_days,
  notes: r.notes,
  tags: JSON.parse(r.tags) as string[],
  status: r.status,
  archivedAt: r.archived_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
export type Client = ReturnType<typeof toClient>;

/** Creates a client (optionally with its primary contact) and returns its id and number. */
export async function createClient(
  ctx: RequestContext,
  input: ClientData,
  primaryContact?: ContactData,
): Promise<{ id: string; number: string }> {
  const built = await buildCreateClient(ctx, input, primaryContact);
  await new Batch(ctx.db).addAll(built.statements).run();
  const row = await ctx.db
    .prepare('SELECT client_number FROM clients WHERE id = ?')
    .bind(built.id)
    .first<{ client_number: string }>();
  return { id: built.id, number: row!.client_number };
}

/**
 * Statements that create a client (number allocation, row, main contact, audit) for a caller's own atomic batch,
 * e.g. converting a lead. They must run in order in ONE batch.
 */
export async function buildCreateClient(
  ctx: RequestContext,
  input: ClientData,
  primaryContact?: ContactData,
): Promise<{ id: string; contactId: string | null; statements: D1PreparedStatement[] }> {
  assertCan(ctx, 'clients.create');
  await assertCurrency(ctx, input.defaultCurrency);
  const settings = await getSettings(ctx);
  const format = settingText(settings, 'numbering.client') ?? 'CL-{SEQ:4}';
  const year = businessYear(ctx.now());
  const key = sequenceKey('client', format, year);
  const num = numberSqlExpr(key, format, year);
  const now = ctx.now().toISOString();
  const id = newId('cli', ctx.now().getTime());
  const contactId = primaryContact ? newId('con', ctx.now().getTime()) : null;
  const statements: D1PreparedStatement[] = [
    ...sequenceStatements(ctx.db, key),
    stmt(
      ctx.db,
      `INSERT INTO clients (id, client_number, type, display_name, legal_name, email, phone, website, tax_number, billing_address,
           physical_address, default_currency, payment_terms_days, notes, tags, status, created_by, created_at, updated_at)
         VALUES (?, ${num.sql}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      id,
      ...num.params,
      input.type,
      input.displayName,
      input.legalName ?? null,
      input.email?.toLowerCase() ?? null,
      input.phone ?? null,
      input.website ?? null,
      input.taxNumber ?? null,
      addressJson(input.billingAddress),
      addressJson(input.physicalAddress),
      input.defaultCurrency,
      input.paymentTermsDays,
      input.notes ?? null,
      JSON.stringify([...new Set(input.tags)]),
      ctx.actor.userId,
      now,
      now,
    ),
    ...(primaryContact && contactId
      ? [insertContactStmt(ctx, id, contactId, { ...primaryContact, isPrimary: true })]
      : []),
    auditStmt(ctx, {
      action: 'client.created',
      entityType: 'client',
      entityId: id,
      after: { displayName: input.displayName, type: input.type },
    }),
  ];
  return { id, contactId, statements };
}

export async function updateClient(ctx: RequestContext, id: string, input: ClientData): Promise<void> {
  assertCan(ctx, 'clients.update');
  const before = await getClientRow(ctx, id);
  if (input.defaultCurrency !== before.default_currency) await assertCurrency(ctx, input.defaultCurrency);
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE clients SET type = ?, display_name = ?, legal_name = ?, email = ?, phone = ?, website = ?, tax_number = ?,
           billing_address = ?, physical_address = ?, default_currency = ?, payment_terms_days = ?, notes = ?, tags = ?, updated_at = ?
         WHERE id = ?`,
        input.type,
        input.displayName,
        input.legalName ?? null,
        input.email?.toLowerCase() ?? null,
        input.phone ?? null,
        input.website ?? null,
        input.taxNumber ?? null,
        addressJson(input.billingAddress),
        addressJson(input.physicalAddress),
        input.defaultCurrency,
        input.paymentTermsDays,
        input.notes ?? null,
        JSON.stringify([...new Set(input.tags)]),
        ctx.now().toISOString(),
        id,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'client.updated',
        entityType: 'client',
        entityId: id,
        before: { displayName: before.display_name, email: before.email, defaultCurrency: before.default_currency },
        after: { displayName: input.displayName, email: input.email ?? null, defaultCurrency: input.defaultCurrency },
      }),
    )
    .run();
}

async function getClientRow(ctx: RequestContext, id: string): Promise<ClientRow> {
  const row = await ctx.db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first<ClientRow>();
  if (!row) throw notFound();
  return row;
}

/** Archiving hides a client from lists and new documents; history is kept. Portal access stays as it is. */
export async function setArchived(ctx: RequestContext, id: string, archived: boolean): Promise<void> {
  assertCan(ctx, 'clients.archive');
  await getClientRow(ctx, id);
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      archived
        ? stmt(
            ctx.db,
            "UPDATE clients SET status = 'archived', archived_at = ?, updated_at = ? WHERE id = ? AND status = 'active'",
            now,
            now,
            id,
          )
        : stmt(
            ctx.db,
            "UPDATE clients SET status = 'active', archived_at = NULL, updated_at = ? WHERE id = ? AND status = 'archived'",
            now,
            id,
          ),
      'change',
    )
    .add(
      auditWhen(
        ctx,
        { action: archived ? 'client.archived' : 'client.restored', entityType: 'client', entityId: id },
        'EXISTS (SELECT 1 FROM clients WHERE id = ? AND updated_at = ?)',
        id,
        now,
      ),
    )
    .run();
  if (res.changes('change') !== 1)
    throw conflict(archived ? 'This client is already archived.' : 'This client is not archived.');
}

const RELATED_SQL = `(SELECT COUNT(*) FROM quotations WHERE client_id = c.id) AS quotations,
  (SELECT COUNT(*) FROM invoices WHERE client_id = c.id) AS invoices,
  (SELECT COUNT(*) FROM projects WHERE client_id = c.id) AS projects,
  (SELECT COUNT(*) FROM client_credits WHERE client_id = c.id) AS credits,
  (SELECT COUNT(*) FROM client_user_access WHERE client_id = c.id) AS access,
  (SELECT COUNT(*) FROM subscriptions WHERE client_id = c.id) AS subscriptions`;

/**
 * Deletes a client only when nothing refers to it (no documents, projects, credits or portal access): a client created
 * by mistake. Everything else must be archived so history stays intact.
 */
export async function deleteClient(ctx: RequestContext, id: string): Promise<void> {
  assertCan(ctx, 'clients.archive');
  const r = await ctx.db.prepare(`SELECT c.display_name, ${RELATED_SQL} FROM clients c WHERE c.id = ?`).bind(id).first<{
    display_name: string;
    quotations: number;
    invoices: number;
    projects: number;
    credits: number;
    access: number;
    subscriptions: number;
  }>();
  if (!r) throw notFound();
  if (r.quotations || r.invoices || r.projects || r.credits || r.access || r.subscriptions) {
    throw conflict('This client has documents, projects or portal access. Archive it instead.');
  }
  await new Batch(ctx.db)
    .add(stmt(ctx.db, 'UPDATE leads SET client_id = NULL WHERE client_id = ?', id))
    .add(stmt(ctx.db, 'DELETE FROM client_notes WHERE client_id = ?', id))
    .add(stmt(ctx.db, 'DELETE FROM client_contacts WHERE client_id = ?', id))
    .add(stmt(ctx.db, 'DELETE FROM clients WHERE id = ?', id))
    .add(
      auditStmt(ctx, {
        action: 'client.deleted',
        entityType: 'client',
        entityId: id,
        before: { displayName: r.display_name },
      }),
    )
    .run();
}

export async function listClients(
  ctx: RequestContext,
  filter: { q?: string | undefined; status: 'active' | 'archived' | 'all'; tag?: string | undefined; page: number },
) {
  assertCan(ctx, 'clients.view');
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.status !== 'all') {
    where.push('c.status = ?');
    params.push(filter.status);
  }
  if (filter.q?.trim()) {
    const like = `%${filter.q
      .trim()
      .slice(0, 80)
      .replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push(
      "(c.display_name LIKE ? ESCAPE '\\' OR c.legal_name LIKE ? ESCAPE '\\' OR c.client_number LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\')",
    );
    params.push(like, like, like, like);
  }
  if (filter.tag) {
    where.push('EXISTS (SELECT 1 FROM json_each(c.tags) WHERE value = ?)');
    params.push(filter.tag);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [count, rows] = await ctx.db.batch([
    ctx.db.prepare(`SELECT COUNT(*) AS n FROM clients c ${w}`).bind(...params),
    ctx.db
      .prepare(
        `SELECT c.*, (SELECT name FROM client_contacts WHERE client_id = c.id AND is_primary = 1) AS primary_contact
         FROM clients c ${w} ORDER BY c.display_name COLLATE NOCASE LIMIT ? OFFSET ?`,
      )
      .bind(...params, CLIENTS_PER_PAGE, (filter.page - 1) * CLIENTS_PER_PAGE),
  ]);
  const total = ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  return {
    total,
    page: filter.page,
    pages: Math.max(1, Math.ceil(total / CLIENTS_PER_PAGE)),
    items: ((rows?.results ?? []) as (ClientRow & { primary_contact: string | null })[]).map((r) => ({
      ...toClient(r),
      primaryContact: r.primary_contact,
    })),
  };
}

export async function allTags(ctx: RequestContext): Promise<string[]> {
  const { results } = await ctx.db
    .prepare(
      "SELECT DISTINCT value AS tag FROM clients, json_each(clients.tags) WHERE clients.status = 'active' ORDER BY value LIMIT 200",
    )
    .all<{ tag: string }>();
  return results.map((r) => r.tag);
}

/** Everything on the client detail page. Financial figures come from issued documents and the credit ledger. */
export async function getClient(ctx: RequestContext, id: string) {
  assertCan(ctx, 'clients.view');
  const row = await getClientRow(ctx, id);
  const [contacts, notes, credits, access, related] = await ctx.db.batch([
    ctx.db.prepare('SELECT * FROM client_contacts WHERE client_id = ? ORDER BY is_primary DESC, name').bind(id),
    ctx.db
      .prepare(
        `SELECT n.id, n.body, n.created_at, u.name AS author FROM client_notes n JOIN users u ON u.id = n.author_id
         WHERE n.client_id = ? ORDER BY n.created_at DESC LIMIT 100`,
      )
      .bind(id),
    ctx.db
      .prepare(
        'SELECT currency, SUM(amount_minor) AS balance FROM client_credits WHERE client_id = ? GROUP BY currency HAVING SUM(amount_minor) <> 0 ORDER BY currency',
      )
      .bind(id),
    ctx.db
      .prepare(
        `SELECT a.id, a.role, a.status, a.created_at, a.approved_at, u.id AS user_id, u.name, u.email, u.status AS user_status, u.last_login_at
         FROM client_user_access a JOIN users u ON u.id = a.user_id WHERE a.client_id = ? ORDER BY a.status, u.name`,
      )
      .bind(id),
    ctx.db.prepare(`SELECT ${RELATED_SQL} FROM clients c WHERE c.id = ?`).bind(id),
  ]);
  type ContactRow = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    job_title: string | null;
    is_primary: number;
    is_billing: number;
  };
  return {
    client: toClient(row),
    contacts: ((contacts?.results ?? []) as ContactRow[]).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      jobTitle: c.job_title,
      isPrimary: c.is_primary === 1,
      isBilling: c.is_billing === 1,
    })),
    notes: (notes?.results ?? []) as { id: string; body: string; created_at: string; author: string }[],
    credits: (credits?.results ?? []) as { currency: string; balance: number }[],
    access: (access?.results ?? []) as {
      id: string;
      role: 'owner' | 'member' | 'billing';
      status: 'pending' | 'active' | 'revoked';
      created_at: string;
      approved_at: string | null;
      user_id: string;
      name: string;
      email: string;
      user_status: string;
      last_login_at: string | null;
    }[],
    related: ((related?.results ?? [])[0] ?? {}) as Record<
      'quotations' | 'invoices' | 'projects' | 'credits' | 'access' | 'subscriptions',
      number
    >,
  };
}

// ---------------------------------------------------------------- contacts

function insertContactStmt(ctx: RequestContext, clientId: string, id: string, c: ContactData) {
  const now = ctx.now().toISOString();
  return stmt(
    ctx.db,
    `INSERT INTO client_contacts (id, client_id, name, email, phone, job_title, is_primary, is_billing, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    clientId,
    c.name,
    c.email?.toLowerCase() ?? null,
    c.phone ?? null,
    c.jobTitle ?? null,
    c.isPrimary ? 1 : 0,
    c.isBilling ? 1 : 0,
    now,
    now,
  );
}

export async function addContact(ctx: RequestContext, clientId: string, input: ContactData): Promise<{ id: string }> {
  assertCan(ctx, 'clients.update');
  await getClientRow(ctx, clientId);
  const id = newId('con', ctx.now().getTime());
  await new Batch(ctx.db)
    .addAll(
      input.isPrimary
        ? [stmt(ctx.db, 'UPDATE client_contacts SET is_primary = 0 WHERE client_id = ? AND is_primary = 1', clientId)]
        : [],
    )
    .add(insertContactStmt(ctx, clientId, id, input))
    .add(
      auditStmt(ctx, {
        action: 'client.contact_added',
        entityType: 'client',
        entityId: clientId,
        after: { contactId: id, name: input.name },
      }),
    )
    .run();
  return { id };
}

export async function updateContact(
  ctx: RequestContext,
  clientId: string,
  contactId: string,
  input: ContactData,
): Promise<void> {
  assertCan(ctx, 'clients.update');
  const existing = await ctx.db
    .prepare('SELECT id FROM client_contacts WHERE id = ? AND client_id = ?')
    .bind(contactId, clientId)
    .first();
  if (!existing) throw notFound();
  await new Batch(ctx.db)
    .addAll(
      input.isPrimary
        ? [
            stmt(
              ctx.db,
              'UPDATE client_contacts SET is_primary = 0 WHERE client_id = ? AND is_primary = 1 AND id <> ?',
              clientId,
              contactId,
            ),
          ]
        : [],
    )
    .add(
      stmt(
        ctx.db,
        'UPDATE client_contacts SET name = ?, email = ?, phone = ?, job_title = ?, is_primary = ?, is_billing = ?, updated_at = ? WHERE id = ? AND client_id = ?',
        input.name,
        input.email?.toLowerCase() ?? null,
        input.phone ?? null,
        input.jobTitle ?? null,
        input.isPrimary ? 1 : 0,
        input.isBilling ? 1 : 0,
        ctx.now().toISOString(),
        contactId,
        clientId,
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'client.contact_updated',
        entityType: 'client',
        entityId: clientId,
        after: { contactId },
      }),
    )
    .run();
}

/** A contact used on a document stays (documents keep a snapshot, but the reference must remain valid). */
export async function removeContact(ctx: RequestContext, clientId: string, contactId: string): Promise<void> {
  assertCan(ctx, 'clients.update');
  const used = await ctx.db
    .prepare(
      `SELECT (EXISTS (SELECT 1 FROM quotations WHERE contact_id = ?1) OR EXISTS (SELECT 1 FROM invoices WHERE contact_id = ?1)) AS used,
         EXISTS (SELECT 1 FROM client_contacts WHERE id = ?1 AND client_id = ?2) AS found`,
    )
    .bind(contactId, clientId)
    .first<{ used: number; found: number }>();
  if (!used?.found) throw notFound();
  if (used.used) throw conflict('This contact is on quotations or invoices, so it is kept. Edit it instead.');
  await new Batch(ctx.db)
    .add(stmt(ctx.db, 'DELETE FROM client_contacts WHERE id = ? AND client_id = ?', contactId, clientId))
    .add(
      auditStmt(ctx, {
        action: 'client.contact_removed',
        entityType: 'client',
        entityId: clientId,
        before: { contactId },
      }),
    )
    .run();
}

// ---------------------------------------------------------------- notes

export async function addNote(ctx: RequestContext, clientId: string, body: string): Promise<{ id: string }> {
  assertCan(ctx, 'clients.update');
  await getClientRow(ctx, clientId);
  const id = newId('cnt', ctx.now().getTime());
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'INSERT INTO client_notes (id, client_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
        id,
        clientId,
        ctx.actor.userId,
        body,
        ctx.now().toISOString(),
      ),
    )
    .add(
      auditStmt(ctx, { action: 'client.note_added', entityType: 'client', entityId: clientId, after: { noteId: id } }),
    )
    .run();
  return { id };
}

// ---------------------------------------------------------------- portal access

/** Invites a client contact to the portal. They get an email; access becomes active when they accept. */
export async function invitePortalContact(
  ctx: RequestContext,
  clientId: string,
  input: { contactId: string; role: 'owner' | 'member' | 'billing' },
): Promise<{ userId: string }> {
  assertCan(ctx, 'clients.update');
  const client = await getClientRow(ctx, clientId);
  if (client.status !== 'active') throw conflict('Restore this client before inviting people to the portal.');
  const contact = await ctx.db
    .prepare('SELECT name, email FROM client_contacts WHERE id = ? AND client_id = ?')
    .bind(input.contactId, clientId)
    .first<{ name: string; email: string | null }>();
  if (!contact) throw notFound();
  if (!contact.email) throw validationError({ contactId: ['Add an email address to this contact first.'] });
  const existing = await ctx.db
    .prepare(
      `SELECT a.status FROM client_user_access a JOIN users u ON u.id = a.user_id
       WHERE a.client_id = ? AND u.email = ? AND a.status = 'active'`,
    )
    .bind(clientId, contact.email)
    .first();
  if (existing) throw conflict('This person already has portal access.');
  const inv = await buildInvitation(
    ctx,
    { kind: 'client', email: contact.email, name: contact.name, clientId, accessRole: input.role },
    ctx.actor.userId,
  );
  const email = enqueue(ctx, {
    type: 'email.send',
    payload: {
      template: 'client_invitation',
      to: contact.email,
      data: { name: contact.name, link: inv.link, expiresInDays: 7 },
    },
    idempotencyKey: `email:invite:${inv.tokenId}`,
  });
  await new Batch(ctx.db).addAll(inv.statements).add(email.stmt).run();
  dispatch(ctx, [email.id]);
  return { userId: inv.userId };
}

/** Approve a pending link (only for people who have finished setting up their account) or revoke any link. */
export async function setPortalAccess(
  ctx: RequestContext,
  clientId: string,
  accessId: string,
  action: 'approve' | 'revoke',
): Promise<void> {
  assertCan(ctx, 'clients.update');
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        action === 'approve'
          ? `UPDATE client_user_access SET status = 'active', approved_by = ?, approved_at = ?, updated_at = ?
             WHERE id = ? AND client_id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM users WHERE id = client_user_access.user_id AND status = 'active')`
          : `UPDATE client_user_access SET status = 'revoked', updated_at = ? WHERE id = ? AND client_id = ? AND status <> 'revoked'`,
        ...(action === 'approve' ? [ctx.actor.userId, now, now, accessId, clientId] : [now, accessId, clientId]),
      ),
      'change',
    )
    .add(
      auditWhen(
        ctx,
        {
          action: action === 'approve' ? 'client.portal_approved' : 'client.portal_revoked',
          entityType: 'client',
          entityId: clientId,
          after: { accessId },
        },
        'EXISTS (SELECT 1 FROM client_user_access WHERE id = ? AND updated_at = ?)',
        accessId,
        now,
      ),
    )
    .run();
  if (res.changes('change') !== 1) {
    throw conflict(
      action === 'approve'
        ? 'This link is not waiting for approval, or the person has not finished setting up their account.'
        : 'This link is already revoked.',
    );
  }
}

// ---------------------------------------------------------------- portal sign-ups (optional self-registration)

/** Finished self-registrations that are not linked to any client yet (no pending or active access). */
const SIGNUP_WHERE = `u.user_type = 'client' AND u.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM client_user_access a WHERE a.user_id = u.id AND a.status IN ('pending','active'))
  AND EXISTS (SELECT 1 FROM auth_tokens t WHERE t.user_id = u.id AND t.purpose = 'invite_client'
              AND t.used_at IS NOT NULL AND json_extract(t.metadata, '$.registration') = 1)`;

export interface PortalSignup {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  registeredAt: string;
}

export async function listPortalSignups(ctx: RequestContext): Promise<PortalSignup[]> {
  assertCan(ctx, 'clients.view');
  const { results } = await ctx.db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at,
         (SELECT json_extract(t.metadata, '$.company') FROM auth_tokens t WHERE t.user_id = u.id AND t.purpose = 'invite_client'
          AND t.used_at IS NOT NULL ORDER BY t.used_at DESC LIMIT 1) AS company,
         (SELECT t.used_at FROM auth_tokens t WHERE t.user_id = u.id AND t.purpose = 'invite_client'
          AND t.used_at IS NOT NULL ORDER BY t.used_at DESC LIMIT 1) AS registered_at
       FROM users u WHERE ${SIGNUP_WHERE} ORDER BY registered_at DESC LIMIT 200`,
    )
    .all<{
      id: string;
      name: string;
      email: string;
      phone: string | null;
      created_at: string;
      company: string | null;
      registered_at: string | null;
    }>();
  return results.map((r) => ({
    userId: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    company: r.company,
    registeredAt: r.registered_at ?? r.created_at,
  }));
}

async function assertSignup(ctx: RequestContext, userId: string): Promise<void> {
  const row = await ctx.db
    .prepare(`SELECT 1 AS ok FROM users u WHERE u.id = ? AND ${SIGNUP_WHERE}`)
    .bind(userId)
    .first();
  if (!row) throw notFound();
}

/** Staff explicitly link a sign-up to a client (the only way a self-registered account gets access). */
export async function linkPortalSignup(
  ctx: RequestContext,
  userId: string,
  input: { clientId: string; role: 'owner' | 'member' | 'billing' },
): Promise<void> {
  assertCan(ctx, 'clients.update');
  const client = await getClientRow(ctx, input.clientId);
  if (client.status !== 'active') throw conflict('Restore this client before giving people portal access.');
  await assertSignup(ctx, userId);
  const now = ctx.now().toISOString();
  const accessId = newId('cua', ctx.now().getTime());
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO client_user_access (id, client_id, user_id, role, status, approved_by, approved_at, created_at, updated_at)
         SELECT ?, ?, u.id, ?, 'active', ?, ?, ?, ? FROM users u WHERE u.id = ? AND ${SIGNUP_WHERE}
         ON CONFLICT(client_id, user_id) DO UPDATE SET role = excluded.role, status = 'active',
           approved_by = excluded.approved_by, approved_at = excluded.approved_at, updated_at = excluded.updated_at`,
        accessId,
        input.clientId,
        input.role,
        ctx.actor.userId,
        now,
        now,
        now,
        userId,
      ),
      'link',
    )
    .add(
      auditWhen(
        ctx,
        {
          action: 'client.portal_linked',
          entityType: 'client',
          entityId: input.clientId,
          after: { userId, role: input.role },
        },
        "EXISTS (SELECT 1 FROM client_user_access WHERE client_id = ? AND user_id = ? AND status = 'active' AND approved_at = ?)",
        input.clientId,
        userId,
        now,
      ),
    )
    .add(
      notifyUser(ctx, userId, {
        type: 'client.portal_linked',
        title: `Your account is now linked to ${client.display_name}`,
        body: 'You can now see your quotations, invoices and projects in the portal.',
        link: '/portal',
        dedupeKey: `client.portal_linked:${input.clientId}`,
      }),
    )
    .run();
  if (res.changes('link') !== 1) throw conflict('This sign-up is no longer waiting to be linked.');
}

/** Declines a sign-up: the account is disabled and signed out everywhere. */
export async function declinePortalSignup(ctx: RequestContext, userId: string): Promise<void> {
  assertCan(ctx, 'clients.update');
  await assertSignup(ctx, userId);
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE users SET status = 'disabled', updated_at = ? WHERE id IN (SELECT u.id FROM users u WHERE u.id = ? AND ${SIGNUP_WHERE})`,
        now,
        userId,
      ),
      'decline',
    )
    .add(
      stmt(
        ctx.db,
        `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL
         AND EXISTS (SELECT 1 FROM users WHERE id = ? AND status = 'disabled' AND updated_at = ?)`,
        now,
        userId,
        userId,
        now,
      ),
    )
    .add(
      auditWhen(
        ctx,
        { action: 'client.portal_signup_declined', entityType: 'user', entityId: userId },
        "EXISTS (SELECT 1 FROM users WHERE id = ? AND status = 'disabled' AND updated_at = ?)",
        userId,
        now,
      ),
    )
    .run();
  if (res.changes('decline') !== 1) throw conflict('This sign-up is no longer waiting to be linked.');
}
