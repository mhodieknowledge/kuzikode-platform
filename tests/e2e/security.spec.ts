/**
 * P7.2 security boundaries in the browser (docs/08 §4 "security.spec.ts"): client B can't open client A's invoice, quotation,
 * project, payment or file URLs (404, never 403, so nothing is confirmed to exist); a Content Manager can't reach finance;
 * signed-out visitors are sent to sign in; private areas are never indexed. The full matrix of API checks lives in the
 * integration suite (rbac, portal-*, files, payments-online…).
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { E2E_PASSWORD, E2E_PORTAL_USER, E2E_SECURITY_USER, E2E_USERS } from './users';
import { ownIp } from './helpers';

test.use(ownIp('security'));

const hydrated = (page: Page, text: string) =>
  expect(page.locator('astro-island').filter({ hasText: text }).first()).not.toHaveAttribute('ssr', {
    timeout: 10_000,
  });

async function signIn(page: Page, area: 'admin' | 'portal', email: string) {
  await page.goto(`/${area}/login`);
  await hydrated(page, 'Sign in');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`/${area}$`));
}

/** A deliverable on another client's project (not client B's), uploaded by an admin for this run. */
async function clientAFile(request: APIRequestContext, page: Page): Promise<string> {
  const csrf = (await page.locator('meta[name="csrf-token"]').getAttribute('content')) ?? '';
  const res = await request.post('/api/v1/admin/projects/prj_e2e_time/files', {
    headers: { 'x-csrf-token': csrf, origin: new URL(page.url()).origin },
    multipart: {
      label: `Security check ${Date.now()}`,
      kind: 'deliverable',
      clientVisible: 'true',
      file: { name: 'private.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') },
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const body = (await res.json()) as { data: { fileId?: string; id?: string; file?: { id: string } } };
  const id = body.data.fileId ?? body.data.file?.id ?? body.data.id;
  expect(id).toBeTruthy();
  return id!;
}

test("client B can't open client A's documents, project, payments or files (404)", async ({ page, browser }) => {
  // An admin shares a file with client A, so there is something real to try to reach.
  await signIn(page, 'admin', E2E_USERS.securityAdmin.email);
  await page.goto('/admin/projects/prj_e2e_time');
  const fileId = await clientAFile(page.request, page);
  const adminFile = await page.request.get(`/api/v1/admin/files/${fileId}`, { maxRedirects: 0 });
  expect([200, 302, 303]).toContain(adminFile.status());

  const b = await (await browser.newContext({ baseURL: new URL(page.url()).origin })).newPage();
  await signIn(b, 'portal', E2E_SECURITY_USER.email);
  for (const path of [
    '/portal/invoices/inv_e2e_portal_1',
    '/portal/invoices/inv_e2e_portal_1/pay',
    '/portal/quotations/quo_e2e_portal_1',
    '/portal/projects/prj_e2e_portal',
    '/portal/payments/attempts/pat_e2e_portal_failed',
  ]) {
    const res = await b.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(b.getByText(E2E_PORTAL_USER.clientName)).toHaveCount(0);
  }
  for (const path of [
    '/api/v1/portal/invoices/inv_e2e_portal_1',
    '/api/v1/portal/invoices/inv_e2e_portal_1/pdf',
    '/api/v1/portal/invoices/inv_e2e_portal_1/payment-options',
    '/api/v1/portal/quotations/quo_e2e_portal_1',
    '/api/v1/portal/quotations/quo_e2e_portal_1/pdf',
    '/api/v1/portal/projects/prj_e2e_portal',
    '/api/v1/portal/payments/pay_e2e_portal_1/receipt',
    '/api/v1/portal/payment-attempts/pat_e2e_portal_failed',
    `/api/v1/portal/files/${fileId}`,
  ]) {
    const res = await b.request.get(path);
    expect(res.status(), path).toBe(404);
    expect(await res.text(), path).not.toContain(E2E_PORTAL_USER.clientName);
  }
  // Lists only show client B's own records.
  const list = await (await b.request.get('/api/v1/portal/invoices')).text();
  expect(list).not.toContain('inv_e2e_portal_1');
  // A portal session is not an admin session.
  expect((await b.request.get('/api/v1/admin/invoices')).status()).toBe(401);
  expect((await b.request.get(`/api/v1/admin/files/${fileId}`)).status()).toBe(401);
  const adminPage = await b.goto('/admin/invoices');
  expect(adminPage?.url()).toMatch(/\/admin\/login/);
  await b.context().close();
});

test("a Content Manager can't reach invoices, payments or clients", async ({ page }) => {
  await signIn(page, 'admin', E2E_USERS.contentAdmin.email);
  const nav = page.getByRole('navigation', { name: 'Admin navigation' }).first();
  await expect(nav.getByRole('link', { name: 'Pages' })).toBeVisible();
  for (const name of ['Invoices', 'Payments', 'Clients', 'Quotations'])
    await expect(nav.getByRole('link', { name })).toHaveCount(0);
  for (const path of ['/admin/invoices', '/admin/payments', '/admin/clients', '/admin/invoices/inv_e2e_portal_1']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(403);
    await expect(page.getByRole('heading', { name: "You don't have access to this page" })).toBeVisible();
  }
  for (const path of ['/api/v1/admin/invoices', '/api/v1/admin/payments', '/api/v1/admin/clients'])
    expect((await page.request.get(path)).status(), path).toBe(403);
});

test('signed-out visitors are sent to sign in; private areas are never indexed', async ({ page, request }) => {
  for (const [path, login] of [
    ['/admin/invoices', '/admin/login'],
    ['/admin', '/admin/login'],
    ['/portal/invoices', '/portal/login'],
    ['/portal/projects/prj_e2e_portal', '/portal/login'],
  ] as const) {
    await page.goto(path);
    expect(new URL(page.url()).pathname, path).toBe(login);
    expect(new URL(page.url()).searchParams.get('next'), path).toBe(path);
  }
  for (const path of ['/api/v1/admin/invoices', '/api/v1/portal/invoices', '/api/v1/portal/overview'])
    expect((await request.get(path)).status(), path).toBe(401);

  for (const path of ['/admin/login', '/portal/login', '/admin/invoices', '/api/v1/admin/invoices']) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.headers()['x-robots-tag'], path).toContain('noindex');
  }
  await page.goto('/admin/login');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  // Outside production the whole site is closed to crawlers (production lists the private paths; see the sitemap unit test).
  expect(await (await request.get('/robots.txt')).text()).toMatch(/^Disallow: \/$/m);
});
