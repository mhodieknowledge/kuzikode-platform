/**
 * Our own checkout page (docs/06 §3b): everything `/pay/[invoiceToken]` and `/portal/invoices/[id]/pay` render, built
 * from the invoice, `invoicePaymentOptions` (the routed account's methods) and Settings. Gateway-independent: no
 * provider names, keys or URLs reach the page. The caller has already checked access (portal scope or public token).
 */
import type { RequestContext } from '../../context';
import { Batch } from '../../db/client';
import { auditStmt } from '../../lib/audit';
import { conflict, notFound } from '../../lib/errors';
import { formatMoney } from '../../../shared/money';
import { normalizeZimPhone } from '../../../shared/payment-methods';
import type { BankTransferNoticeInput } from '../../../shared/schemas/payments';
import { getSettings, settingText } from '../cms';
import { notifyStaffWithPermission } from '../notifications/service';
import { invoicePaymentOptions, type PaymentOptions } from './orchestration';
import { checkoutCards, type SavedCardView } from './saved-cards';

const SUMMARY_LINES = 5;

export interface CheckoutView {
  invoice: {
    id: string;
    number: string;
    status: string;
    clientName: string;
    currency: string;
    minorDigits: number;
    totalMinor: number;
    /** Paid and credited so far. */
    paidMinor: number;
    amountDueMinor: number;
    /** The first few lines (description + line total) and how many more there are. */
    lines: { description: string; totalMinor: number }[];
    moreLines: number;
  };
  /** Online methods of the routed account; empty when nothing can be paid online now. */
  methods: PaymentOptions['methods'];
  payable: boolean;
  testMode: boolean;
  /** Bank details and the reference to quote, while the invoice is open and Settings have bank details. */
  bankTransfer: { details: string; reference: string } | null;
  /** Mobile number to suggest for wallet payments (the caller's own or the invoice's client), local format. */
  phone: string | null;
  /** Signed-in portal payers only (docs/06 §3b): usable saved cards, and whether a new card may be saved. */
  cards: { saved: SavedCardView[]; canSave: boolean };
}

interface InvoiceRow {
  id: string;
  client_id: string;
  number: string | null;
  status: string;
  currency: string;
  total_minor: number;
  amount_paid_minor: number;
  amount_credited_minor: number;
  balance_minor: number;
  client_snapshot: string | null;
}

const OPEN = ['issued', 'partially_paid', 'overdue'];

export async function checkoutView(
  ctx: RequestContext,
  invoiceId: string,
  opts: { userId?: string | null } = {},
): Promise<CheckoutView> {
  const inv = await ctx.db
    .prepare(
      `SELECT id, client_id, number, status, currency, total_minor, amount_paid_minor, amount_credited_minor, balance_minor,
         client_snapshot FROM invoices WHERE id = ? AND status <> 'draft'`,
    )
    .bind(invoiceId)
    .first<InvoiceRow>();
  if (!inv) throw notFound();
  const [lines, count, digits] = await ctx.db.batch([
    ctx.db
      .prepare('SELECT description, line_total_minor FROM invoice_items WHERE invoice_id = ? ORDER BY position LIMIT ?')
      .bind(inv.id, SUMMARY_LINES),
    ctx.db.prepare('SELECT COUNT(*) AS n FROM invoice_items WHERE invoice_id = ?').bind(inv.id),
    ctx.db.prepare('SELECT minor_digits FROM currencies WHERE code = ?').bind(inv.currency),
  ]);
  const open = OPEN.includes(inv.status) && inv.balance_minor > 0;
  const [options, settings] = await Promise.all([invoicePaymentOptions(ctx, inv.id), open ? getSettings(ctx) : null]);
  const cards =
    open && options.methods.some((m) => m.code === 'card')
      ? await checkoutCards(ctx, { clientId: inv.client_id, currency: inv.currency }, { portalUser: !!opts.userId })
      : { savedCards: [], canSaveCard: false };
  const user = opts.userId
    ? await ctx.db.prepare('SELECT phone FROM users WHERE id = ?').bind(opts.userId).first<{ phone: string | null }>()
    : null;
  const client = JSON.parse(inv.client_snapshot ?? '{}') as { name?: string; phone?: string | null };
  const bank = settings ? (settingText(settings, 'documents.bank_details') ?? '').trim() : '';
  const total = ((count?.results ?? [])[0] as { n: number } | undefined)?.n ?? 0;
  const shown = (lines?.results ?? []) as { description: string; line_total_minor: number }[];
  return {
    invoice: {
      id: inv.id,
      number: inv.number ?? inv.id,
      status: inv.status,
      clientName: client.name ?? '',
      currency: inv.currency,
      minorDigits: ((digits?.results ?? [])[0] as { minor_digits: number } | undefined)?.minor_digits ?? 2,
      totalMinor: inv.total_minor,
      paidMinor: inv.amount_paid_minor + inv.amount_credited_minor,
      amountDueMinor: open ? inv.balance_minor : 0,
      lines: shown.map((l) => ({ description: l.description, totalMinor: l.line_total_minor })),
      moreLines: Math.max(0, total - shown.length),
    },
    methods: options.methods,
    payable: options.payable,
    testMode: options.testMode,
    bankTransfer: open && bank ? { details: bank, reference: inv.number ?? inv.id } : null,
    phone: normalizeZimPhone(user?.phone ?? '') ?? normalizeZimPhone(client.phone ?? ''),
    cards: { saved: cards.savedCards, canSave: cards.canSaveCard },
  };
}

/**
 * "I've paid, notify Kuzikode" (bank transfer): a note for finance to look for the transfer and record it. It never
 * marks anything paid. One notice per invoice per day is enough (repeats are accepted silently).
 */
export async function reportBankTransfer(
  ctx: RequestContext,
  invoiceId: string,
  input: BankTransferNoticeInput,
): Promise<{ ok: true }> {
  const inv = await ctx.db
    .prepare('SELECT id, number, status, currency, balance_minor FROM invoices WHERE id = ?')
    .bind(invoiceId)
    .first<{ id: string; number: string | null; status: string; currency: string; balance_minor: number }>();
  if (!inv || inv.status === 'draft') throw notFound();
  if (!OPEN.includes(inv.status) || inv.balance_minor <= 0) throw conflict('This invoice has nothing left to pay.');
  const day = ctx.now().toISOString().slice(0, 10);
  const number = inv.number ?? inv.id;
  const said = [input.payerName && `from ${input.payerName}`, input.reference && `reference ${input.reference}`]
    .filter(Boolean)
    .join(', ');
  await new Batch(ctx.db)
    .add(
      notifyStaffWithPermission(ctx, 'payments.record_manual', {
        type: 'payment.reported',
        title: `Client reports a bank transfer for ${number} (${formatMoney(inv.balance_minor, inv.currency)} due)${said ? `: ${said}` : ''}. Check the bank and record it.`,
        link: `/admin/invoices/${inv.id}`,
        entityType: 'invoice',
        entityId: inv.id,
        dedupeKey: `bank_transfer_notice:${inv.id}:${day}`,
      }),
    )
    .add(
      auditStmt(ctx, {
        action: 'payment.bank_transfer_reported',
        entityType: 'invoice',
        entityId: inv.id,
        after: { payerName: input.payerName ?? null, reference: input.reference ?? null },
      }),
    )
    .run();
  return { ok: true };
}
