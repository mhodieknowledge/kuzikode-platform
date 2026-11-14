import { expect, test } from '@playwright/test';
import { expectAccessible, ownIp } from './helpers';

test.use(ownIp('floating-menu'));

for (const width of [360, 390, 430]) {
  test(`floating menu at ${width}px: inset panel, no prices, open/close/navigate/back`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const opener = page.getByRole('button', { name: 'Open menu' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Menu' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('data-open', '');

    await page.waitForTimeout(450);
    await page.screenshot({ path: `test-results/screens/menu-open-${width}.png` });
    // Floating: inset from the edges, not full-bleed.
    const box = await dialog.locator('.kz-sheet__panel').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(8);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width - 8);
    expect(box!.y).toBeGreaterThanOrEqual(8);

    // No prices; every row has an icon.
    await expect(dialog).not.toContainText(/\$\s?\d|from\s+\$/i);
    const items = dialog.locator('.kz-fm__item');
    expect(await items.count()).toBeGreaterThan(8);
    expect(await items.locator('svg').count()).toBe(await items.count());
    await expect(dialog.getByRole('link', { name: 'Get a quote' })).toBeVisible();
    await page.waitForTimeout(450); // let the open transition settle before axe samples colours
    await expectAccessible(page);

    // Body scroll is locked; no horizontal overflow.
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(0);

    // Escape closes and returns focus to the opener.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();

    // Tap outside (on the dimmed backdrop) closes.
    await opener.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(width / 2, 790);
    await expect(dialog).toBeHidden();

    // Navigate, then the back button returns with the menu closed.
    await opener.click();
    await dialog.getByRole('link', { name: 'Pricing' }).click();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(dialog).toBeHidden();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
    await page.screenshot({ path: `test-results/screens/menu-${width}.png` });
  });
}
