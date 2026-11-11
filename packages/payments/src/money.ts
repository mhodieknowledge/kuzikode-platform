/**
 * Integer-only conversions between minor units and the decimal strings gateways use ("12.34"). No floats anywhere:
 * a float can turn 0.29 into 0.28999… and a gateway amount must match ours exactly.
 */

/** 1234 → "12.34" (digits = minor-unit digits of the currency, normally 2). */
export function minorToDecimal(minor: number, digits = 2): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError('Amount must be a safe integer in minor units');
  if (!Number.isInteger(digits) || digits < 0 || digits > 4) throw new RangeError('Unsupported minor-unit digits');
  const negative = minor < 0;
  const s = String(Math.abs(minor)).padStart(digits + 1, '0');
  const whole = digits ? s.slice(0, -digits) : s;
  const frac = digits ? `.${s.slice(-digits)}` : '';
  return `${negative ? '-' : ''}${whole}${frac}`;
}

const DECIMAL = /^(-)?(\d{1,15})(?:\.(\d+))?$/;

/**
 * "12.34" → 1234. Accepts fewer decimals ("12.3", "12"); refuses more decimals than the currency has unless they are
 * zeros ("12.340"), signs other than a leading minus, separators, symbols and exponents. Returns null when invalid.
 */
export function decimalToMinor(value: string, digits = 2): number | null {
  const m = DECIMAL.exec(value.trim());
  if (!m) return null;
  const [, sign, whole, fracRaw = ''] = m;
  if (fracRaw.length > digits && /[^0]/.test(fracRaw.slice(digits))) return null;
  const frac = fracRaw.slice(0, digits).padEnd(digits, '0');
  const n = Number(`${whole}${frac}`);
  if (!Number.isSafeInteger(n)) return null;
  return sign ? -n : n;
}

/** Same as decimalToMinor but throws, for values that must be valid. */
export function parseDecimalMinor(value: string, digits = 2): number {
  const n = decimalToMinor(value, digits);
  if (n === null) throw new RangeError('Invalid decimal amount');
  return n;
}
