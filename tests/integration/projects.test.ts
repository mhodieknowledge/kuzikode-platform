import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { ORIGIN, api, login } from '../helpers/api';
import { createClient, createPortalUser, createStaff } from '../helpers/factories';
import { pdf } from '../helpers/file-fixtures';
import { seedBase } from '../helpers/seed';

async function staff(roles: string[]) {
  const u = await createStaff(roles);
  return { ...(await login('admin', u.email, u.password)), id: u.id };
}
type S = Awaited<ReturnType<typeof staff>>;
const row = (sql: string, ...p: unknown[]) =>
  env.DB.prepare(sql)
    .bind(...p)
    .first<any>();
const P = (s: S, path: string, body?: unknown, method?: string) =>
  api(`/api/v1/admin/projects${path}`, { cookie: s.cookie, csrf: s.csrf, body, ...(method ? { method } : {}) });
const progress = async (id: string) =>
  (await row('SELECT progress_pct FROM projects WHERE id = ?', id)).progress_pct as number;

async function project(s: S, over: Record<string, unknown> = {}) {
  const client = await createClient();
  const res = await P(s, '', { clientId: client.id, name: 'Booking platform', ...over });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { id: res.body.data.id as string, clientId: client.id };
}

async function upload(s: S, projectId: string, meta: Record<string, string>) {
  const form = new FormData();
  form.set('file', new File([pdf()], 'handover.pdf', { type: 'application/pdf' }));
  for (const [k, v] of Object.entries(meta)) form.set(k, v);
  const res = await exports.default.fetch(`${ORIGIN}/api/v1/admin/projects/${projectId}/files`, {
    method: 'POST',
    headers: { cookie: s.cookie, 'x-csrf-token': s.csrf, origin: ORIGIN },
    body: form,
  });
  return { status: res.status, body: (await res.json()) as any };
}

describe('projects (P4.12)', () => {
  beforeEach(() => seedBase());

  it('creates a numbered project with the creator as lead and scopes visibility to members', async () => {
    const pm = await staff(['project_manager']);
    const { id } = await project(pm);
    const p = await row('SELECT * FROM projects WHERE id = ?', id);
    expect(p.reference).toMatch(/^PRJ-\d{4}-\d{4}$/);
    expect(await row('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?', id, pm.id)).toEqual({
      role: 'lead',
    });

    const other = await staff(['support_staff']); // projects.view: members only (project managers see all)
    expect((await P(other, `/${id}`)).status).toBe(404);
    expect((await P(other, '?status=all')).body.data.items.some((x: any) => x.id === id)).toBe(false);
    const admin = await staff(['admin']);
    expect((await P(admin, `/${id}`)).status).toBe(200);
    const content = await staff(['content_manager']);
    expect((await P(content, '')).status).toBe(403);
    expect((await P(content, '', { clientId: p.client_id, name: 'X' })).status).toBe(403);
  });

  it('keeps progress in step with milestones and tasks, unless set by hand', async () => {
    const s = await staff(['admin']);
    const { id } = await project(s);
    const m1 = (await P(s, `/${id}/milestones`, { title: 'Design', clientVisible: true })).body.data.id;
    await P(s, `/${id}/milestones`, { title: 'Build', clientVisible: false });
    expect(await progress(id)).toBe(0);
    expect(
      (await P(s, `/${id}/milestones/${m1}`, { title: 'Design', status: 'completed', clientVisible: true }, 'PUT'))
        .status,
    ).toBe(200);
    expect(await progress(id)).toBe(50);
    expect((await row('SELECT completed_at FROM project_milestones WHERE id = ?', m1)).completed_at).toBeTruthy();

    // Once there are tasks, they drive progress.
    const tasks: string[] = [];
    for (const t of ['Wireframes', 'Visual design', 'Build pages', 'Launch'])
      tasks.push((await P(s, `/${id}/tasks`, { title: t, milestoneId: m1 })).body.data.id);
    expect(await progress(id)).toBe(0);
    expect((await P(s, `/${id}/tasks/${tasks[0]}/move`, { status: 'done' })).status).toBe(200);
    expect(await progress(id)).toBe(25);

    // Manual override sticks until switched back.
    await P(
      s,
      `/${id}/settings`,
      { progressMode: 'manual', progressPct: 80, internalNotes: 'Client is happy.' },
      'PUT',
    );
    await P(s, `/${id}/tasks/${tasks[1]}/move`, { status: 'done' });
    expect(await progress(id)).toBe(80);
    await P(s, `/${id}/settings`, { progressMode: 'auto' }, 'PUT');
    expect(await progress(id)).toBe(50);

    // Deleting a milestone keeps its tasks.
    expect((await P(s, `/${id}/milestones/${m1}`, undefined, 'DELETE')).status).toBe(200);
    expect(
      (await row('SELECT COUNT(*) AS n FROM project_tasks WHERE project_id = ? AND milestone_id IS NULL', id)).n,
    ).toBe(4);
    const detail = await P(s, `/${id}`);
    expect(detail.body.data.activity.length).toBeGreaterThan(5);
  });

  it('lets an assignee without manage rights move only their own tasks', async () => {
    const s = await staff(['admin']);
    const support = await staff(['support_staff']);
    const { id } = await project(s);
    const mine = (await P(s, `/${id}/tasks`, { title: 'Answer client questions', assigneeId: support.id })).body.data
      .id;
    const theirs = (await P(s, `/${id}/tasks`, { title: 'Deploy' })).body.data.id;
    expect((await P(support, `/${id}`)).status).toBe(200); // assignee became a member
    expect((await P(support, `/${id}/tasks/${mine}/move`, { status: 'in_progress' })).status).toBe(200);
    expect((await P(support, `/${id}/tasks/${theirs}/move`, { status: 'done' })).status).toBe(404);
    expect((await P(support, `/${id}/tasks`, { title: 'Sneaky' })).status).toBe(403);
  });

  it('creates one project from an accepted quotation, even when asked concurrently', async () => {
    const s = await staff(['admin']);
    const c = await api('/api/v1/admin/clients', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: {
        type: 'business',
        displayName: 'Victoria Crafts',
        defaultCurrency: 'USD',
        paymentTermsDays: 7,
        tags: [],
        primaryContact: { name: 'Thandi Ncube', email: 'thandi@crafts.example' },
      },
    });
    const items = [
      { description: 'Online shop\nWith checkout', quantity: '1', unitPriceMinor: 90_000 },
      { description: 'Product photography', quantity: '30', unitPriceMinor: 1_000 },
    ];
    const q = await api('/api/v1/admin/quotations', {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { clientId: c.body.data.id, title: 'Online shop', currency: 'USD', items },
    });
    const qid = q.body.data.id as string;
    expect((await P(s, `/from-quotation/${qid}`, {})).status).toBe(409); // not accepted yet
    await api(`/api/v1/admin/quotations/${qid}/send`, { cookie: s.cookie, csrf: s.csrf, body: {} });
    await api(`/api/v1/admin/quotations/${qid}/response`, {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { decision: 'accept', name: 'Thandi Ncube', agree: true },
    });
    const before =
      (await row("SELECT next_value FROM sequences WHERE key LIKE 'project%' ORDER BY key DESC LIMIT 1"))?.next_value ??
      1;
    const results = await Promise.all([1, 2, 3].map(() => P(s, `/from-quotation/${qid}`, {})));
    const ids = new Set(results.map((r) => r.body.data.projectId));
    expect(ids.size).toBe(1);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const pid = [...ids][0] as string;
    const after = (await row("SELECT next_value FROM sequences WHERE key LIKE 'project%' ORDER BY key DESC LIMIT 1"))
      .next_value;
    expect(after - before).toBe(1);
    const detail = (await P(s, `/${pid}`)).body.data;
    expect(detail.project.name).toBe('Online shop');
    expect(detail.milestones.map((m: any) => m.title)).toEqual(['Online shop', 'Product photography']);
    expect(detail.tasks).toHaveLength(2);
    expect(detail.quotation.id).toBe(qid);
  });

  it('shares client updates with portal users and the main contact; internal updates stay internal', async () => {
    const s = await staff(['admin']);
    const { id, clientId } = await project(s);
    const portal = await createPortalUser([clientId]);
    const internal = await P(s, `/${id}/updates`, {
      body: 'Server costs higher than planned.',
      visibility: 'internal',
    });
    expect(internal.status).toBe(201);
    expect((await row('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', portal.id)).n).toBe(0);
    const shared = await P(s, `/${id}/updates`, {
      body: 'Design approved; build starts Monday.',
      visibility: 'client',
    });
    expect(shared.status).toBe(201);
    const n = await row('SELECT title, link FROM notifications WHERE user_id = ?', portal.id);
    expect(n.link).toBe(`/portal/projects/${id}`);
    expect(
      (await row('SELECT notified_at FROM project_updates WHERE id = ?', shared.body.data.id)).notified_at,
    ).toBeTruthy();
    const job = await row(
      'SELECT payload FROM outbox WHERE idempotency_key = ?',
      `email:project_update:${shared.body.data.id}`,
    );
    expect(JSON.parse(job.payload)).toMatchObject({
      template: 'project_update',
      to: expect.stringContaining('@example.com'),
    });

    const msg = await P(s, `/${id}/messages`, { body: 'Could you send the logo files?' });
    expect(msg.status).toBe(201);
  });

  it('uploads deliverables, controls client visibility and file access', async () => {
    const s = await staff(['admin']);
    const { id, clientId } = await project(s);
    const deliverable = await upload(s, id, { label: 'Handover pack', kind: 'deliverable', clientVisible: 'true' });
    expect(deliverable.status, JSON.stringify(deliverable.body)).toBe(201);
    const internal = await upload(s, id, { label: 'Costing', kind: 'internal', clientVisible: 'false' });
    expect(internal.status).toBe(201);
    expect((await upload(s, id, { label: 'Bad', kind: 'internal', clientVisible: 'true' })).status).toBe(422);
    expect((await P(s, `/${id}/files/${internal.body.data.id}`, { clientVisible: true }, 'PUT')).status).toBe(422);

    // The client's portal user can read the deliverable, not the internal file.
    const pu = await createPortalUser([clientId]);
    const portal = await login('portal', pu.email, pu.password);
    const get = (path: string, cookie: string) => exports.default.fetch(`${ORIGIN}${path}`, { headers: { cookie } });
    expect((await get(`/api/v1/portal/files/${deliverable.body.data.fileId}`, portal.cookie)).status).toBe(200);
    expect((await get(`/api/v1/portal/files/${internal.body.data.fileId}`, portal.cookie)).status).toBe(404);
    await P(s, `/${id}/files/${deliverable.body.data.id}`, { clientVisible: false }, 'PUT');
    expect((await get(`/api/v1/portal/files/${deliverable.body.data.fileId}`, portal.cookie)).status).toBe(404);

    // Staff: members and view-all only.
    const outsider = await staff(['support_staff']);
    expect((await get(`/api/v1/admin/files/${deliverable.body.data.fileId}`, outsider.cookie)).status).toBe(404);
    expect((await get(`/api/v1/admin/files/${deliverable.body.data.fileId}`, s.cookie)).status).toBe(200);

    expect((await P(s, `/${id}/files/${deliverable.body.data.id}`, undefined, 'DELETE')).status).toBe(200);
    expect(await row('SELECT id FROM files WHERE id = ?', deliverable.body.data.fileId)).toBeNull();
  });
});
