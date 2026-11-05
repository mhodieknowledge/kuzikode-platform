/**
 * The one pricing engine used by quotations, invoices, credit notes, PDFs and the browser line editor.
 *
 * Rules (PRD §8):
 *  - line subtotal = round_half_even(quantity_milli × unit_price_minor / 1000)
 *  - line discount: percent (basis points of the subtotal, half-even) or a fixed amount, capped at the subtotal (never below zero)
 *  - document discount: percent or amount of the post-line-discount total, capped, then allocated to lines
 *    proportionally (largest remainder) and added to each line's discount, so totals are always sums of rounded lines
 *  - tax per line on the discounted amount, rounded half-even per line:
 *      exclusive: tax = round(net × bp / 10000), total = net + tax
 *      inclusive: the discounted amount already contains tax; net = round(gross × 10000 / (10000 + bp)), tax = gross − net
 *  - document subtotal / discount / tax / total = sums of the rounded line values
 */
import { allocateProportionally, assertMinor, mulDivHalfEven, MoneyError } from './money';

export type DiscountType = 'none' | 'percent' | 'amount';

export interface Discount {
  type: DiscountType;
  /** percent → basis points (1000 = 10%); amount → minor units. Ignored for `none`. */
  value: number;
}

export interface LineInput {
  quantityMilli: number;
  unitPriceMinor: number;
  discount?: Discount;
  /** Basis points snapshot, e.g. 1550 = 15.5%. 0 = no tax. */
  taxRateBp?: number;
  taxInclusive?: boolean;
}

export interface LineResult {
  /** quantity × unit price, rounded. */
  subtotalMinor: number;
  /** Line discount + allocated share of the document discount. */
  discountMinor: number;
  /** Part of discountMinor that came from the document-level discount. */
  documentDiscountShareMinor: number;
  /** Amount excluding tax after all discounts. */
  netMinor: number;
  taxMinor: number;
  /** Amount payable for the line (net + tax). */
  totalMinor: number;
}

export interface DocumentInput {
  lines: LineInput[];
  discount?: Discount;
}

export interface DocumentResult {
  lines: LineResult[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
}

const NO_DISCOUNT: Discount = { type: 'none', value: 0 };

export function discountAmount(base: number, d: Discount = NO_DISCOUNT): number {
  if (d.type === 'none') return 0;
  assertMinor(d.value, 'discount');
  if (d.value < 0) throw new MoneyError('Discount cannot be negative');
  if (d.type === 'percent') {
    if (d.value > 10000) throw new MoneyError('Discount percentage cannot exceed 100%');
    return Math.min(base, mulDivHalfEven(base, d.value, 10000));
  }
  return Math.min(base, d.value);
}

function validateLine(line: LineInput): void {
  assertMinor(line.quantityMilli, 'quantity');
  assertMinor(line.unitPriceMinor, 'unit price');
  if (line.quantityMilli <= 0) throw new MoneyError('Quantity must be greater than zero');
  if (line.unitPriceMinor < 0) throw new MoneyError('Unit price cannot be negative');
  const bp = line.taxRateBp ?? 0;
  if (!Number.isSafeInteger(bp) || bp < 0 || bp > 10000) throw new MoneyError('Tax rate must be between 0 and 100%');
}

function taxFor(discountedAmount: number, bp: number, inclusive: boolean): { net: number; tax: number; total: number } {
  if (bp === 0) return { net: discountedAmount, tax: 0, total: discountedAmount };
  if (inclusive) {
    const net = mulDivHalfEven(discountedAmount, 10000, 10000 + bp);
    return { net, tax: discountedAmount - net, total: discountedAmount };
  }
  const tax = mulDivHalfEven(discountedAmount, bp, 10000);
  return { net: discountedAmount, tax, total: discountedAmount + tax };
}

/** Computes one line on its own (no document discount). */
export function computeLine(line: LineInput): LineResult {
  return computeDocument({ lines: [line] }).lines[0]!;
}

export function computeDocument(input: DocumentInput): DocumentResult {
  input.lines.forEach(validateLine);
  const pre = input.lines.map((line) => {
    const subtotal = mulDivHalfEven(line.quantityMilli, line.unitPriceMinor, 1000);
    const lineDiscount = discountAmount(subtotal, line.discount);
    return { line, subtotal, lineDiscount, afterLine: subtotal - lineDiscount };
  });
  const base = pre.reduce((s, p) => s + p.afterLine, 0);
  const docDiscount = discountAmount(base, input.discount);
  const shares = allocateProportionally(
    docDiscount,
    pre.map((p) => p.afterLine),
  );

  const lines: LineResult[] = pre.map((p, i) => {
    const share = shares[i] ?? 0;
    const discounted = p.afterLine - share;
    const { net, tax, total } = taxFor(discounted, p.line.taxRateBp ?? 0, p.line.taxInclusive ?? false);
    return {
      subtotalMinor: p.subtotal,
      discountMinor: p.lineDiscount + share,
      documentDiscountShareMinor: share,
      netMinor: net,
      taxMinor: tax,
      totalMinor: total,
    };
  });

  const sum = (k: keyof LineResult) =>
    assertMinor(
      lines.reduce((s, l) => s + l[k], 0),
      k,
    );
  return {
    lines,
    subtotalMinor: sum('subtotalMinor'),
    discountMinor: sum('discountMinor'),
    taxMinor: sum('taxMinor'),
    totalMinor: sum('totalMinor'),
  };
}
