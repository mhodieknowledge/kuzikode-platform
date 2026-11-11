import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';
import { E2E_PASSWORD, E2E_USERS } from './users';

test.use(ownIp('content-admin'));

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

test('content admin: write and publish an article, add a FAQ, see testimonials need consent, newsletter list (P4.22)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, E2E_USERS.contentAdmin.email);
  const n = Date.now() % 100000;
  const title = `Choosing a domain name ${n}`;
  const slug = `choosing-a-domain-${n}`;

  await page.getByRole('complementary', { name: 'Admin' }).getByRole('link', { name: 'Content', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/content\/insights$/);
  await page.getByRole('link', { name: 'New article' }).click();
  await hydrated(page, 'Create article');
  await page.getByRole('textbox', { name: /^Title/ }).fill(title);
  await page.getByRole('textbox', { name: /^Address/ }).fill(slug);
  await page
    .getByRole('textbox', { name: /^Summary/ })
    .fill('How to pick a short, memorable domain for your business.');
  await page.getByRole('textbox', { name: 'Article' }).fill('Keep it short and easy to spell.');
  await page.getByRole('textbox', { name: /^Tags/ }).fill('Domains, Small business');
  await expectAccessible(page);
  await screenshots(page, 'admin-article-editor');
  await page.getByRole('button', { name: 'Create article' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');

  // Drafts are not public; publishing makes the article live.
  expect((await page.request.get(`/insights/${slug}`, { headers: { cookie: '' } })).status()).toBe(404);
  await hydrated(page, 'Save');
  await page.getByLabel('Status').selectOption('published');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('link', { name: 'View on the website' })).toBeVisible();
  await page.goto(`/insights/${slug}`);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

  // Clean up so other specs that count the launch articles stay stable: back to draft, then delete.
  await page.goBack();
  await hydrated(page, 'Save');
  await page.getByLabel('Status').selectOption('draft');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete article' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete article' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page).toHaveURL(/\/admin\/content\/insights$/);
  await expect(page.getByRole('link', { name: title })).toHaveCount(0);
  expect((await page.request.get(`/insights/${slug}`, { headers: { cookie: '' } })).status()).toBe(404);

  // FAQ
  await page.goto('/admin/content/faq');
  await hydrated(page, 'New question');
  await page.getByRole('button', { name: 'New question' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Category').selectOption('pricing');
  await dialog.getByRole('textbox', { name: /^Question/ }).fill(`Do you offer payment plans? ${n}`);
  await dialog.getByRole('textbox', { name: /^Answer/ }).fill('Yes, larger projects can be paid by milestone.');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(`Do you offer payment plans? ${n}`)).toBeVisible();
  await page.goto('/faq');
  await expect(page.getByText(`Do you offer payment plans? ${n}`)).toBeVisible();

  // Testimonials: consent is required before saving.
  await page.goto('/admin/content/testimonials');
  await expect(page.getByText(/needs the client's recorded consent/)).toBeVisible();
  await expectAccessible(page);

  // Newsletter: content managers can view, not export.
  await page.goto('/admin/content/newsletter');
  await expect(page.getByRole('heading', { level: 1, name: 'Content' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Export/ })).toHaveCount(0);
  await expectAccessible(page);
  await screenshots(page, 'admin-newsletter');
});
