/**
 * P7.3 responsive + accessibility sweep over every page (docs/08 §5, PRD §10): for each route, as the right visitor, the page
 * loads, axe has no serious/critical WCAG 2.1 AA violations, nothing scrolls sideways at 375/768/1440 px, and the first Tab
 * lands on "Skip to content" where the layout has one. Detail pages use global-setup fixtures or the first record a list
 * page links to; a detail route with no record yet is reported, not failed. Feature specs cover the interactive states.
 * Not here: Super Admin pages (gateways, data export: their specs sign in with 2FA) and /careers/apply (404 while general
 * applications are switched off, the default; the careers spec covers the application form).
 */
import AxeBuilder from '@axe-core/playwright';
import { createHmac } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { WIDTHS, ownIp } from './helpers';
import { E2E_PASSWORD, E2E_PORTAL_SUPPORT_USER, E2E_USERS } from './users';

test.use(ownIp('sweep'));

test.describe.configure({ timeout: 600_000 });
test.use({ actionTimeout: 15_000 });

const DEV_HMAC_SECRET = 'dev-only-hmac-secret-not-for-production-use-0001';
const docToken = (kind: string, id: string) =>
  createHmac('sha256', DEV_HMAC_SECRET).update(`${kind}:${id}`).digest('base64url');

/** A detail route: either a fixed path, or the first link on `list` whose path matches `pattern`. */
type Target = string | { list: string; pattern: RegExp; suffix?: string };

async function resolve(page: Page, t: Target): Promise<string | null> {
  if (typeof t === 'string') return t;
  await page.goto(t.list);
  const hrefs = await page.locator('a[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  const hit = hrefs.find((h) => t.pattern.test(h.split('?')[0]!));
  return hit ? `${hit.split('?')[0]}${t.suffix ?? ''}` : null;
}

async function check(page: Page, path: string, problems: string[]) {
  const res = await page.goto(path);
  const status = res?.status() ?? 0;
  if (status >= 400) {
    problems.push(`${path}: HTTP ${status}`);
    return;
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  for (const v of axe.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical'))
    problems.push(
      `${path}: axe ${v.id} → ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(', ')}`,
    );
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(80);
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (scroll > 0) problems.push(`${path}: scrolls sideways by ${scroll}px at ${width}px`);
  }
  if ((await page.getByRole('link', { name: 'Skip to content' }).count()) > 0) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.locator('body').focus();
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    if (focused !== 'Skip to content')
      problems.push(`${path}: first Tab focuses "${focused.slice(0, 40)}", not the skip link`);
  }
}

async function sweep(page: Page, targets: Target[]) {
  const problems: string[] = [];
  const missing: string[] = [];
  for (const t of targets) {
    const path = await resolve(page, t);
    if (!path) {
      missing.push(typeof t === 'string' ? t : t.pattern.source);
      continue;
    }
    await check(page, path, problems);
  }
  if (missing.length) console.info(`[sweep] no record to open for: ${missing.join(' | ')}`);
  expect(problems).toEqual([]);
}

async function signIn(page: Page, area: 'admin' | 'portal', email: string) {
  await page.goto(`/${area}/login`);
  await expect(page.locator('astro-island').filter({ hasText: 'Sign in' }).first()).not.toHaveAttribute('ssr');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`/${area}$`));
}

test('public pages', async ({ page }) => {
  await sweep(page, [
    '/',
    '/about',
    '/how-we-work',
    '/services/',
    { list: '/services/', pattern: /^\/services\/[a-z0-9-]+$/ },
    '/pricing',
    '/products',
    '/industries/',
    { list: '/industries/', pattern: /^\/industries\/[a-z0-9-]+$/ },
    '/work/',
    { list: '/work/', pattern: /^\/work\/[a-z0-9-]+$/ },
    '/insights/',
    { list: '/insights/', pattern: /^\/insights\/(?!category|tag)[a-z0-9-]+$/ },
    { list: '/insights/', pattern: /^\/insights\/category\/[a-z0-9-]+$/ },
    { list: '/insights/', pattern: /^\/insights\/tag\/[a-z0-9-]+$/ },
    '/careers/',
    { list: '/careers/', pattern: /^\/careers\/(?!apply)[a-z0-9-]+$/ },
    '/faq',
    '/contact',
    '/consultation',
    '/search?q=website',
    '/legal/privacy',
    '/legal/terms',
    `/i/${docToken('invoice', 'inv_e2e_portal_2')}`,
    '/newsletter/unsubscribe',
    '/admin/login',
    '/admin/forgot-password',
    '/admin/reset-password',
    '/admin/accept-invite',
    '/portal/login',
    '/portal/forgot-password',
    '/portal/reset-password',
    '/portal/accept-invite',
  ]);
  // The 404 page itself.
  const problems: string[] = [];
  const res = await page.goto('/no-such-page-for-the-sweep');
  expect(res?.status()).toBe(404);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  for (const v of axe.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical'))
    problems.push(`404: ${v.id}`);
  expect(problems).toEqual([]);
});

test('admin pages', async ({ page }) => {
  await signIn(page, 'admin', E2E_USERS.sweepAdmin.email);
  const detail = (list: string, re: string, suffix?: string) => ({
    list,
    pattern: new RegExp(`^${re}$`),
    ...(suffix ? { suffix } : {}),
  });
  await sweep(page, [
    '/admin/',
    '/admin/notifications',
    '/admin/account/notifications',
    '/admin/account/security',
    '/admin/account/sessions',
    '/admin/enquiries/',
    detail('/admin/enquiries/', '/admin/enquiries/enq_[A-Za-z0-9_]+'),
    '/admin/leads/',
    '/admin/leads/?view=board',
    '/admin/leads/new',
    detail('/admin/leads/', '/admin/leads/led_[A-Za-z0-9_]+'),
    detail('/admin/leads/', '/admin/leads/led_[A-Za-z0-9_]+', '/edit'),
    '/admin/clients/',
    '/admin/clients/new',
    '/admin/clients/portal-signups',
    '/admin/clients/cli_e2e_portal',
    '/admin/clients/cli_e2e_portal/edit',
    '/admin/quotations/',
    '/admin/quotations/new',
    '/admin/quotations/quo_e2e_portal_1',
    '/admin/invoices/',
    '/admin/invoices/new',
    '/admin/invoices/inv_e2e_portal_1',
    '/admin/invoices/inv_e2e_recon',
    '/admin/payments/',
    '/admin/payments/pay_e2e_portal_1',
    '/admin/subscriptions/',
    '/admin/subscriptions/new',
    detail('/admin/subscriptions/', '/admin/subscriptions/sub_[A-Za-z0-9_]+'),
    detail('/admin/subscriptions/', '/admin/subscriptions/sub_[A-Za-z0-9_]+', '/edit'),
    '/admin/assets/',
    '/admin/assets/new',
    detail('/admin/assets/', '/admin/assets/ast_[A-Za-z0-9_]+'),
    '/admin/expenses/',
    '/admin/expenses/new',
    '/admin/expenses/categories',
    '/admin/expenses/report',
    detail('/admin/expenses/', '/admin/expenses/exp_[A-Za-z0-9_]+'),
    '/admin/reports/',
    '/admin/projects/',
    '/admin/projects/new',
    '/admin/projects/prj_e2e_portal',
    '/admin/projects/prj_e2e_portal/edit',
    '/admin/time/',
    detail('/admin/time/', '/admin/time/bill/[A-Za-z0-9_]+'),
    '/admin/support/',
    '/admin/support/new',
    detail('/admin/support/', '/admin/support/sup_[A-Za-z0-9_]+'),
    '/admin/cms/',
    detail('/admin/cms/', '/admin/cms/pages/[a-z0-9_.-]+'),
    '/admin/cms/announcements',
    '/admin/cms/products',
    '/admin/cms/portfolio/',
    detail('/admin/cms/portfolio/', '/admin/cms/portfolio/[A-Za-z0-9_]+'),
    '/admin/services/',
    '/admin/services/new',
    '/admin/services/divisions/new',
    detail('/admin/services/', '/admin/services/svc_[A-Za-z0-9_]+'),
    detail('/admin/services/', '/admin/services/divisions/[A-Za-z0-9_]+'),
    '/admin/packages/',
    '/admin/packages/new',
    detail('/admin/packages/', '/admin/packages/pkg_[A-Za-z0-9_]+'),
    '/admin/content/',
    '/admin/content/faq',
    '/admin/content/technologies',
    '/admin/content/testimonials',
    '/admin/content/newsletter',
    '/admin/content/industries/',
    detail('/admin/content/industries/', '/admin/content/industries/[A-Za-z0-9_]+'),
    '/admin/content/insights/',
    detail('/admin/content/insights/', '/admin/content/insights/[A-Za-z0-9_]+'),
    '/admin/media/',
    '/admin/careers/',
    '/admin/careers/new',
    '/admin/careers/applicants',
    '/admin/careers/templates',
    detail('/admin/careers/', '/admin/careers/job_[A-Za-z0-9_]+'),
    detail('/admin/careers/applicants', '/admin/careers/applications/app_[A-Za-z0-9_]+'),
    '/admin/users/',
    '/admin/users/roles',
    '/admin/users/usr_e2e_admin',
    '/admin/settings/',
    '/admin/settings/billing',
    '/admin/settings/numbering',
    '/admin/settings/website',
    '/admin/settings/integrations',
    '/admin/audit/',
  ]);
});

test('client portal pages', async ({ page }) => {
  await signIn(page, 'portal', E2E_PORTAL_SUPPORT_USER.email);
  await sweep(page, [
    '/portal/',
    '/portal/quotations/',
    '/portal/quotations/quo_e2e_portal_1',
    '/portal/invoices/',
    '/portal/invoices/inv_e2e_portal_1',
    '/portal/invoices/inv_e2e_portal_1/pay',
    '/portal/payments/',
    '/portal/payments/attempts/pat_e2e_portal_failed',
    '/portal/projects/',
    '/portal/projects/prj_e2e_portal',
    '/portal/services',
    '/portal/support/',
    '/portal/support/new',
    { list: '/portal/support/', pattern: /^\/portal\/support\/sup_[A-Za-z0-9_]+$/ },
    '/portal/account/',
    '/portal/account/sessions',
  ]);
});
