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

/**
 * Division URLs retired with the 2026-11 catalogue (R9.1, REFINEMENTS §1) and the closest remaining page for their 301:
 * renamed divisions go to their successor, removed ones to the services overview.
 */
export const RETIRED_DIVISIONS: Record<string, string> = {
  'web-development': '/services/websites',
  'mobile-desktop-apps': '/services/cross-platform-apps',
  'cloud-it': '/services',
};

/** Short division names for compact navigation (route index, tabs); the full CMS name stays on the division page. */
const SHORT_NAMES: Record<string, string> = {
  websites: 'Websites & web apps',
  'business-software': 'Business software',
  'cross-platform-apps': 'Cross-platform apps',
  'ai-data': 'AI, data & intelligence',
  'automation-integration': 'Automation & integration',
  'add-ons': 'Add-ons',
};

export function divisionShortName(slug: string, name: string): string {
  return SHORT_NAMES[slug] ?? name;
}

/** Unit after a "from" price for compact labels: "" for one-off, " / hour", " / mailbox / month" … */
export function fromSuffix(f: FromPrice): string {
  return f.suffix === 'one-off' ? '' : ` ${f.suffix.replace(/^per /, '/ ')}`;
}
