import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, screenshots, ownIp } from './helpers';
import { E2E_PASSWORD, E2E_USERS } from './users';

test.use(ownIp('careers-admin'));

const CV = readFileSync(fileURLToPath(new URL('./fixtures/brief.pdf', import.meta.url)));

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

test('careers admin: draft → staff preview → open → applicant on the board → stage, rating, email → close and archive (P4.21)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, E2E_USERS.hiringManager.email);
  const n = Date.now() % 100000;
  const title = `QA Tester ${n}`;
  const slug = `qa-tester-${n}`;

  await page.goto('/admin/careers/new');
  await hydrated(page, 'Create draft');
  await page.getByRole('textbox', { name: /^Job title/ }).fill(title);
  await page.getByRole('textbox', { name: /^Department/ }).fill('Engineering');
  await page.getByRole('textbox', { name: /^Summary/ }).fill('Help us ship careful, well-tested software.');
  await page.getByLabel('Responsibilities').fill('Test new features\nWrite bug reports');
  await page.getByRole('button', { name: 'Add question' }).click();
  await page.getByRole('textbox', { name: /^Question 1/ }).fill('Do you have the right to work in Zimbabwe?');
  await page.getByLabel('Answer type').selectOption('yes_no');
  await expectAccessible(page);
  await screenshots(page, 'admin-posting-editor');
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

  // Staff preview of the draft; the public URL is a 404 for visitors.
  expect((await page.request.get(`/careers/${slug}`, { headers: { cookie: '' } })).status()).toBe(404);
  await page.goto(`/careers/${slug}?preview=1`);
  await expect(page.getByText('Staff preview.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Apply for this role' })).toHaveCount(0);

  await page.goBack();
  await hydrated(page, 'Open for applications');
  await page.getByRole('button', { name: 'Open for applications' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Open for applications' }).click();
  await expect(page.getByText(/^Open ·/)).toBeVisible();

  // An application arrives (through the public API, exactly as the form sends it).
  const list = await (await page.request.get('/api/v1/admin/careers/postings')).json();
  const questionId = list.data.postings.find((x: { slug: string }) => x.slug === slug).questions[0].id as string;
  const res = await page.request.post(`/api/v1/public/careers/${slug}/applications`, {
    headers: { origin: new URL(page.url()).origin },
    multipart: {
      data: JSON.stringify({
        fullName: 'Nyasha Example',
        email: `nyasha-${n}@example.com`,
        consent: true,
        turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
        answers: { [questionId]: 'yes' },
      }),
      cv: { name: 'cv.pdf', mimeType: 'application/pdf', buffer: CV },
    },
  });
  expect(res.status(), await res.text()).toBe(201);

  await page.getByRole('link', { name: 'Applicants' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: `Applicants: ${title}` })).toBeVisible();
  await hydrated(page, 'Reject selected');
  const board = page.getByRole('list', { name: 'Pipeline' });
  await expect(board.getByRole('listitem', { name: 'New (1)' })).toBeVisible();
  await expectAccessible(page);
  await screenshots(page, 'admin-applicants-board');
  await board.getByLabel('Move Nyasha Example to').selectOption('screening');
  await expect(
    page.getByRole('list', { name: 'Pipeline' }).getByRole('listitem', { name: 'Screening (1)' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Nyasha Example' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Nyasha Example' })).toBeVisible();
  await expect(page.getByText('Do you have the right to work in Zimbabwe?')).toBeVisible();
  await hydrated(page, 'Add note');
  await page.getByRole('button', { name: '4 of 5' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Rated 4 of 5')).toBeVisible();
  await hydrated(page, 'Interview invitation');
  await page.getByRole('button', { name: 'Interview invitation' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Subject')).toHaveValue(new RegExp(`Interview invitation: ${title}`));
  await expectAccessible(page);
  await dialog.getByRole('button', { name: 'Send email' }).click();
  await expect(page.getByText(/^Email sent:/)).toBeVisible();
  await screenshots(page, 'admin-applicant');

  // Tidy up: close and archive so other specs see only the sample posting.
  await page.goto('/admin/careers');
  await page.getByRole('link', { name: title, exact: true }).click();
  await hydrated(page, 'Close posting');
  await page.getByRole('button', { name: 'Close posting' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close posting' }).click();
  await hydrated(page, 'Archive posting');
  await page.getByRole('button', { name: 'Archive posting' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archive posting' }).click();
  await expect(page.getByText(/^Archived ·/)).toBeVisible();
});
