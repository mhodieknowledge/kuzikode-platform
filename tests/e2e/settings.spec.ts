import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';
import { E2E_PASSWORD, E2E_USERS } from './users';

async function signIn(page: Page, email: string) {
  await page.goto('/admin/login');
  await expect(page.locator('astro-island:has(form)')).not.toHaveAttribute('ssr');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
/** Waits until the island that contains `text` has hydrated (Astro removes its `ssr` attribute). */
const hydrated = (page: Page, text: string) =>
  expect(page.locator('astro-island').filter({ hasText: text }).last()).not.toHaveAttribute('ssr', { timeout: 10_000 });

test('administrator edits contact details and the public site shows them immediately', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, E2E_USERS.settingsAdmin.email);
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .first()
    .getByRole('link', { name: 'Settings' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  const contactRegion = page.getByRole('region', { name: 'Contact details' });
  await contactRegion.getByLabel('Office hours').scrollIntoViewIfNeeded();
  await hydrated(page, 'Office hours');
  const hours = `Mon–Fri 08:00–17:00 (${Date.now() % 1000})`;
  const contact = page.getByRole('region', { name: 'Contact details' });
  await contact.getByLabel('Office hours').fill(hours);
  await contact.getByRole('button', { name: 'Save' }).click();
  await expect(contact.getByRole('status')).toHaveText('Saved.');
  await expectAccessible(page);
  await screenshots(page, 'admin-settings');

  const pub = await page.context().browser()!.newPage();
  await pub.goto('/contact');
  await expect(pub.getByText(hours)).toBeVisible();
  await pub.close();

  await contact.getByLabel('Office hours').fill('');
  await contact.getByRole('button', { name: 'Save' }).click();
  await expect(contact.getByRole('status')).toHaveText('Saved.');
});

test('billing, numbering and integrations pages; admins see numbering read-only', async ({ page }) => {
  await signIn(page, E2E_USERS.settingsAdmin.email);
  await page.goto('/admin/settings/numbering');
  await expect(page.getByText('Only a Super Administrator can change numbering.')).toBeVisible();
  await expect(page.getByLabel('Invoices format')).toBeDisabled();
  await expectAccessible(page);

  await page.goto('/admin/settings/billing');
  await expect(page.getByRole('heading', { name: 'Tax rates' })).toBeVisible();
  await expect(page.getByText('VAT 15.5%').first()).toBeVisible();
  await page.getByRole('button', { name: 'Add tax rate' }).scrollIntoViewIfNeeded();
  await hydrated(page, 'Add tax rate');
  const name = `E2E levy ${Date.now() % 100000}`;
  await page.getByLabel('New tax rate name').fill(name);
  await page.getByLabel('Rate (%)').fill('2.5');
  await page.getByRole('button', { name: 'Add tax rate' }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText('2.5%').first()).toBeVisible();
  await expectAccessible(page);

  await page.goto('/admin/settings/integrations');
  await expect(page.getByText('Development log (emails are not sent)')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payment gateways' })).toBeVisible();
  await page.getByRole('button', { name: 'Send a test email to me' }).scrollIntoViewIfNeeded();
  await hydrated(page, 'Send a test email');
  await page.getByRole('button', { name: 'Send a test email to me' }).click();
  await expect(page.getByRole('status')).toContainText(`Test email queued to ${E2E_USERS.settingsAdmin.email}`);
  await expectAccessible(page);
});

test('staff choose their own notification preferences; support cannot open settings', async ({ page }) => {
  await signIn(page, E2E_USERS.support.email);
  await page.getByRole('button', { name: /Account menu/ }).click();
  await page.getByRole('menuitem', { name: 'Notification preferences' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Notification preferences' })).toBeVisible();
  await hydrated(page, 'Save preferences');
  await page.getByRole('checkbox', { name: /^Email\s*for New enquiry$/ }).uncheck();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /^Email\s*for New enquiry$/ })).not.toBeChecked();
  await expectAccessible(page);
  expect((await page.goto('/admin/settings'))!.status()).toBe(403);
});
