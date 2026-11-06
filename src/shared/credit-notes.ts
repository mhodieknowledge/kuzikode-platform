/**
 * Credit notes (PRD §4.2 E, §8): corrections to an issued invoice. A credit line either returns part or all of an
 * invoice line (by quantity, priced proportionally to the line's stored total and tax, rounded half-even) or is a
 * free adjustment amount without tax. Shared by the server (authoritative) and the admin dialog (preview).
 */
import { mulDivHalfEven } from './money';

export const CREDIT_APPLICATIONS = [
  { value: 'invoice', label: 'Reduce the invoice balance' },
  { value: 'client_credit', label: "Add to the client's account credit" },
  { value: 'refund', label: 'Refund to the client' },
] as const;
export type CreditApplication = (typeof CREDIT_APPLICATIONS)[number]['value'];

export interface CreditableItem {
  quantity_milli: number;
  line_total_minor: number;
  line_tax_minor: number;
}

/** Total (tax included) and tax for crediting `quantityMilli` of an invoice line. */
export function creditForQuantity(
  item: CreditableItem,
  quantityMilli: number,
): { totalMinor: number; taxMinor: number } {
  if (quantityMilli === item.quantity_milli)
    return { totalMinor: item.line_total_minor, taxMinor: item.line_tax_minor };
  return {
    totalMinor: mulDivHalfEven(item.line_total_minor, quantityMilli, item.quantity_milli),
    taxMinor: mulDivHalfEven(item.line_tax_minor, quantityMilli, item.quantity_milli),
  };
}

/**
 * The most that can be credited with each application:
 * - against the invoice: its balance;
 * - to account credit or as a refund: money actually paid, less what earlier credit notes already gave back that way.
 * Either way the credit notes on one invoice never add up to more than its total.
 */
export function creditLimit(
  inv: { total_minor: number; amount_paid_minor: number; balance_minor: number },
  credited: { total: number; returned: number },
  appliedTo: CreditApplication,
): number {
  const headroom = inv.total_minor - credited.total;
  const cap = appliedTo === 'invoice' ? inv.balance_minor : inv.amount_paid_minor - credited.returned;
  return Math.max(0, Math.min(headroom, cap));
}
