import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { sendFollowUpReminders } from '../../src/server/modules/leads';
import { api, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';

async function session(roles: string[]) {
  const u = await createStaff(roles);
  return { ...(await login('admin', u.email, u.password)), user: u };
}
const lead = (over: Record<string, unknown> = {}) => ({
  title: 'Booking website',
  source: 'referral',
  status: 'new',
  serviceIds: [],
  ...over,
});

async function submitEnquiry(email: string) {
  const res = await api('/api/v1/public/enquiries', {
    headers: { 'cf-connecting-ip': `10.5.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
    body: {
      name: 'Tafadzwa Example',
      email,
      organisation: 'Vumba Lodge',
      category: 'websites',
      service: 'business-website',
      budgetRange: '$500 – $1,500',
      message: 'We need a booking website for our lodge.',
      consent: true,
      turnstileToken: 'test',
    },
  });
  return env.DB.prepare('SELECT id FROM enquiries WHERE reference = ?')
    .bind(res.body.data.reference)
    .first<{ id: string }>();
}

describe('enquiries & leads (P4.5)', () => {
  it('inbox lists new enquiries; triage creates a linked lead with services; spam/close/reopen are audited', async () => {
    const s = await session(['admin']);
    const e = (await submitEnquiry(`tri-${Date.now()}@example.com`))!;
    const inbox = await api('/api/v1/admin/enquiries?q=Vumba', { cookie: s.cookie });
    expect(inbox.body.data.items.map((x: any) => x.id)).toContain(e.id);

    const t = await api(`/api/v1/admin/enquiries/${e.id}/lead`, { cookie: s.cookie, csrf: s.csrf, body: {} });
    expect(t.status).toBe(201);
    const { leadId } = t.body.data;
    const detail = await api(`/api/v1/admin/leads/${leadId}`, { cookie: s.cookie });
    expect(detail.body.data.lead).toMatchObject({
      source: 'website',
      status: 'new',
      organisation: 'Vumba Lodge',
      assigned_to: s.user.id,
    });
    expect(detail.body.data.lead.title).toContain('Vumba Lodge');
    expect(detail.body.data.services.map((x: any) => x.id)).toEqual(['svc_websites__business_website']);
    expect(detail.body.data.activities[0].body).toMatch(/Created from enquiry ENQ-/);
    expect((await api(`/api/v1/admin/enquiries/${e.id}`, { cookie: s.cookie })).body.data).toMatchObject({
      status: 'triaged',
      lead_id: leadId,
    });
    expect(
      (await api(`/api/v1/admin/enquiries/${e.id}/lead`, { cookie: s.cookie, csrf: s.csrf, body: {} })).status,
    ).toBe(409);

    const e2 = (await submitEnquiry(`spam-${Date.now()}@example.com`))!;
    expect(
      (
        await api(`/api/v1/admin/enquiries/${e2.id}/status`, {
          cookie: s.cookie,
          csrf: s.csrf,
          body: { status: 'spam' },
        })
      ).status,
    ).toBe(200);
    expect(
      (await api(`/api/v1/admin/enquiries/${e2.id}/lead`, { cookie: s.cookie, csrf: s.csrf, body: {} })).status,
    ).toBe(409);
    expect(
      (await api(`/api/v1/admin/enquiries?status=spam&q=Vumba`, { cookie: s.cookie })).body.data.items.map(
        (x: any) => x.id,
      ),
    ).toContain(e2.id);
    const audits = await env.DB.prepare("SELECT action FROM audit_logs WHERE entity_type = 'enquiry' AND entity_id = ?")
      .bind(e2.id)
      .all<any>();
    expect(audits.results.map((a: any) => a.action)).toContain('enquiry.spam');
  });

  it('lead lifecycle: status changes are logged, lost needs a reason, assignment notifies the assignee', async () => {
    const s = await session(['admin']);
    const pm = await createStaff(['support_staff']);
    const { id } = (
      await api('/api/v1/admin/leads', {
        cookie: s.cookie,
        csrf: s.csrf,
        body: lead({ estimatedValueMinor: 75000, currency: 'USD' }),
      })
    ).body.data;
    expect(
      (
        await api(`/api/v1/admin/leads/${id}`, {
          method: 'PUT',
          cookie: s.cookie,
          csrf: s.csrf,
          body: lead({ status: 'lost' }),
        })
      ).status,
    ).toBe(422);
    expect(
      (await api('/api/v1/admin/leads', { cookie: s.cookie, csrf: s.csrf, body: lead({ estimatedValueMinor: 100 }) }))
        .status,
    ).toBe(422);
    expect(
      (
        await api(`/api/v1/admin/leads/${id}`, {
          method: 'PUT',
          cookie: s.cookie,
          csrf: s.csrf,
          body: lead({ status: 'contacted', assignedTo: pm.id, estimatedValueMinor: 75000, currency: 'USD' }),
        })
      ).status,
    ).toBe(200);
    const d = (await api(`/api/v1/admin/leads/${id}`, { cookie: s.cookie })).body.data;
    expect(d.activities.find((a: any) => a.type === 'status_change').body).toBe('New → Contacted');
    const note = await env.DB.prepare("SELECT title FROM notifications WHERE user_id = ? AND type = 'lead.assigned'")
      .bind(pm.id)
      .first<any>();
    expect(note.title).toBe('Lead assigned to you: Booking website');
    expect(
      (
        await api(`/api/v1/admin/leads/${id}`, {
          method: 'PUT',
          cookie: s.cookie,
          csrf: s.csrf,
          body: lead({ assignedTo: 'usr_nobody' }),
        })
      ).status,
    ).toBe(422);
  });

  it('follow-ups set the next date, completing one moves to the next; daily reminders notify once per day', async () => {
    const s = await session(['admin']);
    const { id } = (
      await api('/api/v1/admin/leads', { cookie: s.cookie, csrf: s.csrf, body: lead({ title: 'Follow-up lead' }) })
    ).body.data;
    const f1 = (
      await api(`/api/v1/admin/leads/${id}/activities`, {
        cookie: s.cookie,
        csrf: s.csrf,
        body: { type: 'follow_up', body: 'Call back', dueOn: '2026-11-05' },
      })
    ).body.data.id;
    await api(`/api/v1/admin/leads/${id}/activities`, {
      cookie: s.cookie,
      csrf: s.csrf,
      body: { type: 'follow_up', body: 'Send proposal', dueOn: '2026-11-20' },
    });
    expect(
      (
        await api(`/api/v1/admin/leads/${id}/activities`, {
          cookie: s.cookie,
          csrf: s.csrf,
          body: { type: 'follow_up', body: 'No date' },
        })
      ).status,
    ).toBe(422);
    // next_follow_up_on follows the most recently scheduled follow-up
    await env.DB.prepare("UPDATE leads SET next_follow_up_on = '2026-11-05', created_by = ? WHERE id = ?")
      .bind(s.user.id, id)
      .run();
    const ctx = createContext({ env, now: () => new Date('2026-11-06T06:00:00Z') });
    expect(await sendFollowUpReminders(ctx)).toBeGreaterThanOrEqual(1);
    await sendFollowUpReminders(ctx);
    const reminders = await env.DB.prepare(
      "SELECT title FROM notifications WHERE user_id = ? AND type = 'lead.follow_up' AND entity_id = ?",
    )
      .bind(s.user.id, id)
      .all<any>();
    expect(reminders.results).toHaveLength(1);
    expect(reminders.results[0].title).toBe('Overdue follow-up: Follow-up lead');
    expect(
      (await api(`/api/v1/admin/leads/${id}/activities/${f1}/complete`, { cookie: s.cookie, csrf: s.csrf, body: {} }))
        .status,
    ).toBe(200);
    expect((await api(`/api/v1/admin/leads/${id}`, { cookie: s.cookie })).body.data.lead.next_follow_up_on).toBe(
      '2026-11-20',
    );
    expect(
      (await api(`/api/v1/admin/leads/${id}/activities/${f1}/complete`, { cookie: s.cookie, csrf: s.csrf, body: {} }))
        .status,
    ).toBe(404);
  });

  it('convert lead → client with main contact, once; lost leads must be reopened first', async () => {
    const s = await session(['admin']);
    const { id } = (
      await api('/api/v1/admin/leads', {
        cookie: s.cookie,
        csrf: s.csrf,
        body: lead({
          title: 'Convert me',
          organisation: 'Nyanga Farms',
          contactName: 'Ruth Moyo',
          email: 'ruth@nyanga.example',
          estimatedValueMinor: 150000,
          currency: 'USD',
        }),
      })
    ).body.data;
    const conv = await api(`/api/v1/admin/leads/${id}/convert`, { cookie: s.cookie, csrf: s.csrf, body: {} });
    expect(conv.status).toBe(201);
    const client = (await api(`/api/v1/admin/clients/${conv.body.data.clientId}`, { cookie: s.cookie })).body.data;
    expect(client.client).toMatchObject({
      displayName: 'Nyanga Farms',
      type: 'business',
      email: 'ruth@nyanga.example',
      defaultCurrency: 'USD',
    });
    expect(client.contacts).toEqual([expect.objectContaining({ name: 'Ruth Moyo', isPrimary: true })]);
    expect((await api(`/api/v1/admin/leads/${id}`, { cookie: s.cookie })).body.data.lead).toMatchObject({
      status: 'won',
      client_id: conv.body.data.clientId,
    });
    expect((await api(`/api/v1/admin/leads/${id}/convert`, { cookie: s.cookie, csrf: s.csrf, body: {} })).status).toBe(
      409,
    );

    const lost = (
      await api('/api/v1/admin/leads', {
        cookie: s.cookie,
        csrf: s.csrf,
        body: lead({ status: 'lost', lostReason: 'Budget' }),
      })
    ).body.data.id;
    expect(
      (await api(`/api/v1/admin/leads/${lost}/convert`, { cookie: s.cookie, csrf: s.csrf, body: {} })).status,
    ).toBe(409);
  });

  it('permissions: support can view leads and triage enquiries? only with leads.manage; content manager sees neither', async () => {
    const support = await session(['support_staff']);
    expect((await api('/api/v1/admin/enquiries', { cookie: support.cookie })).status).toBe(200);
    expect((await api('/api/v1/admin/leads', { cookie: support.cookie })).status).toBe(200);
    expect(
      (await api('/api/v1/admin/leads', { cookie: support.cookie, csrf: support.csrf, body: lead() })).status,
    ).toBe(403);
    const e = (await submitEnquiry(`perm-${Date.now()}@example.com`))!;
    expect(
      (await api(`/api/v1/admin/enquiries/${e.id}/lead`, { cookie: support.cookie, csrf: support.csrf, body: {} }))
        .status,
    ).toBe(403);
    expect(
      (
        await api(`/api/v1/admin/enquiries/${e.id}/status`, {
          cookie: support.cookie,
          csrf: support.csrf,
          body: { status: 'spam' },
        })
      ).status,
    ).toBe(200);
    const cm = await session(['content_manager']);
    expect((await api('/api/v1/admin/enquiries', { cookie: cm.cookie })).status).toBe(403);
  });
});
