/**
 * Document PDFs (P4.8). An issued document's PDF is rendered once — by the `pdf.generate` job queued when it is
 * issued, or on the first download if the job hasn't run yet — stored privately in R2 and linked from the record's
 * `pdf_file_id` (`receipt_file_id` for payments). After that it is always served from R2 and never regenerated, so
 * later setting or branding changes never alter an issued document. Drafts are rendered on the fly, never stored.
 *
 * Non-production environments watermark every PDF "TEST"; in production drafts carry "DRAFT", and receipts for
 * payments through a test-mode provider account carry "TEST" (docs/06 §6).
 */
import type { RequestContext } from '../../context';
import { Batch, stmt } from '../../db/client';
import { conflict, notFound } from '../../lib/errors';
import { sha256Hex } from '../../lib/crypto';
import { documentLink, looksLikeToken } from '../../lib/public-links';
import type { Permission } from '../../../shared/permissions';
import {
  creditNoteModel,
  invoiceModel,
  quotationModel,
  receiptModel,
  renderDocument,
  type DocumentKind,
  type DocumentModel,
  type DocumentSettings,
  type LineItem,
} from '../../pdf';
import type { BusinessDetails, ClientDetails } from '../../pdf/common';
import type { Watermark } from '../../pdf/layout';
import { getSettings, settingText } from '../cms';
import { getFile, storeGenerated, type FileRow, type OwnerType } from '../files/service';
import { currentLogo } from '../settings/service';
import { snapshots as quotationSnapshots, type QuotationRow } from '../quotations/service';

export const DOCUMENT_KINDS: DocumentKind[] = ['quotation', 'invoice', 'receipt', 'credit_note'];

/** Staff permission to download each kind (same as viewing the record). */
export const VIEW_PERMISSION: Record<DocumentKind, Permission> = {
  quotation: 'quotations.view',
  invoice: 'invoices.view',
  credit_note: 'invoices.view',
  receipt: 'payments.view',
};

interface Target {
  table: 'quotations' | 'invoices' | 'credit_notes' | 'payments';
  column: 'pdf_file_id' | 'receipt_file_id';
  owner: OwnerType;
}

const TARGET: Record<DocumentKind, Target> = {
  quotation: { table: 'quotations', column: 'pdf_file_id', owner: 'quotation' },
  invoice: { table: 'invoices', column: 'pdf_file_id', owner: 'invoice' },
  credit_note: { table: 'credit_notes', column: 'pdf_file_id', owner: 'credit_note' },
  receipt: { table: 'payments', column: 'receipt_file_id', owner: 'payment' },
};

interface Prepared {
  model: DocumentModel;
  /** Issued documents are stored; drafts are previews. */
  issued: boolean;
  storedFileId: string | null;
  testPayment: boolean;
  filename: string;
}

// ---------------------------------------------------------------- loading

const parse = <T>(json: string | null | undefined, fallback: T): T => {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
};

async function documentSettings(ctx: RequestContext): Promise<DocumentSettings> {
  const s = await getSettings(ctx);
  return {
    accentColour: settingText(s, 'branding.accent_colour') ?? null,
    footerText: settingText(s, 'documents.footer_text') ?? null,
    bankDetails: settingText(s, 'documents.bank_details') ?? null,
  };
}

async function minorDigits(ctx: RequestContext, currency: string): Promise<number> {
  const r = await ctx.db
    .prepare('SELECT minor_digits FROM currencies WHERE code = ?')
    .bind(currency)
    .first<{ minor_digits: number }>();
  return r?.minor_digits ?? 2;
}

const fileName = (kind: DocumentKind, number: string | null) =>
  `${(number ?? `${kind.replace('_', '-')}-draft`).replace(/[^A-Za-z0-9._-]+/g, '-')}.pdf`;

async function prepareQuotation(ctx: RequestContext, id: string, settings: DocumentSettings): Promise<Prepared> {
  const q = await ctx.db.prepare('SELECT * FROM quotations WHERE id = ?').bind(id).first<QuotationRow>();
  if (!q) throw notFound();
  const { results: items } = await ctx.db
    .prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY position')
    .bind(id)
    .all<LineItem>();
  const issued = q.status !== 'draft';
  let client: ClientDetails;
  let business: BusinessDetails;
  if (issued && q.client_snapshot && q.business_snapshot) {
    client = parse<ClientDetails>(q.client_snapshot, { name: 'Client' });
    business = parse<BusinessDetails>(q.business_snapshot, { name: 'Kuzikode Technologies' });
  } else {
    const snap = await quotationSnapshots(ctx, q);
    client = snap.client;
    business = snap.business;
  }
  return {
    model: quotationModel({
      quotation: q,
      items,
      client,
      business,
      minorDigits: await minorDigits(ctx, q.currency),
      settings,
    }),
    issued,
    storedFileId: q.pdf_file_id,
    testPayment: false,
    filename: fileName('quotation', q.number),
  };
}

interface InvoiceRow {
  id: string;
  number: string | null;
  status: string;
  client_id: string;
  currency: string;
  issue_date: string | null;
  due_date: string | null;
  payment_terms_days: number | null;
  notes: string | null;
  terms: string | null;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  client_snapshot: string | null;
  business_snapshot: string | null;
  pdf_file_id: string | null;
  quotation_number: string | null;
}

async function liveClient(ctx: RequestContext, clientId: string): Promise<ClientDetails> {
  const c = await ctx.db
    .prepare(
      'SELECT client_number, display_name, legal_name, email, phone, tax_number, billing_address FROM clients WHERE id = ?',
    )
    .bind(clientId)
    .first<{
      client_number: string;
      display_name: string;
      legal_name: string | null;
      email: string | null;
      phone: string | null;
      tax_number: string | null;
      billing_address: string | null;
    }>();
  if (!c) throw notFound();
  const a = parse<Record<string, string | undefined> | null>(c.billing_address, null);
  const address = a
    ? [a['line1'], a['line2'], a['city'], a['region'], a['postalCode'], a['country']].filter(Boolean).join(', ') || null
    : null;
  return {
    name: c.display_name,
    legalName: c.legal_name,
    number: c.client_number,
    email: c.email,
    phone: c.phone,
    taxNumber: c.tax_number,
    address,
  };
}

async function liveBusiness(ctx: RequestContext): Promise<BusinessDetails> {
  const s = await getSettings(ctx);
  return {
    name: settingText(s, 'company.name') ?? 'Kuzikode Technologies',
    legalName: settingText(s, 'company.legal_name') ?? null,
    registrationNumber: settingText(s, 'company.registration_number') ?? null,
    taxNumber: settingText(s, 'company.tax_number') ?? null,
    address: settingText(s, 'contact.address') ?? null,
    email: settingText(s, 'contact.billing_email') ?? settingText(s, 'contact.email') ?? null,
    phone: settingText(s, 'contact.phone') ?? null,
  };
}

async function prepareInvoice(ctx: RequestContext, id: string, settings: DocumentSettings): Promise<Prepared> {
  const inv = await ctx.db
    .prepare(
      `SELECT i.*, q.number AS quotation_number FROM invoices i LEFT JOIN quotations q ON q.id = i.source_quotation_id
       WHERE i.id = ?`,
    )
    .bind(id)
    .first<InvoiceRow>();
  if (!inv) throw notFound();
  const { results: items } = await ctx.db
    .prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position')
    .bind(id)
    .all<LineItem>();
  const issued = inv.status !== 'draft';
  if (inv.status === 'void' && !inv.number) throw notFound();
  return {
    model: invoiceModel({
      invoice: inv,
      items,
      client:
        issued && inv.client_snapshot
          ? parse<ClientDetails>(inv.client_snapshot, { name: 'Client' })
          : await liveClient(ctx, inv.client_id),
      business:
        issued && inv.business_snapshot
          ? parse<BusinessDetails>(inv.business_snapshot, { name: 'Kuzikode Technologies' })
          : await liveBusiness(ctx),
      minorDigits: await minorDigits(ctx, inv.currency),
      settings,
      viewLink: issued ? await documentLink(ctx, 'invoice', id) : null,
      quotationNumber: inv.quotation_number,
    }),
    issued,
    storedFileId: inv.pdf_file_id,
    testPayment: false,
    filename: fileName('invoice', inv.number),
  };
}

async function prepareCreditNote(ctx: RequestContext, id: string, settings: DocumentSettings): Promise<Prepared> {
  const cn = await ctx.db
    .prepare(
      `SELECT cn.*, i.number AS invoice_number, i.client_snapshot, i.business_snapshot
       FROM credit_notes cn JOIN invoices i ON i.id = cn.invoice_id WHERE cn.id = ?`,
    )
    .bind(id)
    .first<{
      number: string;
      currency: string;
      reason: string;
      subtotal_minor: number;
      tax_minor: number;
      total_minor: number;
      applied_to: 'invoice' | 'client_credit' | 'refund';
      issued_at: string;
      client_id: string;
      pdf_file_id: string | null;
      invoice_number: string | null;
      client_snapshot: string | null;
      business_snapshot: string | null;
    }>();
  if (!cn) throw notFound();
  const { results: items } = await ctx.db
    .prepare('SELECT * FROM credit_note_items WHERE credit_note_id = ? ORDER BY rowid')
    .bind(id)
    .all<LineItem>();
  return {
    model: creditNoteModel({
      creditNote: cn,
      invoiceNumber: cn.invoice_number ?? '-',
      items,
      client: cn.client_snapshot
        ? parse<ClientDetails>(cn.client_snapshot, { name: 'Client' })
        : await liveClient(ctx, cn.client_id),
      business: cn.business_snapshot
        ? parse<BusinessDetails>(cn.business_snapshot, { name: 'Kuzikode Technologies' })
        : await liveBusiness(ctx),
      minorDigits: await minorDigits(ctx, cn.currency),
      settings,
    }),
    issued: true,
    storedFileId: cn.pdf_file_id,
    testPayment: false,
    filename: fileName('credit_note', cn.number),
  };
}

async function prepareReceipt(ctx: RequestContext, id: string, settings: DocumentSettings): Promise<Prepared> {
  const p = await ctx.db
    .prepare(
      `SELECT p.*, a.mode AS account_mode FROM payments p LEFT JOIN payment_provider_accounts a ON a.id = p.account_id
       WHERE p.id = ?`,
    )
    .bind(id)
    .first<{
      receipt_number: string;
      client_id: string;
      amount_minor: number;
      currency: string;
      received_at: string;
      method: string;
      reference: string | null;
      provider_reference: string | null;
      receipt_file_id: string | null;
      account_mode: string | null;
    }>();
  if (!p) throw notFound();
  const { results: allocations } = await ctx.db
    .prepare(
      `SELECT i.number AS invoiceNumber, pa.amount_minor AS amountMinor FROM payment_allocations pa
       JOIN invoices i ON i.id = pa.invoice_id WHERE pa.payment_id = ? ORDER BY pa.created_at, pa.id`,
    )
    .bind(id)
    .all<{ invoiceNumber: string; amountMinor: number }>();
  // Decided by the account's mode, never by the gateway's name (docs/06 §1).
  const testPayment = p.account_mode === 'test';
  return {
    model: receiptModel({
      payment: p,
      allocations,
      client: await liveClient(ctx, p.client_id),
      business: await liveBusiness(ctx),
      minorDigits: await minorDigits(ctx, p.currency),
      settings,
      testPayment,
    }),
    issued: true,
    storedFileId: p.receipt_file_id,
    testPayment,
    filename: fileName('receipt', p.receipt_number),
  };
}

const PREPARE: Record<DocumentKind, (ctx: RequestContext, id: string, s: DocumentSettings) => Promise<Prepared>> = {
  quotation: prepareQuotation,
  invoice: prepareInvoice,
  credit_note: prepareCreditNote,
  receipt: prepareReceipt,
};

// ---------------------------------------------------------------- rendering

async function logo(ctx: RequestContext): Promise<{ bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' } | null> {
  const id = await currentLogo(ctx);
  if (!id) return null;
  const f = await getFile(ctx, id);
  if (!f || (f.mime_type !== 'image/png' && f.mime_type !== 'image/jpeg')) return null; // WebP: vector mark instead
  const obj = await ctx.env.FILES.get(f.r2_key);
  if (!obj) return null;
  return { bytes: new Uint8Array(await obj.arrayBuffer()), mime: f.mime_type };
}

export function watermarkFor(ctx: RequestContext, p: Pick<Prepared, 'issued' | 'testPayment'>): Watermark {
  if (!ctx.config.isProduction || p.testPayment) return 'TEST';
  return p.issued ? null : 'DRAFT';
}

async function render(ctx: RequestContext, kind: DocumentKind, p: Prepared, settings: DocumentSettings) {
  const started = Date.now();
  const bytes = await renderDocument(p.model, {
    watermark: watermarkFor(ctx, p),
    accentColour: settings.accentColour,
    logo: await logo(ctx),
    createdAt: ctx.now(),
  });
  // Wall time; on deployed Workers this only advances on I/O, so the CPU figure comes from `wrangler tail`/dev.
  ctx.logger.info('pdf rendered', { kind, bytes: bytes.length, ms: Date.now() - started });
  return bytes;
}

export interface PdfResult {
  bytes: Uint8Array<ArrayBuffer> | null;
  file: FileRow | null;
  filename: string;
  stored: boolean;
}

/**
 * Returns the stored PDF of an issued document, rendering and storing it first if it doesn't exist yet. Two
 * concurrent first calls may both render, but the guarded UPDATE lets only one link its file; the loser removes its
 * own copy and serves the winner's.
 */
export async function ensureStoredPdf(ctx: RequestContext, kind: DocumentKind, id: string): Promise<FileRow> {
  const settings = await documentSettings(ctx);
  const p = await PREPARE[kind](ctx, id, settings);
  if (!p.issued) throw conflict('Drafts have no stored PDF.');
  if (p.storedFileId) {
    const existing = await getFile(ctx, p.storedFileId);
    if (existing) return existing;
  }
  const t = TARGET[kind];
  const bytes = await render(ctx, kind, p, settings);
  const stored = await storeGenerated(ctx, {
    bytes,
    filename: p.filename,
    mime: 'application/pdf',
    ownerType: t.owner,
    ownerId: id,
  });
  // Table and column names come from the fixed TARGET map above, never from input.
  const res = await new Batch(ctx.db)
    .add(stored.stmt)
    .add(
      stmt(
        ctx.db,
        `UPDATE ${t.table} SET ${t.column} = ? WHERE id = ? AND ${t.column} IS ${p.storedFileId ? '?' : 'NULL'}`,
        stored.id,
        id,
        ...(p.storedFileId ? [p.storedFileId] : []),
      ),
      'link',
    )
    .run();
  if (res.changes('link') === 1) return (await getFile(ctx, stored.id))!;
  // Lost the race: drop our copy, serve the one that was linked.
  await ctx.db.prepare('DELETE FROM files WHERE id = ?').bind(stored.id).run();
  await ctx.env.FILES.delete(stored.key);
  const winner = await ctx.db
    .prepare(`SELECT ${t.column} AS id FROM ${t.table} WHERE id = ?`)
    .bind(id)
    .first<{ id: string | null }>();
  const f = winner?.id ? await getFile(ctx, winner.id) : null;
  if (!f) throw conflict('The document changed while its PDF was being created. Try again.');
  return f;
}

/**
 * The PDF to hand to a reader: the stored file for issued documents, an unstored preview for drafts.
 * Authorisation is the caller's job (route permission or public token).
 */
export async function documentPdf(ctx: RequestContext, kind: DocumentKind, id: string): Promise<PdfResult> {
  const settings = await documentSettings(ctx);
  const p = await PREPARE[kind](ctx, id, settings);
  if (!p.issued)
    return { bytes: await render(ctx, kind, p, settings), file: null, filename: p.filename, stored: false };
  const file = await ensureStoredPdf(ctx, kind, id);
  return { bytes: null, file, filename: p.filename, stored: true };
}

/** Builds the model only (no rendering); used by tests and previews. */
export async function documentModel(ctx: RequestContext, kind: DocumentKind, id: string): Promise<DocumentModel> {
  return (await PREPARE[kind](ctx, id, await documentSettings(ctx))).model;
}

/** Quotation id for a public token, or null. Drafts are never public. */
export async function quotationIdForToken(ctx: RequestContext, token: string): Promise<string | null> {
  if (!looksLikeToken(token)) return null;
  const r = await ctx.db
    .prepare("SELECT id FROM quotations WHERE public_token_hash = ? AND status <> 'draft'")
    .bind(await sha256Hex(token))
    .first<{ id: string }>();
  return r?.id ?? null;
}

export function pdfResponse(
  bytes: Uint8Array<ArrayBuffer>,
  filename: string,
  opts: { inline?: boolean } = {},
): Response {
  return new Response(bytes, {
    headers: {
      'content-type': 'application/pdf',
      'content-length': String(bytes.length),
      'content-disposition': `${opts.inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    },
  });
}
