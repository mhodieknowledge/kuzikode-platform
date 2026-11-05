/**
 * Public packages & pricing (docs/12 §A.1, §C.1). Read-only, cached by content_version.
 * Prices are removed on the server when `pricing.show_prices` is off, so hidden prices never reach the HTML.
 * `cost_note` is internal and is never selected here.
 */
import type { RequestContext } from '../../context';
import { cached, getSettings, settingBool, settingText } from './service';

export type PricingTab = 'websites' | 'care' | 'email' | 'other';
export const PRICING_TABS: { key: PricingTab; label: string }[] = [
  { key: 'websites', label: 'Websites' },
  { key: 'care', label: 'Care plans' },
  { key: 'email', label: 'Email & domains' },
  { key: 'other', label: 'Other services' },
];

export interface PackageFeature {
  key: string | null;
  label: string;
  value: 'included' | 'not_included' | 'text';
  text: string | null;
  tooltip: string | null;
}

export interface PublicPackage {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  categorySlug: string;
  serviceSlug: string;
  billingType: 'one_off' | 'recurring';
  interval: 'month' | 'year' | null;
  priceType: 'fixed' | 'starting_from' | 'custom_quote';
  /** null when the price is hidden or it is a custom quote. */
  priceMinor: number | null;
  annualPriceMinor: number | null;
  currency: string | null;
  priceUnit: string | null;
  minQuantity: number;
  deliveryTime: string | null;
  revisionRounds: string | null;
  supportPeriod: string | null;
  mostPopular: boolean;
  tab: PricingTab;
  status: 'active' | 'coming_soon';
  features: PackageFeature[];
}

export interface PublicAddon {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number | null;
  currency: string;
  unit: 'each' | 'page' | 'mailbox' | 'month' | 'year' | 'hour';
  billingType: 'one_off' | 'recurring';
}

export interface PublicFaq {
  id: string;
  question: string;
  answer: string;
}

export interface PricingCatalogue {
  showPrices: boolean;
  vatNote: string;
  packages: PublicPackage[];
  addons: PublicAddon[];
}

interface PackageRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  category_slug: string;
  service_slug: string;
  billing_type: 'one_off' | 'recurring';
  interval: 'month' | 'year' | null;
  price_type: 'fixed' | 'starting_from' | 'custom_quote';
  price_minor: number | null;
  annual_price_minor: number | null;
  currency: string | null;
  price_unit: string | null;
  min_quantity: number;
  delivery_time: string | null;
  revision_rounds: string | null;
  support_period: string | null;
  most_popular: number;
  pricing_tab: PricingTab;
  status: 'active' | 'coming_soon';
}

interface FeatureRow {
  package_id: string;
  comparison_key: string | null;
  label: string;
  value_type: 'included' | 'not_included' | 'text';
  value_text: string | null;
  tooltip: string | null;
}

interface AddonRow {
  id: string;
  name: string;
  description: string | null;
  price_minor: number;
  currency: string;
  unit: PublicAddon['unit'];
  billing_type: 'one_off' | 'recurring';
}

const DEFAULT_VAT_NOTE =
  'Prices exclude VAT where applicable. Final scope and price are confirmed in a written quotation.';

/** Active and coming-soon packages whose service and division are visible. Prices still unredacted. */
function loadPackages(ctx: RequestContext) {
  return cached(ctx, 'packages', async () => {
    const [pkgs, feats, addons] = await ctx.db.batch([
      ctx.db.prepare(
        `SELECT p.id, p.slug, p.name, p.tagline, c.slug AS category_slug, s.slug AS service_slug, p.billing_type, p.interval,
           p.price_type, p.price_minor, p.annual_price_minor, p.currency, p.price_unit, p.min_quantity, p.delivery_time,
           p.revision_rounds, p.support_period, p.most_popular, p.pricing_tab, p.status
         FROM service_packages p
         JOIN services s ON s.id = p.service_id
         JOIN service_categories c ON c.id = s.category_id
         WHERE p.status <> 'inactive' AND s.status <> 'inactive' AND c.status <> 'inactive'
         ORDER BY p.sort_order, p.name`,
      ),
      ctx.db.prepare(
        `SELECT f.package_id, f.comparison_key, f.label, f.value_type, f.value_text, f.tooltip
         FROM package_features f JOIN service_packages p ON p.id = f.package_id
         WHERE p.status <> 'inactive' ORDER BY f.package_id, f.position`,
      ),
      ctx.db.prepare(
        `SELECT id, name, description, price_minor, currency, unit, billing_type FROM package_addons
         WHERE active = 1 AND package_id IS NULL ORDER BY sort_order, name`,
      ),
    ]);
    const featureRows = (feats?.results ?? []) as FeatureRow[];
    return {
      packages: ((pkgs?.results ?? []) as PackageRow[]).map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        categorySlug: p.category_slug,
        serviceSlug: p.service_slug,
        billingType: p.billing_type,
        interval: p.interval,
        priceType: p.price_type,
        priceMinor: p.price_minor,
        annualPriceMinor: p.annual_price_minor,
        currency: p.currency,
        priceUnit: p.price_unit,
        minQuantity: p.min_quantity,
        deliveryTime: p.delivery_time,
        revisionRounds: p.revision_rounds,
        supportPeriod: p.support_period,
        mostPopular: p.most_popular === 1,
        tab: p.pricing_tab,
        status: p.status,
        features: featureRows
          .filter((f) => f.package_id === p.id)
          .map((f) => ({
            key: f.comparison_key,
            label: f.label,
            value: f.value_type,
            text: f.value_text,
            tooltip: f.tooltip,
          })),
      })),
      addons: ((addons?.results ?? []) as AddonRow[]).map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        priceMinor: a.price_minor,
        currency: a.currency,
        unit: a.unit,
        billingType: a.billing_type,
      })),
    };
  });
}

/** Removes prices when the owner has not switched public prices on (docs/12 §A.1). */
export function redactPrices(pkgs: PublicPackage[], addons: PublicAddon[], showPrices: boolean) {
  if (showPrices) return { packages: pkgs, addons };
  return {
    packages: pkgs.map((p) => ({ ...p, priceMinor: null, annualPriceMinor: null })),
    addons: addons.map((a) => ({ ...a, priceMinor: null })),
  };
}

export async function getPricingCatalogue(ctx: RequestContext): Promise<PricingCatalogue> {
  const [settings, data] = await Promise.all([getSettings(ctx), loadPackages(ctx)]);
  const showPrices = settingBool(settings, 'pricing.show_prices');
  return {
    showPrices,
    vatNote: settingText(settings, 'pricing.vat_note') ?? DEFAULT_VAT_NOTE,
    ...redactPrices(data.packages, data.addons, showPrices),
  };
}

export async function packagesForCategory(ctx: RequestContext, categorySlug: string) {
  const cat = await getPricingCatalogue(ctx);
  return { ...cat, packages: cat.packages.filter((p) => p.categorySlug === categorySlug) };
}

export function listFaqs(ctx: RequestContext, category: 'general' | 'pricing' | 'projects' | 'support' | 'careers') {
  return cached(ctx, `faqs:${category}`, async () => {
    const { results } = await ctx.db
      .prepare(
        'SELECT id, question, answer FROM faqs WHERE category = ? AND published = 1 ORDER BY sort_order, question LIMIT 100',
      )
      .bind(category)
      .all<PublicFaq>();
    return results;
  });
}

/** Comparison rows for one tab: the union of comparison keys, in first-seen order (docs/12 §A.1). */
export function comparisonRows(pkgs: PublicPackage[]): { key: string; label: string }[] {
  const rows = new Map<string, string>();
  for (const p of pkgs) for (const f of p.features) if (f.key && !rows.has(f.key)) rows.set(f.key, f.label);
  return [...rows].map(([key, label]) => ({ key, label }));
}
