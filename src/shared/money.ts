/**
 * Money primitives shared by server and browser. Amounts are always integer minor units + a currency code.
 * No floating point is used for money anywhere in this module.
 */

export interface Money {
  amountMinor: number;
  currency: string;
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/** Throws if the value is not a safe integer (protects against floats and overflow past 2^53). */
export function assertMinor(value: number, label = 'amount'): number {
  if (!Number.isSafeInteger(value)) throw new MoneyError(`${label} must be a safe integer in minor units`);
  return value;
}

export function money(amountMinor: number, currency: string): Money {
  return { amountMinor: assertMinor(amountMinor), currency };
}

function sameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new MoneyError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
}

export function addMoney(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

/** Sums amounts of one currency. Mixed currencies throw: never sum across currencies. */
export function sumMoney(items: Money[], currency: string): Money {
  let total = 0;
  for (const m of items) {
    if (m.currency !== currency) throw new MoneyError(`Currency mismatch: ${m.currency} vs ${currency}`);
    total += m.amountMinor;
  }
  return money(total, currency);
}

/**
 * Computes round_half_even(a × b / d) exactly using BigInt, so large intermediate products never lose precision.
 * `d` must be positive.
 */
export function mulDivHalfEven(a: number, b: number, d: number): number {
  assertMinor(a, 'a');
  assertMinor(b, 'b');
  if (!Number.isSafeInteger(d) || d <= 0) throw new MoneyError('divisor must be a positive integer');
  const num = BigInt(a) * BigInt(b);
  const den = BigInt(d);
  const neg = num < 0n;
  const abs = neg ? -num : num;
  let q = abs / den;
  const r = abs % den;
  const twice = r * 2n;
  if (twice > den || (twice === den && q % 2n === 1n)) q += 1n;
  const result = Number(neg ? -q : q);
  return assertMinor(result, 'result');
}

/**
 * Splits `total` across `weights` proportionally (largest remainder method). The parts always sum to `total`.
 * Ties go to the earlier index. Zero total weight → everything to the first item.
 */
export function allocateProportionally(total: number, weights: number[]): number[] {
  assertMinor(total, 'total');
  if (total < 0) throw new MoneyError('Cannot allocate a negative amount');
  if (weights.length === 0) return [];
  for (const w of weights) if (assertMinor(w, 'weight') < 0) throw new MoneyError('Weights cannot be negative');
  const sumW = weights.reduce((s, w) => s + w, 0);
  if (sumW === 0) return weights.map((_, i) => (i === 0 ? total : 0));
  const bigTotal = BigInt(total);
  const bigSum = BigInt(sumW);
  const parts = weights.map((w) => Number((bigTotal * BigInt(w)) / bigSum));
  let rest = total - parts.reduce((s, p) => s + p, 0);
  const order = weights
    .map((w, i) => ({ i, r: (bigTotal * BigInt(w)) % bigSum }))
    .sort((x, y) => (y.r > x.r ? 1 : y.r < x.r ? -1 : x.i - y.i));
  for (let k = 0; rest > 0; k++, rest--) parts[order[k % order.length]!.i]! += 1;
  return parts;
}

/** `1234, 2` → `"12.34"`; `-5, 2` → `"-0.05"`; `7, 0` → `"7"`. Integer string ops only. */
export function minorToDecimalString(minor: number, minorDigits: number): string {
  assertMinor(minor);
  const neg = minor < 0;
  const digits = String(Math.abs(minor)).padStart(minorDigits + 1, '0');
  const whole = minorDigits === 0 ? digits : digits.slice(0, -minorDigits);
  const frac = minorDigits === 0 ? '' : `.${digits.slice(-minorDigits)}`;
  return `${neg ? '-' : ''}${whole}${frac}`;
}

/**
 * Parses user/provider decimal text ("1,234.5", "12.34", "-3") to minor units without floats.
 * Rejects more fractional digits than the currency allows and anything that isn't a plain number.
 */
export function decimalStringToMinor(input: string, minorDigits: number): number {
  const s = input.trim().replace(/,/g, '');
  const m = /^(-)?(\d+)(?:\.(\d*))?$/.exec(s) ?? /^(-)?()\.(\d+)$/.exec(s);
  if (!m) throw new MoneyError('Enter an amount like 1250.00');
  const frac = m[3] ?? '';
  if (frac.length > minorDigits) throw new MoneyError(`Use at most ${minorDigits} decimal places`);
  const whole = m[2] === '' ? '0' : m[2]!;
  const value = Number(whole + frac.padEnd(minorDigits, '0'));
  return assertMinor(m[1] ? -value : value);
}

/** "1.5" → 1500 thousandths. Quantities allow up to 3 decimal places and must be positive. */
export function parseQuantityMilli(input: string): number {
  const milli = decimalStringToMinor(input, 3);
  if (milli <= 0) throw new MoneyError('Quantity must be greater than zero');
  return milli;
}

export function formatQuantity(quantityMilli: number): string {
  return minorToDecimalString(quantityMilli, 3).replace(/\.?0+$/, '');
}

/** "15.5" (percent) → 1550 basis points. */
export function parsePercentToBp(input: string): number {
  const bp = decimalStringToMinor(input, 2);
  if (bp < 0 || bp > 10000) throw new MoneyError('Percentage must be between 0 and 100');
  return bp;
}

export function formatBpAsPercent(bp: number): string {
  return `${minorToDecimalString(bp, 2).replace(/\.?0+$/, '')}%`;
}

const SYMBOLS: Record<string, string> = { USD: '$', ZWG: 'ZWG ' };

/** Display formatting with grouping, e.g. `$1,250.00`, `ZWG 300.00`, `-$5.00`. Tabular numbers are a CSS concern. */
export function formatMoney(minor: number, currency: string, minorDigits = 2): string {
  const neg = minor < 0;
  const [whole, frac] = minorToDecimalString(Math.abs(minor), minorDigits).split('.');
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  return `${neg ? '-' : ''}${symbol}${grouped}${frac ? `.${frac}` : ''}`;
}
