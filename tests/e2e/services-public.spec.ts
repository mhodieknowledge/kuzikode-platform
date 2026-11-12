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
  await expect(rows.filter({ hasText: 'Automation' })).toContainText('per hour');
  await expectAccessible(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/services');
  const row = page.locator('.kz-atlas__acc details').filter({ hasText: 'AI, Data' });
  await row.locator('summary').click();
  await expect(row).toHaveAttribute('open', '');
  await row.getByRole('link', { name: /^Open / }).click();
  await expect(page).toHaveURL(/\/services\/ai-data$/);
});

test('division page: comparison table, recommended column, package requests preselect the contact form', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/services/web-development');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Web Development');
  await expect(page.locator('.kz-dhead svg[data-ill="web-development"]')).toBeVisible();
  await expect(page.locator('.kz-dhead').getByRole('link', { name: 'Get a quote' })).toHaveAttribute(
    'href',
    '/contact?category=web-development',
  );
  const table = page.getByRole('table', { name: /packages compared/ });
  await expect(table.getByRole('columnheader', { name: /Starter Website/ })).toContainText('$350');
  await expect(table.getByRole('columnheader', { name: /Recommended/ })).toContainText('Business Website');
  await expect(table.getByRole('link', { name: /Request this package.*Business Website/ })).toHaveAttribute(
    'href',
    '/contact?category=web-development&package=business-website',
  );
  await expect(page.getByRole('heading', { name: 'Questions' })).toBeVisible();
  await expect(page.locator('a[href^="/start-a-project"]')).toHaveCount(0);
  await expectAccessible(page);

  // Phones: one package at a time, chosen with the selector.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const starter = table.getByRole('columnheader', { name: /Starter Website/ });
  await expect(starter).toBeHidden();
  await page.getByRole('group', { name: 'Show package' }).getByRole('button', { name: 'Starter Website' }).click();
  await expect(starter).toBeVisible();
  await expect(table.getByRole('columnheader', { name: /Business Website/ })).toBeHidden();
});
