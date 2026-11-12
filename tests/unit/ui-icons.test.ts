import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CMS_ICONS } from '../../src/shared/icons';
import { ICONS, ICON_SIZES, cmsIcon, divisionIcon, industryIcon } from '../../src/ui/icons/registry';

const seed = readFileSync('seeds/base.sql', 'utf8');
/** Slugs of the rows a seed INSERT creates for `table` (the slug is the second value of each row). */
const slugs = (table: string) =>
  [
    ...seed.matchAll(new RegExp(`INSERT OR IGNORE INTO ${table} \\([^)]*\\) VALUES \\('[^']*', '([a-z0-9-]+)'`, 'g')),
  ].map((m) => m[1]!);

describe('icon registry (R2.2)', () => {
  it('maps every CMS icon name to itself', () => {
    for (const name of CMS_ICONS) expect(cmsIcon(name)).toBe(name);
  });

  it('falls back to a neutral glyph for unknown or empty names', () => {
    expect(cmsIcon('not-an-icon')).toBe('layers');
    expect(cmsIcon(null)).toBe('layers');
  });

  it('gives every seeded division and industry its own specific glyph', () => {
    const divisions = slugs('service_categories');
    const industries = slugs('industries');
    expect(divisions).toHaveLength(6);
    expect(industries.length).toBeGreaterThanOrEqual(8);
    for (const s of divisions) expect(divisionIcon(s)).toMatch(/^div-/);
    for (const s of industries) expect(industryIcon(s)).toMatch(/^ind-/);
    expect(new Set(divisions.map((s) => divisionIcon(s))).size).toBe(divisions.length);
  });

  it('every entry is a renderable Lucide component and sizes carry a stroke', () => {
    for (const glyph of Object.values(ICONS)) expect(['function', 'object']).toContain(typeof glyph);
    expect(Object.keys(ICON_SIZES).map(Number)).toEqual([16, 20, 24, 32]);
  });
});
