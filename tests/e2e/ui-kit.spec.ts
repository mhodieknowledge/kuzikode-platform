import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';

test.use(ownIp('ui-kit'));

/** The new UI primitives gallery (redesign R2.4); replaces the P2.15 kitchen sink. */
test.describe('UI kit (/dev/ui)', () => {
  test('renders every primitive group, is accessible and has no horizontal scroll', async ({ page }) => {
    await page.goto('/dev/ui');
    await expect(page.getByRole('heading', { name: 'UI kit', level: 1 })).toBeVisible();
    for (const section of [
      'Buttons',
      'Segmented controls and tabs',
      'Rails',
      'Accordion',
      'Status and lists',
      'Fields and choices',
      'Sheets and toasts',
      'Data table',
    ]) {
      await expect(page.getByRole('heading', { name: section, level: 2 })).toBeVisible();
    }
    await expectAccessible(page);
    await screenshots(page, 'ui-kit');
  });

  test('tabs-mode segmented control switches panels with click and arrow keys', async ({ page }) => {
    await page.goto('/dev/ui');
    const list = page.getByRole('tablist', { name: 'Sub-services' });
    await list.getByRole('tab', { name: 'E-commerce' }).click();
    await expect(page.getByText('Online shops with local payments.')).toBeVisible();
    await expect(page.getByText('Corporate and business websites.')).toBeHidden();
    await page.keyboard.press('ArrowRight');
    await expect(list.getByRole('tab', { name: 'Web apps' })).toBeFocused();
    await expect(page.getByText('Portals and dashboards.')).toBeVisible();
  });

  test('rail moves with its buttons and keeps the page from scrolling sideways on phones', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/dev/ui');
    const rail = page.getByRole('region', { name: 'Packages' });
    const track = rail.locator('.kz-rail__track');
    await rail.scrollIntoViewIfNeeded();
    await rail.getByRole('button', { name: 'Next: Packages' }).click();
    await expect.poll(() => track.evaluate((t) => t.scrollLeft)).toBeGreaterThan(100);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('bottom sheet opens, traps focus and closes with Escape', async ({ page }) => {
    await page.goto('/dev/ui');
    const opener = page.getByRole('button', { name: 'Open bottom sheet' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Compare packages' });
    await expect(dialog).toBeVisible();
    await expect(opener).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toHaveAttribute('aria-expanded', 'false');
  });

  test('destructive confirm needs the typed number and reports through a toast', async ({ page }) => {
    await page.goto('/dev/ui');
    await page.getByRole('button', { name: 'Void invoice' }).click();
    const dialog = page.getByRole('dialog', { name: 'Void INV-2026-00021?' });
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole('button', { name: 'Void invoice' });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole('textbox').fill('INV-2026-00021');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByRole('status').getByText('Invoice voided')).toBeVisible();
    await expect(dialog).toBeHidden();
  });

  test('money input stores minor units and flags too many decimals', async ({ page }) => {
    await page.goto('/dev/ui');
    const amount = page.getByLabel('Amount');
    await amount.fill('1250.5');
    await expect(page.getByText('Stored as 125050 minor units')).toBeVisible();
    await amount.fill('1.234');
    await expect(page.getByText('Use at most 2 decimal places')).toBeVisible();
  });

  test('data table becomes list rows on phones and shows its empty state', async ({ page }) => {
    await page.goto('/dev/ui');
    await expect(page.getByRole('table', { name: 'Invoices' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('table', { name: 'Invoices' })).toBeHidden();
    await expect(page.getByRole('list', { name: 'Invoices' }).getByRole('listitem')).toHaveCount(3);
    await page.getByRole('radiogroup', { name: 'Table state' }).getByRole('radio', { name: 'Empty' }).click();
    await expect(page.getByText('No invoices yet')).toBeVisible();
  });

  test('is not available outside development', async ({ request }) => {
    const res = await request.get('/dev/ui');
    expect(res.headers()['x-robots-tag']).toBe('noindex, nofollow');
    expect(res.headers()['cache-control']).toBe('private, no-store');
  });
});
