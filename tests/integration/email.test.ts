import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { processOutbox } from '../../src/server/jobs/consumer';
import { enqueue } from '../../src/server/jobs/outbox';
import { createStaff } from '../helpers/factories';
import { api } from '../helpers/api';

const ctx = () => createContext({ env, actor: { type: 'system', userId: null } });

describe('email via outbox', () => {
  it('a password reset request results in exactly one logged email, even if the job runs twice', async () => {
    const u = await createStaff();
    await api('/api/v1/auth/admin/password/forgot', { body: { email: u.email, turnstileToken: 't' } });
    const job = await env.DB.prepare(
      "SELECT id FROM outbox WHERE json_extract(payload,'$.to') = ? AND json_extract(payload,'$.template') = 'password_reset'",
    )
      .bind(u.email)
      .first<{ id: string }>();
    expect((await processOutbox(ctx(), job!.id)).outcome).toBe('done');
    expect((await processOutbox(ctx(), job!.id)).outcome).toBe('skipped');
    const logs = await env.DB.prepare(
      'SELECT status, provider, subject, html, text FROM email_logs WHERE outbox_id = ?',
    )
      .bind(job!.id)
      .all<any>();
    expect(logs.results).toHaveLength(1);
    expect(logs.results[0]).toMatchObject({ status: 'sent', provider: 'log', subject: 'Reset your Kuzikode password' });
    expect(logs.results[0].text).toContain('/admin/reset-password?token=');
  });

  it('fails permanently for an unknown template', async () => {
    const c = ctx();
    const j = enqueue(c, {
      type: 'email.send',
      payload: { template: 'nope', to: 'a@example.com', data: {} },
      idempotencyKey: 'email:nope:1',
    });
    await j.stmt.run();
    const r = await processOutbox(c, j.id);
    expect(r.outcome).toBe('failed');
  });
});
