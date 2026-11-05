import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';

const BRIEF = fileURLToPath(new URL('./fixtures/brief.pdf', import.meta.url));

test('"Get started" opens the wizard prefilled; a visitor completes all five steps with an attachment', async ({
  page,
}) => {
  await page.goto('/pricing');
  await page
    .locator('[data-package="business-website"]')
    .getByRole('link', { name: /Get started/ })
    .click();
  await expect(page).toHaveURL(/\/start-a-project\?package=business-website$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Package' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Business Website/ })).toBeChecked();
  const summary = page.getByRole('complementary', { name: 'Your selection' });
  await expect(summary).toContainText('Business Website');
  await expect(summary.locator('[data-estimate]')).toContainText('$750');
  await expect(summary).toContainText('Indicative only, confirmed in a quotation.');
  await expectAccessible(page);
  await screenshots(page, 'start-a-project');

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Features' })).toBeFocused();
  await page.getByRole('checkbox', { name: /Online payments/ }).check();
  await page.getByRole('checkbox', { name: /Logo design/ }).check();
  await expect(summary.locator('[data-estimate]')).toContainText('$830');

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Choose a budget range.')).toBeVisible();
  await page.getByLabel('Budget range').selectOption('$500 – $1,500');
  await page.getByLabel('When do you need it?').selectOption('Within 1 month');
  await page
    .getByLabel('Tell us about the project')
    .fill('A website for our logistics firm with online quote requests.');
  await page.locator('input[type="file"]').setInputFiles(BRIEF);
  await expect(page.getByRole('button', { name: 'Remove brief.pdf' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { level: 2, name: 'Your details' })).toBeVisible();
  await page.getByLabel('Your name').fill('Nyasha Example');
  await page.getByLabel('Email').fill('nyasha@example.com');
  await page.getByRole('checkbox', { name: /I agree/ }).check();
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Send project brief' }).click();
  const done = page.getByRole('status').filter({ hasText: 'We have your project brief.' });
  await expect(done).toBeVisible();
  await expect(done).toContainText(/ENQ-\d{4}-\d{4}/);
});

test('progress is kept in this tab and restored after a reload', async ({ page }) => {
  await page.goto('/start-a-project');
  await expect(page.getByRole('heading', { level: 2, name: 'What you need' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Choose what you need.')).toBeVisible();
  await page
    .getByRole('radio', { name: /Cloud & IT|Cloud/ })
    .first()
    .check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: /^Business Email Pro Google/ }).check();
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'Package' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Business Email Pro Google/ })).toBeChecked();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'What you need' })).toBeFocused();
  await expect(page.getByText('We restored the answers you started earlier in this tab.')).toBeVisible();
});
