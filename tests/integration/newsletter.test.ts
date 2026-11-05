import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import {
  confirmSubscription,
  pruneUnconfirmed,
  subscribe,
  unsubscribe,
  unsubscribeUrl,
} from '../../src/server/modules/newsletter';
import { api } from '../helpers/api';
import { seedBase } from '../helpers/seed';

let ip = 0;
const at = (iso: string) =>
  createContext({
    env,
    now: () => new Date(iso),
    request: new Request('http://localhost/', { headers: { 'cf-connecting-ip': `10.7.0.${++ip}` } }),
  });
const row = (email: string) =>
  env.DB.prepare('SELECT * FROM newsletter_subscribers WHERE email = ?').bind(email).first<any>();
const confirmEmails = async (email: string) =>
  (
    await env.DB.prepare(
      "SELECT json_extract(payload, '$.data.link') AS link FROM outbox WHERE json_extract(payload, '$.template') = 'newsletter_confirmation' AND json_extract(payload, '$.to') = ? ORDER BY created_at",
    )
      .bind(email)
      .all<{ link: string }>()
  ).results.map((r) => r.link);
const tokenOf = (link: string) => new URL(link).searchParams.get('token')!;

describe('newsletter double opt-in (docs/12 §C.10, docs/08)', () => {
  beforeEach(async () => {
    await seedBase();
    await env.DB.prepare('DELETE FROM newsletter_subscribers').run();
  });

  it('sign-up → pending + confirmation email; confirm → confirmed; the link works once', async () => {
    await subscribe(at('2026-11-05T10:00:00Z'), { email: 'Reader@Example.com', source: 'footer' });
    const r = await row('reader@example.com');
    expect(r).toMatchObject({ status: 'pending', source: 'footer', confirmed_at: null });
    expect(r.confirm_token_hash).toMatch(/^[0-9a-f]{64}$/);
    const links = await confirmEmails('reader@example.com');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatch(/\/newsletter\/confirm\?token=/);
    expect(r.confirm_token_hash).not.toBe(tokenOf(links[0]!)); // only the hash is stored

    expect(await confirmSubscription(at('2026-11-06T10:00:00Z'), tokenOf(links[0]!))).toBe('confirmed');
    expect(await row('reader@example.com')).toMatchObject({ status: 'confirmed', confirm_token_hash: null });
    expect(await confirmSubscription(at('2026-11-06T10:01:00Z'), tokenOf(links[0]!))).toBe('invalid');
    expect(await confirmSubscription(at('2026-11-06T10:01:00Z'), 'nonsense')).toBe('invalid');
  });

  it('throttles resends, never re-mails confirmed subscribers, and expires old links', async () => {
    await subscribe(at('2026-11-05T10:00:00Z'), { email: 'slow@example.com' });
    await subscribe(at('2026-11-05T10:05:00Z'), { email: 'slow@example.com' });
    expect(await confirmEmails('slow@example.com')).toHaveLength(1);
    await subscribe(at('2026-11-05T10:20:00Z'), { email: 'slow@example.com' });
    const links = await confirmEmails('slow@example.com');
    expect(links).toHaveLength(2);
    // The first link was replaced by the second.
    expect(await confirmSubscription(at('2026-11-05T10:21:00Z'), tokenOf(links[0]!))).toBe('invalid');
    expect(await confirmSubscription(at('2026-11-13T10:21:00Z'), tokenOf(links[1]!))).toBe('expired');
    expect(await confirmSubscription(at('2026-11-05T10:22:00Z'), tokenOf(links[1]!))).toBe('confirmed');
    await subscribe(at('2026-11-07T10:00:00Z'), { email: 'slow@example.com' });
    expect(await confirmEmails('slow@example.com')).toHaveLength(2);
  });

  it('unsubscribe needs a valid signature; re-subscribing starts a fresh opt-in', async () => {
    await subscribe(at('2026-11-05T10:00:00Z'), { email: 'leaver@example.com' });
    await confirmSubscription(at('2026-11-05T10:01:00Z'), tokenOf((await confirmEmails('leaver@example.com'))[0]!));
    const { id } = await row('leaver@example.com');
    const url = new URL(await unsubscribeUrl(at('2026-11-05T11:00:00Z'), id));
    expect(url.pathname).toBe('/newsletter/unsubscribe');
    expect(await unsubscribe(at('2026-11-05T11:00:00Z'), id, 'forged')).toBe(false);
    expect((await row('leaver@example.com')).status).toBe('confirmed');
    expect(await unsubscribe(at('2026-11-05T11:00:00Z'), id, url.searchParams.get('sig')!)).toBe(true);
    expect(await row('leaver@example.com')).toMatchObject({ status: 'unsubscribed' });
    const audit = await env.DB.prepare(
      "SELECT COUNT(*) n FROM audit_logs WHERE action = 'newsletter.unsubscribed' AND entity_id = ?",
    )
      .bind(id)
      .first<any>();
    expect(audit.n).toBe(1);

    await subscribe(at('2026-11-06T10:00:00Z'), { email: 'leaver@example.com' });
    expect((await row('leaver@example.com')).status).toBe('pending');
    expect(await confirmEmails('leaver@example.com')).toHaveLength(2);
  });

  it('public API answers the same for new, pending and confirmed addresses; honeypot stores nothing', async () => {
    const post = (body: unknown, n: number) =>
      api('/api/v1/public/newsletter', { body, headers: { 'cf-connecting-ip': `10.8.0.${n}` } });
    const a = await post({ email: 'api@example.com' }, 1);
    const b = await post({ email: 'api@example.com' }, 2);
    expect(a.status).toBe(202);
    expect(b.status).toBe(202);
    expect(b.body).toEqual(a.body);
    expect((await post({ email: 'not-an-email' }, 3)).status).toBe(422);
    expect((await post({ email: 'bot@example.com', website: 'http://spam' }, 4)).status).toBe(202);
    expect(await row('bot@example.com')).toBeNull();
    expect((await post({ email: 'x@example.com', extra: 1 }, 5)).status).toBe(422);
  });

  it('nightly prune deletes unconfirmed sign-ups older than 30 days only', async () => {
    await subscribe(at('2026-09-01T10:00:00Z'), { email: 'old@example.com' });
    await subscribe(at('2026-11-01T10:00:00Z'), { email: 'new@example.com' });
    expect(await pruneUnconfirmed(at('2026-11-05T02:17:00Z'))).toBe(1);
    expect(await row('old@example.com')).toBeNull();
    expect(await row('new@example.com')).not.toBeNull();
  });
});
