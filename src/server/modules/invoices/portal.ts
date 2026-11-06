/**
 * Client portal reads for invoices and credit notes (P5.4). Scoped to the caller's clients where their access role
 * covers money (`portalAreaClientIds(ctx, 'finance')`); drafts are never shown. Paying online arrives with the payments
 * module (P6); until then the portal shows the payment instructions from Settings.
 */
import type { RequestContext } from '../../context';
import { businessDate } from '../../lib/dates';
import { notFound } from '../../lib/errors';
import { clientScope, portalAreaClientIds } from '../../lib/policies';
import type { InvoiceStatus } from '../../../shared/invoices';
import type { BusinessSnapshot, ClientSnapshot } from '../quotations/service';
import { getSettings, settingText } from '../cms';
import type { InvoiceItemRow, InvoiceRow } from './service';

export interface PortalInvoiceListItem {
  id: string;
  number: string;
  currency: string;
  totalMinor: number;
  balanceMinor: number;
  status: InvoiceStatus;
  /** Past its due date with a balance, whether or not the nightly job has marked it yet. */
  overdue: boolean;
  issueDate: string | null;
  dueDate: string | null;
  clientName: string;
}

const OPEN = "i.status IN ('issued','partially_paid','overdue') AND i.balance_minor > 0";

function scope(ctx: RequestContext, column: string) {
  return clientScope(column, portalAreaClientIds(ctx, 'finance'));
}

const isOverdue = (i: { status: string; due_date: string | null; balance_minor: number }, today: string) =>
  i.balance_minor > 0 &&
  (i.status === 'overdue' ||
    ((i.status === 'issued' || i.status === 'partially_paid') && !!i.due_date && i.due_date < today));

export async function listPortalInvoices(
  ctx: RequestContext,
  filter: { show: 'open' | 'all' } = { show: 'all' },
): Promise<PortalInvoiceListItem[]> {
  const s = scope(ctx, 'i.client_id');
  const today = businessDate(ctx.now());
  const { results } = await ctx.db
    .prepare(
      `SELECT i.id, i.number, i.currency, i.total_minor, i.balance_minor, i.status, i.issue_date, i.due_date,
         c.display_name AS client_name
       FROM invoices i JOIN clients c ON c.id = i.client_id
       WHERE ${s.sql} AND i.status <> 'draft' ${filter.show === 'open' ? `AND ${OPEN}` : ''}
       ORDER BY CASE WHEN ${OPEN} THEN 0 ELSE 1 END, COALESCE(i.due_date, i.issue_date) ${filter.show === 'open' ? 'ASC' : 'DESC'},
         i.number DESC LIMIT 500`,
    )
    .bind(...s.params)
    .all<{
      id: string;
      number: string;
      currency: string;
      total_minor: number;
      balance_minor: number;
      status: InvoiceStatus;
      issue_date: string | null;
      due_date: string | null;
      client_name: string;
    }>();
  return results.map((i) => ({
    id: i.id,
    number: i.number,
    currency: i.currency,
    totalMinor: i.total_minor,
    balanceMinor: i.balance_minor,
    status: i.status,
    overdue: isOverdue(i, today),
    issueDate: i.issue_date,
    dueDate: i.due_date,
    clientName: i.client_name,
  }));
}

export interface PortalCreditNote {
  id: string;
  number: string;
  invoiceId: string;
  invoiceNumber: string;
  currency: string;
  totalMinor: number;
  reason: string;
  appliedTo: 'invoice' | 'client_credit' | 'refund';
  status: 'issued' | 'void';
  issuedAt: string;
}

async function creditNotes(ctx: RequestContext, where: string, ...params: unknown[]): Promise<PortalCreditNote[]> {
  const s = scope(ctx, 'cn.client_id');
  const { results } = await ctx.db
    .prepare(
      `SELECT cn.id, cn.number, cn.invoice_id, i.number AS invoice_number, cn.currency, cn.total_minor, cn.reason,
         cn.applied_to, cn.status, cn.issued_at
       FROM credit_notes cn JOIN invoices i ON i.id = cn.invoice_id
       WHERE ${s.sql} ${where} ORDER BY cn.issued_at DESC, cn.id DESC LIMIT 500`,
    )
    .bind(...s.params, ...params)
    .all<{
      id: string;
      number: string;
      invoice_id: string;
      invoice_number: string;
      currency: string;
      total_minor: number;
      reason: string;
      applied_to: PortalCreditNote['appliedTo'];
      status: PortalCreditNote['status'];
      issued_at: string;
    }>();
  return results.map((c) => ({
    id: c.id,
    number: c.number,
    invoiceId: c.invoice_id,
    invoiceNumber: c.invoice_number,
    currency: c.currency,
    totalMinor: c.total_minor,
    reason: c.reason,
    appliedTo: c.applied_to,
    status: c.status,
    issuedAt: c.issued_at,
  }));
}

export const listPortalCreditNotes = (ctx: RequestContext) => creditNotes(ctx, '');

export interface PortalInvoice {
  invoice: InvoiceRow;
  items: InvoiceItemRow[];
  client: ClientSnapshot;
  business: BusinessSnapshot;
  minorDigits: number;
  overdue: boolean;
  payments: { receiptNumber: string; receivedAt: string; appliedMinor: number }[];
  creditNotes: PortalCreditNote[];
  /** How to pay while the balance is open: bank details from Settings (blank when not set). */
  payment: { bankDetails: string | null; contactEmail: string | null } | null;
}

async function loadPortalInvoiceRow(ctx: RequestContext, id: string): Promise<InvoiceRow> {
  const s = scope(ctx, 'client_id');
  const inv = await ctx.db
    .prepare(`SELECT * FROM invoices WHERE id = ? AND status <> 'draft' AND ${s.sql}`)
    .bind(id, ...s.params)
    .first<InvoiceRow>();
  if (!inv) throw notFound();
  return inv;
}

export async function getPortalInvoice(ctx: RequestContext, id: string): Promise<PortalInvoice> {
  const inv = await loadPortalInvoiceRow(ctx, id);
  const [items, payments, digits] = await ctx.db.batch([
    ctx.db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY position').bind(inv.id),
    ctx.db
      .prepare(
        `SELECT p.receipt_number, p.received_at, a.amount_minor AS applied_minor FROM payment_allocations a
         JOIN payments p ON p.id = a.payment_id WHERE a.invoice_id = ? AND p.status <> 'reversed' ORDER BY p.received_at`,
      )
      .bind(inv.id),
    ctx.db.prepare('SELECT minor_digits FROM currencies WHERE code = ?').bind(inv.currency),
  ]);
  const open = inv.balance_minor > 0 && ['issued', 'partially_paid', 'overdue'].includes(inv.status);
  const settings = open ? await getSettings(ctx) : null;
  return {
    invoice: inv,
    items: (items?.results ?? []) as InvoiceItemRow[],
    client: JSON.parse(inv.client_snapshot ?? '{}') as ClientSnapshot,
    business: JSON.parse(inv.business_snapshot ?? '{}') as BusinessSnapshot,
    minorDigits: ((digits?.results ?? [])[0] as { minor_digits: number } | undefined)?.minor_digits ?? 2,
    overdue: isOverdue(inv, businessDate(ctx.now())),
    payments: (
      (payments?.results ?? []) as { receipt_number: string; received_at: string; applied_minor: number }[]
    ).map((p) => ({ receiptNumber: p.receipt_number, receivedAt: p.received_at, appliedMinor: p.applied_minor })),
    creditNotes: await creditNotes(ctx, 'AND cn.invoice_id = ?', inv.id),
    payment: settings
      ? {
          bankDetails: settingText(settings, 'documents.bank_details') ?? null,
          contactEmail:
            settingText(settings, 'contact.billing_email') ?? settingText(settings, 'contact.email') ?? null,
        }
      : null,
  };
}

/** For the PDF routes: the id when the caller may download it. */
export async function portalInvoiceId(ctx: RequestContext, id: string): Promise<string> {
  return (await loadPortalInvoiceRow(ctx, id)).id;
}

export async function portalCreditNoteId(ctx: RequestContext, id: string): Promise<string> {
  const s = scope(ctx, 'client_id');
  const row = await ctx.db
    .prepare(`SELECT id FROM credit_notes WHERE id = ? AND ${s.sql}`)
    .bind(id, ...s.params)
    .first<{ id: string }>();
  if (!row) throw notFound();
  return row.id;
}
