#!/usr/bin/env node
/**
 * Lighthouse check of the PRD §10 pages (P7.4): `npm run perf:lighthouse -- [baseUrl]` (default http://localhost:8787).
 * Runs Lighthouse (pinned, through npx: no project dependency) with its default mobile profile and fails if a page misses
 * the targets: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO = 100. SEO only passes against a production
 * build (APP_ENV=production): every other environment is deliberately `noindex`, so pass `--no-seo` there.
 * Needs Chrome: set CHROME_PATH (cloud sessions: /opt/pw-browsers/chromium).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const skipSeo = args.includes('--no-seo');
const base = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:8787').replace(/\/$/, '');
const PAGES = ['/', '/services/', '/services/web-development', '/contact'];
const TARGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 100 };
const out = mkdtempSync(join(tmpdir(), 'lh-'));
let failed = false;

for (const path of PAGES) {
  const file = join(out, `${path.replace(/\W+/g, '_') || 'home'}.json`);
  execFileSync(
    'npx',
    [
      '-y',
      'lighthouse@12.6.1',
      `${base}${path}`,
      '--quiet',
      '--chrome-flags=--headless=new --no-sandbox',
      '--only-categories=performance,accessibility,best-practices,seo',
      '--output=json',
      `--output-path=${file}`,
    ],
    { stdio: 'inherit' },
  );
  const report = JSON.parse(readFileSync(file, 'utf8'));
  const scores = Object.fromEntries(
    Object.values(report.categories).map((c) => [c.id, Math.round((c.score ?? 0) * 100)]),
  );
  const misses = Object.entries(TARGETS).filter(([k, min]) => !(skipSeo && k === 'seo') && scores[k] < min);
  const a = report.audits;
  console.log(
    `${misses.length ? '✗' : '✓'} ${path}  ${Object.entries(scores)
      .map(([k, v]) => `${k}=${v}`)
      .join(
        ' ',
      )}  LCP=${a['largest-contentful-paint'].displayValue} TBT=${a['total-blocking-time'].displayValue} CLS=${a['cumulative-layout-shift'].displayValue}`,
  );
  if (misses.length) failed = true;
}
process.exit(failed ? 1 : 0);
