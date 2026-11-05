import { expect, test } from '@playwright/test';
import { expectAccessible } from './helpers';

test.describe('public layout', () => {
  test('desktop: mega-menu opens, lists all six divisions and closes with Escape', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav).toBeVisible();
    const services = nav.getByRole('button', { name: 'Services' });
    await services.click();
    await expect(services).toHaveAttribute('aria-expanded', 'true');
    const panel = page.locator('#menu-services');
    for (const name of [
      'Web Development & Digital Solutions',
      'Mobile & Desktop Application Development',
      'Business Software & Enterprise Systems',
      'AI, Data & Intelligence',
      'Automation & Systems Integration',
      'Cloud, Infrastructure & IT Solutions',
    ]) {
      await expect(
        panel.getByRole('link', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }),
      ).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(services).toBeFocused();
    await expect(page.getByRole('link', { name: 'Start a project' })).toHaveAttribute('href', '/start-a-project');
    await expect(page.getByRole('link', { name: 'Client Portal' })).toHaveAttribute('href', '/portal/login');
    await expectAccessible(page);
  });

  test('tablet and phone: the menu button opens a dialog with the full navigation', async ({ page }) => {
    for (const width of [768, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
      await page.getByRole('button', { name: 'Open menu' }).click();
      const dialog = page.getByRole('dialog', { name: 'Menu' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('link', { name: 'Cloud, Infrastructure & IT Solutions' })).toBeVisible();
      await expect(dialog.getByRole('link', { name: 'Start a project' })).toBeVisible();
      await expectAccessible(page);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      const scroll = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(scroll).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/screens/layout-${width}.png`, fullPage: true });
    }
  });

  test('skip link, footer legal links and no blank contact placeholders', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    const footer = page.getByRole('contentinfo');
    for (const l of ['Privacy Policy', 'Terms of Use', 'Service Terms', 'Cookie notice', 'Accessibility']) {
      await expect(footer.getByRole('link', { name: l })).toBeVisible();
    }
    // Phone/email are blank in the seed, so nothing but the contact form link is shown.
    await expect(footer.locator('a[href^="tel:"], a[href^="mailto:"]')).toHaveCount(0);
    await expect(footer).toContainText(`© ${new Date().getFullYear()} Kuzikode Technologies`);
    await expect(footer).not.toContainText('(Private) Limited');
  });
});
