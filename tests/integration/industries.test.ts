import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { bumpContentVersionStmt, getIndustry, listIndustries, resetCmsCache } from '../../src/server/modules/cms';
import { seedBase } from '../helpers/seed';

const ctx = () => createContext({ env, now: () => new Date('2026-11-05T10:00:00Z') });

describe('industries (docs/12 §C.3)', () => {
  beforeEach(async () => {
    await seedBase();
    resetCmsCache();
  });

  it('lists the 8 seeded industries in order with challenges and linked services', async () => {
    const list = await listIndustries(ctx());
    expect(list.map((i) => i.slug)).toEqual([
      'retail-wholesale',
      'financial-services',
      'education',
      'healthcare',
      'ngos-development',
      'hospitality-tourism',
      'agriculture',
      'logistics-transport',
    ]);
    for (const i of list) {
      expect(i.challenges.length).toBeGreaterThanOrEqual(3);
      expect(i.serviceIds.length).toBeGreaterThanOrEqual(4);
      // Honesty rules: "solutions for", never client claims or statistics.
      expect(`${i.summary} ${i.body} ${JSON.stringify(i.challenges)}`).not.toMatch(/clients include|trusted by|\d+%/i);
    }
  });

  it('resolves services and packages for an industry, and hides inactive services', async () => {
    const retail = await getIndustry(ctx(), 'retail-wholesale');
    expect(retail!.services.map((s) => s.slug)).toContain('ecommerce-website');
    expect(retail!.packages.map((p) => p.slug)).toContain('ecommerce-website');
    await env.DB.batch([
      env.DB.prepare("UPDATE services SET status = 'inactive' WHERE slug = 'ecommerce-website'"),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
    const after = await getIndustry(ctx(), 'retail-wholesale');
    expect(after!.services.map((s) => s.slug)).not.toContain('ecommerce-website');
    expect(after!.packages.map((p) => p.slug)).not.toContain('ecommerce-website');
  });

  it('drafts are not listed and do not resolve', async () => {
    await env.DB.batch([
      env.DB.prepare("UPDATE industries SET status = 'draft' WHERE slug = 'agriculture'"),
      bumpContentVersionStmt(env.DB),
    ]);
    resetCmsCache();
    expect((await listIndustries(ctx())).map((i) => i.slug)).not.toContain('agriculture');
    expect(await getIndustry(ctx(), 'agriculture')).toBeNull();
  });
});
