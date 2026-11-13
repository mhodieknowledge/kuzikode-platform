import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import {
  comparisonRows,
  getPricingCatalogue,
  getServiceCatalogue,
  listFaqs,
  packagesForCategory,
  bumpContentVersionStmt,
  resetCmsCache,
} from '../../src/server/modules/cms';
import { packagePrice } from '../../src/shared/service-display';
import { seedBase } from '../helpers/seed';

const ctx = () => createContext({ env, now: () => new Date('2026-11-05T10:00:00Z') });
const setShowPrices = async (on: boolean) => {
  await env.DB.batch([
    env.DB.prepare("UPDATE application_settings SET value = ? WHERE key = 'pricing.show_prices'").bind(
      JSON.stringify(on),
    ),
    bumpContentVersionStmt(env.DB),
  ]);
  resetCmsCache();
};

describe('packages & pricing (docs/12 §A)', () => {
  beforeEach(async () => {
    await seedBase();
    resetCmsCache();
  });

  it('seeds exactly the 2026-11 catalogue (REFINEMENTS §1): owner-set USD prices, each tied to a real service', async () => {
    const { results } = await env.DB.prepare(
      `SELECT c.slug AS division, p.name, p.price_type, p.price_minor, p.currency, p.price_unit, p.price_review_required,
         s.id AS service
       FROM service_packages p LEFT JOIN services s ON s.id = p.service_id LEFT JOIN service_categories c ON c.id = s.category_id
       WHERE p.status = 'active' ORDER BY p.sort_order`,
    ).all<Record<string, string | number | null>>();
    expect(results.every((r) => r.price_review_required === 0 && r.service !== null && r.currency === 'USD')).toBe(
      true,
    );
    expect(results.map((r) => [r.division, r.name, r.price_type, r.price_minor, r.price_unit])).toEqual([
      ['websites', 'Starter Website', 'fixed', 15_000, null],
      ['websites', 'Business Website', 'fixed', 32_000, null],
      ['websites', 'E-commerce Website', 'starting_from', 65_000, null],
      ['websites', 'Custom Web Applications', 'starting_from', 120_000, null],
      ['business-software', 'POS & Inventory Systems', 'starting_from', 80_000, null],
      ['business-software', 'Custom ERP & Business Management Systems', 'starting_from', 250_000, null],
      ['business-software', 'Business Dashboards & Reporting Systems', 'starting_from', 60_000, null],
      ['cross-platform-apps', 'Cross-Platform Application Development', 'starting_from', 120_000, null],
      ['ai-data', 'AI Integration & Intelligent Assistants', 'starting_from', 50_000, null],
      ['ai-data', 'Data Intelligence & Analytics', 'starting_from', 60_000, null],
      ['ai-data', 'Intelligent Document Processing', 'starting_from', 80_000, null],
      ['automation-integration', 'Business Process Automation', 'starting_from', 40_000, 'per workflow'],
      ['automation-integration', 'Payment Gateway Integration: local methods', 'fixed', 5_000, 'per local method'],
      ['automation-integration', 'Payment Gateway Integration: card payments', 'fixed', 10_000, null],
      ['automation-integration', 'API Development', 'starting_from', 40_000, null],
      ['automation-integration', 'Systems Integration', 'starting_from', 50_000, null],
      ['add-ons', 'Additional Website Pages', 'fixed', 1_500, 'per page'],
      ['add-ons', 'Logo Design', 'fixed', 5_000, null],
      ['add-ons', 'Copywriting', 'fixed', 1_500, 'per page'],
      ['add-ons', 'Additional Languages', 'fixed', 6_000, 'per language'],
      ['add-ons', 'Product Catalogue Upload', 'fixed', 2_500, 'per 50 products'],
    ]);
    // No recurring packages remain (care plans, hosting, email and domains are no longer sold).
    expect(
      (await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM service_packages WHERE status = 'active' AND billing_type = 'recurring'",
      ).first<{ n: number }>())!.n,
    ).toBe(0);
    const addons = await env.DB.prepare(
      'SELECT name, price_minor FROM package_addons WHERE package_id IS NULL AND active = 1 ORDER BY sort_order',
    ).all<{ name: string; price_minor: number }>();
    expect(addons.results.map((a) => [a.name, a.price_minor])).toEqual([
      ['Additional Website Pages', 1_500],
      ['Logo Design', 5_000],
      ['Copywriting', 1_500],
      ['Additional Languages', 6_000],
      ['Product Catalogue Upload', 2_500],
    ]);
  });

  it('groups packages by tab with features and a VAT note; Business Website is most popular', async () => {
    const cat = await getPricingCatalogue(ctx());
    expect(cat.showPrices).toBe(true);
    expect(cat.vatNote).toMatch(/exclude VAT/);
    expect([...new Set(cat.packages.map((p) => p.tab))]).toEqual(['websites', 'other']);
    const websites = cat.packages.filter((p) => p.tab === 'websites');
    expect(websites.map((p) => p.slug)).toEqual([
      'starter-website',
      'business-website',
      'ecommerce-website',
      'custom-web-application',
    ]);
    expect(websites.find((p) => p.mostPopular)!.slug).toBe('business-website');
    expect(comparisonRows(websites).map((r) => r.key)).toContain('payments');
    // Every website package lists every comparison row, so the table lines up column by column.
    for (const w of websites) expect(w.features.map((f) => f.key)).toEqual(comparisonRows(websites).map((r) => r.key));
    const starter = websites[0]!;
    expect(packagePrice(starter)).toMatchObject({ amount: '$150', suffix: 'one-off', hasPrice: true });
    expect(packagePrice(websites[2]!)).toMatchObject({ prefix: 'From', amount: '$650' });
    const local = cat.packages.find((p) => p.slug === 'payment-local-method')!;
    expect(packagePrice(local)).toMatchObject({ amount: '$50', suffix: 'per local method' });
    expect(packagePrice(cat.packages.find((p) => p.slug === 'catalogue-upload')!)).toMatchObject({
      amount: '$25',
      suffix: 'per 50 products',
    });
    expect(cat.addons.map((a) => a.id)).toContain('pad_extra_page');
    // Internal cost notes never leave the server.
    expect(JSON.stringify(cat)).not.toMatch(/transaction fees are paid by the merchant/);
  });

  it('switch off: prices are removed server-side and packages read "Request a quote"', async () => {
    await setShowPrices(false);
    const cat = await getPricingCatalogue(ctx());
    expect(cat.showPrices).toBe(false);
    expect(cat.packages.every((p) => p.priceMinor === null && p.annualPriceMinor === null)).toBe(true);
    expect(cat.addons.every((a) => a.priceMinor === null)).toBe(true);
    const starter = cat.packages.find((p) => p.slug === 'starter-website')!;
    expect(packagePrice(starter)).toMatchObject({ amount: 'Request a quote', hasPrice: false });
    expect(starter.features.length).toBeGreaterThan(10);
  });

  it('division pages get their own packages; inactive packages and services are hidden', async () => {
    const web = await packagesForCategory(ctx(), 'websites');
    expect(web.packages.map((p) => p.slug)).toContain('business-website');
    expect(web.packages.every((p) => p.categorySlug === 'websites')).toBe(true);
    await env.DB.batch([
      env.DB.prepare("UPDATE service_packages SET status = 'inactive' WHERE slug = 'starter-website'"),
      env.DB.prepare("UPDATE services SET status = 'inactive' WHERE slug = 'ecommerce-website'"),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
    const after = (await getPricingCatalogue(ctx())).packages.map((p) => p.slug);
    expect(after).not.toContain('starter-website');
    expect(after).not.toContain('ecommerce-website');
    expect((await getServiceCatalogue(ctx())).length).toBe(6);
  });

  it('lists published pricing FAQs in order', async () => {
    const faqs = await listFaqs(ctx(), 'pricing');
    expect(faqs.length).toBeGreaterThanOrEqual(6);
    expect(faqs[0]!.question).toBe('Is the price on a package final?');
  });
});
