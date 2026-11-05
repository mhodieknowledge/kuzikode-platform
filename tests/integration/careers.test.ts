import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import {
  applyApplicationRetention,
  autoClosePostings,
  getPostingView,
  jobPostingLd,
  listOpenPostings,
  validateAnswers,
} from '../../src/server/modules/careers';
import { bumpContentVersionStmt, resetCmsCache } from '../../src/server/modules/cms';
import { ORIGIN } from '../helpers/api';
import { createStaff } from '../helpers/factories';
import { docx, exe, pdf } from '../helpers/file-fixtures';
import { seedBase } from '../helpers/seed';

const at = (iso: string) => createContext({ env, now: () => new Date(iso) });
const ctx = () => at('2026-11-05T10:00:00Z');
const questions = JSON.stringify([
  { id: 'right_to_work', label: 'Do you have the right to work in Zimbabwe?', type: 'yes_no', required: true },
  { id: 'stack', label: 'Preferred stack', type: 'select', required: false, options: ['React', 'Flutter'] },
]);

async function posting(slug: string, over: Record<string, unknown> = {}) {
  const row = {
    id: `job_${slug.replace(/-/g, '_')}`,
    slug,
    title: `Role ${slug}`,
    department: 'Engineering',
    location: 'Harare',
    employment_type: 'full_time',
    workplace: 'hybrid',
    summary: 'A real summary.',
    responsibilities: '["Build things"]',
    requirements: '["Know things"]',
    custom_questions: questions,
    status: 'open',
    opens_at: '2026-11-01T00:00:00.000Z',
    closes_at: '2026-12-01T00:00:00.000Z',
    ...over,
  };
  const cols = Object.keys(row);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR REPLACE INTO job_postings (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    ).bind(...Object.values(row)),
    bumpContentVersionStmt(env.DB),
  ]);
  resetCmsCache();
}

let ip = 0;
async function apply(
  slug: string | null,
  data: Record<string, unknown>,
  cv?: { bytes: Uint8Array<ArrayBuffer>; name: string },
) {
  const form = new FormData();
  form.set(
    'data',
    JSON.stringify({
      fullName: 'Rufaro Example',
      email: 'rufaro@example.com',
      consent: true,
      turnstileToken: 'test',
      answers: { right_to_work: 'yes' },
      ...data,
    }),
  );
  if (cv) form.set('cv', new File([cv.bytes], cv.name));
  const path = slug ? `/api/v1/public/careers/${slug}/applications` : '/api/v1/public/careers/applications';
  const res = await exports.default.fetch(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'cf-connecting-ip': `10.6.0.${++ip}` },
    body: form,
  });
  return { status: res.status, body: (await res.json()) as any };
}

describe('careers (docs/12 §B, docs/08)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM job_application_events'),
      env.DB.prepare('DELETE FROM job_applications'),
      env.DB.prepare('DELETE FROM job_postings'),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
  });

  it('apply with a valid PDF CV → stored privately, reference returned, hiring staff notified, applicant emailed', async () => {
    const hiring = await createStaff(['hiring_manager']);
    await posting('frontend-developer');
    const res = await apply(
      'frontend-developer',
      { answers: { right_to_work: 'yes', stack: 'React' } },
      { bytes: pdf(), name: 'cv.pdf' },
    );
    expect(res.status).toBe(201);
    expect(res.body.data.reference).toMatch(/^APP-\d{4}-\d{4}$/);
    const row = await env.DB.prepare('SELECT * FROM job_applications WHERE reference = ?')
      .bind(res.body.data.reference)
      .first<any>();
    expect(row).toMatchObject({ posting_id: 'job_frontend_developer', status: 'new', email: 'rufaro@example.com' });
    expect(JSON.parse(row.answers)).toEqual([
      { questionId: 'right_to_work', question: 'Do you have the right to work in Zimbabwe?', answer: 'yes' },
      { questionId: 'stack', question: 'Preferred stack', answer: 'React' },
    ]);
    const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(row.cv_file_id).first<any>();
    expect(file).toMatchObject({
      owner_type: 'careers',
      owner_id: row.id,
      visibility: 'private',
      mime_type: 'application/pdf',
    });
    const note = await env.DB.prepare("SELECT title FROM notifications WHERE user_id = ? AND type = 'application.new'")
      .bind(hiring.id)
      .first<any>();
    expect(note.title).toBe('New application: Role frontend-developer');
    const mail = await env.DB.prepare(
      "SELECT COUNT(*) n FROM outbox WHERE json_extract(payload,'$.template') = 'application_acknowledgement' AND json_extract(payload,'$.to') = 'rufaro@example.com'",
    ).first<any>();
    expect(mail.n).toBe(1);
  });

  it('rejects a renamed EXE, a missing CV, missing required answers and invalid options; DOCX is accepted', async () => {
    await posting('analyst');
    const before = (await env.DB.prepare('SELECT COUNT(*) n FROM job_applications').first<any>()).n;
    const exeRes = await apply('analyst', {}, { bytes: exe(), name: 'cv.pdf' });
    expect(exeRes.status).toBe(422);
    expect(exeRes.body.error.fields.file).toBeDefined();
    expect((await apply('analyst', {})).body.error.fields.cv).toBeDefined();
    const answers = await apply('analyst', { answers: { stack: 'COBOL' } }, { bytes: pdf(), name: 'cv.pdf' });
    expect(Object.keys(answers.body.error.fields).sort()).toEqual(['answers.right_to_work', 'answers.stack']);
    expect((await env.DB.prepare('SELECT COUNT(*) n FROM job_applications').first<any>()).n).toBe(before);
    expect((await apply('analyst', {}, { bytes: docx(), name: 'cv.docx' })).status).toBe(201);
  });

  it('closed, future and unknown postings reject applications; general applications follow the setting', async () => {
    await posting('closed-role', { status: 'closed', closed_at: '2026-11-02T00:00:00.000Z' });
    await posting('past-deadline', { closes_at: '2026-11-04T00:00:00.000Z' });
    await posting('future-role', { opens_at: '2026-12-01T00:00:00.000Z', closes_at: null });
    for (const slug of ['closed-role', 'past-deadline', 'future-role']) {
      const r = await apply(slug, {}, { bytes: pdf(), name: 'cv.pdf' });
      expect(r.status, slug).toBe(422);
      expect(r.body.error.fields.posting).toBeDefined();
    }
    expect((await apply('nope', {}, { bytes: pdf(), name: 'cv.pdf' })).status).toBe(404);
    expect((await apply(null, { answers: {} }, { bytes: pdf(), name: 'cv.pdf' })).status).toBe(422);
    await env.DB.batch([
      env.DB.prepare("UPDATE application_settings SET value = 'true' WHERE key = 'careers.general_applications'"),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
    const general = await apply(null, { answers: {} }, { bytes: pdf(), name: 'cv.pdf' });
    expect(general.status).toBe(201);
    await env.DB.batch([
      env.DB.prepare("UPDATE application_settings SET value = 'false' WHERE key = 'careers.general_applications'"),
      bumpContentVersionStmt(env.DB),
    ]);
  });

  it('auto-closes postings on their closing date; JSON-LD only for open roles; 410 ninety days after closing', async () => {
    await posting('soon-closing', { closes_at: '2026-11-05T12:00:00.000Z' });
    expect((await listOpenPostings(ctx())).all.map((p) => p.slug)).toEqual(['soon-closing']);
    const view = await getPostingView(ctx(), 'soon-closing');
    expect(view!.state).toBe('open');
    const ld = await jobPostingLd(ctx(), (view as { posting: any }).posting);
    expect(ld).toMatchObject({
      '@type': 'JobPosting',
      employmentType: 'FULL_TIME',
      validThrough: '2026-11-05T12:00:00.000Z',
    });
    expect(JSON.stringify(ld)).not.toContain('baseSalary');

    expect(await autoClosePostings(at('2026-11-05T11:00:00Z'))).toBe(0);
    expect(await autoClosePostings(at('2026-11-05T12:05:00Z'))).toBe(1);
    resetCmsCache();
    const row = await env.DB.prepare(
      "SELECT status, closed_at FROM job_postings WHERE slug = 'soon-closing'",
    ).first<any>();
    expect(row).toEqual({ status: 'closed', closed_at: '2026-11-05T12:00:00.000Z' });
    expect((await getPostingView(at('2026-11-06T00:00:00Z'), 'soon-closing'))!.state).toBe('closed');
    expect((await getPostingView(at('2027-02-10T00:00:00Z'), 'soon-closing'))!.state).toBe('gone');
    expect(await getPostingView(ctx(), 'unknown')).toBeNull();
  });

  it('remote roles use TELECOMMUTE and salaries appear only when show_salary is set', async () => {
    await posting('remote-role', {
      workplace: 'remote',
      show_salary: 1,
      salary_min_minor: 80000,
      salary_max_minor: 120000,
      salary_currency: 'USD',
      salary_period: 'month',
    });
    const view = (await getPostingView(ctx(), 'remote-role')) as { posting: any };
    expect(await jobPostingLd(ctx(), view.posting)).toMatchObject({
      jobLocationType: 'TELECOMMUTE',
      baseSalary: { currency: 'USD', value: { minValue: 800, maxValue: 1200, unitText: 'MONTH' } },
    });
  });

  it('retention anonymises applications and deletes their CV once the posting has been closed for 12 months', async () => {
    await posting('old-role');
    const res = await apply('old-role', {}, { bytes: pdf(), name: 'cv.pdf' });
    const app = await env.DB.prepare('SELECT * FROM job_applications WHERE reference = ?')
      .bind(res.body.data.reference)
      .first<any>();
    const file = await env.DB.prepare('SELECT r2_key FROM files WHERE id = ?').bind(app.cv_file_id).first<any>();
    expect(await env.FILES.head(file.r2_key)).not.toBeNull();
    await env.DB.prepare(
      "UPDATE job_postings SET status = 'closed', closed_at = '2026-11-10T00:00:00.000Z' WHERE slug = 'old-role'",
    ).run();

    expect(await applyApplicationRetention(at('2027-11-01T02:17:00Z'))).toBe(0);
    expect(await applyApplicationRetention(at('2027-11-11T02:17:00Z'))).toBe(1);
    const after = await env.DB.prepare('SELECT * FROM job_applications WHERE id = ?').bind(app.id).first<any>();
    expect(after).toMatchObject({
      full_name: 'Anonymised applicant',
      email: null,
      phone: null,
      cv_file_id: null,
      answers: '[]',
    });
    expect(after.anonymised_at).not.toBeNull();
    expect(await env.DB.prepare('SELECT id FROM files WHERE id = ?').bind(app.cv_file_id).first()).toBeNull();
    expect(await env.FILES.head(file.r2_key)).toBeNull();
    const event = await env.DB.prepare(
      "SELECT type FROM job_application_events WHERE application_id = ? AND type = 'erased'",
    )
      .bind(app.id)
      .first<any>();
    expect(event.type).toBe('erased');
    expect(await applyApplicationRetention(at('2027-11-12T02:17:00Z'))).toBe(0);
    // The count for reporting survives.
    expect(
      (await env.DB.prepare("SELECT COUNT(*) n FROM job_applications WHERE posting_id = 'job_old_role'").first<any>())
        .n,
    ).toBe(1);
  });

  it('validateAnswers ignores unknown questions and checks types', () => {
    const qs = JSON.parse(questions);
    expect(validateAnswers(qs, { right_to_work: 'maybe', extra: 'x' }).fields).toEqual({
      'answers.right_to_work': ['Choose yes or no.'],
    });
  });
});
