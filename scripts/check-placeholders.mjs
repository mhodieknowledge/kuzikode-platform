#!/usr/bin/env node
/**
 * Placeholder sweep (P7.5, CLAUDE.md §3 "No placeholders / No fabrication"): fails when shipped code or seed content has
 * TODO/FIXME markers, lorem ipsum, `href="#"`, stray console.log/debug, links or buttons labelled "Coming soon",
 * permanently disabled buttons, or invented social proof ("trusted by", "100+ clients", "award-winning"…).
 * Run: `npm run check:placeholders` (part of `npm run verify`, so CI runs it on every push).
 *
 * Development-only pages and fixtures are skipped (they 404 outside APP_ENV=development). A line can opt out with a
 * trailing comment `placeholder-ok: <reason>`; keep that rare and always give the reason.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN = ['src', 'scripts/seeds', 'public'];
const EXTENSIONS = /\.(ts|tsx|astro|css|mjs|js|json|md|html|txt)$/;
const SKIP = [
  /^src\/components\/dev\//, // /dev/ui gallery (development only)
  /^src\/pages\/dev\//, // development-only pages
  /\.d\.ts$/, // generated platform types
  /^src\/server\/lib\/logger\.ts$/, // the one place that writes to the console
  /^public\/.*\.(png|jpe?g|webp|avif|svg|ico|woff2?)$/,
];

/** [rule name, pattern, applies to] */
const RULES = [
  ['todo marker', /\b(TODO|FIXME|HACK)\b|\bXXX\b/, /./],
  ['lorem ipsum', /\blorem\b|\bipsum\b/i, /./],
  ['dead link href="#"', /href\s*=\s*\{?\s*["']#["']/, /./],
  ['console.log/debug', /\bconsole\.(log|debug)\s*\(/, /\.(ts|tsx|astro|mjs|js)$/],
  ['clickable "Coming soon"', /<(a|button|Button|Link)\b[^>]*>\s*(\{[^}]*\}\s*)?coming soon/i, /\.(tsx|astro)$/],
  ['permanently disabled button', /<(button|Button)\b[^>]*\sdisabled(\s*\/?>|\s+[a-zA-Z])/, /\.(tsx|astro)$/],
  [
    'invented social proof',
    /trusted by|happy clients|satisfied (clients|customers)|award[- ]winning|\b\d{2,}\+\s*(happy\s+)?(clients|customers|projects|businesses)\b/i,
    /./,
  ],
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}

const hits = [];
for (const base of SCAN) {
  let start;
  try {
    start = join(ROOT, base);
    statSync(start);
  } catch {
    continue;
  }
  for (const file of files(start)) {
    const rel = relative(ROOT, file).split('\\').join('/');
    if (!EXTENSIONS.test(rel) || SKIP.some((re) => re.test(rel))) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/placeholder-ok:\s*\S/.test(line)) return;
      for (const [name, re, applies] of RULES)
        if (applies.test(rel) && re.test(line)) hits.push(`${rel}:${i + 1}  ${name}  ${line.trim().slice(0, 120)}`);
    });
  }
}

if (hits.length) {
  console.error(`Placeholder check failed (${hits.length}):\n${hits.join('\n')}`);
  process.exit(1);
}
console.log('Placeholder check passed.');
