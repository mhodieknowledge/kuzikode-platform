#!/usr/bin/env node
/**
 * Dev-only: builds the Kuzikode Intelligent Technologies brand set (R9.3) from the chosen mark (exploration A, "Brace K").
 *   pip install fonttools && node design/brand/tools/build-brand.mjs
 * Writes public/brand/*.svg (text outlined from Poppins, so the files stand alone), the favicon set in public/, and
 * public/brand/email-header.png. Colours: emerald brace, saffron chevron (gold on night), ink wordmark, saffron-ink tagline.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const outline = (weight, size, tracking, text) =>
  JSON.parse(execFileSync('python3', ['design/brand/tools/outline_text.py', String(weight), String(size), String(tracking), text], { encoding: 'utf8' }));

export const C = {
  brace: '#1E7A52', // emerald-500
  chevron: '#C98A17', // saffron
  ink: '#141412', // ink-900
  tag: '#8A5C08', // saffron-ink (AA on bone and white)
  bone: '#F2EEE6',
  braceNight: '#3DA676', // emerald lifted for night surfaces (logo only)
  gold: '#E3B04B', // gold-400 (--lit)
};

/** The mark on a 48-unit grid: a code brace as the K's stem, a mitred chevron as its arms. */
const mark = (brace, chevron) =>
  `<path d="M21 7h-3.5Q13 7 13 11.5V19q0 5-5 5 5 0 5 5v7.5q0 4.5 4.5 4.5H21" fill="none" stroke="${brace}" stroke-width="6" stroke-linejoin="round"/>` +
  `<path d="M41 7.5 21.5 24 41 40.5" fill="none" stroke="${chevron}" stroke-width="6.5"/>`;

const WORD = outline(600, 40, -0.02, 'kuzikode'); // width 175.32, ascender ≈ 29.6
const TAG_SIZE = 10.5;
const base = outline(500, TAG_SIZE, 0, 'INTELLIGENT TECHNOLOGIES');
const TAG = outline(500, TAG_SIZE, (WORD.width - base.width) / (23 * TAG_SIZE), 'INTELLIGENT TECHNOLOGIES'); // justified to the wordmark
const TX = 60; // mark 48 + gap 12
const W = Math.ceil(TX + WORD.width + 1);

const svg = (vb, title, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-labelledby="t"><title id="t">${title}</title>${body}</svg>\n`;
const NAME = 'Kuzikode Intelligent Technologies';

const lockups = (p) => ({
  full: svg(
    `0 0 ${W} 48`,
    NAME,
    mark(p.brace, p.chevron) +
      `<path transform="translate(${TX} 31)" fill="${p.ink}" d="${WORD.d}"/>` +
      `<path transform="translate(${TX} 45.5)" fill="${p.tag}" d="${TAG.d}"/>`,
  ),
  wordmark: svg(`0 0 ${W} 48`, 'Kuzikode', mark(p.brace, p.chevron) + `<path transform="translate(${TX} 37)" fill="${p.ink}" d="${WORD.d}"/>`),
  stacked: svg(
    `0 0 ${Math.ceil(WORD.width)} 124`,
    NAME,
    `<g transform="translate(${(WORD.width - 64) / 2} 0) scale(1.3333)">${mark(p.brace, p.chevron)}</g>` +
      `<path transform="translate(0 104)" fill="${p.ink}" d="${WORD.d}"/>` +
      `<path transform="translate(0 120)" fill="${p.tag}" d="${TAG.d}"/>`,
  ),
  mark: svg('0 0 48 48', 'Kuzikode', mark(p.brace, p.chevron)),
});

const light = lockups({ brace: C.brace, chevron: C.chevron, ink: C.ink, tag: C.tag });
const night = lockups({ brace: C.braceNight, chevron: C.gold, ink: C.bone, tag: C.gold });
const monoInk = lockups({ brace: C.ink, chevron: C.ink, ink: C.ink, tag: C.ink });
const monoBone = lockups({ brace: C.bone, chevron: C.bone, ink: C.bone, tag: C.bone });

const out = {
  'logo.svg': light.full,
  'logo-wordmark.svg': light.wordmark,
  'logo-stacked.svg': light.stacked,
  'logo-mark.svg': light.mark,
  'logo-white.svg': night.full, // full colour for night surfaces (OG cards)
  'logo-night-wordmark.svg': night.wordmark,
  'logo-night-stacked.svg': night.stacked,
  'logo-night-mark.svg': night.mark,
  'logo-mono-dark.svg': monoInk.full, // one colour, ink, for light backgrounds
  'logo-mono-dark-stacked.svg': monoInk.stacked,
  'logo-mono-dark-mark.svg': monoInk.mark,
  'logo-mono-light.svg': monoBone.full, // one colour, bone, for dark backgrounds
  'logo-mono-light-stacked.svg': monoBone.stacked,
  'logo-mono-light-mark.svg': monoBone.mark,
};

/** App/favicon tile: bone brace and gold chevron on an emerald tile. `inset` scales the mark (maskable needs the safe zone). */
const tile = (rx, inset = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="${rx}" fill="${C.brace}"/>` +
  `<g transform="translate(24 24) scale(${(0.74 * inset).toFixed(3)}) translate(-24.5 -24)">${mark(C.bone, C.gold)}</g></svg>\n`;
out['favicon.svg'] = tile(11);
for (const [f, s] of Object.entries(out)) writeFileSync(`public/brand/${f}`, s);
writeFileSync('public/favicon.svg', tile(11));

const png = (s, size) => sharp(Buffer.from(s), { density: Math.max(72, (72 * size) / 48) * 1.0 }).resize(size, size).png().toBuffer();
const f16 = await png(tile(10), 16);
const f32 = await png(tile(10), 32);
const f48 = await png(tile(11), 48);
writeFileSync('public/favicon-32.png', f32);
writeFileSync('public/apple-touch-icon.png', await png(tile(0, 0.92), 180)); // iOS rounds the corners itself
writeFileSync('public/icon-512.png', await png(tile(11), 512));
writeFileSync('public/icon-512-maskable.png', await png(tile(0, 0.78), 512)); // mark inside the 80 % safe circle

// favicon.ico: PNG-encoded entries (16, 32, 48), supported by every current browser.
const imgs = [f16, f32, f48];
const head = Buffer.alloc(6 + 16 * imgs.length);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(imgs.length, 4);
let offset = head.length;
imgs.forEach((b, i) => {
  const size = [16, 32, 48][i];
  const e = 6 + i * 16;
  head.writeUInt8(size, e);
  head.writeUInt8(size, e + 1);
  head.writeUInt16LE(1, e + 4);
  head.writeUInt16LE(32, e + 6);
  head.writeUInt32LE(b.length, e + 8);
  head.writeUInt32LE(offset, e + 12);
  offset += b.length;
});
writeFileSync('public/favicon.ico', Buffer.concat([head, ...imgs]));

// Email header: the full lockup on white, 2× for a 600 px email (rendered at 300 × ~61).
const emailW = 1200;
const lockH = 96;
const lockW = Math.round((W * lockH) / 48);
const emailSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${emailW}" height="160" viewBox="0 0 ${emailW} 160"><rect width="100%" height="100%" fill="#FFFFFF"/><g transform="translate(64 32) scale(${lockH / 48})">${light.full.replace(/^<svg[^>]*>/, '').replace('</svg>\n', '').replace(/<title[^>]*>.*?<\/title>/, '')}</g></svg>`;
writeFileSync('public/brand/email-header.png', await sharp(Buffer.from(emailSvg)).png().toBuffer());
console.log(`brand: ${Object.keys(out).length} svgs, favicons, email header (lockup ${W}×48, tag tracking ${((WORD.width - base.width) / (23 * TAG_SIZE)).toFixed(3)}em, email lockup ${lockW}px)`);
