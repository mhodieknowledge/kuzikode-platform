#!/usr/bin/env node
/**
 * Dev-only image generator (docs/13 §2). Not part of the app.
 *   npm run img:gen -- --id home-hero --size 1600x896 --variants 3 [--model @cf/leonardo/lucid-origin] [--seed 42]
 *   npm run img:gen -- --id home-hero --provider openai [--model gpt-image-1.5] [--quality medium]
 *     (docs/13 generator #3: OPENAI_API_KEY; size snaps to 1536x1024, 1024x1536 or 1024x1024 by aspect ratio)
 * Reads design/images/prompts/<id>.txt (first line: `category: people|object|abstract`), prepends the style block,
 * calls Cloudflare Workers AI and writes candidates to design/images/raw/<id>-<n>.png (git-ignored).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const provider = arg('provider', 'workers-ai');
const model = arg('model', provider === 'openai' ? 'gpt-image-1.5' : '@cf/leonardo/lucid-origin');
const quality = arg('quality', 'medium');
const baseSeed = Number(arg('seed', String(Math.floor(Math.random() * 1e6))));
const steps = Math.min(40, Math.max(8, Number(arg('steps', '30'))));
const { CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token } = process.env;
if (provider === 'openai' ? !process.env.OPENAI_API_KEY : !account || !token)
  throw new Error(
    provider === 'openai' ? 'OPENAI_API_KEY must be set' : 'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set',
  );

/** OpenAI Images API: returns base64 PNG in data[0].b64_json. */
async function runOpenAI(prompt) {
  const ratio = w / h;
  const size = ratio > 1.2 ? '1536x1024' : ratio < 0.83 ? '1024x1536' : '1024x1024';
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
  });
  const json = await res.json();
  return { res, json, b64: json?.data?.[0]?.b64_json };
}

const raw = readFileSync(`design/images/prompts/${id}.txt`, 'utf8').trim().split('\n');
const category = (raw[0].match(/^category:\s*(\w+)/) ?? [])[1];
if (!STYLE[category]) throw new Error('First line of the prompt file must be `category: people|object|abstract`');
const prompt = `${STYLE[category]} ${raw.slice(1).join(' ').trim()} ${AVOID}`;

mkdirSync('design/images/raw', { recursive: true });
/** Don't overwrite earlier candidates from another run (OpenAI has no seed to reproduce them). */
const nextIndex = (v) => {
  let n = v;
  while (existsSync(`design/images/raw/${id}-${n}.png`)) n++;
  return n;
};
const clamp = (n) => Math.min(2048, Math.round(n / 16) * 16);
for (let v = 1; v <= variants; v++) {
  const seed = baseSeed + v;
  if (provider === 'openai') {
    const { res, json, b64 } = await runOpenAI(prompt);
    if (!res.ok || !b64) {
      console.error(`variant ${v} failed: ${res.status} ${JSON.stringify(json?.error ?? json).slice(0, 300)}`);
      if (res.status === 429 || res.status === 401) break;
      continue;
    }
    const n = nextIndex(v);
    const out = `design/images/raw/${id}-${n}.png`;
    await sharp(Buffer.from(b64, 'base64')).png().toFile(out);
    writeFileSync(
      `design/images/raw/${id}-${n}.json`,
      JSON.stringify({ id, model, seed: null, category, prompt, size: [w, h] }, null, 2),
    );
    console.log(`wrote ${out}`);
    continue;
  }
  const body = model.includes('flux-1-schnell')
    ? { prompt, steps: 8 }
    : { prompt, width: clamp(w), height: clamp(h), seed, steps, guidance: 4.5 };
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
