import { describe, expect, it, vi } from 'vitest';
import { EmailProviderError } from '../../src/server/email/provider';
import { resendProvider } from '../../src/server/email/providers/resend';
import { renderTemplate, TEMPLATE_NAMES } from '../../src/server/email/templates';
import { escapeHtml } from '../../src/server/email/templates/layout';

const brand = { companyName: 'Kuzikode Technologies', siteUrl: 'https://kuzikode.example/' };
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
  const samples: Record<string, unknown> = {
    security_alert: { name: 'Ann', event: 'password_changed', at: '2026-11-05T10:00:00Z', ip: '1.2.3.4' },
    password_reset: {
      name: 'Ann',
      link: 'https://kuzikode.example/admin/reset-password?token=abc',
      expiresInMinutes: 60,
    },
    email_verification: { name: 'Ann', link: 'https://kuzikode.example/portal/verify-email?token=abc' },
    staff_invitation: { name: 'Ann', link: 'https://kuzikode.example/admin/accept-invite?token=abc', expiresInDays: 7 },
    client_invitation: {
      name: 'Ann',
      link: 'https://kuzikode.example/portal/accept-invite?token=abc',
      expiresInDays: 7,
    },
    enquiry_acknowledgement: { name: 'Ann', reference: 'ENQ-2026-0001', kind: 'contact' },
    enquiry_admin: {
      reference: 'ENQ-2026-0001',
      name: 'Ann',
      email: 'ann@example.com',
      category: 'web-development',
      message: 'We need a website.',
      kind: 'contact',
      link: 'https://kuzikode.example/admin/enquiries/enq_1',
    },
    application_acknowledgement: { name: 'Ann', reference: 'APP-2026-0001', position: 'Junior Web Developer' },
    system_test: { name: 'Ann', at: '2026-11-06T10:00:00.000Z' },
    quotation_sent: {
      name: 'Ann',
      number: 'QUO-2026-0001',
      title: 'Website redesign',
      total: 'US$1,200.00',
      validUntil: '6 December 2026',
      link: 'https://example.com/q/abc',
      message: null,
    },
    newsletter_confirmation: { link: 'https://kuzikode.example/newsletter/confirm?token=abc' },
    support_reply: {
      name: 'Ann',
      reference: 'SUP-2026-0001',
      subject: 'Email not syncing',
      body: 'We reset the mailbox password; please try again.',
    },
    notification: {
      name: 'Tendai',
      label: 'New enquiry',
      title: 'New enquiry from Ann Moyo',
      body: 'Website for a bakery, budget USD 1,000–2,500.',
      link: 'https://kuzikode.example/admin/enquiries/enq_1',
    },
    project_update: {
      name: 'Ann',
      project: 'Online ordering website',
      reference: 'PRJ-2026-0001',
      body: 'The design is approved. Build starts on Monday.',
    },
    invoice_issued: {
      name: 'Ann',
      number: 'INV-2026-00001',
      total: '$500.00',
      dueDate: '13 November 2026',
      link: 'https://example.com/i/abc',
      message: null,
    },
    invoice_reminder: {
      name: 'Ann',
      number: 'INV-2026-00001',
      balance: '$250.00',
      dueDate: '13 November 2026',
      overdue: true,
      link: 'https://example.com/i/abc',
    },
    payment_receipt: {
      name: 'Ann',
      receiptNumber: 'RCT-2026-00001',
      amount: '$600.00',
      receivedOn: '6 November 2026',
      invoiceNumber: 'INV-2026-00001',
      balance: '$0.00',
      credit: '$100.00',
      link: 'https://example.com/i/abc',
    },
  };

  it.each(TEMPLATE_NAMES)('%s renders HTML and text with the branded layout', (name) => {
    const r = renderTemplate(name, brand, samples[name]);
    expect(r.subject.length).toBeGreaterThan(5);
    expect(r.html).toContain('<!doctype html>');
    expect(r.html).toContain('Kuzikode Technologies');
    expect(r.html).toContain('color-scheme');
    expect(r.text).not.toContain('<');
    expect(r.html).toMatchSnapshot();
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
