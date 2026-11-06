/**
 * Admin → Careers (P4.21, docs/12 §B.2): postings (draft → open → closed → archived, scheduled opening, auto-close,
 * duplicate, custom questions, preview), the applicant pipeline (list + kanban, rating, tags, reviewer, notes, history),
 * candidate emails from editable templates, bulk reject with regret email, and "Erase applicant". Applicant data is
 * personal data: erasure deletes the files and blanks every personal field; audit rows never copy personal details.
 */
import type { RequestContext } from '../../context';
import { Batch, isUniqueViolation, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { conflict, notFound, validationError } from '../../lib/errors';
import { sanitizeHtml } from '../../lib/html-sanitize';
import { newId } from '../../lib/ids';
import { assertCan } from '../../lib/policies';
import { dispatch, enqueue } from '../../jobs/outbox';
import {
  APPLICATION_STATUSES,
  CANDIDATE_TEMPLATES,
  type ApplicationListQuery,
  type ApplicationStatus,
  type ApplicationUpdate,
  type CandidateTemplate,
  type CandidateTemplates,
  type PostingInput,
} from '../../../shared/schemas/careers-admin';
import { customQuestionSchema, type CustomQuestion } from '../../../shared/schemas/careers';
import { bumpContentVersionStmt, getSettings, resetCmsCache, settingText } from '../cms';
import { notifyUser } from '../notifications';

export const APPLICATION_PAGE_SIZE = 50;

// ---------------------------------------------------------------- postings

export interface AdminPosting {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  employmentType: PostingInput['employmentType'];
  workplace: PostingInput['workplace'];
  salaryMinMinor: number | null;
  salaryMaxMinor: number | null;
  salaryCurrency: string | null;
  salaryPeriod: 'hour' | 'month' | 'year' | null;
  showSalary: boolean;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  niceToHaves: string[];
  offer: string[];
  howToApply: string | null;
  questions: CustomQuestion[];
  opensAt: string | null;
  closesAt: string | null;
  closedAt: string | null;
  status: 'draft' | 'open' | 'closed' | 'archived';
  updatedAt: string;
}

interface PostingDb {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  employment_type: AdminPosting['employmentType'];
  workplace: AdminPosting['workplace'];
  salary_min_minor: number | null;
  salary_max_minor: number | null;
  salary_currency: string | null;
  salary_period: AdminPosting['salaryPeriod'];
  show_salary: number;
  summary: string;
  description: string | null;
  responsibilities: string;
  requirements: string;
  nice_to_haves: string;
  offer: string;
  how_to_apply: string | null;
  custom_questions: string;
  opens_at: string | null;
  closes_at: string | null;
  closed_at: string | null;
  status: AdminPosting['status'];
  updated_at: string;
}

const arr = (v: string): string[] => {
  try {
    const a = JSON.parse(v) as unknown;
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const qs = (v: string): CustomQuestion[] => {
  try {
    const a = JSON.parse(v) as unknown[];
    return Array.isArray(a)
      ? a.flatMap((q) => (customQuestionSchema.safeParse(q).success ? [q as CustomQuestion] : []))
      : [];
  } catch {
    return [];
  }
};

const toPosting = (r: PostingDb): AdminPosting => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  department: r.department,
  location: r.location,
  employmentType: r.employment_type,
  workplace: r.workplace,
  salaryMinMinor: r.salary_min_minor,
  salaryMaxMinor: r.salary_max_minor,
  salaryCurrency: r.salary_currency,
  salaryPeriod: r.salary_period,
  showSalary: r.show_salary === 1,
  summary: r.summary,
  description: r.description ?? '',
  responsibilities: arr(r.responsibilities),
  requirements: arr(r.requirements),
  niceToHaves: arr(r.nice_to_haves),
  offer: arr(r.offer),
  howToApply: r.how_to_apply,
  questions: qs(r.custom_questions),
  opensAt: r.opens_at,
  closesAt: r.closes_at,
  closedAt: r.closed_at,
  status: r.status,
  updatedAt: r.updated_at,
});

export async function listPostingsAdmin(ctx: RequestContext) {
  assertCan(ctx, 'careers.view');
  const { results } = await ctx.db
    .prepare(
      `SELECT p.*,
         (SELECT COUNT(*) FROM job_applications a WHERE a.posting_id = p.id) AS applicants,
         (SELECT COUNT(*) FROM job_applications a WHERE a.posting_id = p.id AND a.status = 'new' AND a.anonymised_at IS NULL) AS fresh
       FROM job_postings p
       ORDER BY CASE p.status WHEN 'open' THEN 0 WHEN 'draft' THEN 1 WHEN 'closed' THEN 2 ELSE 3 END, p.updated_at DESC`,
    )
    .all<PostingDb & { applicants: number; fresh: number }>();
  const general = await ctx.db
    .prepare(
      "SELECT COUNT(*) AS n, SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS fresh FROM job_applications WHERE posting_id IS NULL AND anonymised_at IS NULL",
    )
    .first<{ n: number; fresh: number | null }>();
  return {
    postings: results.map((r) => ({ ...toPosting(r), applicants: r.applicants, fresh: r.fresh })),
    general: { applicants: general?.n ?? 0, fresh: general?.fresh ?? 0 },
  };
}

export async function getPostingAdmin(ctx: RequestContext, id: string): Promise<AdminPosting> {
  assertCan(ctx, 'careers.view');
  const r = await ctx.db.prepare('SELECT * FROM job_postings WHERE id = ?').bind(id).first<PostingDb>();
  if (!r) throw notFound();
  return toPosting(r);
}

const postingValues = (i: PostingInput) => [
  i.slug,
  i.title,
  i.department,
  i.location,
  i.employmentType,
  i.workplace,
  i.salaryMinMinor,
  i.salaryMaxMinor,
  i.salaryCurrency,
  i.salaryPeriod,
  i.showSalary ? 1 : 0,
  i.summary,
  sanitizeHtml(i.description),
  JSON.stringify(i.responsibilities),
  JSON.stringify(i.requirements),
  JSON.stringify(i.niceToHaves),
  JSON.stringify(i.offer),
  i.howToApply,
  JSON.stringify(i.questions),
  i.opensAt,
  i.closesAt,
];

async function runWrite(batch: Batch) {
  try {
    await batch.run();
    resetCmsCache();
  } catch (err) {
    if (isUniqueViolation(err)) throw validationError({ slug: ['Another posting already uses that web address.'] });
    throw err;
  }
}

async function checkCurrency(ctx: RequestContext, code: string | null) {
  if (!code) return;
  if (!(await ctx.db.prepare('SELECT code FROM currencies WHERE code = ?').bind(code).first()))
    throw validationError({ salaryCurrency: ['Choose a currency.'] });
}

export async function createPosting(ctx: RequestContext, input: PostingInput): Promise<{ id: string }> {
  assertCan(ctx, 'careers.manage');
  await checkCurrency(ctx, input.salaryCurrency);
  const id = newId('job', ctx.now().getTime());
  const now = ctx.now().toISOString();
  await runWrite(
    new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          `INSERT INTO job_postings (id, slug, title, department, location, employment_type, workplace, salary_min_minor, salary_max_minor,
             salary_currency, salary_period, show_salary, summary, description, responsibilities, requirements, nice_to_haves, offer,
             how_to_apply, custom_questions, opens_at, closes_at, status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
          id,
          ...postingValues(input),
          ctx.actor.userId,
          now,
          now,
        ),
      )
      .add(
        auditStmt(ctx, {
          action: 'job_posting.created',
          entityType: 'job_posting',
          entityId: id,
          after: { title: input.title, slug: input.slug },
        }),
      ),
  );
  return { id };
}

export async function updatePosting(ctx: RequestContext, id: string, input: PostingInput): Promise<void> {
  assertCan(ctx, 'careers.manage');
  const before = await getPostingAdmin(ctx, id);
  await checkCurrency(ctx, input.salaryCurrency);
  // Questions that applicants have already answered keep their ids (answers stay readable).
  await runWrite(
    new Batch(ctx.db)
      .add(
        stmt(
          ctx.db,
          `UPDATE job_postings SET slug = ?, title = ?, department = ?, location = ?, employment_type = ?, workplace = ?,
             salary_min_minor = ?, salary_max_minor = ?, salary_currency = ?, salary_period = ?, show_salary = ?, summary = ?, description = ?,
             responsibilities = ?, requirements = ?, nice_to_haves = ?, offer = ?, how_to_apply = ?, custom_questions = ?, opens_at = ?,
             closes_at = ?, updated_at = ? WHERE id = ?`,
          ...postingValues(input),
          ctx.now().toISOString(),
          id,
        ),
      )
      .add(bumpContentVersionStmt(ctx.db))
      .add(
        auditStmt(ctx, {
          action: 'job_posting.updated',
          entityType: 'job_posting',
          entityId: id,
          before: { title: before.title, slug: before.slug, closesAt: before.closesAt },
          after: { title: input.title, slug: input.slug, closesAt: input.closesAt },
        }),
      ),
  );
}

const TRANSITIONS: Record<AdminPosting['status'], AdminPosting['status'][]> = {
  draft: ['open', 'archived'],
  open: ['closed'],
  closed: ['open', 'archived'],
  archived: ['draft'],
};

/**
 * Status change. Opening needs a closing date in the future (or none); re-opening a closed posting clears its closed
 * date. Closing stamps `closed_at` (the retention clock starts then).
 */
export async function setPostingStatus(ctx: RequestContext, id: string, to: AdminPosting['status']): Promise<void> {
  assertCan(ctx, 'careers.manage');
  const p = await getPostingAdmin(ctx, id);
  if (!TRANSITIONS[p.status].includes(to)) throw conflict(`A ${p.status} posting can't become ${to}.`);
  const now = ctx.now().toISOString();
  if (to === 'open' && p.closesAt && p.closesAt <= now)
    throw validationError({ closesAt: ['The closing date has passed. Set a new one before opening.'] });
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE job_postings SET status = ?, closed_at = CASE WHEN ? = 'closed' THEN ? WHEN ? = 'open' THEN NULL ELSE closed_at END,
           updated_at = ? WHERE id = ? AND status = ?`,
        to,
        to,
        now,
        to,
        now,
        id,
        p.status,
      ),
      'status',
    )
    .add(bumpContentVersionStmt(ctx.db))
    .add(
      auditStmt(ctx, {
        action: `job_posting.${to === 'open' ? 'opened' : to}`,
        entityType: 'job_posting',
        entityId: id,
        before: { status: p.status },
        after: { status: to },
      }),
    )
    .run();
  resetCmsCache();
  if (res.changes('status') !== 1) throw conflict('This posting changed. Reload and try again.');
}

/** A new draft with the same content, "-copy" slug and no dates. */
export async function duplicatePosting(ctx: RequestContext, id: string): Promise<{ id: string }> {
  const p = await getPostingAdmin(ctx, id);
  for (let n = 1; n < 50; n++) {
    const slug = `${p.slug}-copy${n > 1 ? `-${n}` : ''}`.slice(0, 80);
    try {
      return await createPosting(ctx, {
        slug,
        title: p.title,
        department: p.department,
        location: p.location,
        employmentType: p.employmentType,
        workplace: p.workplace,
        salaryMinMinor: p.salaryMinMinor,
        salaryMaxMinor: p.salaryMaxMinor,
        salaryCurrency: p.salaryCurrency,
        salaryPeriod: p.salaryPeriod,
        showSalary: p.showSalary,
        summary: p.summary,
        description: p.description,
        responsibilities: p.responsibilities,
        requirements: p.requirements,
        niceToHaves: p.niceToHaves,
        offer: p.offer,
        howToApply: p.howToApply,
        questions: p.questions,
        opensAt: null,
        closesAt: null,
      });
    } catch (err) {
      if (!(err instanceof Error && 'fields' in err)) throw err;
    }
  }
  throw conflict('Could not find a free web address for the copy.');
}

// ---------------------------------------------------------------- applications

export interface ApplicationRow {
  id: string;
  reference: string;
  posting_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  cv_file_id: string | null;
  cover_letter: string | null;
  cover_letter_file_id: string | null;
  answers: string;
  notice_period: string | null;
  salary_expectation: string | null;
  status: ApplicationStatus;
  rating: number | null;
  tags: string;
  assigned_to: string | null;
  anonymised_at: string | null;
  created_at: string;
  updated_at: string;
}

const escapeLike = (q: string) =>
  `%${q
    .trim()
    .slice(0, 80)
    .replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

export async function listApplications(ctx: RequestContext, f: ApplicationListQuery) {
  assertCan(ctx, 'careers.view');
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.postingId === 'general') where.push('a.posting_id IS NULL');
  else if (f.postingId) {
    where.push('a.posting_id = ?');
    params.push(f.postingId);
  }
  const status = f.status ?? 'all';
  if (status === 'active') where.push("a.status NOT IN ('hired','rejected','withdrawn')");
  else if (status !== 'all') {
    where.push('a.status = ?');
    params.push(status);
  }
  if (f.assignee === 'me') {
    where.push('a.assigned_to = ?');
    params.push(ctx.actor.userId);
  } else if (f.assignee === 'none') where.push('a.assigned_to IS NULL');
  else if (f.assignee) {
    where.push('a.assigned_to = ?');
    params.push(f.assignee);
  }
  if (f.tag) {
    where.push('EXISTS (SELECT 1 FROM json_each(a.tags) t WHERE t.value = ?)');
    params.push(f.tag);
  }
  if (f.minRating) {
    where.push('a.rating >= ?');
    params.push(f.minRating);
  }
  if (f.q) {
    where.push(`(a.full_name LIKE ? ESCAPE '\\' OR a.email LIKE ? ESCAPE '\\' OR a.reference LIKE ? ESCAPE '\\')`);
    params.push(escapeLike(f.q), escapeLike(f.q), escapeLike(f.q));
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [count, rows] = await ctx.db.batch([
    ctx.db.prepare(`SELECT COUNT(*) AS n FROM job_applications a ${w}`).bind(...params),
    ctx.db
      .prepare(
        `SELECT a.id, a.reference, a.posting_id, a.full_name, a.email, a.status, a.rating, a.tags, a.assigned_to, a.anonymised_at,
           a.created_at, p.title AS posting_title, u.name AS assignee_name
         FROM job_applications a LEFT JOIN job_postings p ON p.id = a.posting_id LEFT JOIN users u ON u.id = a.assigned_to
         ${w} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, APPLICATION_PAGE_SIZE, (f.page - 1) * APPLICATION_PAGE_SIZE),
  ]);
  const total = ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  type ListRow = Pick<
    ApplicationRow,
    | 'id'
    | 'reference'
    | 'posting_id'
    | 'full_name'
    | 'email'
    | 'status'
    | 'rating'
    | 'tags'
    | 'assigned_to'
    | 'anonymised_at'
    | 'created_at'
  > & { posting_title: string | null; assignee_name: string | null };
  return {
    items: ((rows?.results ?? []) as ListRow[]).map((r) => ({ ...r, tags: arr(r.tags) })),
    total,
    page: f.page,
    pages: Math.max(1, Math.ceil(total / APPLICATION_PAGE_SIZE)),
  };
}

async function loadApplication(ctx: RequestContext, id: string): Promise<ApplicationRow> {
  const r = await ctx.db.prepare('SELECT * FROM job_applications WHERE id = ?').bind(id).first<ApplicationRow>();
  if (!r) throw notFound();
  return r;
}

export async function getApplication(ctx: RequestContext, id: string) {
  assertCan(ctx, 'careers.view');
  const a = await loadApplication(ctx, id);
  const [posting, events, files, assignee] = await ctx.db.batch([
    ctx.db.prepare('SELECT id, title, slug FROM job_postings WHERE id = ?').bind(a.posting_id ?? ''),
    ctx.db
      .prepare(
        `SELECT e.id, e.type, e.body, e.created_at, u.name AS actor FROM job_application_events e LEFT JOIN users u ON u.id = e.actor_id
         WHERE e.application_id = ? ORDER BY e.created_at DESC, e.id DESC`,
      )
      .bind(id),
    ctx.db
      .prepare('SELECT id, original_name, size_bytes, mime_type FROM files WHERE id IN (?, ?)')
      .bind(a.cv_file_id ?? '', a.cover_letter_file_id ?? ''),
    ctx.db.prepare('SELECT id, name FROM users WHERE id = ?').bind(a.assigned_to ?? ''),
  ]);
  const p = ((posting?.results ?? [])[0] as { id: string; title: string; slug: string } | undefined) ?? null;
  // Stored at submission as [{ questionId, question, answer }] so answers stay readable after questions change.
  let answers: { label: string; value: string }[] = [];
  try {
    const parsed = JSON.parse(a.answers) as { question?: string; questionId?: string; answer?: string }[];
    answers = Array.isArray(parsed)
      ? parsed.map((x) => ({ label: x.question ?? x.questionId ?? 'Question', value: x.answer ?? '' }))
      : [];
  } catch {
    answers = [];
  }
  const fileRows = (files?.results ?? []) as {
    id: string;
    original_name: string;
    size_bytes: number;
    mime_type: string;
  }[];
  return {
    application: { ...a, tags: arr(a.tags) },
    posting: p ? { id: p.id, title: p.title, slug: p.slug } : null,
    answers,
    cv: fileRows.find((f) => f.id === a.cv_file_id) ?? null,
    coverLetterFile: fileRows.find((f) => f.id === a.cover_letter_file_id) ?? null,
    events: (events?.results ?? []) as {
      id: string;
      type: string;
      body: string | null;
      created_at: string;
      actor: string | null;
    }[],
    assignee: ((assignee?.results ?? [])[0] as { id: string; name: string } | undefined) ?? null,
  };
}

/** Staff who can work on applicants (reviewers for the "assigned to" picker). */
export async function reviewers(ctx: RequestContext) {
  const { results } = await ctx.db
    .prepare(
      `SELECT DISTINCT u.id, u.name FROM users u JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
       WHERE u.user_type = 'staff' AND u.status = 'active' AND (ur.role_id = 'rol_super_admin' OR rp.permission_key = 'careers.view')
       ORDER BY u.name`,
    )
    .all<{ id: string; name: string }>();
  return results;
}

const eventStmt = (ctx: RequestContext, appId: string, type: string, body: string | null) =>
  stmt(
    ctx.db,
    'INSERT INTO job_application_events (id, application_id, actor_id, type, body, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    newId('aev', ctx.now().getTime()),
    appId,
    ctx.actor.userId,
    type,
    body,
    ctx.now().toISOString(),
  );

const STATUS_TEXT: Record<ApplicationStatus, string> = {
  new: 'New',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

/** Status (pipeline move), rating, tags and reviewer. Each change is a history event; erased applicants are read-only. */
export async function updateApplication(ctx: RequestContext, id: string, input: ApplicationUpdate): Promise<void> {
  assertCan(ctx, 'careers.manage');
  const a = await loadApplication(ctx, id);
  if (a.anonymised_at) throw conflict('This applicant has been erased.');
  if (input.assignedTo) {
    const ok = (await reviewers(ctx)).some((r) => r.id === input.assignedTo);
    if (!ok) throw validationError({ assignedTo: ['Choose a colleague who can see applicants.'] });
  }
  const events: D1PreparedStatement[] = [];
  if (input.status && input.status !== a.status)
    events.push(eventStmt(ctx, id, 'status_change', `${STATUS_TEXT[a.status]} → ${STATUS_TEXT[input.status]}`));
  if (input.rating !== undefined && input.rating !== a.rating)
    events.push(eventStmt(ctx, id, 'rating', input.rating ? `Rated ${input.rating} of 5` : 'Rating cleared'));
  const assignChanged = input.assignedTo !== undefined && input.assignedTo !== a.assigned_to;
  const now = ctx.now().toISOString();
  const res = await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE job_applications SET status = COALESCE(?, status), rating = CASE WHEN ? = 1 THEN ? ELSE rating END,
           tags = COALESCE(?, tags), assigned_to = CASE WHEN ? = 1 THEN ? ELSE assigned_to END, updated_at = ?
         WHERE id = ? AND updated_at = ? AND anonymised_at IS NULL`,
        input.status ?? null,
        input.rating !== undefined ? 1 : 0,
        input.rating ?? null,
        input.tags ? JSON.stringify([...new Set(input.tags.map((t) => t.toLowerCase()))]) : null,
        assignChanged ? 1 : 0,
        input.assignedTo ?? null,
        now,
        id,
        a.updated_at,
      ),
      'update',
    )
    .addAll(events)
    .addAll(
      assignChanged && input.assignedTo
        ? [
            notifyUser(ctx, input.assignedTo, {
              type: 'application.new',
              title: `Applicant assigned to you: ${a.reference}`,
              link: `/admin/careers/applications/${id}`,
              entityType: 'job_application',
              entityId: id,
              dedupeKey: `application_assigned:${id}:${now}`,
            }),
          ]
        : [],
    )
    .add(
      auditStmt(ctx, {
        action: 'application.updated',
        entityType: 'job_application',
        entityId: id,
        before: { status: a.status, rating: a.rating, assignedTo: a.assigned_to },
        after: {
          status: input.status ?? a.status,
          rating: input.rating ?? a.rating,
          assignedTo: input.assignedTo ?? a.assigned_to,
        },
      }),
    )
    .run();
  if (res.changes('update') !== 1) throw conflict('This applicant changed. Reload and try again.');
}

export async function addApplicationNote(ctx: RequestContext, id: string, body: string): Promise<void> {
  assertCan(ctx, 'careers.manage');
  const a = await loadApplication(ctx, id);
  if (a.anonymised_at) throw conflict('This applicant has been erased.');
  await new Batch(ctx.db)
    .add(eventStmt(ctx, id, 'note', body))
    .add(auditStmt(ctx, { action: 'application.note_added', entityType: 'job_application', entityId: id }))
    .run();
}

// ---------------------------------------------------------------- candidate emails

const DEFAULT_TEMPLATES: CandidateTemplates = {
  received: {
    subject: 'Your application for {position} ({reference})',
    body: 'Hi {name},\n\nThank you for applying for {position}. We have your application and will be in touch once we have reviewed it.\n\nKind regards,\n{company}',
  },
  interview: {
    subject: 'Interview invitation: {position}',
    body: 'Hi {name},\n\nThank you for your application for {position}. We would like to invite you to an interview. Please reply with two or three times that suit you this week or next.\n\nKind regards,\n{company}',
  },
  regret: {
    subject: 'Your application for {position}',
    body: "Hi {name},\n\nThank you for your interest in {position} and for the time you put into your application. After careful consideration we won't be taking your application further this time.\n\nWe wish you every success.\n\nKind regards,\n{company}",
  },
  offer: {
    subject: 'Offer: {position}',
    body: "Hi {name},\n\nWe are pleased to offer you the position of {position}. We'll follow up with the written offer and next steps. Please reply if you have any questions.\n\nKind regards,\n{company}",
  },
};

const templateKey = (k: CandidateTemplate) => `careers.template.${k}`;

/** The four candidate templates (saved versions, else the defaults). Placeholders: {name}, {position}, {reference}, {company}. */
export async function candidateTemplates(ctx: RequestContext): Promise<CandidateTemplates> {
  const settings = await getSettings(ctx);
  const out = { ...DEFAULT_TEMPLATES };
  for (const k of CANDIDATE_TEMPLATES) {
    const raw = settings[templateKey(k)];
    if (raw && typeof raw === 'object' && 'subject' in raw && 'body' in raw)
      out[k] = {
        subject: String((raw as { subject: unknown }).subject),
        body: String((raw as { body: unknown }).body),
      };
  }
  return out;
}

export async function saveCandidateTemplates(ctx: RequestContext, t: CandidateTemplates): Promise<void> {
  assertCan(ctx, 'careers.manage');
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .addAll(
      CANDIDATE_TEMPLATES.map((k) =>
        stmt(
          ctx.db,
          `INSERT INTO application_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
          templateKey(k),
          JSON.stringify(t[k]),
          ctx.actor.userId,
          now,
        ),
      ),
    )
    .add(bumpContentVersionStmt(ctx.db))
    .add(auditStmt(ctx, { action: 'careers.templates_updated', entityType: 'settings', entityId: 'careers.templates' }))
    .run();
  resetCmsCache();
}

const fill = (s: string, v: Record<string, string>) =>
  s.replace(/\{(name|position|reference|company)\}/g, (_, k: string) => v[k] ?? '');

async function placeholders(ctx: RequestContext, a: ApplicationRow) {
  const [settings, posting] = await Promise.all([
    getSettings(ctx),
    a.posting_id
      ? ctx.db.prepare('SELECT title FROM job_postings WHERE id = ?').bind(a.posting_id).first<{ title: string }>()
      : null,
  ]);
  return {
    name: a.full_name.split(/\s+/)[0] ?? a.full_name,
    position: posting?.title ?? 'a role at our company',
    reference: a.reference,
    company: settingText(settings, 'company.name') ?? 'Kuzikode Technologies',
  };
}

/** A template with the placeholders filled in for one applicant (the email dialog shows it for editing). */
export async function draftCandidateEmail(ctx: RequestContext, id: string, template: CandidateTemplate) {
  assertCan(ctx, 'careers.manage');
  const a = await loadApplication(ctx, id);
  const t = (await candidateTemplates(ctx))[template];
  const v = await placeholders(ctx, a);
  return { subject: fill(t.subject, v), body: fill(t.body, v) };
}

function candidateEmail(ctx: RequestContext, a: ApplicationRow, msg: { subject: string; body: string }, key: string) {
  return enqueue(ctx, {
    type: 'email.send',
    payload: {
      template: 'candidate_message',
      to: a.email!,
      data: { subject: msg.subject, body: msg.body, reference: a.reference },
    },
    idempotencyKey: `email:candidate:${a.id}:${key}`,
  });
}

/** Emails one applicant (template text, possibly edited). Recorded in the history; the audit row has no content. */
export async function emailApplicant(
  ctx: RequestContext,
  id: string,
  input: { template: CandidateTemplate; subject: string; body: string },
): Promise<void> {
  assertCan(ctx, 'careers.manage');
  const a = await loadApplication(ctx, id);
  if (a.anonymised_at || !a.email) throw conflict('This applicant has no email address on file.');
  const job = candidateEmail(ctx, a, input, `${input.template}:${ctx.now().getTime()}`);
  await new Batch(ctx.db)
    .add(job.stmt)
    .add(eventStmt(ctx, id, 'email_sent', `${input.subject}`))
    .add(
      auditStmt(ctx, {
        action: 'application.emailed',
        entityType: 'job_application',
        entityId: id,
        after: { template: input.template },
      }),
    )
    .run();
  dispatch(ctx, [job.id]);
}

/** Rejects several applicants at once, optionally with the regret email (one per applicant, never twice). */
export async function bulkReject(
  ctx: RequestContext,
  ids: string[],
  sendRegret: boolean,
): Promise<{ rejected: number; emailed: number }> {
  assertCan(ctx, 'careers.manage');
  const { results } = await ctx.db
    .prepare(
      `SELECT * FROM job_applications WHERE id IN (SELECT value FROM json_each(?)) AND anonymised_at IS NULL
         AND status NOT IN ('rejected','withdrawn','hired')`,
    )
    .bind(JSON.stringify(ids))
    .all<ApplicationRow>();
  if (results.length === 0) return { rejected: 0, emailed: 0 };
  const template = (await candidateTemplates(ctx)).regret;
  const now = ctx.now().toISOString();
  const batch = new Batch(ctx.db);
  const jobs: string[] = [];
  for (const a of results) {
    batch
      .add(
        stmt(
          ctx.db,
          "UPDATE job_applications SET status = 'rejected', updated_at = ? WHERE id = ? AND status = ?",
          now,
          a.id,
          a.status,
        ),
      )
      .add(eventStmt(ctx, a.id, 'status_change', `${STATUS_TEXT[a.status]} → Rejected`))
      .add(
        auditStmt(ctx, {
          action: 'application.rejected',
          entityType: 'job_application',
          entityId: a.id,
          after: { bulk: true, regretEmail: sendRegret && !!a.email },
        }),
      );
    if (sendRegret && a.email) {
      const v = await placeholders(ctx, a);
      const job = candidateEmail(
        ctx,
        a,
        { subject: fill(template.subject, v), body: fill(template.body, v) },
        'regret',
      );
      jobs.push(job.id);
      batch.add(job.stmt).add(eventStmt(ctx, a.id, 'email_sent', fill(template.subject, v)));
    }
  }
  await batch.run();
  dispatch(ctx, jobs);
  return { rejected: results.length, emailed: jobs.length };
}

/** "Erase applicant" (on request or by decision): files deleted, personal fields blanked, notes and emails dropped. Audited. */
export async function eraseApplicant(ctx: RequestContext, id: string): Promise<void> {
  assertCan(ctx, 'careers.manage');
  const a = await loadApplication(ctx, id);
  if (a.anonymised_at) return;
  const fileIds = [a.cv_file_id, a.cover_letter_file_id].filter((f): f is string => !!f);
  const files = fileIds.length
    ? (
        await ctx.db
          .prepare('SELECT id, r2_key FROM files WHERE id IN (SELECT value FROM json_each(?))')
          .bind(JSON.stringify(fileIds))
          .all<{ id: string; r2_key: string }>()
      ).results
    : [];
  const now = ctx.now().toISOString();
  await new Batch(ctx.db)
    .add(
      stmt(
        ctx.db,
        `UPDATE job_applications SET full_name = 'Erased applicant', email = NULL, phone = NULL, location = NULL, linkedin_url = NULL,
           portfolio_url = NULL, cv_file_id = NULL, cover_letter = NULL, cover_letter_file_id = NULL, answers = '[]', notice_period = NULL,
           salary_expectation = NULL, ip_hash = NULL, tags = '[]', anonymised_at = ?, updated_at = ? WHERE id = ? AND anonymised_at IS NULL`,
        now,
        now,
        id,
      ),
    )
    .sql("DELETE FROM job_application_events WHERE application_id = ? AND type IN ('note','email_sent')", id)
    .add(eventStmt(ctx, id, 'erased', 'Personal data erased by staff.'))
    .addAll(files.map((f) => stmt(ctx.db, 'DELETE FROM files WHERE id = ?', f.id)))
    .add(
      auditStmt(ctx, {
        action: 'application.erased',
        entityType: 'job_application',
        entityId: id,
        after: { reference: a.reference },
      }),
    )
    .run();
  for (const f of files) await ctx.env.FILES.delete(f.r2_key).catch(() => undefined);
}

export { APPLICATION_STATUSES };
