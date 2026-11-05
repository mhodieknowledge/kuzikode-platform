import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildBaseSeed } from '../../scripts/seeds/build-base-seed';
import { DIVISIONS } from '../../scripts/seeds/content/services';
import { PAGES, SETTINGS } from '../../scripts/seeds/content/cms';
import { planSeeds, SeedGuardError } from '../../scripts/seed';
import { ALL_PERMISSIONS } from '../../src/shared/permissions';

const BANNED =
  /\b(unlock|elevate|seamless|cutting-edge|revolutioni[sz]e|leverage synergies|empower your journey)\b|in today's fast-paced world/i;

describe('seed guard', () => {
  it('refuses the dev seed for production', () => {
    expect(() => planSeeds('production', { dev: true })).toThrow(SeedGuardError);
  });

  it('applies only base data to production and never the mock gateway', () => {
    expect(planSeeds('production')).toEqual(['seeds/base.sql']);
  });

  it('applies nonprod + dev locally and dev on staging only on request', () => {
    expect(planSeeds('local')).toEqual(['seeds/base.sql', 'seeds/nonprod.sql', 'seeds/dev.sql']);
    expect(planSeeds('staging')).not.toContain('seeds/dev.sql');
    expect(planSeeds('staging', { dev: true })).toContain('seeds/dev.sql');
    expect(() => planSeeds('prod')).toThrow(SeedGuardError);
  });
});

describe('base seed', () => {
  const sql = buildBaseSeed();

  it('is up to date with its generator (run `npm run seed:build`)', () => {
    expect(readFileSync('seeds/base.sql', 'utf8')).toBe(sql);
  });

  it('is idempotent and production-safe', () => {
    for (const line of sql.split('\n').filter((l) => /^\s*(INSERT|UPDATE|DELETE)/.test(l))) {
      expect(line.startsWith('INSERT OR IGNORE')).toBe(true);
    }
    expect(sql).not.toMatch(/example\.com|mock/i);
  });

  it('contains every permission and all six divisions with sub-services', () => {
    for (const p of ALL_PERMISSIONS) expect(sql).toContain(`'${p}'`);
    expect(DIVISIONS.map((d) => d.slug)).toEqual([
      'web-development',
      'mobile-desktop-apps',
      'business-software',
      'ai-data',
      'automation-integration',
      'cloud-it',
    ]);
    for (const d of DIVISIONS) expect(d.services.length).toBeGreaterThanOrEqual(6);
  });

  it('keeps prices hidden and VAT inactive by default', () => {
    expect(SETTINGS['pricing.show_prices']).toBe(false);
    expect(sql).toContain("'tax_vat', 'VAT 15.5%', 1550, 0, 0, 0");
  });

  it('copy follows the PRD rules: no banned words, no exclamation marks in titles, no lorem ipsum', () => {
    const copy = JSON.stringify({ DIVISIONS, PAGES, SETTINGS });
    expect(copy).not.toMatch(BANNED);
    expect(copy).not.toMatch(/lorem ipsum/i);
    for (const page of PAGES)
      for (const s of page.sections) expect(String(s.content['title'] ?? '')).not.toContain('!');
  });
});

describe('robots', () => {
  it('disallows everything outside production and private paths in production', async () => {
    const { renderRobots } = await import('../../src/server/modules/cms/sitemap');
    const prod = renderRobots({ config: { appEnv: 'production', siteUrl: new URL('https://kuzikode.com') } } as never);
    for (const p of ['/admin', '/portal', '/api', '/q/', '/i/']) expect(prod).toContain(`Disallow: ${p}`);
    expect(prod).toContain('Sitemap: https://kuzikode.com/sitemap.xml');
    const staging = renderRobots({ config: { appEnv: 'staging', siteUrl: new URL('https://s.example') } } as never);
    expect(staging).toContain('Disallow: /\n');
  });
});
