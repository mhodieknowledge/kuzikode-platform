#!/usr/bin/env node
/**
 * Dev-only: optimise a chosen candidate into AVIF/WebP/JPEG at 640/1024/1600/2400 widths (never upscaled), strip
 * metadata, make a tiny blur placeholder, and record it in design/images/manifest.json.
 *   npm run img:process -- --id home-hero --pick 2 --alt "Three colleagues reviewing a dashboard on a large screen" [--crop 16:9]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};
const id = arg('id');
const pick = arg('pick');
const alt = arg('alt');
const crop = arg('crop');
if (!id || !pick || !alt) throw new Error('--id, --pick and --alt are required');
const src = `design/images/raw/${id}-${pick}.png`;
const meta = JSON.parse(readFileSync(`design/images/raw/${id}-${pick}.json`, 'utf8'));

let img = sharp(src).rotate();
const { width, height } = await img.metadata();
let w = width;
let h = height;
if (crop) {
  const [cw, ch] = crop.split(':').map(Number);
  const target = cw / ch;
  if (w / h > target) w = Math.round(h * target);
  else h = Math.round(w / target);
  img = img.extract({ left: Math.round((width - w) / 2), top: Math.round((height - h) / 2), width: w, height: h });
}
const base = await img.toBuffer();
const outDir = 'public/images/site';
mkdirSync(outDir, { recursive: true });
const widths = [640, 1024, 1600, 2400].filter((x) => x <= w);
if (widths.length === 0 || widths.at(-1) < w) widths.push(w);
for (const width of widths) {
  const resized = sharp(base).resize({ width, withoutEnlargement: true });
  await resized.clone().avif({ quality: 50, effort: 6 }).toFile(`${outDir}/${id}-${width}.avif`);
  await resized.clone().webp({ quality: 72 }).toFile(`${outDir}/${id}-${width}.webp`);
  await resized.clone().jpeg({ quality: 76, mozjpeg: true, progressive: true }).toFile(`${outDir}/${id}-${width}.jpg`);
}
const placeholder = (await sharp(base).resize(24).blur(1).webp({ quality: 40 }).toBuffer()).toString('base64');

const manifestPath = 'design/images/manifest.json';
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { images: {} };
manifest.images[id] = {
  model: meta.model,
  seed: meta.seed,
  category: meta.category,
  prompt: meta.prompt,
  chosen: `${id}-${pick}`,
  alt,
  width: w,
  height: h,
  widths,
  placeholder: `data:image/webp;base64,${placeholder}`,
  illustrative: meta.category === 'people',
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`processed ${id}: ${widths.join(', ')} px`);
