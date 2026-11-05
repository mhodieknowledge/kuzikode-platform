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
