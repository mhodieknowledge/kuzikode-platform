import { formatMoney } from './money';

export type PricingModel = 'fixed' | 'hourly' | 'starting_from' | 'custom_quote';

/** Public label for a service's pricing model (PRD §3.3). Prices only when the owner has allowed them. */
export function pricingLabel(
  model: PricingModel,
  priceMinor: number | null,
  currency: string | null,
  showPrices: boolean,
): string {
  if (model === 'custom_quote' || priceMinor === null || !currency || !showPrices) {
    return model === 'hourly'
      ? 'Billed by the hour'
      : model === 'custom_quote'
        ? 'Priced per project'
        : 'Price on request';
  }
  const amount = formatMoney(priceMinor, currency);
  if (model === 'hourly') return `${amount} per hour`;
  if (model === 'starting_from') return `From ${amount}`;
  return `${amount} fixed price`;
}

/** Contact link that preselects the division and (optionally) the service in the enquiry form. */
export function quotationHref(categorySlug: string, serviceSlug?: string): string {
  const params = new URLSearchParams({ category: categorySlug });
  if (serviceSlug) params.set('service', serviceSlug);
  return `/contact?${params.toString()}`;
}

/** Coming-soon divisions and services are shown with a badge but never offer a quotation. */
export function canRequestQuote(categoryStatus: string, serviceStatus = 'active'): boolean {
  return categoryStatus === 'active' && serviceStatus === 'active';
}

export interface PackagePriceInput {
  priceType: 'fixed' | 'starting_from' | 'custom_quote';
  priceMinor: number | null;
  annualPriceMinor: number | null;
  currency: string | null;
  billingType: 'one_off' | 'recurring';
  interval: 'month' | 'year' | null;
  priceUnit: string | null;
}

export interface PackagePriceDisplay {
  /** "From" for starting_from prices, otherwise null. */
  prefix: string | null;
  /** Formatted amount, or the quote wording when no price can be shown. */
  amount: string;
  /** e.g. "per month", "per mailbox / month", "one-off". */
  suffix: string | null;
  /** e.g. "or $250.00 per year". */
  annual: string | null;
  hasPrice: boolean;
}

/** Package price wording (docs/12 §A.1). Hidden prices read "Request a quote"; custom quotes read "Custom quote". */
/** Marketing amounts drop ".00" on whole amounts ($350, not $350.00); invoices always use formatMoney. */
export function formatPriceTag(minor: number, currency: string): string {
  const s = formatMoney(minor, currency);
  return minor % 100 === 0 ? s.replace(/\.00$/, '') : s;
}

export function packagePrice(p: PackagePriceInput): PackagePriceDisplay {
  if (p.priceType === 'custom_quote') {
    return { prefix: null, amount: 'Custom quote', suffix: null, annual: null, hasPrice: false };
  }
  if (p.priceMinor === null || !p.currency) {
    return { prefix: null, amount: 'Request a quote', suffix: null, annual: null, hasPrice: false };
  }
  const per = p.billingType === 'recurring' ? (p.interval === 'year' ? 'year' : 'month') : null;
  const unit = p.priceUnit?.replace(/^per\s+/i, '') ?? null;
  const suffix = unit && per ? `per ${unit} / ${per}` : unit ? `per ${unit}` : per ? `per ${per}` : 'one-off';
  const annual =
    p.annualPriceMinor !== null && per === 'month'
      ? `or ${formatPriceTag(p.annualPriceMinor, p.currency)}${unit ? ` per ${unit}` : ''} per year`
      : null;
  return {
    prefix: p.priceType === 'starting_from' ? 'From' : null,
    amount: formatPriceTag(p.priceMinor, p.currency),
    suffix,
    annual,
    hasPrice: true,
  };
}

/** "Get started" opens the Start-a-Project wizard with the package preselected (docs/12 §A.1, §C.2). */
export function startProjectHref(packageSlug: string): string {
  return `/start-a-project?${new URLSearchParams({ package: packageSlug }).toString()}`;
}

/** "5 November 2026" in the business time zone (Africa/Harare). */
export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Harare',
  }).format(new Date(iso));
}
