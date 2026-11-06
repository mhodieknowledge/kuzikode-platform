import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { api, login, type Session } from '../helpers/api';
import { createClient, createPortalUser, createStaff } from '../helpers/factories';

const u = () => Math.random().toString(36).slice(2, 10);
const run = (sql: string, ...params: unknown[]) =>
  env.DB.prepare(sql)
    .bind(...params)
    .run();
const P = (s: Session, path: string, body?: unknown) =>
  api(`/api/v1/portal${path}`, { cookie: s.cookie, csrf: s.csrf, ...(body === undefined ? {} : { body }) });

async function file(projectId: string, label: string, kind: string, visible: 0 | 1) {
  const fileId = `fil_${u()}`;
  const key = `test/${fileId}.pdf`;
  await env.FILES.put(key, '%PDF-1.4 deliverable');
  await run(
    `INSERT INTO files (id, r2_key, original_name, mime_type, size_bytes, sha256, owner_type, owner_id)
     VALUES (?, ?, ?, 'application/pdf', 20, 'x', 'project', ?)`,
    fileId,
    key,
    `${label}.pdf`,
    projectId,
  );
  await run(
    'INSERT INTO project_files (id, project_id, file_id, label, kind, client_visible) VALUES (?, ?, ?, ?, ?, ?)',
    `pfl_${u()}`,
    projectId,
    fileId,
    label,
    kind,
    visible,
  );
  return fileId;
}

/** A project with one of everything: client-facing and internal. */
async function fixture() {
  const client = await createClient('Projects Client');
  const lead = await createStaff(['project_manager']);
  const member = await createStaff(['project_manager']);
  const outsider = await createStaff(['project_manager']);
  const id = `prj_${u()}`;
  await run(
    `INSERT INTO projects (id, reference, client_id, name, description, status, progress_pct, budget_minor, currency, created_by)
     VALUES (?, ?, ?, 'Online shop', 'INTERNAL-DESCRIPTION margin is thin', 'active', 55, 999900, 'USD', ?)`,
    id,
    `PRJ-${u()}`,
    client.id,
    lead.id,
  );
  await run('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', id, member.id, 'member');
  await run(
    `INSERT INTO project_milestones (id, project_id, title, due_date, status, client_visible, position)
     VALUES (?, ?, 'Design sign-off', '2026-12-01', 'in_progress', 1, 1), (?, ?, 'INTERNAL-MILESTONE code freeze', '2026-12-05', 'pending', 0, 2)`,
    `mil_${u()}`,
    id,
    `mil_${u()}`,
    id,
  );
  await run(
    "INSERT INTO project_tasks (id, project_id, title, status) VALUES (?, ?, 'INTERNAL-TASK fix checkout bug', 'todo')",
    `tsk_${u()}`,
    id,
  );
  await run(
    `INSERT INTO project_updates (id, project_id, author_id, body, visibility, created_at)
     VALUES (?, ?, ?, 'Product pages are live on staging.', 'client', '2026-11-01T09:00:00.000Z'),
            (?, ?, ?, 'INTERNAL-UPDATE client is slow to reply', 'internal', '2026-11-02T09:00:00.000Z')`,
    `pup_${u()}`,
    id,
    lead.id,
    `pup_${u()}`,
    id,
    lead.id,
  );
  await run(
    "INSERT INTO project_messages (id, project_id, author_user_id, body, created_at) VALUES (?, ?, ?, 'Can you send the logo files?', '2026-11-03T09:00:00.000Z')",
    `pmg_${u()}`,
    id,
    lead.id,
  );
  const shared = await file(id, 'Style guide', 'deliverable', 1);
  const hidden = await file(id, 'INTERNAL-FILE draft estimate', 'deliverable', 0);
  const internal = await file(id, 'INTERNAL-KIND notes', 'internal', 1);
  return { client, id, lead, member, outsider, shared, hidden, internal };
}

describe('portal projects (P5.6)', () => {
  it('shows progress, client-visible milestones/updates/files and the thread; internal items never appear', async () => {
    const f = await fixture();
    const user = await createPortalUser([f.client.id], { role: 'member' });
    const p = await login('portal', user.email, user.password);

    const list = await P(p, '/projects');
    expect(list.body.data).toEqual([
      expect.objectContaining({ id: f.id, name: 'Online shop', progressPct: 55, status: 'active', unreadMessages: 1 }),
    ]);

    const d = await P(p, `/projects/${f.id}`);
    expect(d.status).toBe(200);
    expect(d.body.data.milestones.map((m: { title: string }) => m.title)).toEqual(['Design sign-off']);
    expect(d.body.data.updates.map((x: { body: string }) => x.body)).toEqual(['Product pages are live on staging.']);
    expect(d.body.data.deliverables.map((x: { fileId: string }) => x.fileId)).toEqual([f.shared]);
    expect(d.body.data.messages).toEqual([
      expect.objectContaining({ body: 'Can you send the logo files?', fromTeam: true, mine: false }),
    ]);
    const raw = JSON.stringify(d.body);
    for (const secret of ['INTERNAL-', '999900', 'margin is thin', 'budget']) expect(raw).not.toContain(secret);

    // Opening the project marks the team's message as read by the client.
    expect((await P(p, '/projects')).body.data[0].unreadMessages).toBe(0);

    // Files: only the shared deliverable downloads.
    expect((await P(p, `/files/${f.shared}`)).status).toBe(200);
    expect((await P(p, `/files/${f.hidden}`)).status).toBe(404);
    expect((await P(p, `/files/${f.internal}`)).status).toBe(404);
  });

  it('a client message reaches the project team only (members + creator), audited', async () => {
    const f = await fixture();
    const user = await createPortalUser([f.client.id]);
    const p = await login('portal', user.email, user.password);
    const empty = await P(p, `/projects/${f.id}/messages`, { body: '   ' });
    expect(empty.status).toBe(422);
    const res = await P(p, `/projects/${f.id}/messages`, { body: 'Logo files attached in the email. Thanks!' });
    expect(res.status).toBe(201);
    const count = async (userId: string) =>
      (await env.DB.prepare(
        "SELECT count(*) n FROM notifications WHERE user_id = ? AND type = 'project.message' AND entity_id = ?",
      )
        .bind(userId, f.id)
        .first<{ n: number }>())!.n;
    expect(await count(f.lead.id)).toBe(1);
    expect(await count(f.member.id)).toBe(1);
    expect(await count(f.outsider.id)).toBe(0);
    const thread = (await P(p, `/projects/${f.id}`)).body.data.messages as { body: string; mine: boolean }[];
    expect(thread.at(-1)).toMatchObject({ body: 'Logo files attached in the email. Thanks!', mine: true });
    const audit = await env.DB.prepare(
      "SELECT actor_type FROM audit_logs WHERE action = 'project.message_posted' AND entity_id = ?",
    )
      .bind(f.id)
      .first<{ actor_type: string }>();
    expect(audit!.actor_type).toBe('client');
  });

  it('other clients, "billing" contacts and staff sessions cannot read or write a project', async () => {
    const f = await fixture();
    const other = await createPortalUser([(await createClient('Other')).id]);
    const billing = await createPortalUser([f.client.id], { role: 'billing' });
    for (const who of [other, billing]) {
      const s = await login('portal', who.email, who.password);
      expect((await P(s, '/projects')).body.data).toEqual([]);
      expect((await P(s, `/projects/${f.id}`)).status).toBe(404);
      expect((await P(s, `/projects/${f.id}/messages`, { body: 'hello' })).status).toBe(404);
      expect((await P(s, `/files/${f.shared}`)).status).toBe(404);
    }
    const staff = await login('admin', f.lead.email, f.lead.password);
    expect((await P(staff, `/projects/${f.id}`)).status).toBe(401);
    const n = await env.DB.prepare('SELECT count(*) n FROM project_messages WHERE project_id = ?')
      .bind(f.id)
      .first<{ n: number }>();
    expect(n!.n).toBe(1);
  });

  it('staff messages notify the client’s portal users in-app', async () => {
    const f = await fixture();
    const user = await createPortalUser([f.client.id]);
    const s = await login('admin', f.lead.email, f.lead.password);
    const res = await api(`/api/v1/admin/projects/${f.id}/messages`, {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { body: 'The new homepage is ready for review.' },
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const note = await env.DB.prepare(
      "SELECT link FROM notifications WHERE user_id = ? AND type = 'project.message' AND entity_id = ?",
    )
      .bind(user.id, f.id)
      .first<{ link: string }>();
    expect(note!.link).toBe(`/portal/projects/${f.id}`);
  });
});
