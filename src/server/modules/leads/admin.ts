/**
 * Enquiries inbox and lead pipeline (P4.5, PRD §4.2 B). Website enquiries are triaged into leads; leads move through
 * new → contacted → qualified → proposal_sent → won | lost, with an activity log and follow-ups, and can be converted
 * into a client in one atomic batch.
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt, auditWhen } from '../../lib/audit';
import { businessDate } from '../../lib/dates';
import { conflict, notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { assertCan, can } from '../../lib/policies';
import { buildCreateClient } from '../clients/service';
import { getSettings, settingNumber, settingText } from '../cms';
import { notifyUser } from '../notifications';
import type { ProjectBrief } from './enquiries';

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal_sent: 'Proposal sent',
  won: 'Won',
  lost: 'Lost',
};
export const LEAD_SOURCES = ['website', 'referral', 'manual', 'social', 'other'] as const;
export const PAGE_SIZE = 25;

const like = (q: string) =>
  `%${q
    .trim()
    .slice(0, 80)
    .replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

// ---------------------------------------------------------------- enquiries

export interface EnquiryRow {
  id: string;
  reference: string;
  kind: 'contact' | 'wizard' | 'consultation' | 'product_interest';
  name: string;
  email: string;
  phone: string | null;
  organisation: string | null;
  category: string;
  service_id: string | null;
  package_id: string | null;
  product_id: string | null;
  budget_range: string | null;
  message: string;
  brief: string | null;
  attachment_file_id: string | null;
  status: 'new' | 'triaged' | 'spam' | 'closed';
  lead_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function listEnquiries(
  ctx: RequestContext,
  filter: { status?: string | undefined; kind?: string | undefined; q?: string | undefined; page: number },
) {
  assertCan(ctx, 'enquiries.view');
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.status && filter.status !== 'all') {
    where.push('status = ?');
    params.push(filter.status);
  } else if (!filter.status) {
    where.push("status IN ('new','triaged')");
  }
  if (filter.kind) {
    where.push('kind = ?');
    params.push(filter.kind);
  }
  if (filter.q?.trim()) {
    const l = like(filter.q);
    where.push(
      "(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR organisation LIKE ? ESCAPE '\\' OR reference LIKE ? ESCAPE '\\')",
    );
    params.push(l, l, l, l);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [count, rows, counts] = await ctx.db.batch([
    ctx.db.prepare(`SELECT COUNT(*) AS n FROM enquiries ${w}`).bind(...params),
    ctx.db
      .prepare(
        `SELECT id, reference, kind, name, email, organisation, category, budget_range, substr(message, 1, 200) AS message, status, lead_id, created_at
         FROM enquiries ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, PAGE_SIZE, (filter.page - 1) * PAGE_SIZE),
    ctx.db.prepare('SELECT status, COUNT(*) AS n FROM enquiries GROUP BY status'),
  ]);
  const total = ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  return {
    total,
    page: filter.page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    items: (rows?.results ?? []) as Pick<
      EnquiryRow,
      | 'id'
      | 'reference'
      | 'kind'
      | 'name'
      | 'email'
      | 'organisation'
      | 'category'
      | 'budget_range'
      | 'message'
      | 'status'
      | 'lead_id'
      | 'created_at'
    >[],
    counts: Object.fromEntries(
      ((counts?.results ?? []) as { status: string; n: number }[]).map((r) => [r.status, r.n]),
    ),
  };
}

export async function getEnquiry(ctx: RequestContext, id: string) {
  assertCan(ctx, 'enquiries.view');
  const row = await ctx.db
    .prepare(
      `SELECT e.*, s.name AS service_name, c.name AS category_name, p.name AS package_name, pr.name AS product_name,
         f.original_name AS attachment_name, f.size_bytes AS attachment_size, l.title AS lead_title, l.status AS lead_status
       FROM enquiries e
       LEFT JOIN services s ON s.id = e.service_id
       LEFT JOIN service_categories c ON c.slug = e.category
       LEFT JOIN service_packages p ON p.id = e.package_id
       LEFT JOIN products pr ON pr.id = e.product_id
       LEFT JOIN files f ON f.id = e.attachment_file_id
       LEFT JOIN leads l ON l.id = e.lead_id
       WHERE e.id = ?`,
    )
    .bind(id)
    .first<
      EnquiryRow & {
        service_name: string | null;
        category_name: string | null;
        package_name: string | null;
        product_name: string | null;
        attachment_name: string | null;
        attachment_size: number | null;
        lead_title: string | null;
        lead_status: LeadStatus | null;
      }
    >();
  if (!row) throw notFound();
  let brief: (ProjectBrief & { preferredTimes?: string[] }) | { preferredTimes: string[] } | null = null;
  try {
    brief = row.brief ? (JSON.parse(row.brief) as ProjectBrief) : null;
  } catch {
    brief = null;
  }
  return { ...row, brief };
}

/** Marks an enquiry as spam, closed, or back to new. Triage into a lead uses `triageToLead`. */
export async function setEnquiryStatus(
  ctx: RequestContext,
  id: string,
  status: 'new' | 'spam' | 'closed',
): Promise<void> {
  assertCan(ctx, 'enquiries.manage');
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'UPDATE enquiries SET status = ?, updated_at = ? WHERE id = ? AND status <> ?',
        status,
        now,
        id,
        status,
      ),
      'change',
    )
    .add(
      auditWhen(
        ctx,
        { action: `enquiry.${status === 'new' ? 'reopened' : status}`, entityType: 'enquiry', entityId: id },
        'EXISTS (SELECT 1 FROM enquiries WHERE id = ? AND updated_at = ?)',
        id,
        now,
      ),
    )
    .run();
  if (res.changes('change') !== 1) {
    const exists = await ctx.db.prepare('SELECT 1 FROM enquiries WHERE id = ?').bind(id).first();
    if (!exists) throw notFound();
  }
}

/** Creates a lead from an enquiry (copying contact details, requested service and budget) and links them. */
export async function triageToLead(ctx: RequestContext, enquiryId: string, opts: { assignedTo?: string | null } = {}) {
  assertCan(ctx, 'enquiries.manage', 'leads.manage');
  const e = await getEnquiry(ctx, enquiryId);
  if (e.lead_id) throw conflict('This enquiry already has a lead.');
  if (e.status === 'spam') throw conflict('Mark this enquiry as not spam first.');
  if (opts.assignedTo) await assertAssignable(ctx, opts.assignedTo);
  const now = ctx.now().toISOString();
  const leadId = newId('led', ctx.now().getTime());
  const what = e.package_name ?? e.service_name ?? e.category_name ?? e.product_name ?? 'Enquiry';
  const title = `${e.organisation ?? e.name}: ${what}`.slice(0, 160);
  const estimate =
    e.brief && 'estimate' in e.brief && e.brief.estimate && e.brief.estimate.oneOffLowMinor > 0
      ? e.brief.estimate
      : null;
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO leads (id, title, source, status, contact_name, email, phone, organisation, assigned_to, estimated_value_minor, currency,
           notes, created_by, created_at, updated_at)
         VALUES (?, ?, 'website', 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        leadId,
        title,
        e.name,
        e.email,
        e.phone,
        e.organisation,
        opts.assignedTo ?? ctx.actor.userId,
        estimate?.oneOffLowMinor ?? null,
        estimate?.currency ?? null,
        e.budget_range ? `Budget: ${e.budget_range}` : null,
        ctx.actor.userId,
        now,
        now,
      ),
    )
    .addAll(
      e.service_id
        ? [
            stmt(
              ctx.db,
              'INSERT OR IGNORE INTO lead_services (lead_id, service_id) VALUES (?, ?)',
              leadId,
              e.service_id,
            ),
          ]
        : [],
    )
    .add(
      stmt(
        ctx.db,
        "INSERT INTO lead_activities (id, lead_id, user_id, type, body, created_at) VALUES (?, ?, ?, 'note', ?, ?)",
        newId('lac', ctx.now().getTime()),
        leadId,
        ctx.actor.userId,
        `Created from enquiry ${e.reference}.`,
        now,
      ),
    )
    .add(
      stmt(
        ctx.db,
        "UPDATE enquiries SET status = 'triaged', lead_id = ?, updated_at = ? WHERE id = ? AND lead_id IS NULL",
        leadId,
        now,
        enquiryId,
      ),
      'link',
    )
    .add(auditStmt(ctx, { action: 'enquiry.triaged', entityType: 'enquiry', entityId: enquiryId, after: { leadId } }))
    .add(
      auditStmt(ctx, {
        action: 'lead.created',
        entityType: 'lead',
        entityId: leadId,
        after: { source: 'website', enquiryId },
      }),
    )
    .run();
  return { leadId };
}

// ---------------------------------------------------------------- leads

async function assertAssignable(ctx: RequestContext, userId: string) {
  const u = await ctx.db
    .prepare("SELECT id FROM users WHERE id = ? AND user_type = 'staff' AND status = 'active'")
    .bind(userId)
    .first();
  if (!u) throw validationError({ assignedTo: ['Choose an active staff member.'] });
}

export interface LeadRow {
  id: string;
  title: string;
  source: (typeof LEAD_SOURCES)[number];
  status: LeadStatus;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  organisation: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  estimated_value_minor: number | null;
  currency: string | null;
  next_follow_up_on: string | null;
  lost_reason: string | null;
  notes: string | null;
  client_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

const LEAD_SELECT = `SELECT l.*, u.name AS assigned_name FROM leads l LEFT JOIN users u ON u.id = l.assigned_to`;

export async function listLeads(
  ctx: RequestContext,
  filter: {
    status?: string | undefined;
    assigned?: string | undefined;
    q?: string | undefined;
    due?: boolean | undefined;
    page: number;
  },
) {
  assertCan(ctx, 'leads.view');
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.status === 'open' || !filter.status) where.push("l.status NOT IN ('won','lost')");
  else if (filter.status !== 'all') {
    where.push('l.status = ?');
    params.push(filter.status);
  }
  if (filter.assigned === 'me') {
    where.push('l.assigned_to = ?');
    params.push(ctx.actor.userId);
  } else if (filter.assigned === 'none') where.push('l.assigned_to IS NULL');
  if (filter.due) {
    where.push('l.next_follow_up_on IS NOT NULL AND l.next_follow_up_on <= ?');
    params.push(businessDate(ctx.now()));
  }
  if (filter.q?.trim()) {
    const l = like(filter.q);
    where.push(
      "(l.title LIKE ? ESCAPE '\\' OR l.contact_name LIKE ? ESCAPE '\\' OR l.organisation LIKE ? ESCAPE '\\' OR l.email LIKE ? ESCAPE '\\')",
    );
    params.push(l, l, l, l);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [count, rows] = await ctx.db.batch([
    ctx.db.prepare(`SELECT COUNT(*) AS n FROM leads l ${w}`).bind(...params),
    ctx.db
      .prepare(
        `${LEAD_SELECT} ${w} ORDER BY l.next_follow_up_on IS NULL, l.next_follow_up_on, l.updated_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, PAGE_SIZE * 4, (filter.page - 1) * PAGE_SIZE * 4),
  ]);
  const total = ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  return {
    total,
    page: filter.page,
    pages: Math.max(1, Math.ceil(total / (PAGE_SIZE * 4))),
    items: (rows?.results ?? []) as LeadRow[],
  };
}

export async function getLead(ctx: RequestContext, id: string) {
  assertCan(ctx, 'leads.view');
  const lead = await ctx.db.prepare(`${LEAD_SELECT} WHERE l.id = ?`).bind(id).first<LeadRow>();
  if (!lead) throw notFound();
  const [services, activities, enquiries, client] = await ctx.db.batch([
    ctx.db
      .prepare(
        'SELECT s.id, s.name FROM lead_services ls JOIN services s ON s.id = ls.service_id WHERE ls.lead_id = ? ORDER BY s.name',
      )
      .bind(id),
    ctx.db
      .prepare(
        `SELECT a.id, a.type, a.body, a.due_on, a.completed_at, a.created_at, u.name AS user_name FROM lead_activities a
         LEFT JOIN users u ON u.id = a.user_id WHERE a.lead_id = ? ORDER BY a.created_at DESC LIMIT 200`,
      )
      .bind(id),
    ctx.db.prepare('SELECT id, reference, created_at FROM enquiries WHERE lead_id = ? ORDER BY created_at').bind(id),
    ctx.db
      .prepare(
        'SELECT c.id, c.display_name, c.client_number FROM clients c JOIN leads l ON l.client_id = c.id WHERE l.id = ?',
      )
      .bind(id),
  ]);
  return {
    lead,
    services: (services?.results ?? []) as { id: string; name: string }[],
    activities: (activities?.results ?? []) as {
      id: string;
      type: 'note' | 'call' | 'email' | 'meeting' | 'status_change' | 'follow_up';
      body: string | null;
      due_on: string | null;
      completed_at: string | null;
      created_at: string;
      user_name: string | null;
    }[],
    enquiries: (enquiries?.results ?? []) as { id: string; reference: string; created_at: string }[],
    client: ((client?.results ?? [])[0] ?? null) as { id: string; display_name: string; client_number: string } | null,
  };
}

export interface LeadInput {
  title: string;
  source: (typeof LEAD_SOURCES)[number];
  status: LeadStatus;
  contactName?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  organisation?: string | undefined;
  assignedTo?: string | null | undefined;
  estimatedValueMinor?: number | null | undefined;
  currency?: string | null | undefined;
  nextFollowUpOn?: string | null | undefined;
  lostReason?: string | undefined;
  notes?: string | undefined;
  serviceIds: string[];
}

function checkLead(input: LeadInput) {
  if (input.status === 'lost' && !input.lostReason)
    throw validationError({ lostReason: ['Say why the lead was lost.'] });
  if (input.estimatedValueMinor != null && !input.currency)
    throw validationError({ currency: ['Choose a currency for the value.'] });
}

async function checkServices(ctx: RequestContext, ids: string[]) {
  if (!ids.length) return;
  const { results } = await ctx.db
    .prepare('SELECT id FROM services WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(ids))
    .all<{ id: string }>();
  if (results.length !== new Set(ids).size) throw validationError({ serviceIds: ['Choose services from the list.'] });
}

export async function createLead(ctx: RequestContext, input: LeadInput): Promise<{ id: string }> {
  assertCan(ctx, 'leads.manage');
  checkLead(input);
  await checkServices(ctx, input.serviceIds);
  if (input.assignedTo) await assertAssignable(ctx, input.assignedTo);
  const id = newId('led', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `INSERT INTO leads (id, title, source, status, contact_name, email, phone, organisation, assigned_to, estimated_value_minor, currency,
           next_follow_up_on, lost_reason, notes, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        input.title,
        input.source,
        input.status,
        input.contactName ?? null,
        input.email?.toLowerCase() ?? null,
        input.phone ?? null,
        input.organisation ?? null,
        input.assignedTo ?? null,
        input.estimatedValueMinor ?? null,
        input.estimatedValueMinor != null ? (input.currency ?? null) : null,
        input.nextFollowUpOn ?? null,
        input.status === 'lost' ? (input.lostReason ?? null) : null,
        input.notes ?? null,
        ctx.actor.userId,
        now,
        now,
      ),
    )
    .addAll(
      input.serviceIds.map((s) =>
        stmt(ctx.db, 'INSERT OR IGNORE INTO lead_services (lead_id, service_id) VALUES (?, ?)', id, s),
      ),
    )
    .add(
      auditStmt(ctx, {
        action: 'lead.created',
        entityType: 'lead',
        entityId: id,
        after: { title: input.title, source: input.source },
      }),
    )
    .run();
  return { id };
}

export async function updateLead(ctx: RequestContext, id: string, input: LeadInput): Promise<void> {
  assertCan(ctx, 'leads.manage');
  checkLead(input);
  await checkServices(ctx, input.serviceIds);
  const { lead } = await getLead(ctx, id);
  if (input.assignedTo && input.assignedTo !== lead.assigned_to) await assertAssignable(ctx, input.assignedTo);
  const now = ctx.now().toISOString();
  const statusChanged = lead.status !== input.status;
  const assignChanged = (lead.assigned_to ?? null) !== (input.assignedTo ?? null);
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE leads SET title = ?, source = ?, status = ?, contact_name = ?, email = ?, phone = ?, organisation = ?, assigned_to = ?,
           estimated_value_minor = ?, currency = ?, next_follow_up_on = ?, lost_reason = ?, notes = ?, updated_at = ? WHERE id = ?`,
        input.title,
        input.source,
        input.status,
        input.contactName ?? null,
        input.email?.toLowerCase() ?? null,
        input.phone ?? null,
        input.organisation ?? null,
        input.assignedTo ?? null,
        input.estimatedValueMinor ?? null,
        input.estimatedValueMinor != null ? (input.currency ?? null) : null,
        input.nextFollowUpOn ?? null,
        input.status === 'lost' ? (input.lostReason ?? null) : null,
        input.notes ?? null,
        now,
        id,
      ),
    )
    .add(stmt(ctx.db, 'DELETE FROM lead_services WHERE lead_id = ?', id))
    .addAll(
      input.serviceIds.map((s) =>
        stmt(ctx.db, 'INSERT OR IGNORE INTO lead_services (lead_id, service_id) VALUES (?, ?)', id, s),
      ),
    )
    .addAll(
      statusChanged
        ? [
            stmt(
              ctx.db,
              "INSERT INTO lead_activities (id, lead_id, user_id, type, body, created_at) VALUES (?, ?, ?, 'status_change', ?, ?)",
              newId('lac', ctx.now().getTime()),
              id,
              ctx.actor.userId,
              `${LEAD_STATUS_LABEL[lead.status]} → ${LEAD_STATUS_LABEL[input.status]}${input.status === 'lost' && input.lostReason ? `: ${input.lostReason}` : ''}`,
              now,
            ),
          ]
        : [],
    )
    .addAll(
      assignChanged && input.assignedTo && input.assignedTo !== ctx.actor.userId
        ? [
            notifyUser(ctx, input.assignedTo, {
              type: 'lead.assigned',
              title: `Lead assigned to you: ${input.title}`,
              link: `/admin/leads/${id}`,
              entityType: 'lead',
              entityId: id,
            }),
          ]
        : [],
    )
    .add(
      auditStmt(ctx, {
        action: 'lead.updated',
        entityType: 'lead',
        entityId: id,
        before: { status: lead.status, assignedTo: lead.assigned_to },
        after: { status: input.status, assignedTo: input.assignedTo ?? null },
      }),
    )
    .run();
}

/** Adds a note/call/email/meeting, or schedules a follow-up (which also sets the lead's next follow-up date). */
export async function addActivity(
  ctx: RequestContext,
  leadId: string,
  input: { type: 'note' | 'call' | 'email' | 'meeting' | 'follow_up'; body: string; dueOn?: string | undefined },
): Promise<{ id: string }> {
  assertCan(ctx, 'leads.manage');
  await getLead(ctx, leadId);
  if (input.type === 'follow_up' && !input.dueOn) throw validationError({ dueOn: ['Choose a follow-up date.'] });
  const id = newId('lac', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        'INSERT INTO lead_activities (id, lead_id, user_id, type, body, due_on, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id,
        leadId,
        ctx.actor.userId,
        input.type,
        input.body,
        input.type === 'follow_up' ? input.dueOn! : null,
        now,
      ),
    )
    .addAll(
      input.type === 'follow_up'
        ? [
            stmt(
              ctx.db,
              'UPDATE leads SET next_follow_up_on = ?, updated_at = ? WHERE id = ?',
              input.dueOn!,
              now,
              leadId,
            ),
          ]
        : [stmt(ctx.db, 'UPDATE leads SET updated_at = ? WHERE id = ?', now, leadId)],
    )
    .run();
  return { id };
}

/** Completes a follow-up; the lead's next follow-up becomes the earliest remaining open one (or none). */
export async function completeFollowUp(ctx: RequestContext, leadId: string, activityId: string): Promise<void> {
  assertCan(ctx, 'leads.manage');
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        "UPDATE lead_activities SET completed_at = ? WHERE id = ? AND lead_id = ? AND type = 'follow_up' AND completed_at IS NULL",
        now,
        activityId,
        leadId,
      ),
      'done',
    )
    .add(
      stmt(
        ctx.db,
        `UPDATE leads SET next_follow_up_on = (SELECT MIN(due_on) FROM lead_activities WHERE lead_id = ? AND type = 'follow_up' AND completed_at IS NULL),
           updated_at = ? WHERE id = ?`,
        leadId,
        now,
        leadId,
      ),
    )
    .run();
  if (res.changes('done') !== 1) throw notFound();
}

/**
 * Converts a lead into a client (client + main contact from the lead's contact details), links the lead, and marks it
 * won, in one batch. A lead can be converted once.
 */
export async function convertLead(ctx: RequestContext, leadId: string): Promise<{ clientId: string }> {
  assertCan(ctx, 'leads.manage', 'clients.create');
  const { lead } = await getLead(ctx, leadId);
  if (lead.client_id) throw conflict('This lead has already been converted.');
  if (lead.status === 'lost') throw conflict('Reopen this lead before converting it.');
  const settings = await getSettings(ctx);
  const isBusiness = !!lead.organisation;
  const displayName = (lead.organisation ?? lead.contact_name ?? lead.title).slice(0, 200);
  const built = await buildCreateClient(
    ctx,
    {
      type: isBusiness ? 'business' : 'individual',
      displayName,
      legalName: undefined,
      website: undefined,
      taxNumber: undefined,
      notes: undefined,
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      defaultCurrency: lead.currency ?? settingText(settings, 'currency.default') ?? 'USD',
      paymentTermsDays: settingNumber(settings, 'invoice.default_terms_days', 14),
      tags: [],
    },
    lead.contact_name
      ? {
          name: lead.contact_name,
          email: lead.email ?? undefined,
          phone: lead.phone ?? undefined,
          jobTitle: undefined,
          isPrimary: true,
          isBilling: true,
        }
      : undefined,
  );
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .addAll(built.statements)
    .add(
      stmt(
        ctx.db,
        "UPDATE leads SET client_id = ?, converted_at = ?, status = 'won', next_follow_up_on = NULL, updated_at = ? WHERE id = ? AND client_id IS NULL",
        built.id,
        now,
        now,
        leadId,
      ),
      'link',
    )
    .add(
      stmt(
        ctx.db,
        "INSERT INTO lead_activities (id, lead_id, user_id, type, body, created_at) VALUES (?, ?, ?, 'status_change', ?, ?)",
        newId('lac', ctx.now().getTime()),
        leadId,
        ctx.actor.userId,
        `Converted to client ${displayName}.`,
        now,
      ),
    )
    .add(
      auditStmt(ctx, { action: 'lead.converted', entityType: 'lead', entityId: leadId, after: { clientId: built.id } }),
    )
    .run();
  if (res.changes('link') !== 1) throw conflict('This lead has already been converted.');
  return { clientId: built.id };
}

/** Daily: remind the assigned person (or the creator) about follow-ups due today or overdue. Once per lead per day. */
export async function sendFollowUpReminders(ctx: RequestContext): Promise<number> {
  const today = businessDate(ctx.now());
  const { results } = await ctx.db
    .prepare(
      `SELECT id, title, COALESCE(assigned_to, created_by) AS user_id, next_follow_up_on FROM leads
       WHERE next_follow_up_on IS NOT NULL AND next_follow_up_on <= ? AND status NOT IN ('won','lost') AND COALESCE(assigned_to, created_by) IS NOT NULL
       LIMIT 500`,
    )
    .bind(today)
    .all<{ id: string; title: string; user_id: string; next_follow_up_on: string }>();
  if (!results.length) return 0;
  await ctx.db.batch(
    results.map((l) =>
      notifyUser(ctx, l.user_id, {
        type: 'lead.follow_up',
        title: `${l.next_follow_up_on < today ? 'Overdue follow-up' : 'Follow up today'}: ${l.title}`,
        link: `/admin/leads/${l.id}`,
        entityType: 'lead',
        entityId: l.id,
        dedupeKey: `lead_follow_up:${l.id}:${today}`,
      }),
    ),
  );
  return results.length;
}

export const canManageLeads = (ctx: RequestContext) => can(ctx, 'leads.manage');

/** Choices for the lead form and triage dialog: active staff, services (with division) and active currencies. */
export async function leadFormOptions(ctx: RequestContext) {
  assertCan(ctx, 'leads.view');
  const [staff, services, currencies] = await ctx.db.batch([
    ctx.db.prepare("SELECT id, name FROM users WHERE user_type = 'staff' AND status = 'active' ORDER BY name"),
    ctx.db.prepare(
      `SELECT s.id, s.name, c.name AS division FROM services s JOIN service_categories c ON c.id = s.category_id
       WHERE s.status <> 'inactive' ORDER BY c.sort_order, c.name, s.sort_order, s.name`,
    ),
    ctx.db.prepare('SELECT code FROM currencies WHERE active = 1 ORDER BY is_default DESC, code'),
  ]);
  return {
    staff: (staff?.results ?? []) as { id: string; name: string }[],
    services: (services?.results ?? []) as { id: string; name: string; division: string }[],
    currencies: ((currencies?.results ?? []) as { code: string }[]).map((r) => r.code),
  };
}
