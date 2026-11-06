/**
 * Line items for quotations (and later invoices): add, reorder and remove rows, discounts and tax per line, a document
 * discount, and live totals computed with the same pricing engine the server uses (src/shared/pricing.ts). The server
 * recomputes everything on save; these figures are a preview.
 */
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatMoney, parsePercentToBp, parseQuantityMilli, minorToDecimalString } from '../../shared/money';
import { computeDocument, type DiscountType } from '../../shared/pricing';
import { Button, Field, IconButton, Input, MoneyInput, Select, Textarea } from '../ui';

export interface EditorLine {
  key: string;
  serviceId: string | null;
  packageId: string | null;
  description: string;
  quantity: string;
  unitPriceMinor: number | null;
  discountType: DiscountType;
  /** percent: text like "10"; amount: minor units as text handled by MoneyInput. */
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

const safeQty = (q: string) => {
  try {
    return parseQuantityMilli(q);
  } catch {
    return null;
  }
};
const safePct = (p: string) => {
  try {
    return p.trim() ? parsePercentToBp(p) : 0;
  } catch {
    return null;
  }
};

/** Converts editor rows to the API's line shape. */
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
    quantity: minorToDecimalString(i.quantity_milli, 3).replace(/\.?0+$/, ''),
    unitPriceMinor: i.unit_price_minor,
    discountType: i.discount_type,
    discountPercent:
      i.discount_type === 'percent' ? minorToDecimalString(i.discount_value, 2).replace(/\.?0+$/, '') : '',
    discountAmountMinor: i.discount_type === 'amount' ? i.discount_value : null,
    taxRateId: i.tax_rate_id,
    isRecurring: i.is_recurring === 1,
    recurringInterval: i.recurring_interval ?? null,
  });
}

export function LineItemEditor({
  lines,
  onChange,
  currency,
  minorDigits,
  taxRates,
  catalogue,
  docDiscount,
  onDocDiscount,
  errors,
  allowRecurring = true,
}: {
  lines: EditorLine[];
  onChange: (lines: EditorLine[]) => void;
  currency: string;
  minorDigits: number;
  taxRates: TaxOption[];
  catalogue: CatalogueOption[];
  docDiscount: { type: DiscountType; percent: string; amountMinor: number | null };
  onDocDiscount: (d: { type: DiscountType; percent: string; amountMinor: number | null }) => void;
  errors: Record<string, string[]>;
  /** Invoices bill one period; recurring billing is set up with subscriptions. */
  allowRecurring?: boolean;
}) {
  const [pick, setPick] = useState('');
  const set = (i: number, patch: Partial<EditorLine>) =>
    onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i: number, to: number) => {
    if (to < 0 || to >= lines.length) return;
    const next = [...lines];
    const [m] = next.splice(i, 1);
    next.splice(to, 0, m!);
    onChange(next);
  };
  const taxMap = new Map(taxRates.map((t) => [t.id, t]));
  const parsed = lines.map((l) => ({
    qty: safeQty(l.quantity),
    pct: l.discountType === 'percent' ? safePct(l.discountPercent) : 0,
  }));
  const docPct = docDiscount.type === 'percent' ? safePct(docDiscount.percent) : 0;
  let totals: ReturnType<typeof computeDocument> | null = null;
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
          docDiscount.type === 'percent'
            ? { type: 'percent', value: docPct }
            : docDiscount.type === 'amount'
              ? { type: 'amount', value: docDiscount.amountMinor ?? 0 }
              : { type: 'none', value: 0 },
      });
    } catch {
      totals = null;
    }
  }
  const fmt = (m: number) => formatMoney(m, currency, minorDigits);
  const groups = [...new Set(catalogue.map((c) => c.group))];
  const addFromCatalogue = (value: string) => {
    const c = catalogue.find((x) => x.value === value);
    if (!c) return;
    const samePrice = c.priceMinor != null && c.currency === currency;
    onChange([
      ...lines.filter((l) => l.description.trim() || l.unitPriceMinor),
      newLine({
        serviceId: c.serviceId,
        packageId: c.packageId,
        description: c.description,
        quantity: String(c.quantity),
        unitPriceMinor: samePrice ? c.priceMinor : null,
        isRecurring: allowRecurring && c.isRecurring,
        recurringInterval: allowRecurring ? c.interval : null,
      }),
    ]);
    setPick('');
  };
  return (
    <div className="flex flex-col gap-4">
      {errors['items'] ? (
        <p role="alert" className="text-sm font-medium text-danger-600">
          {errors['items'].join(' ')}
        </p>
      ) : null}
      <ol className="flex flex-col gap-3" aria-label="Lines">
        {lines.map((l, i) => {
          const err = (k: string) => errors[`items.${i}.${k}`];
          const line = totals?.lines[i];
          return (
            <li key={l.key} className="rounded-md border border-line bg-canvas p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-semibold text-ink-600">Line {i + 1}</p>
                <div className="flex gap-1">
                  <IconButton
                    size="sm"
                    label={`Move line ${i + 1} up`}
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    label={`Move line ${i + 1} down`}
                    disabled={i === lines.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    size="sm"
                    label={`Remove line ${i + 1}`}
                    disabled={lines.length === 1}
                    onClick={() => onChange(lines.filter((_, j) => j !== i))}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </IconButton>
                </div>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-6">
                <Field label={`Line ${i + 1} description`} error={err('description')} className="sm:col-span-6">
                  <Textarea
                    rows={2}
                    value={l.description}
                    maxLength={2000}
                    onChange={(e) => set(i, { description: e.target.value })}
                  />
                </Field>
                <Field
                  label="Quantity"
                  error={err('quantity') ?? (parsed[i]!.qty === null ? 'Use up to 3 decimals.' : undefined)}
                >
                  <Input
                    inputMode="decimal"
                    value={l.quantity}
                    onChange={(e) => set(i, { quantity: e.target.value })}
                    aria-label={`Line ${i + 1} quantity`}
                  />
                </Field>
                <Field label="Unit price" error={err('unitPriceMinor')} className="sm:col-span-2">
                  <MoneyInput
                    valueMinor={l.unitPriceMinor}
                    onChangeMinor={(v) => set(i, { unitPriceMinor: v })}
                    currency={currency}
                    minorDigits={minorDigits}
                    aria-label={`Line ${i + 1} unit price`}
                  />
                </Field>
                <Field label="Discount" error={err('discountValue')}>
                  <Select
                    value={l.discountType}
                    onChange={(e) => set(i, { discountType: e.target.value as DiscountType })}
                    aria-label={`Line ${i + 1} discount type`}
                    options={[
                      { value: 'none', label: 'None' },
                      { value: 'percent', label: '%' },
                      { value: 'amount', label: 'Amount' },
                    ]}
                  />
                </Field>
                <div className="flex flex-col justify-end">
                  {l.discountType === 'percent' ? (
                    <Input
                      inputMode="decimal"
                      value={l.discountPercent}
                      onChange={(e) => set(i, { discountPercent: e.target.value })}
                      aria-label={`Line ${i + 1} discount percent`}
                      aria-invalid={parsed[i]!.pct === null || undefined}
                      placeholder="e.g. 10"
                    />
                  ) : l.discountType === 'amount' ? (
                    <MoneyInput
                      valueMinor={l.discountAmountMinor}
                      onChangeMinor={(v) => set(i, { discountAmountMinor: v })}
                      currency={currency}
                      minorDigits={minorDigits}
                      aria-label={`Line ${i + 1} discount amount`}
                    />
                  ) : null}
                </div>
                <Field label="Tax" error={err('taxRateId')}>
                  <Select
                    value={l.taxRateId ?? ''}
                    onChange={(e) => set(i, { taxRateId: e.target.value || null })}
                    aria-label={`Line ${i + 1} tax`}
                    options={[
                      { value: '', label: 'No tax' },
                      ...taxRates.map((t) => ({ value: t.id, label: `${t.name}${t.inclusive ? ' (incl.)' : ''}` })),
                    ]}
                  />
                </Field>
                {allowRecurring ? (
                  <Field label="Billing" error={err('recurringInterval')}>
                    <Select
                      value={l.isRecurring ? (l.recurringInterval ?? 'month') : 'once'}
                      onChange={(e) =>
                        set(
                          i,
                          e.target.value === 'once'
                            ? { isRecurring: false, recurringInterval: null }
                            : { isRecurring: true, recurringInterval: e.target.value as 'month' | 'year' },
                        )
                      }
                      aria-label={`Line ${i + 1} billing`}
                      options={[
                        { value: 'once', label: 'One-off' },
                        { value: 'month', label: 'Monthly' },
                        { value: 'year', label: 'Yearly' },
                      ]}
                    />
                  </Field>
                ) : null}
                <div className="flex items-end justify-end sm:col-span-4">
                  <p className="tnum text-sm text-ink-800">
                    Line total: <span className="font-semibold text-ink-950">{line ? fmt(line.totalMinor) : '—'}</span>
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-end gap-3">
        <Button variant="secondary" onClick={() => onChange([...lines, newLine()])}>
          Add line
        </Button>
        {catalogue.length ? (
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-950">
            Add from services and packages
            <select
              value={pick}
              onChange={(e) => addFromCatalogue(e.target.value)}
              className="h-10 max-w-xs rounded-sm border border-line bg-surface px-3 text-sm text-ink-950"
            >
              <option value="">Choose…</option>
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {catalogue
                    .filter((c) => c.group === g)
                    .map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="ml-auto w-full max-w-sm rounded-md border border-line bg-surface p-4">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Overall discount">
            <Select
              value={docDiscount.type}
              onChange={(e) => onDocDiscount({ ...docDiscount, type: e.target.value as DiscountType })}
              options={[
                { value: 'none', label: 'None' },
                { value: 'percent', label: '%' },
                { value: 'amount', label: 'Amount' },
              ]}
            />
          </Field>
          <div className="flex flex-col justify-end">
            {docDiscount.type === 'percent' ? (
              <Input
                inputMode="decimal"
                aria-label="Overall discount percent"
                value={docDiscount.percent}
                aria-invalid={docPct === null || undefined}
                onChange={(e) => onDocDiscount({ ...docDiscount, percent: e.target.value })}
              />
            ) : docDiscount.type === 'amount' ? (
              <MoneyInput
                aria-label="Overall discount amount"
                valueMinor={docDiscount.amountMinor}
                onChangeMinor={(v) => onDocDiscount({ ...docDiscount, amountMinor: v })}
                currency={currency}
                minorDigits={minorDigits}
              />
            ) : null}
          </div>
        </div>
        <dl className="tnum mt-4 grid grid-cols-2 gap-y-1 text-sm" aria-live="polite">
          <dt className="text-ink-600">Subtotal</dt>
          <dd className="text-right">{totals ? fmt(totals.subtotalMinor) : '—'}</dd>
          <dt className="text-ink-600">Discounts</dt>
          <dd className="text-right">{totals ? `−${fmt(totals.discountMinor)}` : '—'}</dd>
          <dt className="text-ink-600">Tax</dt>
          <dd className="text-right">{totals ? fmt(totals.taxMinor) : '—'}</dd>
          <dt className="border-t border-line pt-2 font-semibold text-ink-950">Total</dt>
          <dd className="border-t border-line pt-2 text-right font-semibold text-ink-950">
            {totals ? fmt(totals.totalMinor) : '—'}
          </dd>
        </dl>
      </div>
    </div>
  );
}

/** Document-discount state → API fields. */
export function toApiDiscount(d: { type: DiscountType; percent: string; amountMinor: number | null }) {
  return {
    discountType: d.type,
    discountValue: d.type === 'percent' ? (safePct(d.percent) ?? 0) : d.type === 'amount' ? (d.amountMinor ?? 0) : 0,
  };
}
