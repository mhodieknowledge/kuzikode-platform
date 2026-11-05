import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { expectAccessible, screenshots } from './helpers';

const CV = fileURLToPath(new URL('./fixtures/brief.pdf', import.meta.url));

test('careers: open role listed, JobPosting JSON-LD, apply with a CV, nav shows Careers while a role is open', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: /main/i }).getByRole('link', { name: 'Careers' })).toBeVisible();

  await page.goto('/careers');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Work with us');
  await expectAccessible(page);
  await screenshots(page, 'careers');
  await page.getByRole('link', { name: /Junior Web Developer \(sample posting\)/ }).click();
  await expect(page).toHaveURL(/\/careers\/example-junior-developer$/);
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(
    (t) => JSON.parse(t) as Record<string, unknown>[],
  );
  expect(ld.find((x) => x['@type'] === 'JobPosting')).toMatchObject({
    title: 'Junior Web Developer (sample posting)',
    employmentType: 'FULL_TIME',
  });
  await expect(page.getByRole('heading', { name: 'Responsibilities' })).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'careers-posting');

  await page.getByRole('heading', { name: 'Apply for this role' }).scrollIntoViewIfNeeded();
  await expect(page.locator('astro-island:has(form)').last()).not.toHaveAttribute('ssr');
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByText('Attach your CV as a PDF or Word document.')).toBeVisible();
  await page.getByLabel('Full name').fill('Chipo Example');
  await page.getByLabel('Email').fill('chipo@example.com');
  await page.locator('input[type="file"]').first().setInputFiles(CV);
  await page.getByLabel('Cover letter', { exact: true }).fill('I would like to join your team.');
  await page.getByRole('checkbox', { name: /I agree/ }).check();
  await page.getByRole('button', { name: 'Submit application' }).click();
  const done = page.getByRole('status').filter({ hasText: 'Thank you for applying.' });
  await expect(done).toContainText(/APP-\d{4}-\d{4}/);
});

test('careers: unknown role is 404, general applications are off by default', async ({ request }) => {
  expect((await request.get('/careers/no-such-role')).status()).toBe(404);
  expect((await request.get('/careers/apply')).status()).toBe(404);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/careers/example-junior-developer');
});
