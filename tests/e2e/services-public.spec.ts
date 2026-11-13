import { expect, test } from '@playwright/test';
import { expectAccessible, ownIp } from './helpers';

/** R4.2: services index (photo hero + atlas) and a division page (drawing, comparison table, offer ledger, photo band). */
test.use(ownIp('services-public'));

test('services index: photo hero, atlas with drawings and prices; the atlas is an accordion on phones', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/services');
  await expect(page.getByRole('heading', { level: 1, name: 'Services' })).toBeVisible();
  await expect(page.locator('.kz-shero img')).toBeVisible();
  const rows = page.locator('.kz-atlas__row');
  await expect(rows).toHaveCount(6);
  await expect(rows.locator('svg[data-ill]')).toHaveCount(6);
  await expect(rows.filter({ hasText: 'Automation' })).toContainText('per local method');
  await expectAccessible(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/services');
  const row = page.locator('.kz-atlas__acc details').filter({ hasText: 'AI, Data' });
  await row.locator('summary').click();
  await expect(row).toHaveAttribute('open', '');
  await row.getByRole('link', { name: /^Open / }).click();
  await expect(page).toHaveURL(/\/services\/ai-data$/);
});

test('division page: carousel of its own packages, comparison table with every package, package requests preselect the contact form', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/services/websites');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Websites & Web Applications');
  await expect(page.locator('.kz-dhead svg[data-ill="web-development"]')).toBeVisible();
  await expect(page.locator('.kz-dhead').getByRole('link', { name: 'Get a quote' })).toHaveAttribute(
    'href',
    '/contact?category=websites',
  );
  // No switching tabs or selectors on the page; only the division's own four packages.
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.locator('[data-kz-seg], [data-kz-compare], .kz-plans__pick, .kz-cmp__pick')).toHaveCount(0);
  await expect(page.locator('#plans li[data-package]')).toHaveCount(4);
  await expect(page.locator('[data-package="payment-card"]')).toHaveCount(0);
  const popular = page.locator('#plans li[data-package="business-website"]');
  await expect(popular.getByText('Most popular')).toBeVisible();
  await expect(popular.getByRole('link', { name: /Get a quote/ })).toHaveAttribute(
    'href',
    '/contact?category=websites&package=business-website',
  );
  const table = page.getByRole('table', { name: /packages compared/ });
  await expect(table.getByRole('columnheader', { name: /Starter Website/ })).toContainText('$150');
  await expect(table.getByRole('columnheader', { name: /Most popular/ })).toContainText('Business Website');
  await expect(table.getByRole('link', { name: /Get a quote.*Business Website/ })).toHaveAttribute(
    'href',
    '/contact?category=websites&package=business-website',
  );
  // One closing call to action band, and no repeated sections.
  await expect(page.locator('.kz-qband')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Questions' })).toHaveCount(0);
  await expect(page.locator('a[href^="/start-a-project"]')).toHaveCount(0);
  await expectAccessible(page);
});

test('division with a single priced offer: one offer card with what is included, no carousel and no table', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/services/cross-platform-apps');
  const card = page.locator('li[data-package="cross-platform-app"]');
  await expect(card).toHaveCount(1);
  await expect(card.locator('[data-price]')).toContainText('$1,200');
  await expect(card.getByRole('heading', { name: 'What is included' })).toBeVisible();
  await expect(card.getByRole('link', { name: /Get a quote/ })).toHaveAttribute(
    'href',
    '/contact?category=cross-platform-apps&package=cross-platform-app',
  );
  await expect(page.locator('[data-kz-rail]')).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
  await expectAccessible(page);
});

test('package carousel swipes and steps with the arrow buttons at 390; the table lists every package as a column', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/services/websites');
  const rail = page.getByRole('region', { name: /packages/i }).first();
  const track = page.locator('#plans .kz-rail__track');
  await expect(track.locator('li[data-package]')).toHaveCount(4);
  const next = page.getByRole('button', { name: /^Next:/ });
  const prev = page.getByRole('button', { name: /^Previous:/ });
  await expect(rail).toBeVisible();
  await expect(prev).toBeDisabled();
  expect(await track.evaluate((t) => t.scrollLeft)).toBeLessThan(3);
  await next.click();
  await expect.poll(() => track.evaluate((t) => t.scrollLeft)).toBeGreaterThan(100);
  await expect(prev).toBeEnabled();
  await prev.click();
  await expect.poll(() => track.evaluate((t) => t.scrollLeft)).toBeLessThan(3);
  // The dots mark the position, and the next card peeks (the track is wider than its viewport).
  expect(await track.evaluate((t) => t.scrollWidth > t.clientWidth)).toBe(true);
  expect(await page.locator('#plans .kz-rail__dot').count()).toBe(4);

  // Comparison table: all four packages are columns; the feature column is pinned while the table scrolls sideways.
  const table = page.getByRole('table', { name: /packages compared/ });
  await expect(table.getByRole('columnheader')).toHaveCount(5); // feature column + 4 packages
  for (const name of ['Starter Website', 'Business Website', 'E-commerce Website', 'Custom Web Applications'])
    await expect(table.getByRole('columnheader', { name: new RegExp(name) })).toHaveCount(1);
  const scroll = page.locator('#compare .kz-cmp__scroll');
  expect(await scroll.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const pinned = table.getByRole('rowheader', { name: 'Pages' });
  await scroll.evaluate((e) => (e.scrollLeft = 300));
  const [left, scrollLeft] = await Promise.all([
    pinned.evaluate(
      (e) => e.getBoundingClientRect().left - (e.closest('.kz-cmp__scroll')?.getBoundingClientRect().left ?? 0),
    ),
    scroll.evaluate((e) => e.scrollLeft),
  ]);
  expect(scrollLeft).toBeGreaterThan(100);
  expect(Math.abs(left)).toBeLessThan(2);
});
