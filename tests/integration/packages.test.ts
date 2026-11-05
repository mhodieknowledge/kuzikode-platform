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

  it('seeds the full catalogue, every package flagged for price review and tied to a real service', async () => {
    const { results } = await env.DB.prepare(
      'SELECT p.slug, p.price_review_required, s.id AS service FROM service_packages p LEFT JOIN services s ON s.id = p.service_id',
    ).all<{ slug: string; price_review_required: number; service: string | null }>();
    expect(results.length).toBeGreaterThanOrEqual(20);
    expect(results.every((r) => r.price_review_required === 1 && r.service !== null)).toBe(true);
    const addons = await env.DB.prepare('SELECT COUNT(*) AS n FROM package_addons WHERE package_id IS NULL').first<{
      n: number;
    }>();
    expect(addons!.n).toBe(8);
  });

  it('groups packages by tab with features, add-ons and a VAT note; Business Website is most popular', async () => {
    const cat = await getPricingCatalogue(ctx());
    expect(cat.showPrices).toBe(true);
    expect(cat.vatNote).toMatch(/exclude VAT/);
    const websites = cat.packages.filter((p) => p.tab === 'websites');
    expect(websites.map((p) => p.slug)).toEqual([
      'starter-website',
      'business-website',
      'ecommerce-store',
      'custom-web-app',
    ]);
    expect(websites.find((p) => p.mostPopular)!.slug).toBe('business-website');
    expect(comparisonRows(websites).map((r) => r.key)).toContain('payments');
    const starter = websites[0]!;
    expect(packagePrice(starter)).toMatchObject({ amount: '$350', suffix: 'one-off', hasPrice: true });
    const email = cat.packages.find((p) => p.slug === 'business-email')!;
    expect(packagePrice(email)).toMatchObject({
      amount: '$3',
      suffix: 'per mailbox / month',
      annual: 'or $30 per mailbox per year',
    });
    expect(email.minQuantity).toBe(3);
    expect(cat.addons.map((a) => a.id)).toContain('pad_extra_page');
    // Internal cost notes never leave the server.
    expect(JSON.stringify(cat)).not.toMatch(/Zoho Mail Lite/);
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
    const web = await packagesForCategory(ctx(), 'web-development');
    expect(web.packages.map((p) => p.slug)).toContain('business-website');
    expect(web.packages.every((p) => p.categorySlug === 'web-development')).toBe(true);
    await env.DB.batch([
      env.DB.prepare("UPDATE service_packages SET status = 'inactive' WHERE slug = 'starter-website'"),
      env.DB.prepare("UPDATE services SET status = 'inactive' WHERE slug = 'e-commerce'"),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
    const after = (await getPricingCatalogue(ctx())).packages.map((p) => p.slug);
    expect(after).not.toContain('starter-website');
    expect(after).not.toContain('ecommerce-store');
    expect((await getServiceCatalogue(ctx())).length).toBe(6);
  });

  it('lists published pricing FAQs in order', async () => {
    const faqs = await listFaqs(ctx(), 'pricing');
    expect(faqs.length).toBeGreaterThanOrEqual(6);
    expect(faqs[0]!.question).toBe('Is the price on a package final?');
  });
});
