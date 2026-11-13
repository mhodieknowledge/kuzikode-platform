/**
 * Line-item editor for quotations (R6.2; invoices move to it in group 2). Each line is a ruled row: a mono line number, the
 * live line total and reorder / remove controls on a strip, the description, then quantity, unit price, discount, tax and
 * billing in a compact grid (two columns on phones). Below: add a line or insert from the catalogue, and the totals ledger
 * with the overall discount. Logic lives in `lines.ts`; accessible names ("Line 1 unit price", "Overall discount") are the
 * e2e contract.
 */
import { useState } from 'react';
import { formatMoney } from '../../../shared/money';
import type { DiscountType } from '../../../shared/pricing';
import { Field, MoneyInput } from '../../primitives';
import { Button, IconButton } from '../../primitives/button';
import {
  addCatalogueLine,
  moveLine,
  newLine,
  previewLines,
  type CatalogueOption,
  type DocDiscount,
  type EditorLine,
  type TaxOption,
} from './lines';

const DISCOUNT_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'percent', label: '%' },
  { value: 'amount', label: 'Amount' },
];

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
  docDiscount: DocDiscount;
  onDocDiscount: (d: DocDiscount) => void;
  errors: Record<string, string[]>;
  /** Invoices bill one period; recurring billing is set up with subscriptions. */
  allowRecurring?: boolean;
}) {
  const [pick, setPick] = useState('');
  const set = (i: number, patch: Partial<EditorLine>) =>
    onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const { parsed, docPct, totals } = previewLines(lines, taxRates, docDiscount);
  const fmt = (m: number) => formatMoney(m, currency, minorDigits);
  const groups = [...new Set(catalogue.map((c) => c.group))];
  const addFromCatalogue = (value: string) => {
    const c = catalogue.find((x) => x.value === value);
    if (!c) return;
    onChange(addCatalogueLine(lines, c, currency, allowRecurring));
    setPick('');
  };
  return (
    <div className="kz-lines">
      {errors['items'] ? (
        <p role="alert" className="kz-error">
          {errors['items'].join(' ')}
        </p>
      ) : null}
      <ol className="kz-lines__list" aria-label="Lines">
        {lines.map((l, i) => {
          const n = i + 1;
          const err = (k: string) => errors[`items.${i}.${k}`]?.[0];
          const line = totals?.lines[i];
          return (
            <li key={l.key} className="kz-line">
              <div className="kz-line__strip">
                <span className="kz-line__n" aria-hidden="true">
                  {String(n).padStart(2, '0')}
                </span>
                <span className="kz-line__total">
                  <span className="kz-line__tl">Line total</span>{' '}
                  <span className="kz-line__tv">{line ? fmt(line.totalMinor) : '—'}</span>
                </span>
                <span className="kz-line__acts">
                  <IconButton
                    name="chevron-down"
                    className="kz-rot180"
                    size="sm"
                    label={`Move line ${n} up`}
                    disabled={i === 0}
                    onClick={() => onChange(moveLine(lines, i, i - 1))}
                  />
                  <IconButton
                    name="chevron-down"
                    size="sm"
                    label={`Move line ${n} down`}
                    disabled={i === lines.length - 1}
                    onClick={() => onChange(moveLine(lines, i, i + 1))}
                  />
                  <IconButton
                    name="delete"
                    size="sm"
                    label={`Remove line ${n}`}
                    disabled={lines.length === 1}
                    onClick={() => onChange(lines.filter((_, j) => j !== i))}
                  />
                </span>
              </div>
              <Field
                label={
                  <>
                    <span className="sr-only">Line {n} </span>Description
                  </>
                }
                error={err('description')}
                className="kz-line__desc"
              >
                {(p) => (
                  <textarea
                    {...p}
                    className="kz-input"
                    rows={2}
                    value={l.description}
                    maxLength={2000}
                    onChange={(e) => set(i, { description: e.target.value })}
                  />
                )}
              </Field>
              <div className="kz-line__grid">
                <Field
                  label="Quantity"
                  error={err('quantity') ?? (parsed[i]!.qty === null ? 'Use up to 3 decimals.' : undefined)}
                >
                  {(p) => (
                    <input
                      {...p}
                      className="kz-input kz-input--num"
                      inputMode="decimal"
                      value={l.quantity}
                      onChange={(e) => set(i, { quantity: e.target.value })}
                      aria-label={`Line ${n} quantity`}
                    />
                  )}
                </Field>
                <Field label="Unit price" error={err('unitPriceMinor')} className="kz-line__price">
                  {(p) => (
                    <MoneyInput
                      {...p}
                      valueMinor={l.unitPriceMinor}
                      onChangeMinor={(v) => set(i, { unitPriceMinor: v })}
                      currency={currency}
                      minorDigits={minorDigits}
                      aria-label={`Line ${n} unit price`}
                    />
                  )}
                </Field>
                <Field label="Discount" error={err('discountValue')}>
                  {(p) => (
                    <div className="kz-line__pair">
                      <select
                        {...p}
                        className="kz-input"
                        value={l.discountType}
                        onChange={(e) => set(i, { discountType: e.target.value as DiscountType })}
                        aria-label={`Line ${n} discount type`}
                      >
                        {DISCOUNT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {l.discountType === 'percent' ? (
                        <input
                          className="kz-input kz-input--num"
                          inputMode="decimal"
                          value={l.discountPercent}
                          onChange={(e) => set(i, { discountPercent: e.target.value })}
                          aria-label={`Line ${n} discount percent`}
                          aria-invalid={parsed[i]!.pct === null || undefined}
                          placeholder="e.g. 10"
                        />
                      ) : l.discountType === 'amount' ? (
                        <MoneyInput
                          valueMinor={l.discountAmountMinor}
                          onChangeMinor={(v) => set(i, { discountAmountMinor: v })}
                          currency={currency}
                          minorDigits={minorDigits}
                          aria-label={`Line ${n} discount amount`}
                        />
                      ) : null}
                    </div>
                  )}
                </Field>
                <Field label="Tax" error={err('taxRateId')}>
                  {(p) => (
                    <select
                      {...p}
                      className="kz-input"
                      value={l.taxRateId ?? ''}
                      onChange={(e) => set(i, { taxRateId: e.target.value || null })}
                      aria-label={`Line ${n} tax`}
                    >
                      <option value="">No tax</option>
                      {taxRates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {`${t.name}${t.inclusive ? ' (incl.)' : ''}`}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                {allowRecurring ? (
                  <Field label="Billing" error={err('recurringInterval')}>
                    {(p) => (
                      <select
                        {...p}
                        className="kz-input"
                        value={l.isRecurring ? (l.recurringInterval ?? 'month') : 'once'}
                        onChange={(e) =>
                          set(
                            i,
                            e.target.value === 'once'
                              ? { isRecurring: false, recurringInterval: null }
                              : { isRecurring: true, recurringInterval: e.target.value as 'month' | 'year' },
                          )
                        }
                        aria-label={`Line ${n} billing`}
                      >
                        <option value="once">One-off</option>
                        <option value="month">Monthly</option>
                        <option value="year">Yearly</option>
                      </select>
                    )}
                  </Field>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="kz-lines__add">
        <Button variant="secondary" lead="add" onClick={() => onChange([...lines, newLine()])}>
          Add line
        </Button>
        {catalogue.length ? (
          <Field label="Add from services and packages" className="kz-lines__pick">
            {(p) => (
              <select {...p} value={pick} onChange={(e) => addFromCatalogue(e.target.value)} className="kz-input">
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
            )}
          </Field>
        ) : null}
      </div>
      <div className="kz-ledger">
        <Field label="Overall discount" className="kz-ledger__disc">
          {(p) => (
            <div className="kz-line__pair">
              <select
                {...p}
                className="kz-input"
                value={docDiscount.type}
                onChange={(e) => onDocDiscount({ ...docDiscount, type: e.target.value as DiscountType })}
              >
                {DISCOUNT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {docDiscount.type === 'percent' ? (
                <input
                  className="kz-input kz-input--num"
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
          )}
        </Field>
        <dl className="kz-ledger__dl" aria-live="polite">
          <div>
            <dt>Subtotal</dt>
            <dd>{totals ? fmt(totals.subtotalMinor) : '—'}</dd>
          </div>
          <div>
            <dt>Discounts</dt>
            <dd>{totals ? `−${fmt(totals.discountMinor)}` : '—'}</dd>
          </div>
          <div>
            <dt>Tax</dt>
            <dd>{totals ? fmt(totals.taxMinor) : '—'}</dd>
          </div>
          <div className="is-total">
            <dt>Total</dt>
            <dd>{totals ? fmt(totals.totalMinor) : '—'}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
