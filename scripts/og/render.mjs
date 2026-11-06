#!/usr/bin/env node
/**
 * Dev-only: renders 1200×630 Open Graph cards with the brand fonts via Playwright and writes PNGs to public/brand/og/.
 *   node scripts/og/render.mjs
 * Cards: default, about, contact, work, services, one per division (slug from the seed content), pricing, insights, careers.
 */
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { DIVISIONS } from '../seeds/content/services.ts';

const font = (p) => `data:font/woff2;base64,${readFileSync(p).toString('base64')}`;
const manrope = font('node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2');
const inter = font('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2');
const logo = readFileSync('public/brand/logo-white.svg', 'utf8');
// Owner-supplied abstract background (docs/13 §4 "bg-og"), processed by img:process.
const bg = `data:image/jpeg;base64,${readFileSync('public/images/site/bg-og-1600.jpg').toString('base64')}`;

const cards = [
  { file: 'default', eyebrow: 'Kuzikode Technologies', title: 'Building intelligent digital solutions.' },
  { file: 'about', eyebrow: 'About', title: 'A technology partner for organisations in Zimbabwe and Africa.' },
  { file: 'contact', eyebrow: 'Contact', title: 'Tell us what you need.' },
  { file: 'work', eyebrow: 'Our work', title: 'Projects we design, build and support.' },
  { file: 'services', eyebrow: 'Services', title: 'Websites, apps, business software, data, integration and cloud.' },
  { file: 'pricing', eyebrow: 'Pricing', title: 'Clear packages. Scope confirmed in writing.' },
  { file: 'insights', eyebrow: 'Insights', title: 'Practical notes on technology for growing organisations.' },
  { file: 'careers', eyebrow: 'Careers', title: 'Work with Kuzikode.' },
  ...DIVISIONS.map((d) => ({ file: `services-${d.slug}`, eyebrow: 'Services', title: d.name })),
];

const html = (c) => `<!doctype html><html><head><style>
@font-face{font-family:Manrope;src:url(${manrope}) format('woff2');font-weight:200 800}
@font-face{font-family:Inter;src:url(${inter}) format('woff2');font-weight:100 900}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0A0F1C url(${bg}) center/cover no-repeat;color:#fff;font-family:Inter;position:relative;overflow:hidden}
.shade{position:absolute;inset:0;background:linear-gradient(100deg,rgba(10,15,28,.7),rgba(10,15,28,.15) 75%)}
.wrap{position:absolute;inset:72px 80px;display:flex;flex-direction:column;justify-content:space-between}
.logo svg{height:44px;width:auto}
.eyebrow{font-size:24px;font-weight:600;color:#5B78FF;letter-spacing:.02em}
h1{font-family:Manrope;font-weight:800;font-size:${c.title.length > 48 ? 58 : 68}px;line-height:1.08;letter-spacing:-.02em;max-width:980px;margin-top:18px}
.bar{height:6px;width:96px;background:#E8A33D;border-radius:3px}
</style></head><body><div class="shade"></div><div class="wrap">
<div class="logo">${logo}</div>
<div><div class="eyebrow">${c.eyebrow}</div><h1>${c.title.replace(/&/g, '&amp;')}</h1></div>
<div class="bar"></div></div></body></html>`;

const exe = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(exe) && !process.env.CI ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const c of cards) {
  await page.setContent(html(c), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `public/brand/og/${c.file}.png`, type: 'png' });
  console.log(`og: ${c.file}.png`);
}
await browser.close();
