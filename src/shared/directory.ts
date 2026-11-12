/**
 * Derived values for the services directory (docs/redesign/RESPONSIVE_DESIGN_SPEC.md §2): the lowest published package price of a
 * division, shown as "from $X". Presentation only: reads the catalogue the pricing page reads, never stores or changes a price.
 */
import { formatPriceTag, packagePrice, type PackagePriceInput } from './service-display';

export interface DirectoryPackage extends PackagePriceInput {
  categorySlug: string;
  status: 'active' | 'coming_soon';
}

export interface FromPrice {
  /** e.g. "$350" */
  amount: string;
  /** e.g. "one-off", "per month", "per mailbox / month" */
  suffix: string;
}

/**
 * Lowest priced active package of a division. One-off packages win over recurring ones (a "from $25" care plan would
 * misdescribe a websites division); within the chosen kind the lowest amount in the division's main currency wins.
 * Returns null when prices are hidden, nothing is priced, or the division has no packages.
 */
export function divisionFromPrice(packages: DirectoryPackage[], categorySlug: string): FromPrice | null {
  const priced = packages.filter(
    (p) =>
      p.categorySlug === categorySlug &&
      p.status === 'active' &&
      p.priceType !== 'custom_quote' &&
      p.priceMinor !== null &&
      p.currency !== null,
  );
  if (priced.length === 0) return null;
  const oneOff = priced.filter((p) => p.billingType === 'one_off');
  const pool = oneOff.length > 0 ? oneOff : priced;
  const counts = new Map<string, number>();
  for (const p of pool) counts.set(p.currency!, (counts.get(p.currency!) ?? 0) + 1);
  const currency = [...counts].sort((a, b) => b[1] - a[1] || (a[0] === 'USD' ? -1 : 1))[0]![0];
  const best = pool
    .filter((p) => p.currency === currency)
    .reduce((min, p) => (p.priceMinor! < min.priceMinor! ? p : min));
  const display = packagePrice(best);
  return { amount: formatPriceTag(best.priceMinor!, currency), suffix: display.suffix ?? 'one-off' };
}
