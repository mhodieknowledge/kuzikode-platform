/** Business-date helpers. Business dates are `YYYY-MM-DD` in the display timezone (default Africa/Harare). */

export const DEFAULT_TIMEZONE = 'Africa/Harare';

function parts(date: Date, timeZone: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
}

/** Calendar date of `date` in `timeZone`, as YYYY-MM-DD. */
export function businessDate(date: Date, timeZone = DEFAULT_TIMEZONE): string {
  const p = parts(date, timeZone);
  return `${p['year']}-${p['month']}-${p['day']}`;
}

export function businessYear(date: Date, timeZone = DEFAULT_TIMEZONE): number {
  return Number(parts(date, timeZone)['year']);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  if (!isValidDate(date)) throw new Error(`Invalid date: ${date}`);
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Adds calendar months, clamping to the month end (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: string, months: number): string {
  if (!isValidDate(date)) throw new Error(`Invalid date: ${date}`);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
