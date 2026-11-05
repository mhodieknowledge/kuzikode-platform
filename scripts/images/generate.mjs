#!/usr/bin/env node
/**
 * Dev-only image generator (docs/13 §2). Not part of the app.
 *   npm run img:gen -- --id home-hero --size 1600x896 --variants 3 [--model @cf/leonardo/lucid-origin] [--seed 42]
 * Reads design/images/prompts/<id>.txt (first line: `category: people|object|abstract`), prepends the style block,
 * calls Cloudflare Workers AI and writes candidates to design/images/raw/<id>-<n>.png (git-ignored).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { AVOID, STYLE } from './style.mjs';

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};
const id = arg('id');
if (!id || !/^[a-z0-9-]+$/.test(id)) throw new Error('--id is required (kebab-case)');
const [w, h] = arg('size', '1600x896').split('x').map(Number);
const variants = Number(arg('variants', '3'));
const model = arg('model', '@cf/leonardo/lucid-origin');
const baseSeed = Number(arg('seed', String(Math.floor(Math.random() * 1e6))));
const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token } = process.env;
if (!account || !token) throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set');

const raw = readFileSync(`design/images/prompts/${id}.txt`, 'utf8').trim().split('\n');
const category = (raw[0].match(/^category:\s*(\w+)/) ?? [])[1];
if (!STYLE[category]) throw new Error('First line of the prompt file must be `category: people|object|abstract`');
const prompt = `${STYLE[category]} ${raw.slice(1).join(' ').trim()} ${AVOID}`;

mkdirSync('design/images/raw', { recursive: true });
const clamp = (n) => Math.min(2048, Math.round(n / 16) * 16);
for (let v = 1; v <= variants; v++) {
  const seed = baseSeed + v;
  const body = model.includes('flux-1-schnell')
    ? { prompt, steps: 8 }
    : { prompt, width: clamp(w), height: clamp(h), seed, steps: 30, guidance: 4.5 };
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const b64 = json?.result?.image;
  if (!res.ok || !b64) {
    console.error(`variant ${v} failed: ${res.status} ${JSON.stringify(json?.errors ?? json).slice(0, 300)}`);
    if (res.status === 429) break; // daily neuron budget reached: stop and continue next session
    continue;
  }
  const out = `design/images/raw/${id}-${v}.png`;
  await sharp(Buffer.from(b64, 'base64')).png().toFile(out);
  writeFileSync(
    `design/images/raw/${id}-${v}.json`,
    JSON.stringify({ id, model, seed, category, prompt, size: [w, h] }, null, 2),
  );
  console.log(`wrote ${out} (seed ${seed})`);
}
