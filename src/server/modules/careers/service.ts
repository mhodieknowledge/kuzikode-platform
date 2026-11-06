/**
 * Careers (docs/12 §B): public postings, applications with CV upload, JobPosting JSON-LD, auto-close and the
 * retention job that anonymises applications and deletes CVs. Applications are personal data, not financial records.
 */
import { z } from 'zod';
import {
  customQuestionSchema,
  EMPLOYMENT_TYPES,
  WORKPLACES,
  type applicationSchema,
  type CustomQuestion,
  type EmploymentType,
  type Workplace,
} from '../../../shared/schemas/careers';
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { hashIp, type Bytes } from '../../lib/crypto';
import { businessYear } from '../../lib/dates';
import { notFound, validationError } from '../../lib/errors';
import { newId } from '../../lib/ids';
import { guardPublicSubmission } from '../../lib/public-forms';
import { numberSqlExpr, renderNumber, sequenceKey, sequenceStatements } from '../../lib/sequences';
import { sanitizeHtml } from '../../lib/html-sanitize';
import { dispatch, enqueue } from '../../jobs/outbox';
import { cached, getSettings, resetCmsCache, settingBool, settingNumber, settingText } from '../cms';
import { storeUpload } from '../files';
import { notifyStaffWithPermission } from '../notifications';

type ApplicationOutput = z.output<typeof applicationSchema>;

export interface PublicPosting {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  employmentType: EmploymentType;
  workplace: Workplace;
  salary: { min: number | null; max: number | null; currency: string; period: 'hour' | 'month' | 'year' } | null;
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
  status: 'open' | 'closed' | 'archived';
  updatedAt: string;
}

interface PostingRow {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  employment_type: EmploymentType;
  workplace: Workplace;
  salary_min_minor: number | null;
  salary_max_minor: number | null;
  salary_currency: string | null;
  salary_period: 'hour' | 'month' | 'year' | null;
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
  status: 'open' | 'closed' | 'archived';
  updated_at: string;
}

const strings = (v: string): string[] => {
  try {
    const a = JSON.parse(v) as unknown;
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string').slice(0, 30) : [];
  } catch {
    return [];
  }
};

function questions(v: string): CustomQuestion[] {
  try {
    const parsed = z.array(customQuestionSchema).max(5).safeParse(JSON.parse(v));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function toPosting(r: PostingRow): PublicPosting {
  const showSalary =
    r.show_salary === 1 && r.salary_currency && r.salary_period && (r.salary_min_minor ?? r.salary_max_minor) !== null;
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    department: r.department,
    location: r.location,
    employmentType: r.employment_type,
    workplace: r.workplace,
    salary: showSalary
      ? { min: r.salary_min_minor, max: r.salary_max_minor, currency: r.salary_currency!, period: r.salary_period! }
      : null,
    summary: r.summary,
    description: sanitizeHtml(r.description ?? ''),
    responsibilities: strings(r.responsibilities),
    requirements: strings(r.requirements),
    niceToHaves: strings(r.nice_to_haves),
    offer: strings(r.offer),
    howToApply: r.how_to_apply,
    questions: questions(r.custom_questions),
    opensAt: r.opens_at,
    closesAt: r.closes_at,
    closedAt: r.closed_at,
    status: r.status,
    updatedAt: r.updated_at,
  };
}

/** Published (non-draft) postings, newest first. Drafts never leave the server. */
function loadPostings(ctx: RequestContext): Promise<PublicPosting[]> {
  return cached(ctx, 'job-postings', async () => {
    const { results } = await ctx.db
      .prepare(
        "SELECT * FROM job_postings WHERE status IN ('open','closed','archived') ORDER BY COALESCE(opens_at, created_at) DESC LIMIT 500",
      )
      .all<PostingRow>();
    return results.map(toPosting);
  });
}

/** A posting accepts applications while it is open, has opened, and its closing date has not passed. */
export function isAccepting(p: PublicPosting, now: Date): boolean {
  const t = now.toISOString();
  return p.status === 'open' && (!p.opensAt || p.opensAt <= t) && (!p.closesAt || p.closesAt > t);
}

export interface PostingFilter {
  department?: string | undefined;
  type?: string | undefined;
  workplace?: string | undefined;
}

export async function listOpenPostings(ctx: RequestContext, filter: PostingFilter = {}) {
  const now = ctx.now();
  const open = (await loadPostings(ctx)).filter((p) => isAccepting(p, now));
  return {
    all: open,
    postings: open.filter(
      (p) =>
        (!filter.department || p.department === filter.department) &&
        (!filter.type || p.employmentType === filter.type) &&
        (!filter.workplace || p.workplace === filter.workplace),
    ),
    departments: [...new Set(open.map((p) => p.department))].sort(),
  };
}

export type PostingView =
  | { state: 'open'; posting: PublicPosting }
  | { state: 'closed'; posting: PublicPosting }
  | { state: 'preview'; posting: PublicPosting }
  | { state: 'gone' };

/** Closed postings show a "closed" state; 90 days after closing they are gone (410). Archived ones are gone. */
export async function getPostingView(ctx: RequestContext, slug: string): Promise<PostingView | null> {
  // Staff preview (`?preview=1`, careers.view): any status, read fresh, no form and no JSON-LD.
  if (ctx.preview) {
    const r = await ctx.db
      .prepare('SELECT * FROM job_postings WHERE slug = ?')
      .bind(slug)
      .first<Omit<PostingRow, 'status'> & { status: PostingRow['status'] | 'draft' }>();
    return r
      ? { state: 'preview', posting: toPosting({ ...r, status: r.status === 'draft' ? 'open' : r.status }) }
      : null;
  }
  const posting = (await loadPostings(ctx)).find((p) => p.slug === slug);
  if (!posting) return null;
  const now = ctx.now();
  if (isAccepting(posting, now)) return { state: 'open', posting };
  if (posting.status === 'archived') return { state: 'gone' };
  const closedAt = posting.closedAt ?? posting.closesAt;
  if (closedAt && now.getTime() - Date.parse(closedAt) > 90 * 86_400_000) return { state: 'gone' };
  if (posting.status === 'open' && posting.opensAt && posting.opensAt > now.toISOString()) return null; // not yet open
  return { state: 'closed', posting };
}

const abs = (ctx: RequestContext, path: string) => new URL(path, ctx.config.siteUrl).toString();
const LD_TYPE: Record<EmploymentType, string> = {
  full_time: 'FULL_TIME',
  part_time: 'PART_TIME',
  contract: 'CONTRACTOR',
  internship: 'INTERN',
  attachment: 'INTERN',
};

/** Google JobPosting structured data; only for postings that accept applications. */
export async function jobPostingLd(ctx: RequestContext, p: PublicPosting): Promise<Record<string, unknown>> {
  const settings = await getSettings(ctx);
  const list = (title: string, items: string[]) =>
    items.length ? `<h3>${title}</h3><ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : '';
  const description = [
    `<p>${escapeHtml(p.summary)}</p>`,
    p.description,
    list('Responsibilities', p.responsibilities),
    list('Requirements', p.requirements),
    list('Nice to have', p.niceToHaves),
    list('What we offer', p.offer),
  ].join('');
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: p.title,
    description,
    datePosted: (p.opensAt ?? p.updatedAt).slice(0, 10),
    ...(p.closesAt ? { validThrough: p.closesAt } : {}),
    employmentType: LD_TYPE[p.employmentType],
    hiringOrganization: {
      '@type': 'Organization',
      name: settingText(settings, 'company.name') ?? 'Kuzikode Technologies',
      sameAs: abs(ctx, '/'),
      logo: abs(ctx, '/icon-512.png'),
    },
    directApply: true,
    url: abs(ctx, `/careers/${p.slug}`),
    ...(p.workplace === 'remote'
      ? { jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: { '@type': 'Country', name: 'Zimbabwe' } }
      : {
          jobLocation: {
            '@type': 'Place',
            address: { '@type': 'PostalAddress', addressLocality: p.location, addressCountry: 'ZW' },
          },
        }),
    ...(p.salary
      ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: p.salary.currency,
            value: {
              '@type': 'QuantitativeValue',
              ...(p.salary.min !== null ? { minValue: p.salary.min / 100 } : {}),
              ...(p.salary.max !== null ? { maxValue: p.salary.max / 100 } : {}),
              unitText: p.salary.period.toUpperCase(),
            },
          },
        }
      : {}),
  };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const employmentTypeLabel = (t: EmploymentType) => EMPLOYMENT_TYPES[t];
export const workplaceLabel = (w: Workplace) => WORKPLACES[w];

/** Validates answers against the posting's questions; returns stored answers in question order. */
export function validateAnswers(qs: CustomQuestion[], answers: Record<string, string>) {
  const fields: Record<string, string[]> = {};
  const out: { questionId: string; question: string; answer: string }[] = [];
  for (const q of qs) {
    const a = (answers[q.id] ?? '').trim();
    if (!a) {
      if (q.required) fields[`answers.${q.id}`] = ['Please answer this question.'];
      continue;
    }
    if (q.type === 'short_text' && a.length > 300) fields[`answers.${q.id}`] = ['Keep this under 300 characters.'];
    if (q.type === 'yes_no' && a !== 'yes' && a !== 'no') fields[`answers.${q.id}`] = ['Choose yes or no.'];
    if (q.type === 'select' && !(q.options ?? []).includes(a))
      fields[`answers.${q.id}`] = ['Choose one of the options.'];
    out.push({ questionId: q.id, question: q.label, answer: a });
  }
  return { fields, answers: out };
}

export interface ApplicationResult {
  reference: string;
}

/**
 * Public application (docs/12 §B.1) for a posting, or a general application when `slug` is null and the setting allows.
 * CV is required (PDF/DOCX ≤ 5 MB, content-sniffed); a cover letter may be text or a file.
 */
export async function submitApplication(
  ctx: RequestContext,
  slug: string | null,
  input: ApplicationOutput,
  files: {
    cv?: { bytes: Bytes; filename: string } | undefined;
    coverLetter?: { bytes: Bytes; filename: string } | undefined;
  },
): Promise<ApplicationResult> {
  const settings = await getSettings(ctx);
  const format = settingText(settings, 'numbering.application') ?? 'APP-{YYYY}-{SEQ:4}';
  const year = businessYear(ctx.now());
  if (
    !(await guardPublicSubmission(ctx, { honeypot: input.website, token: input.turnstileToken, bucket: 'careers' }))
  ) {
    return { reference: renderNumber(format, year, 0) };
  }

  let posting: PublicPosting | null = null;
  if (slug) {
    posting = (await loadPostings(ctx)).find((p) => p.slug === slug) ?? null;
    if (!posting) throw notFound('This position does not exist.');
    if (!isAccepting(posting, ctx.now())) {
      throw validationError({ posting: ['This position is closed and no longer accepts applications.'] });
    }
  } else if (!settingBool(settings, 'careers.general_applications')) {
    throw validationError({ posting: ['We are not accepting general applications at the moment.'] });
  }

  const { fields, answers } = validateAnswers(posting?.questions ?? [], input.answers);
  if (!files.cv) fields['cv'] = ['Attach your CV as a PDF or Word document.'];
  if (Object.keys(fields).length) throw validationError(fields);

  const now = ctx.now();
  const id = newId('app', now.getTime());
  const cv = await storeUpload(ctx, { ...files.cv!, purpose: 'cv', ownerType: 'careers', ownerId: id });
  const letter = files.coverLetter
    ? await storeUpload(ctx, { ...files.coverLetter, purpose: 'cv', ownerType: 'careers', ownerId: id })
    : null;

  const key = sequenceKey('application', format, year);
  const ref = numberSqlExpr(key, format, year);
  const jobs = [
    enqueue(ctx, {
      type: 'email.send',
      payload: {
        template: 'application_acknowledgement',
        to: input.email,
        data: { name: input.fullName, applicationId: id, position: posting?.title ?? 'General application' },
      },
      idempotencyKey: `email:application_ack:${id}`,
    }),
  ];

  await new Batch(ctx.db)
    .addAll(sequenceStatements(ctx.db, key))
    .add(cv.stmt)
    .addAll(letter ? [letter.stmt] : [])
    .add(
      stmt(
        ctx.db,
        `INSERT INTO job_applications (id, reference, posting_id, full_name, email, phone, location, linkedin_url, portfolio_url,
           cv_file_id, cover_letter, cover_letter_file_id, answers, notice_period, salary_expectation, consent_at, ip_hash,
           status, created_at, updated_at)
         VALUES (?, ${ref.sql}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
        id,
        ...ref.params,
        posting?.id ?? null,
        input.fullName,
        input.email,
        input.phone ?? null,
        input.location ?? null,
        input.linkedinUrl ?? null,
        input.portfolioUrl ?? null,
        cv.id,
        input.coverLetter ?? null,
        letter?.id ?? null,
        JSON.stringify(answers),
        input.noticePeriod ?? null,
        input.salaryExpectation ?? null,
        now.toISOString(),
        await hashIp(ctx.ip, ctx.config.hmacSecret),
        now.toISOString(),
        now.toISOString(),
      ),
    )
    .add(
      notifyStaffWithPermission(ctx, 'careers.view', {
        type: 'application.new',
        title: `New application: ${posting?.title ?? 'General application'}`,
        body: input.fullName,
        link: `/admin/careers/applications/${id}`,
        entityType: 'job_application',
        entityId: id,
        dedupeKey: `application:${id}`,
      }),
    )
    .add(
      auditStmt(ctx, {
        action: 'application.received',
        entityType: 'job_application',
        entityId: id,
        after: { postingId: posting?.id ?? null },
      }),
    )
    .addAll(jobs.map((j) => j.stmt))
    .run();
  dispatch(
    ctx,
    jobs.map((j) => j.id),
  );
  const row = await ctx.db
    .prepare('SELECT reference FROM job_applications WHERE id = ?')
    .bind(id)
    .first<{ reference: string }>();
  return { reference: row!.reference };
}

/** Every-5-minutes cron: open postings whose closing date has passed become closed (and caches turn over). */
export async function autoClosePostings(ctx: RequestContext): Promise<number> {
  const now = ctx.now().toISOString();
  const due = "status = 'open' AND closes_at IS NOT NULL AND closes_at <= ?";
  const [, update] = await ctx.db.batch([
    ctx.db
      .prepare(
        `UPDATE application_settings SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT), updated_at = ?
         WHERE key = 'content_version' AND EXISTS (SELECT 1 FROM job_postings WHERE ${due})`,
      )
      .bind(now, now),
    ctx.db
      .prepare(`UPDATE job_postings SET status = 'closed', closed_at = closes_at, updated_at = ? WHERE ${due}`)
      .bind(now, now),
  ]);
  const changed = update?.meta.changes ?? 0;
  if (changed > 0) resetCmsCache();
  return changed;
}

/**
 * Nightly retention (docs/12 §B.2): applications older than `careers.retention_months` after their posting closed (or
 * after submission, for general applications) are anonymised and their CV / cover-letter files deleted. Counts remain.
 */
export async function applyApplicationRetention(ctx: RequestContext): Promise<number> {
  const months = settingNumber(await getSettings(ctx), 'careers.retention_months', 12);
  const cutoff = new Date(ctx.now());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - Math.max(1, months));
  const iso = cutoff.toISOString();
  const { results } = await ctx.db
    .prepare(
      `SELECT a.id, a.cv_file_id, a.cover_letter_file_id FROM job_applications a LEFT JOIN job_postings p ON p.id = a.posting_id
       WHERE a.anonymised_at IS NULL
         AND ((p.id IS NOT NULL AND COALESCE(p.closed_at, CASE WHEN p.status <> 'open' THEN p.updated_at END) < ?)
              OR (p.id IS NULL AND a.created_at < ?))
       LIMIT 200`,
    )
    .bind(iso, iso)
    .all<{ id: string; cv_file_id: string | null; cover_letter_file_id: string | null }>();
  if (results.length === 0) return 0;
  const now = ctx.now().toISOString();
  for (const app of results) {
    const fileIds = [app.cv_file_id, app.cover_letter_file_id].filter((f): f is string => !!f);
    const files = fileIds.length
      ? (
          await ctx.db
            .prepare('SELECT id, r2_key FROM files WHERE id IN (SELECT value FROM json_each(?))')
            .bind(JSON.stringify(fileIds))
            .all<{ id: string; r2_key: string }>()
        ).results
      : [];
    // Database first (so the record no longer points at the files), then the objects.
    await ctx.db.batch([
      stmt(
        ctx.db,
        `UPDATE job_applications SET full_name = 'Anonymised applicant', email = NULL, phone = NULL, location = NULL,
           linkedin_url = NULL, portfolio_url = NULL, cv_file_id = NULL, cover_letter = NULL, cover_letter_file_id = NULL,
           answers = '[]', notice_period = NULL, salary_expectation = NULL, ip_hash = NULL, tags = '[]',
           anonymised_at = ?, updated_at = ? WHERE id = ? AND anonymised_at IS NULL`,
        now,
        now,
        app.id,
      ),
      stmt(
        ctx.db,
        "DELETE FROM job_application_events WHERE application_id = ? AND type IN ('note','email_sent')",
        app.id,
      ),
      stmt(
        ctx.db,
        `INSERT INTO job_application_events (id, application_id, type, body, created_at) VALUES (?, ?, 'erased', ?, ?)`,
        newId('aev'),
        app.id,
        'Anonymised by the retention policy.',
        now,
      ),
      ...files.map((f) => stmt(ctx.db, 'DELETE FROM files WHERE id = ?', f.id)),
      auditStmt(ctx, {
        action: 'application.anonymised',
        entityType: 'job_application',
        entityId: app.id,
        after: { reason: 'retention' },
      }),
    ]);
    for (const f of files) await ctx.env.FILES.delete(f.r2_key);
  }
  return results.length;
}
