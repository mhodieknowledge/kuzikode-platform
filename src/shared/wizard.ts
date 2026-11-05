/**
 * Start-a-Project wizard (docs/12 §C.2): fixed option lists and the indicative estimate.
 * Shared by the browser island (live estimate) and the server (estimate stored in the brief), so both always agree.
 */
import { assertMinor, mulDivHalfEven } from './money';

const add = (a: number, b: number) => assertMinor(a + b);

export const WIZARD_FEATURES = [
  { value: 'online_payments', label: 'Online payments (EcoCash, OneMoney, cards)' },
  { value: 'user_accounts', label: 'User accounts and sign-in' },
  { value: 'blog', label: 'Blog or news section' },
  { value: 'booking', label: 'Bookings or appointments' },
  { value: 'catalogue', label: 'Product or service catalogue' },
  { value: 'multilingual', label: 'More than one language' },
  { value: 'integrations', label: 'Connect to existing systems' },
  { value: 'reports', label: 'Reports and dashboards' },
  { value: 'mobile_app', label: 'Android / iOS app' },
  { value: 'business_email', label: 'Business email on my domain' },
] as const;
export type WizardFeature = (typeof WIZARD_FEATURES)[number]['value'];

export const TIMELINES = ['As soon as possible', 'Within 1 month', '1 – 3 months', '3 – 6 months', 'Flexible'] as const;

export const WIZARD_STEPS = ['What you need', 'Package', 'Features', 'Budget & details', 'Your details'] as const;

export interface EstimatePackage {
  priceType: 'fixed' | 'starting_from' | 'custom_quote';
  priceMinor: number | null;
  currency: string | null;
  billingType: 'one_off' | 'recurring';
  interval: 'month' | 'year' | null;
  minQuantity: number;
}

export interface EstimateAddon {
  priceMinor: number | null;
  currency: string;
  billingType: 'one_off' | 'recurring';
  unit: 'each' | 'page' | 'mailbox' | 'month' | 'year' | 'hour';
}

export interface Estimate {
  currency: string;
  /** One-off part: low–high (equal for fixed packages). */
  oneOffLowMinor: number;
  oneOffHighMinor: number;
  /** Recurring part, per interval. */
  recurring: { interval: 'month' | 'year'; amountMinor: number }[];
}

/** "Starting from" packages: the upper end of the indicative range is 60% above the starting price. */
export const STARTING_FROM_SPREAD_BP = 16_000;

const addonInterval = (a: EstimateAddon): 'month' | 'year' => (a.unit === 'month' ? 'month' : 'year');

/**
 * Indicative estimate from a package and add-ons (each add-on counted once). Returns null when no price can be shown:
 * custom quotes, hidden prices, or mixed currencies. Always labelled "Indicative only, confirmed in a quotation".
 */
export function indicativeEstimate(pkg: EstimatePackage | null, addons: EstimateAddon[]): Estimate | null {
  if (!pkg || pkg.priceType === 'custom_quote' || pkg.priceMinor === null || !pkg.currency) return null;
  const currency = pkg.currency;
  if (addons.some((a) => a.priceMinor === null || a.currency !== currency)) return null;

  let low = 0;
  let high = 0;
  const recurring = new Map<'month' | 'year', number>();
  const addRecurring = (interval: 'month' | 'year', amount: number) =>
    recurring.set(interval, add(recurring.get(interval) ?? 0, amount));

  const base = assertMinor(pkg.priceMinor * pkg.minQuantity);
  if (pkg.billingType === 'recurring') addRecurring(pkg.interval ?? 'month', base);
  else {
    low = base;
    high = pkg.priceType === 'starting_from' ? mulDivHalfEven(base, STARTING_FROM_SPREAD_BP, 10_000) : base;
  }
  for (const a of addons) {
    const price = a.priceMinor ?? 0;
    if (a.billingType === 'recurring') addRecurring(addonInterval(a), price);
    else {
      low = add(low, price);
      high = add(high, price);
    }
  }
  return {
    currency,
    oneOffLowMinor: low,
    oneOffHighMinor: high,
    recurring: (['month', 'year'] as const)
      .filter((i) => recurring.has(i))
      .map((interval) => ({ interval, amountMinor: recurring.get(interval)! })),
  };
}
