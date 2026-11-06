import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { getPostingView } from '../../src/server/modules/careers';
import { bumpContentVersionStmt, resetCmsCache } from '../../src/server/modules/cms';
import { ORIGIN, api, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';
import { pdf } from '../helpers/file-fixtures';
import { seedBase } from '../helpers/seed';

async function staff(roles: string[]) {
  const u = await createStaff(roles);
  return { ...(await login('admin', u.email, u.password)), id: u.id };
}
type S = Awaited<ReturnType<typeof staff>>;
const C = (s: S, path: string, body?: unknown, method?: string) =>
  api(`/api/v1/admin/careers${path}`, { cookie: s.cookie, csrf: s.csrf, body, ...(method ? { method } : {}) });
const row = (sql: string, ...p: unknown[]) =>
  env.DB.prepare(sql)
    .bind(...p)
    .first<any>();
const all = async (sql: string, ...p: unknown[]) =>
  (
    await env.DB.prepare(sql)
      .bind(...p)
      .all<any>()
  ).results;

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const posting = (over: Record<string, unknown> = {}) => ({
  slug: 'junior-developer',
  title: 'Junior Developer',
  department: 'Engineering',
  location: 'Harare',
  employmentType: 'full_time',
  workplace: 'hybrid',
  summary: 'Build web apps with a small, careful team.',
  description: '<p>About the role</p><script>alert(1)</script>',
  responsibilities: ['Build features', 'Write tests'],
  requirements: ['Some JavaScript'],
  questions: [
    { id: 'right_to_work', label: 'Do you have the right to work in Zimbabwe?', type: 'yes_no', required: true },
    { id: 'stack', label: 'Preferred stack', type: 'select', required: false, options: ['React', 'Flutter'] },
  ],
  closesAt: future(30),
  ...over,
});

let ip = 0;
async function apply(slug: string, name: string) {
  const form = new FormData();
  form.set(
    'data',
    JSON.stringify({
      fullName: name,
      email: `${name.split(' ')[0]!.toLowerCase()}@example.com`,
      phone: '+263771234567',
      consent: true,
      turnstileToken: 'test',
      answers: { right_to_work: 'yes', stack: 'React' },
    }),
  );
  form.set('cv', new File([pdf()], 'cv.pdf'));
  const res = await exports.default.fetch(`${ORIGIN}/api/v1/public/careers/${slug}/applications`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'cf-connecting-ip': `10.9.0.${++ip}` },
    body: form,
  });
  const body = (await res.json()) as any;
  expect(res.status, JSON.stringify(body)).toBe(201);
  return (await row('SELECT id FROM job_applications WHERE reference = ?', body.data.reference)).id as string;
}

describe('careers admin (P4.21)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM rate_limits'),
      env.DB.prepare('DELETE FROM job_application_events'),
      env.DB.prepare('DELETE FROM job_applications'),
      env.DB.prepare('DELETE FROM job_postings'),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
  });

  it('posting lifecycle: draft (previewable by staff only) → open → closed → reopen → archive; duplicate; validation', async () => {
    const hm = await staff(['hiring_manager']);
    const created = await C(hm, '/postings', posting());
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.data.id as string;
    const stored = await row('SELECT status, description, custom_questions FROM job_postings WHERE id = ?', id);
    expect(stored.status).toBe('draft');
    expect(stored.description).not.toContain('<script>');
    // Drafts are invisible publicly; the staff preview (ctx.preview, set by the page middleware) shows them.
    const viewCtx = (preview: boolean) => {
      const c = createContext({ env });
      if (preview) c.preview = true;
      return c;
    };
    expect(await getPostingView(viewCtx(false), 'junior-developer')).toBeNull();
    expect((await getPostingView(viewCtx(true), 'junior-developer'))?.state).toBe('preview');
    // Validation: a select question needs choices; at most 5 questions; closing before opening.
    expect(
      (
        await C(
          hm,
          '/postings',
          posting({ slug: 'x1', questions: [{ id: 'a', label: 'Pick', type: 'select', required: false }] }),
        )
      ).status,
    ).toBe(422);
    expect(
      (await C(hm, '/postings', posting({ slug: 'x2', opensAt: future(10), closesAt: future(5) }))).body.error.fields
        .closesAt,
    ).toBeTruthy();
    expect((await C(hm, '/postings', posting())).body.error.fields.slug).toBeTruthy();
    // Open → public page with the form; closed; reopened; archived (gone).
    expect((await C(hm, `/postings/${id}/status`, { status: 'open' })).status).toBe(200);
    resetCmsCache();
    expect((await getPostingView(viewCtx(false), 'junior-developer'))?.state).toBe('open');
    expect((await C(hm, `/postings/${id}/status`, { status: 'archived' })).status).toBe(409); // open → archived not allowed
    expect((await C(hm, `/postings/${id}/status`, { status: 'closed' })).status).toBe(200);
    expect((await row('SELECT closed_at FROM job_postings WHERE id = ?', id)).closed_at).toBeTruthy();
    expect((await C(hm, `/postings/${id}/status`, { status: 'open' })).status).toBe(200);
    expect((await row('SELECT closed_at FROM job_postings WHERE id = ?', id)).closed_at).toBeNull();
    const dup = await C(hm, `/postings/${id}/duplicate`, {});
    expect(dup.status).toBe(201);
    expect(await row('SELECT slug, status, closes_at FROM job_postings WHERE id = ?', dup.body.data.id)).toEqual({
      slug: 'junior-developer-copy',
      status: 'draft',
      closes_at: null,
    });
    expect(
      (await row("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type = 'job_posting' AND entity_id = ?", id)).n,
    ).toBeGreaterThanOrEqual(4);
    // Staff without careers rights can't see postings.
    const support = await staff(['support_staff']);
    expect((await C(support, '/postings')).status).toBe(403);
  });

  it('pipeline: stage moves, rating, tags, reviewer (notified), notes; all in the history', async () => {
    const hm = await staff(['hiring_manager']);
    const reviewer = await createStaff(['hiring_manager']);
    const id = (await C(hm, '/postings', posting())).body.data.id as string;
    await C(hm, `/postings/${id}/status`, { status: 'open' });
    const app = await apply('junior-developer', 'Tino Moyo');
    const res = await C(
      hm,
      `/applications/${app}`,
      { status: 'screening', rating: 4, tags: ['React', 'strong'], assignedTo: reviewer.id },
      'PATCH',
    );
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(await row('SELECT status, rating, tags, assigned_to FROM job_applications WHERE id = ?', app)).toEqual({
      status: 'screening',
      rating: 4,
      tags: '["react","strong"]',
      assigned_to: reviewer.id,
    });
    expect((await C(hm, `/applications/${app}/notes`, { body: 'Good portfolio.' })).status).toBe(201);
    const d = (await C(hm, `/applications/${app}`)).body.data;
    expect(d.events.map((e: any) => e.type).sort()).toEqual(['note', 'rating', 'status_change']);
    expect(d.answers).toEqual([
      { label: 'Do you have the right to work in Zimbabwe?', value: 'yes' },
      { label: 'Preferred stack', value: 'React' },
    ]);
    expect(d.cv).toMatchObject({ original_name: expect.stringContaining('.pdf') });
    expect(
      (await all('SELECT title FROM notifications WHERE user_id = ? AND entity_id = ?', reviewer.id, app)).map(
        (n) => n.title,
      ),
    ).toContainEqual(expect.stringContaining('assigned to you'));
    // Filters: by tag, rating, stage, reviewer.
    const list = (q: string) => C(hm, `/applications?${q}`).then((r) => r.body.data.items.map((i: any) => i.id));
    expect(await list('tag=react')).toEqual([app]);
    expect(await list('minRating=5')).toEqual([]);
    expect(await list(`status=screening&postingId=${id}`)).toEqual([app]);
    expect(await list(`assignee=${reviewer.id}`)).toEqual([app]);
    // An assignee must be able to see applicants.
    const outsider = await createStaff(['support_staff']);
    expect((await C(hm, `/applications/${app}`, { assignedTo: outsider.id }, 'PATCH')).status).toBe(422);
  });

  it('emails from editable templates, bulk reject with one regret email each, and erase', async () => {
    const hm = await staff(['hiring_manager']);
    const id = (await C(hm, '/postings', posting())).body.data.id as string;
    await C(hm, `/postings/${id}/status`, { status: 'open' });
    const a1 = await apply('junior-developer', 'Tino Moyo');
    const a2 = await apply('junior-developer', 'Rudo Dube');
    const a3 = await apply('junior-developer', 'Farai Ncube');
    // Edit the interview template; the draft fills placeholders.
    const t = (await C(hm, '/templates')).body.data;
    const saved = await C(
      hm,
      '/templates',
      {
        ...t,
        interview: { subject: 'Interview: {position}', body: 'Hi {name},\n\nCome and meet us. Ref {reference}.' },
      },
      'PUT',
    );
    expect(saved.status).toBe(200);
    const draft = (await C(hm, `/applications/${a1}/email-draft?template=interview`)).body.data;
    expect(draft.subject).toBe('Interview: Junior Developer');
    expect(draft.body).toMatch(/^Hi Tino,\n\nCome and meet us\. Ref APP-/);
    expect(
      (
        await C(hm, `/applications/${a1}/email`, {
          template: 'interview',
          ...draft,
          body: `${draft.body}\n\nThursday 10:00?`,
        })
      ).status,
    ).toBe(201);
    const sent = await all(
      'SELECT payload FROM outbox WHERE instr(idempotency_key, ?) = 1',
      `email:candidate:${a1}:interview:`,
    );
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0].payload)).toMatchObject({ template: 'candidate_message', to: 'tino@example.com' });
    expect(JSON.parse(sent[0].payload).data.body).toContain('Thursday 10:00?');
    // Bulk reject twice: one regret email per applicant, already-rejected ones skipped.
    const r1 = (await C(hm, '/applications/reject', { ids: [a2, a3], sendRegret: true })).body.data;
    const r2 = (await C(hm, '/applications/reject', { ids: [a2, a3], sendRegret: true })).body.data;
    expect(r1).toEqual({ rejected: 2, emailed: 2 });
    expect(r2).toEqual({ rejected: 0, emailed: 0 });
    expect((await all("SELECT id FROM outbox WHERE idempotency_key LIKE 'email:candidate:%:regret'")).length).toBe(2);
    expect((await row('SELECT status FROM job_applications WHERE id = ?', a2)).status).toBe('rejected');
    // Erase: personal data and files gone, the anonymous row stays, audited, read-only afterwards.
    const cv = (await row('SELECT cv_file_id FROM job_applications WHERE id = ?', a1)).cv_file_id as string;
    expect((await C(hm, `/applications/${a1}/erase`, {})).status).toBe(200);
    const erased = await row('SELECT * FROM job_applications WHERE id = ?', a1);
    expect(erased).toMatchObject({
      full_name: 'Erased applicant',
      email: null,
      phone: null,
      cv_file_id: null,
      answers: '[]',
    });
    expect(erased.anonymised_at).toBeTruthy();
    expect(await row('SELECT id FROM files WHERE id = ?', cv)).toBeNull();
    expect(
      await all(
        "SELECT type FROM job_application_events WHERE application_id = ? AND type IN ('note','email_sent')",
        a1,
      ),
    ).toEqual([]);
    expect(
      await row("SELECT action FROM audit_logs WHERE entity_id = ? AND action = 'application.erased'", a1),
    ).toBeTruthy();
    expect(JSON.stringify(await all('SELECT after FROM audit_logs WHERE entity_id = ?', a1))).not.toContain('tino@');
    expect((await C(hm, `/applications/${a1}`, { status: 'interview' }, 'PATCH')).status).toBe(409);
  });
});
