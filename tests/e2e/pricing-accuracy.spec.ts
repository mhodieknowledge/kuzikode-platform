/**
 * Price accuracy (BRIEF B.6): every package, price, unit, annual price, minimum quantity and feature the pricing page shows
 * must equal what is stored in D1. The expected values are read straight from the LOCAL D1 used by `wrangler dev` (the same
 * database the page renders from), with SQL written independently of the CMS module, at phone and desktop widths.
 * The stored catalogue itself must be exactly the 2026-11 catalogue (docs/redesign/REFINEMENTS.md §1), and the add-ons offered
 * on enquiries and quotations must carry the same prices as the Add-ons division.
 */
import { execFileSync } from 'node:child_process';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ownIp } from './helpers';
import { formatPriceTag } from '../../src/shared/service-display';

test.use(ownIp('pricing-accuracy'));

interface Row {
  [k: string]: string | number | null;
}
function d1(sql: string): Row[] {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--json', '--command', sql], {
    stdio: ['ignore', 'pipe', 'pipe'],
  }).toString();
  const parsed = JSON.parse(out) as { results: Row[] }[];
  return parsed[0]?.results ?? [];
}

// Read in beforeAll (not at import): the runner lists spec files before the web server has prepared the local D1.
/** REFINEMENTS §1: division, package name, price type, USD cents, unit. */
const CATALOGUE: [string, string, string, number, string | null][] = [
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
];

let packages: Row[] = [];
let features: Row[] = [];
let addons: Row[] = [];
let showPrices = false;
test.beforeAll(() => {
  packages = d1(
    `SELECT p.id, p.slug, p.name, p.tagline, p.pricing_tab, p.price_type, p.price_minor, p.annual_price_minor, p.currency,
            p.price_unit, p.min_quantity, p.delivery_time, p.revision_rounds, p.support_period, p.status,
            c.slug AS division
     FROM service_packages p JOIN services s ON s.id = p.service_id JOIN service_categories c ON c.id = s.category_id
     WHERE p.status <> 'inactive' AND s.status <> 'inactive' AND c.status <> 'inactive'
     ORDER BY p.sort_order`,
  );
  features = d1(`SELECT package_id, label, value_type, value_text FROM package_features`);
  addons = d1(`SELECT id, name, price_minor, currency FROM package_addons WHERE active = 1 AND package_id IS NULL`);
  showPrices = d1(`SELECT value FROM application_settings WHERE key = 'pricing.show_prices'`)[0]?.value === 'true';
});

/** Text of an element including closed <details> content (textContent, not innerText), with whitespace collapsed. */
const text = async (l: Locator) => ((await l.textContent()) ?? '').replace(/\s+/g, ' ');

async function checkPage(page: Page) {
  expect(packages.length).toBeGreaterThan(0);
  for (const p of packages) {
    const item = page.locator(`#${String(p.pricing_tab)} li[data-package="${String(p.slug)}"]`);
    await expect(item, String(p.slug)).toHaveCount(1);
    const t = await text(item);
    expect(t).toContain(String(p.name));
    if (p.tagline) expect(t).toContain(String(p.tagline));
    const price = await text(item.locator('[data-price]'));
    if (p.price_type === 'custom_quote') expect(price).toContain('Custom quote');
    else if (!showPrices || p.price_minor === null) expect(price).toContain('Request a quote');
    else {
      expect(price, `${String(p.slug)} price`).toContain(formatPriceTag(Number(p.price_minor), String(p.currency)));
      if (p.price_type === 'starting_from') expect(price).toContain('From');
      if (p.annual_price_minor !== null)
        expect(t).toContain(formatPriceTag(Number(p.annual_price_minor), String(p.currency)));
    }
    if (Number(p.min_quantity) > 1) expect(t).toContain(`Minimum ${String(p.min_quantity)}`);
    for (const v of [p.delivery_time, p.revision_rounds, p.support_period]) if (v) expect(t).toContain(String(v));
    for (const f of features.filter((x) => x.package_id === p.id)) {
      expect(t, `${String(p.slug)} feature`).toContain(String(f.label));
      if (f.value_type === 'text' && f.value_text) expect(t).toContain(String(f.value_text));
    }
  }
  // The separate add-ons block is gone (the Add-ons division lists them); none of its rows remain on the page.
  await expect(page.locator('[data-addon]')).toHaveCount(0);
}

test('the stored catalogue is exactly the 2026-11 catalogue, in USD, and add-ons match the Add-ons division', () => {
  expect(packages.map((p) => [p.division, p.name, p.price_type, p.price_minor, p.price_unit])).toEqual(CATALOGUE);
  expect(packages.every((p) => p.currency === 'USD' && p.status === 'active')).toBe(true);
  const division = new Map(packages.filter((p) => p.division === 'add-ons').map((p) => [p.name, p.price_minor]));
  expect(addons.length).toBe(division.size);
  for (const a of addons) {
    expect(a.currency, String(a.name)).toBe('USD');
    expect(division.get(String(a.name)), String(a.name)).toBe(a.price_minor);
  }
});

for (const width of [390, 1440]) {
  test(`every displayed price, feature and add-on equals the stored data (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    expect((await page.goto('/pricing'))!.status()).toBe(200);
    await checkPage(page);
    if (width === 1440 && showPrices) {
      // The comparison table repeats the prices: they must match too.
      for (const p of packages.filter((x) => x.price_type !== 'custom_quote' && x.price_minor !== null)) {
        const head = page.locator(`#${String(p.pricing_tab)} th[data-package="${String(p.slug)}"] [data-price]`);
        if ((await head.count()) === 0) continue;
        expect(await text(head)).toContain(formatPriceTag(Number(p.price_minor), String(p.currency)));
      }
    }
  });
}
