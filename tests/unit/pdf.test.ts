import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  creditNoteModel,
  htmlToText,
  invoiceModel,
  quotationModel,
  receiptModel,
  renderDocument,
  type LineItem,
} from '../../src/server/pdf';
import { watermarkFor } from '../../src/server/modules/documents/service';
import { isPdf, pdfText } from '../helpers/pdf-text';

const settings = {
  accentColour: '#2747E8',
  footerText: 'Kuzikode Intelligent Technologies · Harare',
  bankDetails: 'Bank: Example Bank\nAccount: 0000000000',
};
const business = {
  name: 'Kuzikode Intelligent Technologies',
  email: 'billing@kuzikode.example',
  address: 'Harare, Zimbabwe',
};
const client = {
  name: 'Baobab Foods',
  legalName: 'Baobab Foods (Pvt) Ltd',
  number: 'CL-0001',
  email: 'accounts@baobab.example',
  contact: { name: 'Tariro Banda', email: 'tariro@baobab.example' },
};
const item = (description: string, over: Partial<LineItem> = {}): LineItem => ({
  description,
  quantity_milli: 1000,
  unit_price_minor: 10_000,
  tax_rate_bp: 0,
  line_tax_minor: 0,
  line_total_minor: 10_000,
  ...over,
});
const created = new Date('2026-11-06T08:00:00Z');
const render = (m: Parameters<typeof renderDocument>[0], watermark: 'TEST' | 'DRAFT' | null = null) =>
  renderDocument(m, { watermark, accentColour: settings.accentColour, createdAt: created });

const quotation = (items: LineItem[], over: Record<string, unknown> = {}) =>
  quotationModel({
    quotation: {
      number: 'QUO-2026-0007',
      title: 'New company website',
      intro_html: '<p>Thanks for the brief.</p><ul><li>Design</li><li>Build</li></ul>',
      currency: 'USD',
      issue_date: '2026-11-06',
      valid_until: '2026-12-06',
      payment_terms: '50% deposit, balance on launch',
      notes: null,
      terms: '<p>Prices exclude third-party fees.</p>',
      version: 1,
      subtotal_minor: 125_000,
      discount_minor: 6_250,
      tax_minor: 0,
      total_minor: 118_750,
      ...over,
    },
    items,
    client,
    business,
    minorDigits: 2,
    settings,
  });

describe('PDF engine (P4.8)', () => {
  it('renders a branded A4 quotation with number, parties, lines, totals and terms', async () => {
    const bytes = await render(
      quotation([
        item('Website design', { line_total_minor: 80_000, unit_price_minor: 80_000 }),
        item('Hosting', { is_recurring: 1, recurring_interval: 'year', tax_rate_bp: 1550, line_tax_minor: 775 }),
      ]),
    );
    expect(isPdf(bytes)).toBe(true);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe('Quotation QUO-2026-0007');
    const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()];
    expect([Math.round(w), Math.round(h)]).toEqual([595, 842]);
    const text = await pdfText(bytes);
    for (const s of [
      'QUOTATION',
      'QUO-2026-0007',
      'New company website',
      'Baobab Foods',
      'Attn: Tariro Banda',
      'Website design',
      'Billed yearly',
      '15.5%',
      '$800.00',
      '-$62.50',
      '$1,187.50',
      '• Design',
      'Prices exclude third-party fees.',
      'Page 1 of 1',
    ])
      expect(text).toContain(s);
    expect(text).not.toContain('TEST');
  });

  it('watermarks TEST (with a notice) or DRAFT, and labels an unnumbered draft', async () => {
    const test = await pdfText(await render(quotation([item('A')]), 'TEST'));
    expect(test).toContain('TEST');
    expect(test).toContain('NOT VALID FOR PAYMENT');
    const draft = await pdfText(await render(quotation([item('A')], { number: null }), 'DRAFT'));
    expect(draft).toContain('DRAFT');
    expect(draft).toContain('Draft (not yet numbered)');
  });

  it('chooses the watermark from environment, issue state and test-mode payments', () => {
    const ctx = (isProduction: boolean) => ({ config: { isProduction } }) as never;
    expect(watermarkFor(ctx(false), { issued: true, testPayment: false })).toBe('TEST');
    expect(watermarkFor(ctx(true), { issued: true, testPayment: false })).toBeNull();
    expect(watermarkFor(ctx(true), { issued: false, testPayment: false })).toBe('DRAFT');
    expect(watermarkFor(ctx(true), { issued: true, testPayment: true })).toBe('TEST');
  });

  it('breaks long tables across pages with a repeated header and exact page numbers', async () => {
    const items = Array.from({ length: 70 }, (_, i) =>
      item(`Line ${i + 1}: ${'detailed work description '.repeat(i % 3 === 0 ? 6 : 1)}`),
    );
    const bytes = await render(quotation(items));
    const doc = await PDFDocument.load(bytes);
    const pages = doc.getPageCount();
    expect(pages).toBeGreaterThan(2);
    const text = await pdfText(bytes);
    expect(text).toContain(`Page ${pages} of ${pages}`);
    expect(text).toContain('Items (continued)');
    expect(text).toContain('Line 70:');
  });

  it('splits a single row taller than a page instead of looping', async () => {
    const huge = item(Array.from({ length: 160 }, (_, i) => `Paragraph ${i + 1}`).join('\n'));
    const bytes = await render(quotation([huge]));
    const text = await pdfText(bytes);
    expect(text).toContain('Paragraph 1');
    expect(text).toContain('Paragraph 160');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });

  it('never throws on characters the standard font cannot encode', async () => {
    const bytes = await render(
      quotation([item('Café menu — “premium” ✓ 漢字 🚀 Ŵ x−y')], { title: 'Ndatenda — Zvakanaka' }),
    );
    const text = await pdfText(bytes);
    expect(text).toContain('Café menu — “premium” ? ?? ? W\u00a0x-y');
    expect(text).toContain('Ndatenda — Zvakanaka');
  });

  it('renders an invoice with how-to-pay, a receipt with allocations and credit, and a credit note', async () => {
    const inv = await pdfText(
      await render(
        invoiceModel({
          invoice: {
            number: 'INV-2026-0042',
            currency: 'USD',
            issue_date: '2026-11-06',
            due_date: '2026-11-13',
            payment_terms_days: 7,
            notes: null,
            terms: 'Payment is due by the due date shown.',
            subtotal_minor: 50_000,
            discount_minor: 0,
            tax_minor: 0,
            total_minor: 50_000,
          },
          items: [item('Support retainer', { line_total_minor: 50_000, unit_price_minor: 50_000 })],
          client,
          business,
          minorDigits: 2,
          settings,
          viewLink: 'https://kuzikode.example/i/abc',
          quotationNumber: 'QUO-2026-0007',
        }),
      ),
    );
    for (const s of [
      'INVOICE',
      'INV-2026-0042',
      'Amount due (USD)',
      '$500.00',
      '7 days',
      'QUO-2026-0007',
      'Bank: Example Bank',
      'Please quote INV-2026-0042',
      'https://kuzikode.example/i/abc',
    ])
      expect(inv).toContain(s);

    const rec = await pdfText(
      await render(
        receiptModel({
          payment: {
            receipt_number: 'RCT-2026-0003',
            amount_minor: 60_000,
            currency: 'USD',
            received_at: '2026-11-06T09:30:00Z',
            method: 'ecocash',
            reference: null,
            provider_reference: 'PN-778899',
          },
          allocations: [{ invoiceNumber: 'INV-2026-0042', amountMinor: 50_000 }],
          client,
          business,
          minorDigits: 2,
          settings,
          testPayment: true,
        }),
      ),
    );
    for (const s of [
      'RECEIPT',
      'RCT-2026-0003',
      'EcoCash',
      'PN-778899',
      'INV-2026-0042',
      'Held as account credit',
      '$100.00',
      '$600.00',
      'No real money',
    ])
      expect(rec).toContain(s);

    const cn = await pdfText(
      await render(
        creditNoteModel({
          creditNote: {
            number: 'CN-2026-0001',
            currency: 'USD',
            reason: 'Hosting cancelled',
            subtotal_minor: 10_000,
            tax_minor: 0,
            total_minor: 10_000,
            applied_to: 'client_credit',
            issued_at: '2026-11-06T10:00:00Z',
          },
          invoiceNumber: 'INV-2026-0042',
          items: [item('Hosting')],
          client,
          business,
          minorDigits: 2,
          settings,
        }),
      ),
    );
    for (const s of [
      'CREDIT NOTE',
      'CN-2026-0001',
      'INV-2026-0042',
      'Hosting cancelled',
      'Total credit (USD)',
      'Held as credit on your account',
    ])
      expect(cn).toContain(s);
  });

  it('is deterministic for the same input and fast enough for a Worker', async () => {
    const items = Array.from({ length: 40 }, (_, i) => item(`Line ${i + 1}`));
    await render(quotation(items)); // warm-up (font metrics, module init)
    const runs: number[] = [];
    let a: Uint8Array | null = null;
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      const b = await render(quotation(items));
      runs.push(performance.now() - t);
      if (a) expect(Buffer.from(b).equals(Buffer.from(a))).toBe(true);
      a = b;
    }
    const median = runs.sort((x, y) => x - y)[2]!;
    console.info(`[pdf] 40-line quotation: median ${median.toFixed(1)} ms over 5 runs, ${a!.length} bytes`);
    expect(median).toBeLessThan(250);
  });

  it('converts sanitised rich text to plain paragraphs', () => {
    expect(htmlToText('<p>One &amp; two</p><p>Three<br>four</p><ol><li>a</li><li>b</li></ol>&#8212;&nbsp;x')).toBe(
      'One & two\n\nThree\nfour\n\n• a\n• b\n\n— x',
    );
    expect(htmlToText(null)).toBe('');
  });
});
