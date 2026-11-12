/**
 * Price accuracy (BRIEF B.6): every package, price, unit, annual price, minimum quantity, feature and add-on the pricing page shows
 * must equal what is stored in D1. The expected values are read straight from the LOCAL D1 used by `wrangler dev` (the same
 * database the page renders from), with SQL written independently of the CMS module, at phone and desktop widths.
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
let packages: Row[] = [];
let features: Row[] = [];
let addons: Row[] = [];
let showPrices = false;
test.beforeAll(() => {
  packages = d1(
    `SELECT p.id, p.slug, p.name, p.tagline, p.pricing_tab, p.price_type, p.price_minor, p.annual_price_minor, p.currency,
            p.min_quantity, p.delivery_time, p.revision_rounds, p.support_period, p.status
     FROM service_packages p JOIN services s ON s.id = p.service_id JOIN service_categories c ON c.id = s.category_id
     WHERE p.status <> 'inactive' AND s.status <> 'inactive' AND c.status <> 'inactive'`,
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
  for (const a of addons) {
    const row = page.locator(`[data-addon="${String(a.id)}"]`);
    const t = await text(row);
    expect(t).toContain(String(a.name));
    if (showPrices && a.price_minor !== null)
      expect(t).toContain(formatPriceTag(Number(a.price_minor), String(a.currency)));
  }
}

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
