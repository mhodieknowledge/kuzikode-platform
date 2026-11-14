/**
 * R8.1 full QA sweep (standalone; NOT part of the e2e suite). Every public / portal / admin route of tests/e2e/sweep.spec.ts at
 * the 10 BRIEF B.2 viewports, with prefers-reduced-motion emulated. Measures per route+viewport:
 *   overflow, type limits (phones: H1<=38, H2<=30, body>=16, tiny text<12, button label wraps, H1<=4 / H2<=3 lines),
 *   tap targets <44x44 on touch viewports (<=1024 px), broken images, console/page errors, infinite animations.
 * Prereq: the e2e fixtures exist in the LOCAL D1 (run any e2e spec once, e.g. `npx playwright test tests/e2e/legal.spec.ts`).
 * Usage:  node scripts/qa-sweep.mjs [--only public|portal|admin] [--out path.json] [--port 8787]
 * Starts `wrangler dev` itself when nothing answers on the port (build output must already exist: `npm run build`).
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const PORT = Number(arg('port', process.env.PORT ?? 8787));
const BASE = `http://localhost:${PORT}`;
const ONLY = arg('only', '');
const OUT = arg('out', 'qa-sweep-results.json');
const PASSWORD = 'E2e-only-password-2026!';
const SWEEP_ADMIN = 'e2e-sweep@example.com';
const PORTAL_USER = 'e2e-portal-support@example.com';
const HMAC = 'dev-only-hmac-secret-not-for-production-use-0001';
const docToken = (kind, id) => createHmac('sha256', HMAC).update(`${kind}:${id}`).digest('base64url');

const VIEWPORTS = [
  [360, 740], [375, 667], [390, 844], [412, 915], [430, 932],
  [768, 1024], [1024, 1366], [1280, 800], [1440, 900], [1920, 1080],
];
const isPhone = (w) => w >= 360 && w <= 430;
const isTouch = (w) => w <= 1024;

const list = (l, re, suffix) => ({ list: l, pattern: new RegExp(`^${re}$`), suffix });
const PUBLIC = [
  '/', '/about', '/how-we-work', '/services/',
  { list: '/services/', pattern: /^\/services\/[a-z0-9-]+$/ },
  '/pricing', '/industries/',
  { list: '/industries/', pattern: /^\/industries\/[a-z0-9-]+$/ },
  '/work/', { list: '/work/', pattern: /^\/work\/[a-z0-9-]+$/ },
  '/insights/',
  { list: '/insights/', pattern: /^\/insights\/(?!category|tag)[a-z0-9-]+$/ },
  { list: '/insights/', pattern: /^\/insights\/category\/[a-z0-9-]+$/ },
  { list: '/insights/', pattern: /^\/insights\/tag\/[a-z0-9-]+$/ },
  '/careers/', { list: '/careers/', pattern: /^\/careers\/(?!apply)[a-z0-9-]+$/ },
  '/faq', '/contact', '/consultation', '/search?q=website', '/legal/privacy', '/legal/terms',
  `/i/${docToken('invoice', 'inv_e2e_portal_2')}`, '/newsletter/unsubscribe',
  '/admin/login', '/admin/forgot-password', '/admin/reset-password', '/admin/accept-invite',
  '/portal/login', '/portal/forgot-password', '/portal/reset-password', '/portal/accept-invite',
  '/no-such-page-for-the-sweep',
];
const ADMIN = [
  '/admin/', '/admin/notifications', '/admin/account/notifications', '/admin/account/security', '/admin/account/sessions',
  '/admin/enquiries/', list('/admin/enquiries/', '/admin/enquiries/enq_[A-Za-z0-9_]+'),
  '/admin/leads/', '/admin/leads/?view=board', '/admin/leads/new',
  list('/admin/leads/', '/admin/leads/led_[A-Za-z0-9_]+'), list('/admin/leads/', '/admin/leads/led_[A-Za-z0-9_]+', '/edit'),
  '/admin/clients/', '/admin/clients/new', '/admin/clients/portal-signups', '/admin/clients/cli_e2e_portal',
  '/admin/clients/cli_e2e_portal/edit',
  '/admin/quotations/', '/admin/quotations/new', '/admin/quotations/quo_e2e_portal_1',
  '/admin/invoices/', '/admin/invoices/new', '/admin/invoices/inv_e2e_portal_1', '/admin/invoices/inv_e2e_recon',
  '/admin/payments/', '/admin/payments/pay_e2e_portal_1',
  '/admin/subscriptions/', '/admin/subscriptions/new',
  list('/admin/subscriptions/', '/admin/subscriptions/sub_[A-Za-z0-9_]+'),
  list('/admin/subscriptions/', '/admin/subscriptions/sub_[A-Za-z0-9_]+', '/edit'),
  '/admin/assets/', '/admin/assets/new', list('/admin/assets/', '/admin/assets/ast_[A-Za-z0-9_]+'),
  '/admin/expenses/', '/admin/expenses/new', '/admin/expenses/categories', '/admin/expenses/report',
  list('/admin/expenses/', '/admin/expenses/exp_[A-Za-z0-9_]+'),
  '/admin/reports/', '/admin/projects/', '/admin/projects/new', '/admin/projects/prj_e2e_portal',
  '/admin/projects/prj_e2e_portal/edit', '/admin/time/', list('/admin/time/', '/admin/time/bill/[A-Za-z0-9_]+'),
  '/admin/support/', '/admin/support/new', list('/admin/support/', '/admin/support/sup_[A-Za-z0-9_]+'),
  '/admin/cms/', list('/admin/cms/', '/admin/cms/pages/[a-z0-9_.-]+'), '/admin/cms/announcements', '/admin/cms/products',
  '/admin/cms/portfolio/', list('/admin/cms/portfolio/', '/admin/cms/portfolio/[A-Za-z0-9_]+'),
  '/admin/services/', '/admin/services/new', '/admin/services/divisions/new',
  list('/admin/services/', '/admin/services/svc_[A-Za-z0-9_]+'),
  list('/admin/services/', '/admin/services/divisions/[A-Za-z0-9_]+'),
  '/admin/packages/', '/admin/packages/new', list('/admin/packages/', '/admin/packages/pkg_[A-Za-z0-9_]+'),
  '/admin/content/', '/admin/content/faq', '/admin/content/technologies', '/admin/content/testimonials',
  '/admin/content/newsletter', '/admin/content/industries/',
  list('/admin/content/industries/', '/admin/content/industries/[A-Za-z0-9_]+'),
  '/admin/content/insights/', list('/admin/content/insights/', '/admin/content/insights/[A-Za-z0-9_]+'),
  '/admin/media/', '/admin/careers/', '/admin/careers/new', '/admin/careers/applicants', '/admin/careers/templates',
  list('/admin/careers/', '/admin/careers/job_[A-Za-z0-9_]+'),
  list('/admin/careers/applicants', '/admin/careers/applications/app_[A-Za-z0-9_]+'),
  '/admin/users/', '/admin/users/roles', '/admin/users/usr_e2e_admin',
  '/admin/settings/', '/admin/settings/billing', '/admin/settings/numbering', '/admin/settings/website',
  '/admin/settings/integrations', '/admin/audit/',
];
const PORTAL = [
  '/portal/', '/portal/quotations/', '/portal/quotations/quo_e2e_portal_1', '/portal/invoices/',
  '/portal/invoices/inv_e2e_portal_1', '/portal/invoices/inv_e2e_portal_1/pay', '/portal/payments/',
  '/portal/payments/attempts/pat_e2e_portal_failed', '/portal/projects/', '/portal/projects/prj_e2e_portal',
  '/portal/services', '/portal/support/', '/portal/support/new',
  { list: '/portal/support/', pattern: /^\/portal\/support\/sup_[A-Za-z0-9_]+$/ },
  '/portal/account/', '/portal/account/sessions',
];

/** Runs inside the page. Returns raw findings for one viewport. */
function measure({ phone, touch }) {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return null;
    if (r.bottom < 0 || r.right < 0 || r.left > innerWidth + 2000) return null;
    return { r, s };
  };
  const sel = (el) => {
    const parts = [];
    for (let e = el; e && e.nodeType === 1 && parts.length < 3; e = e.parentElement) {
      let p = e.tagName.toLowerCase();
      const cls = [...e.classList].slice(0, 2).join('.');
      if (e.id) p += `#${e.id}`;
      else if (cls) p += `.${cls}`;
      parts.unshift(p);
      if (e.id) break;
    }
    return parts.join(' > ');
  };
  const txt = (el) => (el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 30);
  const out = { overflow: null, type: [], tap: [], images: [], anims: [] };
  const sw = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  if (sw > 0) {
    const culprits = [...document.querySelectorAll('body *')]
      .filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && vis(e))
      .slice(0, 3)
      .map(sel);
    out.overflow = { px: sw, culprits };
  }
  const lines = (el, s) => Math.round(el.getBoundingClientRect().height / (parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2));
  if (phone) {
    for (const el of document.querySelectorAll('h1, h2')) {
      const v = vis(el);
      if (!v) continue;
      const fs = parseFloat(v.s.fontSize);
      const n = lines(el, v.s);
      const max = el.tagName === 'H1' ? 38 : 30;
      const maxLines = el.tagName === 'H1' ? 4 : 3;
      if (fs > max) out.type.push({ kind: `${el.tagName.toLowerCase()}>${max}px`, sel: sel(el), val: `${fs}px`, text: txt(el) });
      if (n > maxLines) out.type.push({ kind: `${el.tagName.toLowerCase()} lines>${maxLines}`, sel: sel(el), val: `${n} lines`, text: txt(el) });
    }
    for (const el of document.querySelectorAll('p, li')) {
      const v = vis(el);
      if (!v) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      if (own.length < 60) continue;
      const fs = parseFloat(v.s.fontSize);
      if (fs < 12) out.type.push({ kind: 'text<12px', sel: sel(el), val: `${fs}px`, text: txt(el) });
      else if (fs < 16) out.type.push({ kind: 'body<16px', sel: sel(el), val: `${fs}px`, text: txt(el) });
    }
    for (const el of document.querySelectorAll('button, a[class*="btn"], a[class*="button"], [role="button"]')) {
      const v = vis(el);
      if (!v) continue;
      if (el.textContent.trim().length < 3) continue;
      const tops = new Set();
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        if (!n.textContent.trim()) continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        for (const q of rg.getClientRects()) if (q.width > 0) tops.add(Math.round(q.top / 6));
      }
      if (tops.size > 1) out.type.push({ kind: 'button label wraps', sel: sel(el), val: `${tops.size} lines`, text: txt(el) });
    }
  }
  if (touch) {
    const seen = new Set();
    for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch]')) {
      const v = vis(el);
      if (!v || el.disabled) continue;
      if (v.s.display === 'inline' && el.tagName === 'A') continue; // inline text link: WCAG 2.5.8 inline exception
      if (el.classList.contains('skip-link') || (v.r.width <= 2 && v.r.height <= 2)) continue; // visually hidden until focused
      if (el.type === 'checkbox' || el.type === 'radio') {
        const lab = el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`));
        if (lab) { const lr = lab.getBoundingClientRect(); if (lr.width >= 44 && lr.height >= 44) continue; }
      }
      if (v.r.width < 44 || v.r.height < 44) {
        const key = sel(el);
        if (seen.has(key)) continue;
        seen.add(key);
        out.tap.push({ sel: key, size: `${Math.round(v.r.width)}x${Math.round(v.r.height)}`, text: txt(el) });
      }
    }
  }
  for (const img of document.images) {
    const r = img.getBoundingClientRect();
    const src = img.currentSrc || img.src;
    if (!src) continue;
    if (img.complete && img.naturalWidth === 0) out.images.push({ sel: sel(img), why: 'naturalWidth 0', src: src.slice(0, 80) });
    else if ((r.width === 0 || r.height === 0) && img.offsetParent !== null && getComputedStyle(img).display !== 'none')
      out.images.push({ sel: sel(img), why: 'zero-size', src: src.slice(0, 80) });
  }
  for (const a of document.getAnimations()) {
    if (a.playState !== 'running') continue;
    if (a.effect?.getComputedTiming().iterations !== Infinity) continue;
    const t = a.effect.target;
    out.anims.push({ sel: t ? sel(t) : '?', name: a.animationName || a.constructor.name });
  }
  return out;
}

async function healthy() {
  try { return (await fetch(`${BASE}/api/health`)).ok; } catch { return false; }
}

let server = null;
async function ensureServer() {
  if (await healthy()) return;
  if (!existsSync('dist/server')) throw new Error('No dist/: run `npm run build` first');
  server = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--var', `PUBLIC_SITE_URL:${BASE}`], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 120 && !(await healthy()); i++) await new Promise((r) => setTimeout(r, 2000));
  if (!(await healthy())) throw new Error('server did not start');
}

async function signIn(page, area, email) {
  await page.goto(`${BASE}/${area}/login`);
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'), null, { timeout: 15000 }).catch(() => {});
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(new RegExp(`/${area}$`), { timeout: 20000 });
}

async function resolveTarget(page, t) {
  if (typeof t === 'string') return t;
  await page.goto(BASE + t.list, { waitUntil: 'domcontentloaded' });
  const hrefs = await page.locator('a[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
  const hit = hrefs.find((h) => t.pattern.test(h.split('?')[0]));
  return hit ? `${hit.split('?')[0]}${t.suffix ?? ''}` : null;
}

const results = [];
const skipped = [];

async function sweepArea(browser, area, targets, login) {
  const ctx = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { 'cf-connecting-ip': `10.77.${area.length}.${Math.floor(Math.random() * 200) + 1}` },
  });
  const page = await ctx.newPage();
  let errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e.message).slice(0, 160)}`));
  if (login) await signIn(page, login.area, login.email);
  for (const t of targets) {
    const path = await resolveTarget(page, t);
    if (!path) { skipped.push(typeof t === 'string' ? t : t.pattern.source); continue; }
    errors = [];
    const rec = { area, path, status: 0, viewports: {}, errors: [] };
    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      const res = await page.goto(BASE + path, { waitUntil: 'load', timeout: 30000 });
      rec.status = res?.status() ?? 0;
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      // trigger lazy images
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
        scrollTo(0, 0);
      });
      await page.waitForTimeout(200);
      for (const [w, h] of VIEWPORTS) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(120);
        rec.viewports[w] = await page.evaluate(measure, { phone: isPhone(w), touch: isTouch(w) });
      }
    } catch (e) {
      rec.errors.push(`script: ${String(e.message).slice(0, 120)}`);
    }
    rec.errors.push(...new Set(errors));
    results.push(rec);
    process.stdout.write('.');
  }
  await ctx.close();
}

const main = async () => {
  await ensureServer();
  const exe = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(existsSync(exe) && !process.env.CI ? { executablePath: exe } : {});
  if (!ONLY || ONLY === 'public') await sweepArea(browser, 'public', PUBLIC, null);
  if (!ONLY || ONLY === 'portal') await sweepArea(browser, 'portal', PORTAL, { area: 'portal', email: PORTAL_USER });
  if (!ONLY || ONLY === 'admin') await sweepArea(browser, 'admin', ADMIN, { area: 'admin', email: SWEEP_ADMIN });
  await browser.close();
  writeFileSync(OUT, JSON.stringify({ viewports: VIEWPORTS, skipped, results }, null, 1));
  console.log(`\nwrote ${OUT}: ${results.length} routes, ${skipped.length} skipped (no record)`);
  if (server) try { process.kill(-server.pid); } catch {}
  process.exit(0);
};
main().catch((e) => { console.error(e); if (server) try { process.kill(-server.pid); } catch {} process.exit(1); });
