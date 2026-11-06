import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { processOutbox } from '../../src/server/jobs/consumer';
import { ensureStoredPdf } from '../../src/server/modules/documents';
import { sha256Hex } from '../../src/server/lib/crypto';
import { ORIGIN, api, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';
import { isPdf, pdfText } from '../helpers/pdf-text';
import { seedBase } from '../helpers/seed';

async function session(roles: string[]) {
  const u = await createStaff(roles);
  return login('admin', u.email, u.password);
}
type S = Awaited<ReturnType<typeof session>>;

async function fetchPdf(path: string, cookie?: string) {
  const res = await exports.default.fetch(`${ORIGIN}${path}`, { headers: cookie ? { cookie } : {} });
  return { status: res.status, headers: res.headers, bytes: new Uint8Array(await res.arrayBuffer()) };
}

const sysCtx = () => createContext({ env, actor: { type: 'system', userId: null } });

async function newClient(s: S) {
  const res = await api('/api/v1/admin/clients', {
    cookie: s.cookie,
    csrf: s.csrf,
    body: {
      type: 'business',
      displayName: 'Baobab Foods',
      email: 'accounts@baobab.example',
      defaultCurrency: 'USD',
      paymentTermsDays: 7,
      tags: [],
      primaryContact: { name: 'Tariro Banda', email: 'tariro@baobab.example' },
    },
  });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

async function draftQuotation(s: S, clientId: string) {
  const res = await api('/api/v1/admin/quotations', {
    cookie: s.cookie,
    csrf: s.csrf,
    body: {
      clientId,
      title: 'New company website',
      currency: 'USD',
      discountType: 'none',
      discountValue: 0,
      items: [
        {
          description: 'Website design',
          quantity: '1',
          unitPriceMinor: 80_000,
          discountType: 'none',
          discountValue: 0,
        },
      ],
    },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data.id as string;
}

const row = (sql: string, ...p: unknown[]) =>
  env.DB.prepare(sql)
    .bind(...p)
    .first<any>();

describe('PDF engine (P4.8)', () => {
  beforeEach(() => seedBase());

  it('generates a sent quotation PDF once in the background job, stores it privately and serves the same file after', async () => {
    const s = await session(['admin']);
    const clientId = await newClient(s);
    const id = await draftQuotation(s, clientId);

    // Draft: on-the-fly preview, never stored.
    const preview = await fetchPdf(`/api/v1/admin/documents/quotations/${id}/pdf?inline=1`, s.cookie);
    expect(preview.status).toBe(200);
    expect(preview.headers.get('content-type')).toBe('application/pdf');
    expect(preview.headers.get('content-disposition')).toMatch(/^inline;/);
    expect(preview.headers.get('cache-control')).toBe('private, no-store');
    expect(isPdf(preview.bytes)).toBe(true);
    const previewText = await pdfText(preview.bytes);
    expect(previewText).toContain('Draft (not yet numbered)');
    expect(previewText).toContain('TEST'); // non-production environment
    expect((await row('SELECT pdf_file_id FROM quotations WHERE id = ?', id)).pdf_file_id).toBeNull();
    expect((await row("SELECT COUNT(*) AS n FROM files WHERE owner_type = 'quotation' AND owner_id = ?", id)).n).toBe(
      0,
    );

    const sent = await api(`/api/v1/admin/quotations/${id}/send`, { cookie: s.cookie, csrf: s.csrf, body: {} });
    expect(sent.status).toBe(200);
    const number = sent.body.data.number as string;
    const job = await row(
      "SELECT id FROM outbox WHERE type = 'pdf.generate' AND idempotency_key LIKE ?",
      `pdf:quotation:${id}:%`,
    );
    expect(job).toBeTruthy();
    expect(await processOutbox(sysCtx(), job.id)).toEqual({ outcome: 'done' });

    const q = await row('SELECT pdf_file_id FROM quotations WHERE id = ?', id);
    expect(q.pdf_file_id).toBeTruthy();
    const f = await row('SELECT * FROM files WHERE id = ?', q.pdf_file_id);
    expect(f).toMatchObject({
      owner_type: 'quotation',
      owner_id: id,
      visibility: 'private',
      mime_type: 'application/pdf',
      original_name: `${number}.pdf`,
    });
    const obj = await env.FILES.get(f.r2_key);
    const stored = new Uint8Array(await obj!.arrayBuffer());
    expect(isPdf(stored)).toBe(true);
    const text = await pdfText(stored);
    expect(text).toContain(number);
    expect(text).toContain('Baobab Foods');
    expect(text).toContain('$800.00');
    expect(text).toContain('TEST');

    // Re-running the job and downloading never render again: same file, same bytes, one files row.
    await processOutbox(sysCtx(), job.id);
    const dl = await fetchPdf(`/api/v1/admin/documents/quotations/${id}/pdf`, s.cookie);
    expect(dl.status).toBe(200);
    expect(dl.headers.get('content-disposition')).toContain(`filename="${number}.pdf"`);
    expect(await sha256Hex(dl.bytes)).toBe(f.sha256);
    expect((await row("SELECT COUNT(*) AS n FROM files WHERE owner_type = 'quotation' AND owner_id = ?", id)).n).toBe(
      1,
    );
    expect(
      (await row("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'file.downloaded' AND entity_id = ?", id)).n,
    ).toBe(1);

    // Settings changes after issue don't touch the issued document.
    await env.DB.prepare("UPDATE application_settings SET value = '\"Renamed Co\"' WHERE key = 'company.name'").run();
    const again = await fetchPdf(`/api/v1/admin/documents/quotations/${id}/pdf`, s.cookie);
    expect(await sha256Hex(again.bytes)).toBe(f.sha256);

    // Public link download: same stored file, noindex; bad tokens are 404.
    const detail = await api(`/api/v1/admin/quotations/${id}`, { cookie: s.cookie });
    const token = (detail.body.data.publicLink as string).split('/q/')[1]!;
    const pub = await fetchPdf(`/api/v1/public/quotations/${token}/pdf`);
    expect(pub.status).toBe(200);
    expect(pub.headers.get('x-robots-tag')).toContain('noindex');
    expect(pub.headers.get('content-disposition')).toMatch(/^attachment;/);
    expect(await sha256Hex(pub.bytes)).toBe(f.sha256);
    expect((await fetchPdf(`/api/v1/public/quotations/${'x'.repeat(43)}/pdf`)).status).toBe(404);
    expect((await fetchPdf('/api/v1/public/quotations/short/pdf')).status).toBe(404);
  });

  it('lets only one of several concurrent first renders link its file', async () => {
    const s = await session(['admin']);
    const id = await draftQuotation(s, await newClient(s));
    expect(
      (await api(`/api/v1/admin/quotations/${id}/send`, { cookie: s.cookie, csrf: s.csrf, body: {} })).status,
    ).toBe(200);
    const files = await Promise.all(Array.from({ length: 5 }, () => ensureStoredPdf(sysCtx(), 'quotation', id)));
    expect(new Set(files.map((f) => f.id)).size).toBe(1);
    expect((await row("SELECT COUNT(*) AS n FROM files WHERE owner_type = 'quotation' AND owner_id = ?", id)).n).toBe(
      1,
    );
    expect((await row('SELECT pdf_file_id FROM quotations WHERE id = ?', id)).pdf_file_id).toBe(files[0]!.id);
  });

  it('requires the view permission of the document kind and refuses unknown kinds', async () => {
    const admin = await session(['admin']);
    const id = await draftQuotation(admin, await newClient(admin));
    const content = await session(['content_manager']);
    expect((await fetchPdf(`/api/v1/admin/documents/quotations/${id}/pdf`, content.cookie)).status).toBe(403);
    expect((await fetchPdf(`/api/v1/admin/documents/quotations/${id}/pdf`)).status).toBe(401);
    expect((await fetchPdf(`/api/v1/admin/documents/contracts/${id}/pdf`, admin.cookie)).status).toBe(404);
    expect((await fetchPdf('/api/v1/admin/documents/invoices/inv_missing/pdf', admin.cookie)).status).toBe(404);
  });

  it('renders and stores invoice, receipt and credit note PDFs from their frozen records', async () => {
    const s = await session(['admin']);
    const clientId = await newClient(s);
    const client = JSON.stringify({ name: 'Baobab Foods', number: 'CL-0001', email: 'accounts@baobab.example' });
    const business = JSON.stringify({ name: 'Kuzikode Technologies', email: 'billing@kuzikode.example' });
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO invoices (id, client_id, currency, issue_date, due_date, payment_terms_days, subtotal_minor, total_minor, balance_minor, status, client_snapshot, business_snapshot)
         VALUES ('inv_pdf', ?, 'USD', '2026-11-06', '2026-11-13', 7, 50000, 50000, 50000, 'draft', ?, ?)`,
      ).bind(clientId, client, business),
      env.DB.prepare(
        `INSERT INTO invoice_items (id, invoice_id, position, description, quantity_milli, unit_price_minor, line_subtotal_minor, line_discount_minor, line_tax_minor, line_total_minor)
         VALUES ('ii_pdf', 'inv_pdf', 0, 'Support retainer', 1000, 50000, 50000, 0, 0, 50000)`,
      ),
      env.DB.prepare(
        "UPDATE invoices SET status = 'issued', number = 'INV-2026-0042', issued_at = '2026-11-06T08:00:00Z' WHERE id = 'inv_pdf'",
      ),
      env.DB.prepare(
        `INSERT INTO payments (id, receipt_number, client_id, provider_key, account_id, method, amount_minor, currency, received_at, provider_reference)
         VALUES ('pay_pdf', 'RCT-2026-0003', ?, 'paynow', 'ppa_paynow_usd', 'ecocash', 60000, 'USD', '2026-11-06T09:30:00Z', 'PN-778899')`,
      ).bind(clientId),
      env.DB.prepare(
        "INSERT INTO payment_allocations (id, payment_id, invoice_id, amount_minor, currency) VALUES ('pal_pdf', 'pay_pdf', 'inv_pdf', 50000, 'USD')",
      ),
      env.DB.prepare(
        `INSERT INTO credit_notes (id, number, invoice_id, client_id, currency, reason, subtotal_minor, tax_minor, total_minor, applied_to, issued_at)
         VALUES ('cn_pdf', 'CN-2026-0001', 'inv_pdf', ?, 'USD', 'Hosting cancelled', 10000, 0, 10000, 'client_credit', '2026-11-06T10:00:00Z')`,
      ).bind(clientId),
      env.DB.prepare(
        `INSERT INTO credit_note_items (id, credit_note_id, description, quantity_milli, unit_price_minor, line_total_minor)
         VALUES ('cni_pdf', 'cn_pdf', 'Hosting', 1000, 10000, 10000)`,
      ),
    ]);

    const cases = [
      [
        'invoices',
        'inv_pdf',
        'invoices',
        'pdf_file_id',
        ['INVOICE', 'INV-2026-0042', 'Support retainer', 'Amount due (USD)', '/i/'],
      ],
      [
        'receipts',
        'pay_pdf',
        'payments',
        'receipt_file_id',
        ['RECEIPT', 'RCT-2026-0003', 'INV-2026-0042', 'Held as account credit', 'No real money'],
      ],
      [
        'credit-notes',
        'cn_pdf',
        'credit_notes',
        'pdf_file_id',
        ['CREDIT NOTE', 'CN-2026-0001', 'INV-2026-0042', 'Hosting cancelled'],
      ],
    ] as const;
    for (const [path, id, table, column, expected] of cases) {
      const res = await fetchPdf(`/api/v1/admin/documents/${path}/${id}/pdf`, s.cookie);
      expect(res.status, path).toBe(200);
      const text = await pdfText(res.bytes);
      for (const e of expected) expect(text, `${path}: ${e}`).toContain(e);
      const linked = await row(`SELECT ${column} AS f FROM ${table} WHERE id = ?`, id);
      expect(linked.f, path).toBeTruthy();
      const again = await fetchPdf(`/api/v1/admin/documents/${path}/${id}/pdf`, s.cookie);
      expect(await sha256Hex(again.bytes)).toBe(await sha256Hex(res.bytes));
    }
  });

  it('fails a pdf.generate job permanently for a missing document instead of retrying', async () => {
    const ctx = sysCtx();
    await env.DB.prepare(
      `INSERT INTO outbox (id, type, payload, idempotency_key, status, attempts, available_at, created_at, updated_at)
       VALUES ('obx_pdf_missing', 'pdf.generate', '{"kind":"invoice","id":"inv_nope"}', 'pdf:test:missing', 'pending', 0, '2000-01-01T00:00:00Z', '2000-01-01T00:00:00Z', '2000-01-01T00:00:00Z')`,
    ).run();
    const res = await processOutbox(ctx, 'obx_pdf_missing');
    expect(res.outcome).toBe('failed');
  });
});
