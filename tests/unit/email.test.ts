import { describe, expect, it, vi } from 'vitest';
import { EmailProviderError } from '../../src/server/email/provider';
import { resendProvider } from '../../src/server/email/providers/resend';
import { renderTemplate, TEMPLATE_NAMES } from '../../src/server/email/templates';
import { EMAIL_SAMPLES, EMAIL_VARIANTS } from '../../src/server/email/templates/samples';
import { escapeHtml } from '../../src/server/email/templates/layout';

const brand = { companyName: 'Kuzikode Intelligent Technologies', siteUrl: 'https://kuzikode.example/' };
const msg = {
  to: 'a@example.com',
  from: 'Kuzikode <onboarding@resend.dev>',
  subject: 'S',
  html: '<p>h</p>',
  text: 't',
  replyTo: 'r@example.com',
  tags: { template: 'pass word!' },
};

describe('Resend adapter', () => {
  it('posts to /emails with bearer auth and the idempotency key', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: 're_123' }), { status: 200 }));
    const res = await resendProvider('re_key', fetcher as unknown as typeof fetch).send(msg, {
      idempotencyKey: 'email:x:1',
    });
    expect(res).toEqual({ providerMessageId: 're_123' });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const headers = init.headers as Record<string, string>;
    expect(headers['authorization']).toBe('Bearer re_key');
    expect(headers['idempotency-key']).toBe('email:x:1');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ to: ['a@example.com'], reply_to: 'r@example.com', subject: 'S', text: 't' });
    expect(body.tags).toEqual([{ name: 'template', value: 'pass_word_' }]);
  });

  it.each([
    [429, true],
    [500, true],
    [409, true],
    [400, false],
    [403, false],
  ])('classifies HTTP %i as retryable=%s', async (status, retryable) => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ name: 'x', message: 'nope' }), { status }));
    const err = await resendProvider('k', fetcher as unknown as typeof fetch)
      .send(msg, { idempotencyKey: 'k' })
      .catch((e) => e);
    expect(err).toBeInstanceOf(EmailProviderError);
    expect(err.retryable).toBe(retryable);
  });

  it('treats network failures as retryable and truncates long idempotency keys', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const err = await resendProvider('k', failing as unknown as typeof fetch)
      .send(msg, { idempotencyKey: 'k' })
      .catch((e) => e);
    expect(err.retryable).toBe(true);
    const ok = vi.fn(async () => new Response(JSON.stringify({ id: 'x' })));
    await resendProvider('k', ok as unknown as typeof fetch).send(msg, { idempotencyKey: 'k'.repeat(400) });
    expect(
      ((ok.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>)['idempotency-key'],
    ).toHaveLength(256);
  });
});

describe('templates', () => {
  it.each(TEMPLATE_NAMES)('%s renders HTML and text with the branded layout', (name) => {
    const r = renderTemplate(name, brand, EMAIL_SAMPLES[name]);
    expect(r.subject.length).toBeGreaterThan(5);
    expect(r.html).toContain('<!doctype html>');
    expect(r.html).toContain('Kuzikode Intelligent Technologies');
    expect(r.html).toContain('color-scheme');
    expect(r.text).not.toContain('<');
    expect(r.text).toContain('Kuzikode Intelligent Technologies');
    expect(r.html).toMatchSnapshot();
    expect({ subject: r.subject, text: r.text }).toMatchSnapshot();
  });

  it.each(EMAIL_VARIANTS.map((v) => [`${v.name} (${v.variant})`, v] as const))('%s', (_label, v) => {
    const r = renderTemplate(v.name, brand, v.data);
    expect({ subject: r.subject, text: r.text }).toMatchSnapshot();
  });

  it('PRD §7 template list is complete', () => {
    for (const name of [
      'staff_invitation',
      'client_invitation',
      'email_verification',
      'password_reset',
      'security_alert',
      'enquiry_admin',
      'enquiry_acknowledgement',
      'quotation_sent',
      'quotation_accepted',
      'invoice_issued',
      'payment_receipt',
      'card_charge_failed',
      'invoice_reminder',
      'project_update',
      'support_ack',
      'support_reply',
    ])
      expect(TEMPLATE_NAMES).toContain(name);
  });

  it('reminder wording: before, on and after the due date', () => {
    const subject = (d: Record<string, unknown>) =>
      renderTemplate('invoice_reminder', brand, { ...EMAIL_SAMPLES.invoice_reminder, ...d }).subject;
    expect(subject({ overdue: false })).toBe('Reminder: invoice INV-2026-00001 is due 13 November 2026');
    expect(subject({ overdue: false, dueToday: true })).toBe('Reminder: invoice INV-2026-00001 is due today');
    expect(subject({ overdue: true })).toBe('Reminder: invoice INV-2026-00001 is overdue');
  });

  it('escapes user-controlled data', () => {
    const r = renderTemplate('staff_invitation', brand, {
      name: '<script>x</script>',
      link: 'https://k.example/a?b="c"',
      expiresInDays: 7,
    });
    expect(r.html).not.toContain('<script>');
    expect(r.html).toContain('&lt;script&gt;');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });

  it('rejects invalid data', () => {
    expect(() =>
      renderTemplate('password_reset', brand, { name: 'x', link: 'not a url', expiresInMinutes: 60 }),
    ).toThrow();
  });
});
