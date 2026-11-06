/**
 * Client portal: payment history, receipts and the status of an online payment attempt (P5.5). Scoped to the caller's
 * clients where their role covers money (`portalAreaClientIds(ctx, 'finance')`). Provider internals (raw statuses, poll
 * URLs, account ids) are never returned.
 */
import type { RequestContext } from '../../context';
import { notFound } from '../../lib/errors';
import { clientScope, portalAreaClientIds } from '../../lib/policies';

export interface PortalPayment {
  id: string;
  receiptNumber: string;
  receivedAt: string;
  method: string;
  currency: string;
  amountMinor: number;
  status: 'completed' | 'reversed' | 'refunded' | 'partially_refunded';
  reference: string | null;
  invoices: { id: string; number: string; amountMinor: number }[];
}

const scope = (ctx: RequestContext, column: string) => clientScope(column, portalAreaClientIds(ctx, 'finance'));

export async function listPortalPayments(ctx: RequestContext): Promise<PortalPayment[]> {
  const s = scope(ctx, 'p.client_id');
  const { results } = await ctx.db
    .prepare(
      `SELECT p.id, p.receipt_number, p.received_at, p.method, p.currency, p.amount_minor, p.status, p.reference,
         (SELECT json_group_array(json_object('id', i.id, 'number', i.number, 'amountMinor', a.amount_minor))
          FROM payment_allocations a JOIN invoices i ON i.id = a.invoice_id WHERE a.payment_id = p.id) AS invoices
       FROM payments p WHERE ${s.sql} ORDER BY p.received_at DESC, p.receipt_number DESC LIMIT 500`,
    )
    .bind(...s.params)
    .all<{
      id: string;
      receipt_number: string;
      received_at: string;
      method: string;
      currency: string;
      amount_minor: number;
      status: PortalPayment['status'];
      reference: string | null;
      invoices: string | null;
    }>();
  return results.map((p) => ({
    id: p.id,
    receiptNumber: p.receipt_number,
    receivedAt: p.received_at,
    method: p.method,
    currency: p.currency,
    amountMinor: p.amount_minor,
    status: p.status,
    reference: p.reference,
    invoices: p.invoices ? (JSON.parse(p.invoices) as PortalPayment['invoices']) : [],
  }));
}

/** For the receipt PDF route: the payment id when the caller may download its receipt. */
export async function portalPaymentId(ctx: RequestContext, id: string): Promise<string> {
  const s = scope(ctx, 'client_id');
  const row = await ctx.db
    .prepare(`SELECT id FROM payments WHERE id = ? AND ${s.sql}`)
    .bind(id, ...s.params)
    .first<{ id: string }>();
  if (!row) throw notFound();
  return row.id;
}

export type AttemptPhase = 'waiting' | 'succeeded' | 'failed';

export interface PortalAttempt {
  id: string;
  phase: AttemptPhase;
  /** Client-safe wording of the outcome; never the provider's raw message. */
  message: string;
  method: string | null;
  payerPhone: string | null;
  currency: string;
  amountMinor: number;
  invoice: { id: string; number: string };
  createdAt: string;
  completedAt: string | null;
  /** The resulting payment (receipt) once the money arrived. */
  payment: { id: string; receiptNumber: string } | null;
}

const WAITING = ['created', 'initiated', 'pending'];
const SUCCEEDED = ['succeeded', 'partially_paid'];

function outcome(status: string): { phase: AttemptPhase; message: string } {
  if (WAITING.includes(status))
    return {
      phase: 'waiting',
      message: 'We are waiting for the payment to be confirmed. This page updates by itself.',
    };
  if (SUCCEEDED.includes(status))
    return {
      phase: 'succeeded',
      message:
        status === 'partially_paid'
          ? 'Part of the amount was received. The rest of the invoice is still open.'
          : 'Payment received. Thank you.',
    };
  switch (status) {
    case 'cancelled':
      return { phase: 'failed', message: 'The payment was cancelled. Nothing was taken from your account.' };
    case 'expired':
      return { phase: 'failed', message: 'The payment request expired before it was approved. You can try again.' };
    case 'refunded':
      return { phase: 'failed', message: 'This payment was refunded.' };
    case 'reversed':
      return { phase: 'failed', message: 'This payment was reversed by the provider.' };
    case 'disputed':
      return { phase: 'failed', message: 'This payment is being disputed. We will contact you.' };
    default:
      return { phase: 'failed', message: 'The payment did not go through. Nothing was taken from your account.' };
  }
}

export async function getPortalAttempt(ctx: RequestContext, id: string): Promise<PortalAttempt> {
  const s = scope(ctx, 'a.client_id');
  const row = await ctx.db
    .prepare(
      `SELECT a.id, a.status, a.method_code, a.payer_phone_masked, a.currency, a.amount_minor, a.created_at, a.completed_at,
         i.id AS invoice_id, i.number AS invoice_number, p.id AS payment_id, p.receipt_number
       FROM payment_attempts a JOIN invoices i ON i.id = a.invoice_id
       LEFT JOIN payments p ON p.attempt_id = a.id
       WHERE a.id = ? AND ${s.sql}`,
    )
    .bind(id, ...s.params)
    .first<{
      id: string;
      status: string;
      method_code: string | null;
      payer_phone_masked: string | null;
      currency: string;
      amount_minor: number;
      created_at: string;
      completed_at: string | null;
      invoice_id: string;
      invoice_number: string;
      payment_id: string | null;
      receipt_number: string | null;
    }>();
  if (!row) throw notFound();
  return {
    id: row.id,
    ...outcome(row.status),
    method: row.method_code,
    payerPhone: row.payer_phone_masked,
    currency: row.currency,
    amountMinor: row.amount_minor,
    invoice: { id: row.invoice_id, number: row.invoice_number },
    createdAt: row.created_at,
    completedAt: row.completed_at,
    payment: row.payment_id && row.receipt_number ? { id: row.payment_id, receiptNumber: row.receipt_number } : null,
  };
}
