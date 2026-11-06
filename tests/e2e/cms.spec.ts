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
const hydrated = (page: Page, text: string) =>
  expect(page.locator('astro-island').filter({ hasText: text }).last()).not.toHaveAttribute('ssr', { timeout: 10_000 });

test('content editor drafts a home page change, previews it privately, then publishes (P4.15)', async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const marker = `Preview check ${Date.now() % 100000}`;
  await signIn(page, E2E_USERS.contentEditor.email);
  await page.goto('/admin/cms');
  await page.getByRole('link', { name: /^Home/ }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const hero = page.getByRole('region', { name: 'Section hero' });
  await hydrated(page, 'Save draft');
  const original = await hero.getByLabel('Title', { exact: true }).inputValue();
  await hero.getByLabel('Title', { exact: true }).fill(marker);
  await hero.getByRole('button', { name: 'Save draft' }).click();
  await expect(hero.getByText('Draft saved. Preview it, then publish.')).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-cms-page');

  // Staff preview shows the draft, marked private and noindex.
  const preview = await page.request.get('/?preview=1');
  expect(preview.headers()['cache-control']).toContain('no-store');
  expect(preview.headers()['x-robots-tag']).toContain('noindex');
  await page.goto('/?preview=1');
  await expect(page.getByText('Preview of unpublished changes.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: marker })).toBeVisible();

  // A visitor (no session) never sees it, even with ?preview=1.
  const visitor = await browser.newContext();
  const v = await visitor.newPage();
  await v.goto('/?preview=1');
  await expect(v.getByText(marker)).toHaveCount(0);
  await expect(v.getByText('Preview of unpublished changes.')).toHaveCount(0);

  // Publish → visible to everyone.
  await page.goto('/admin/cms/pages/home');
  await hydrated(page, 'Publish page');
  await page.getByRole('button', { name: 'Publish page' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText(/0 sections with unpublished changes/)).toBeVisible();
  await v.goto('/');
  await expect(v.getByRole('heading', { level: 1, name: marker })).toBeVisible();
  await visitor.close();

  // Put the original title back (other specs check the live home page).
  await page.goto('/admin/cms/pages/home');
  await hydrated(page, 'Save draft');
  const heroAgain = page.getByRole('region', { name: 'Section hero' });
  await heroAgain.getByLabel('Title', { exact: true }).fill(original);
  await heroAgain.getByRole('button', { name: 'Save draft' }).click();
  await expect(heroAgain.getByText('Draft saved. Preview it, then publish.')).toBeVisible();
  await page.getByRole('button', { name: 'Publish page' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText(/0 sections with unpublished changes/)).toBeVisible();

  // Media library page is reachable and accessible.
  const mediaRes = await page.request.get('/admin/media');
  expect(mediaRes.status(), (await mediaRes.text()).slice(0, 300)).toBe(200);
  await page.waitForLoadState('networkidle');
  await page.goto('/admin/media');
  await expect(page.getByRole('heading', { level: 1, name: 'Media library' })).toBeVisible();
  await expectAccessible(page);
});
