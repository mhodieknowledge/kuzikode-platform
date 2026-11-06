#!/usr/bin/env node
/**
 * Dev-only: optimise a chosen candidate into AVIF/WebP/JPEG at 640/1024/1600/2400 widths (never upscaled), strip
 * metadata, make a tiny blur placeholder, and record it in design/images/manifest.json.
 *   npm run img:process -- --id home-hero --pick 2 --alt "Three colleagues reviewing a dashboard on a large screen" [--crop 16:9]
 * Owner-supplied images (docs/13 §1b) skip the raw/ candidate files: pass --src and the prompt is read from PROMPT-PACK.md.
 *   npm run img:process -- --id svc-cloud-it --src /path/to/file.png --model "owner: gemini-app" --category people --alt "…"
 * --focus 0..1 moves the crop window (0 = top/left, 0.5 = centre, 1 = bottom/right).
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
const ownerSrc = arg('src');
const focus = Number(arg('focus', '0.5'));
if (!id || alt === undefined || (!pick && !ownerSrc))
  throw new Error('--id, --alt and one of --pick / --src are required');
const src = ownerSrc ?? `design/images/raw/${id}-${pick}.png`;
const packPrompt = () => {
  const pack = readFileSync('design/images/PROMPT-PACK.md', 'utf8');
  const fence = '```';
  const start = pack.indexOf(`→ \`${id}.png\`\n${fence}\n`);
  if (start < 0) throw new Error(`No PROMPT-PACK.md entry for ${id}`);
  const body = pack.slice(pack.indexOf('\n', start) + fence.length + 2);
  return body.slice(0, body.indexOf(`\n${fence}`));
};
const meta = ownerSrc
  ? { model: arg('model', 'owner: gemini-app'), seed: null, category: arg('category', 'people'), prompt: packPrompt() }
  : JSON.parse(readFileSync(`design/images/raw/${id}-${pick}.json`, 'utf8'));

let img = sharp(src).rotate();
const { width, height } = await img.metadata();
let w = width;
let h = height;
if (crop) {
  const [cw, ch] = crop.split(':').map(Number);
  const target = cw / ch;
  if (w / h > target) w = Math.round(h * target);
  else h = Math.round(w / target);
  img = img.extract({
    left: Math.round((width - w) * focus),
    top: Math.round((height - h) * focus),
    width: w,
    height: h,
  });
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
  chosen: ownerSrc ? `${id} (owner upload)` : `${id}-${pick}`,
  alt,
  width: w,
  height: h,
  widths,
  placeholder: `data:image/webp;base64,${placeholder}`,
  illustrative: meta.category === 'people',
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`processed ${id}: ${widths.join(', ')} px`);
