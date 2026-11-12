import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { E2E_PASSWORD, E2E_PORTAL_USER, E2E_USERS } from '../e2e/users';

/** See playwright.visual.config.ts. One test per page; each shoots every viewport in the chosen set. */
const VIEWPORTS = {
  all: [
    [360, 740],
    [375, 667],
    [390, 844],
    [412, 915],
    [430, 932],
    [768, 1024],
    [1024, 1366],
    [1280, 800],
    [1440, 900],
    [1920, 1080],
  ],
  core: [
    [375, 667],
    [390, 844],
    [430, 932],
    [768, 1024],
    [1440, 900],
  ],
  quick: [
    [390, 844],
    [1440, 900],
  ],
} as const;
const set = (process.env.SHOOT_SET ?? 'core') as keyof typeof VIEWPORTS;
const pages = (process.env.SHOOT ?? '/')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);
const label = process.env.SHOOT_LABEL ?? 'current';
const fullPage = process.env.SHOOT_FULL !== '0';
const reduced = process.env.SHOOT_REDUCED === '1';
const out = `.shots/${label}`;
mkdirSync(`${out}`, { recursive: true });
mkdirSync('.shots/auth', { recursive: true });

const ip = { 'cf-connecting-ip': '10.250.250.7' };

async function authed(browser: Browser, kind: 'admin' | 'portal'): Promise<BrowserContext> {
  const file = `.shots/auth/${kind}.json`;
  if (existsSync(file)) {
    const ctx = await browser.newContext({ storageState: file, extraHTTPHeaders: ip });
    const p = await ctx.newPage();
    const res = await p.goto(kind === 'admin' ? '/admin' : '/portal');
    const ok = res?.ok() && !p.url().includes('/login');
    await p.close();
    if (ok) return ctx;
    await ctx.close();
  }
  const ctx = await browser.newContext({ extraHTTPHeaders: ip });
  const p = await ctx.newPage();
  await p.goto(`/${kind}/login`);
  await expect(p.locator('astro-island:has(form)').first()).not.toHaveAttribute('ssr');
  await p.getByLabel('Email').fill(kind === 'admin' ? E2E_USERS.admin.email : E2E_PORTAL_USER.email);
  await p.getByLabel('Password').fill(E2E_PASSWORD);
  await p.getByRole('button', { name: 'Sign in' }).click();
  await p.waitForURL((u) => !u.pathname.includes('/login'));
  await ctx.storageState({ path: file });
  await p.close();
  return ctx;
}

const slug = (path: string) => (path === '/' ? 'home' : path.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '_'));

for (const path of pages) {
  test(`shoot ${path}`, async ({ browser }) => {
    const kind =
      path.startsWith('/admin') && !/\/admin\/(login|forgot|reset)/.test(path)
        ? 'admin'
        : path.startsWith('/portal') && !/\/portal\/(login|register|forgot|reset)/.test(path)
          ? 'portal'
          : null;
    const ctx = kind ? await authed(browser, kind) : await browser.newContext({ extraHTTPHeaders: ip });
    const page = await ctx.newPage();
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
    const report: string[] = [];
    for (const [w, h] of VIEWPORTS[set]) {
      await page.setViewportSize({ width: w, height: h });
      const res = await page.goto(path, { waitUntil: 'networkidle' });
      // Let reveal animations settle, then force any not-yet-revealed elements visible for full-page captures.
      await page.evaluate(async () => {
        document.documentElement.dataset.shoot = '1';
        for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.8) {
          scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        scrollTo(0, 0);
      });
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const sw = document.documentElement.scrollWidth;
        const offenders: string[] = [];
        if (sw > innerWidth) {
          for (const el of Array.from(document.querySelectorAll('body *'))) {
            const r = el.getBoundingClientRect();
            if (r.right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed') {
              offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
              if (offenders.length > 4) break;
            }
          }
        }
        const small: string[] = [];
        for (const el of Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[role=tab]'))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
          if (!inline && (r.height < 44 || r.width < 24)) {
            small.push(
              `${el.tagName.toLowerCase()}:${(el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 24)}(${Math.round(r.width)}x${Math.round(r.height)})`,
            );
          }
        }
        return { overflow: sw > innerWidth, sw, offenders, small: small.slice(0, 12), smallCount: small.length };
      });
      report.push(
        `${w}x${h} status=${res?.status()} overflow=${m.overflow ? `YES(${m.sw}) ${m.offenders.join(' | ')}` : 'no'} smallTargets=${m.smallCount}${m.smallCount ? ` e.g. ${m.small.join(', ')}` : ''}`,
      );
      await page.screenshot({ path: `${out}/${slug(path)}-${w}.png`, fullPage });
    }
    writeFileSync(`${out}/${slug(path)}.txt`, `${path}\n${report.join('\n')}\n`);
    console.log(`${path}\n  ${report.join('\n  ')}`);
    await ctx.close();
  });
}
