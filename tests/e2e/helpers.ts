import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const WIDTHS = [375, 768, 1440] as const;

/** axe-core: zero serious/critical violations (docs/05 §8). */
export async function expectAccessible(page: Page, opts: { exclude?: string[] } = {}) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  for (const sel of opts.exclude ?? []) builder = builder.exclude(sel);
  const results = await builder.analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

/** Full-page screenshots at the three QA widths into test-results/screens (not committed). */
export async function screenshots(page: Page, name: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(100);
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(scroll, `horizontal scroll at ${width}px`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/screens/${name}-${width}.png`, fullPage: true });
  }
}
