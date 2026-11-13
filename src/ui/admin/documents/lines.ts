/**
 * Line-item logic for quotation (and, from group 2, invoice) editors (R6.2), extracted unchanged from the pre-R6.2
 * `components/admin/LineItemEditor.tsx`: the editor row shape, API conversion both ways, catalogue insertion, reordering and
 * the live totals preview computed with the same pricing engine the server uses (src/shared/pricing.ts). The server
 * recomputes everything on save; these figures are a preview.
 */
import { minorToDecimalString, parsePercentToBp, parseQuantityMilli } from '../../../shared/money';
import { computeDocument, type DiscountType } from '../../../shared/pricing';

export interface EditorLine {
  key: string;
  serviceId: string | null;
  packageId: string | null;
  description: string;
  quantity: string;
  unitPriceMinor: number | null;
  discountType: DiscountType;
  /** percent: text like "10"; amount: minor units handled by MoneyInput. */
  discountPercent: string;
  discountAmountMinor: number | null;
  taxRateId: string | null;
  isRecurring: boolean;
  recurringInterval: 'month' | 'year' | null;
}

export interface TaxOption {
  id: string;
  name: string;
  rate_bp: number;
  inclusive: number;
}

export interface CatalogueOption {
  value: string;
  label: string;
  group: string;
  serviceId: string;
  packageId: string | null;
  description: string;
  priceMinor: number | null;
  currency: string | null;
  isRecurring: boolean;
  interval: 'month' | 'year' | null;
  quantity: number;
}

export interface DocDiscount {
  type: DiscountType;
  percent: string;
  amountMinor: number | null;
}

let seq = 0;
export const newLine = (over: Partial<EditorLine> = {}): EditorLine => ({
  key: `l${Date.now()}_${seq++}`,
  serviceId: null,
  packageId: null,
  description: '',
  quantity: '1',
  unitPriceMinor: null,
  discountType: 'none',
  discountPercent: '',
  discountAmountMinor: null,
  taxRateId: null,
  isRecurring: false,
  recurringInterval: null,
  ...over,
});

/** Quantity text → thousandths, or null when it doesn't parse (more than 3 decimals, not a number). */
export const safeQty = (q: string): number | null => {
  try {
    return parseQuantityMilli(q);
  } catch {
    return null;
  }
};
/** Percent text → basis points (empty = 0), or null when it doesn't parse. */
export const safePct = (p: string): number | null => {
  try {
    return p.trim() ? parsePercentToBp(p) : 0;
  } catch {
    return null;
  }
};

const trimZeros = (s: string) => s.replace(/\.?0+$/, '');

/** Editor rows → the API's line shape. */
export function toApiLines(lines: EditorLine[]) {
  return lines.map((l) => ({
    serviceId: l.serviceId,
    packageId: l.packageId,
    description: l.description,
    quantity: l.quantity,
    unitPriceMinor: l.unitPriceMinor ?? 0,
    discountType: l.discountType,
    discountValue:
      l.discountType === 'percent'
        ? (safePct(l.discountPercent) ?? 0)
        : l.discountType === 'amount'
          ? (l.discountAmountMinor ?? 0)
          : 0,
    taxRateId: l.taxRateId,
    isRecurring: l.isRecurring,
    recurringInterval: l.isRecurring ? l.recurringInterval : null,
  }));
}

/** A stored document line → an editor row. */
export function fromApiLine(i: {
  service_id: string | null;
  package_id: string | null;
  description: string;
  quantity_milli: number;
  unit_price_minor: number;
  discount_type: DiscountType;
  discount_value: number;
  tax_rate_id: string | null;
  is_recurring?: number;
  recurring_interval?: 'month' | 'year' | null;
}): EditorLine {
  return newLine({
    serviceId: i.service_id,
    packageId: i.package_id,
    description: i.description,
    quantity: trimZeros(minorToDecimalString(i.quantity_milli, 3)),
    unitPriceMinor: i.unit_price_minor,
    discountType: i.discount_type,
    discountPercent: i.discount_type === 'percent' ? trimZeros(minorToDecimalString(i.discount_value, 2)) : '',
    discountAmountMinor: i.discount_type === 'amount' ? i.discount_value : null,
    taxRateId: i.tax_rate_id,
    isRecurring: i.is_recurring === 1,
    recurringInterval: i.recurring_interval ?? null,
  });
}

/** Document-discount state → API fields. */
export function toApiDiscount(d: DocDiscount) {
  return {
    discountType: d.type,
    discountValue: d.type === 'percent' ? (safePct(d.percent) ?? 0) : d.type === 'amount' ? (d.amountMinor ?? 0) : 0,
  };
}

/** Stored discount → editor state. */
export function docDiscountFrom(type: DiscountType, value: number): DocDiscount {
  return {
    type,
    percent: type === 'percent' ? trimZeros(minorToDecimalString(value, 2)) : '',
    amountMinor: type === 'amount' ? value : null,
  };
}

/** Moves the row at `i` to `to` (no-op outside the list). */
export function moveLine<T>(lines: T[], i: number, to: number): T[] {
  if (to < 0 || to >= lines.length || i === to) return lines;
  const next = [...lines];
  const [m] = next.splice(i, 1);
  next.splice(to, 0, m!);
  return next;
}

/** A row that has neither a description nor a price is a blank placeholder and is replaced by inserted lines. */
export const isBlankLine = (l: EditorLine) => l.description.trim() === '' && !l.unitPriceMinor;

/** Adds a catalogue entry as a line (price only when it is in the document currency), dropping blank rows. */
export function addCatalogueLine(
  lines: EditorLine[],
  c: CatalogueOption,
  currency: string,
  allowRecurring: boolean,
): EditorLine[] {
  const samePrice = c.priceMinor != null && c.currency === currency;
  return [
    ...lines.filter((l) => !isBlankLine(l)),
    newLine({
      serviceId: c.serviceId,
      packageId: c.packageId,
      description: c.description,
      quantity: String(c.quantity),
      unitPriceMinor: samePrice ? c.priceMinor : null,
      isRecurring: allowRecurring && c.isRecurring,
      recurringInterval: allowRecurring ? c.interval : null,
    }),
  ];
}

export interface LinesPreview {
  /** Parsed quantity / percent per line (null = invalid text). */
  parsed: { qty: number | null; pct: number | null }[];
  docPct: number | null;
  totals: ReturnType<typeof computeDocument> | null;
}

/** Live totals for the editor; null totals while any input doesn't parse. */
export function previewLines(lines: EditorLine[], taxRates: TaxOption[], doc: DocDiscount): LinesPreview {
  const taxMap = new Map(taxRates.map((t) => [t.id, t]));
  const parsed = lines.map((l) => ({
    qty: safeQty(l.quantity),
    pct: l.discountType === 'percent' ? safePct(l.discountPercent) : 0,
  }));
  const docPct = doc.type === 'percent' ? safePct(doc.percent) : 0;
  let totals: LinesPreview['totals'] = null;
  if (parsed.every((p) => p.qty !== null && p.pct !== null) && docPct !== null && lines.length) {
    try {
      totals = computeDocument({
        lines: lines.map((l, i) => ({
          quantityMilli: parsed[i]!.qty!,
          unitPriceMinor: l.unitPriceMinor ?? 0,
          discount:
            l.discountType === 'percent'
              ? { type: 'percent', value: parsed[i]!.pct! }
              : l.discountType === 'amount'
                ? { type: 'amount', value: l.discountAmountMinor ?? 0 }
                : { type: 'none', value: 0 },
          taxRateBp: l.taxRateId ? (taxMap.get(l.taxRateId)?.rate_bp ?? 0) : 0,
          taxInclusive: l.taxRateId ? taxMap.get(l.taxRateId)?.inclusive === 1 : false,
        })),
        discount:
          doc.type === 'percent'
            ? { type: 'percent', value: docPct }
            : doc.type === 'amount'
              ? { type: 'amount', value: doc.amountMinor ?? 0 }
              : { type: 'none', value: 0 },
      });
    } catch {
      totals = null;
    }
  }
  return { parsed, docPct, totals };
}
