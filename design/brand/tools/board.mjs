#!/usr/bin/env node
/**
 * Dev-only: renders the logo exploration board (R9.3) to design/brand/logo-explorations/board-2026-11-13.png.
 *   node design/brand/tools/board.mjs
 * Each mark at 24/40/96 px on bone and on night, a one-colour version, and in a 390 px and a 1440 px header.
 */
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const dir = 'design/brand/logo-explorations';
const font = (w) =>
  `data:font/woff2;base64,${readFileSync(`node_modules/@fontsource/poppins/files/poppins-latin-${w}-normal.woff2`).toString('base64')}`;
const marks = [
  { id: 'A', name: 'Brace K: a code brace as the stem, chevron arms', file: 'mark-a-brace-k.svg' },
  { id: 'B', name: 'Tile K: brace-nub stem and gold chevron on an emerald tile', file: 'mark-b-tile-k.svg' },
  { id: 'C', name: 'Grid K: stepped on a 6-unit code grid', file: 'mark-c-grid-k.svg' },
].map((m) => ({ ...m, svg: readFileSync(`${dir}/${m.file}`, 'utf8') }));

// Night versions: saffron lifts to gold, emerald to a lighter emerald so it holds on #141412; mono = currentColor.
const night = (s) => s.replaceAll('#C98A17', '#E3B04B').replaceAll('#1E7A52', '#3DA676');
const mono = (s) => s.replace(/#(1E7A52|C98A17|E3B04B|F2EEE6)/g, 'currentColor');
const at = (svg, px) => svg.replace('<svg ', `<svg width="${px}" height="${px}" `);

const lockup = (svg, px, small) => `<span class="lk">${at(svg, px)}<span class="wm"><b style="font-size:${px * 0.78}px">kuzikode</b>${
  small ? '' : `<i style="font-size:${Math.max(8, px * 0.24)}px">INTELLIGENT TECHNOLOGIES</i>`
}</span></span>`;

const row = (m) => `<section><h2>${m.id}. ${m.name}</h2><div class="grid">
<div class="cell bone">${[24, 40, 96].map((p) => at(m.svg, p)).join('')}</div>
<div class="cell night">${[24, 40, 96].map((p) => at(night(m.svg), p)).join('')}</div>
<div class="cell bone ink">${[24, 40].map((p) => at(mono(m.svg), p)).join('')}</div>
<div class="cell night onn">${[24, 40].map((p) => at(mono(m.svg), p)).join('')}</div>
<div class="cell fav"><span>favicon 16</span>${at(m.svg, 16)}<span>32</span>${at(m.svg, 32)}</div>
</div>
<div class="hdr" style="width:390px">${lockup(m.svg, 32, true)}<span class="cta">Get a quote</span><span class="menu">☰</span></div>
<div class="hdr" style="width:1440px">${lockup(m.svg, 36, false)}<nav>About Services Pricing Our Work Insights Contact</nav><span class="cta">Get a quote</span></div>
</section>`;

const html = `<!doctype html><html><head><style>
@font-face{font-family:Poppins;src:url(${font(500)}) format('woff2');font-weight:500}
@font-face{font-family:Poppins;src:url(${font(600)}) format('woff2');font-weight:600}
*{margin:0;box-sizing:border-box}
body{width:1520px;padding:40px;background:#e8e2d7;font-family:Poppins;color:#141412}
h1{font-size:28px;font-weight:600;margin-bottom:24px}
h2{font-size:18px;font-weight:600;margin:28px 0 12px}
.grid{display:grid;grid-template-columns:1.4fr 1.4fr 1fr 1fr 1fr;gap:10px}
.cell{display:flex;align-items:center;gap:24px;padding:20px;border-radius:10px;min-height:136px}
.bone{background:#f2eee6}.night{background:#141412}.ink{color:#141412}.onn{color:#f2eee6}
.fav{background:#fff;font-size:11px;gap:10px}
.hdr{display:flex;align-items:center;gap:16px;height:64px;padding:0 20px;margin-top:10px;background:#f2eee6;border-radius:8px}
.hdr nav{margin-left:auto;font-weight:500;word-spacing:22px;font-size:16px;color:#4e4a43}
.cta{margin-left:auto;background:#1e7a52;color:#fff;padding:10px 16px;border-radius:8px;font-weight:600;font-size:14px}
.hdr nav + .cta{margin-left:24px}
.menu{border:1px solid #c4baa8;border-radius:8px;padding:8px 12px}
.lk{display:inline-flex;align-items:center;gap:10px}
.wm{display:flex;flex-direction:column;line-height:1}
.wm b{font-weight:600;letter-spacing:-.02em}
.wm i{font-style:normal;font-weight:500;letter-spacing:.2em;color:#8a5c08;margin-top:3px}
</style></head><body><h1>Kuzikode Intelligent Technologies · mark explorations · 2026-11-13</h1>${marks.map(row).join('')}</body></html>`;

const exe = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(exe) ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1520, height: 900 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${dir}/board-2026-11-13.png`, fullPage: true });
await browser.close();
console.log('board written');
