import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Owner rule BRIEF B.0b (R2.5): no blue, cobalt, indigo, violet or purple (hue ≈ 200°–290°) as a colour anywhere in the new UI
 * layer, the brand artwork, documents or emails. Near-greys (low saturation) are allowed whatever their hue.
 */
const HEX = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;

function hsl(hex: string): { h: number; s: number; l: number } {
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

/** Blue-to-violet hue with visible chroma; very light or very grey tints of those hues are neutrals, not brand colour. */
const isBanned = (hex: string) => {
  const raw = hex.replace('#', '');
  const { h, s, l } = hsl(raw);
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw;
  const ch = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const chroma = Math.max(...ch) - Math.min(...ch);
  if (h < 200 || h > 290) return false;
  return l <= 0.5 ? s > 0.25 && chroma > 0.025 : chroma > 0.06;
};

function files(dir: string, exts: string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p, exts);
    return exts.some((e) => p.endsWith(e)) ? [p] : [];
  });
}

const scanned = [
  ...files('src/ui', ['.css', '.astro', '.tsx', '.ts']),
  ...files('src/layouts', ['.astro']),
  ...files('public/brand', ['.svg']),
  'public/favicon.svg',
  'src/server/email/templates/layout.ts',
  'src/server/pdf/layout.ts',
  'src/server/lib/admin-page.ts',
];

describe('Route palette tokens (R2.1 / R2.5)', () => {
  it('detects banned hues (self-check)', () => {
    expect(isBanned('#2747E8')).toBe(true);
    expect(isBanned('#1F44E0')).toBe(true);
    expect(isBanned('#5146E5')).toBe(true);
    expect(isBanned('#0B1428')).toBe(true);
    expect(isBanned('#1E7A52')).toBe(false);
    expect(isBanned('#1F8478')).toBe(false); // teal is allowed
    expect(isBanned('#F2EEE6')).toBe(false);
  });

  it('defines the Route roles in tokens.css', () => {
    const css = readFileSync('src/ui/tokens/tokens.css', 'utf8');
    for (const name of [
      '--night-900',
      '--bone-50',
      '--gold-400',
      '--ink-900',
      '--emerald-500',
      '--saffron',
      '--clay',
      '--teal',
      '--moss',
      '--msasa',
      '--granite',
      '--lagoon',
      '--action',
      '--lit',
      '--focus',
    ])
      expect(css).toContain(`${name}:`);
  });

  it.each(scanned)('%s uses no blue, indigo or violet', (path) => {
    const banned = [...readFileSync(path, 'utf8').matchAll(HEX)].map((m) => m[0]).filter((h) => isBanned(h));
    expect(banned).toEqual([]);
  });

  it('keeps text contrast at WCAG AA for the main pairs', () => {
    const lum = (hex: string) => {
      const c = [0, 2, 4].map((i) => {
        const v = parseInt(hex.slice(1 + i, 3 + i), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m) as [number, number];
      return (x + 0.05) / (y + 0.05);
    };
    expect(ratio('#FFFFFF', '#1E7A52')).toBeGreaterThan(4.5); // primary action label
    expect(ratio('#FFFFFF', '#17643F')).toBeGreaterThan(4.5); // primary hover
    expect(ratio('#F2EEE6', '#141412')).toBeGreaterThan(4.5); // text on night
    expect(ratio('#BDB6A9', '#141412')).toBeGreaterThan(4.5); // secondary on night
    expect(ratio('#9B9486', '#141412')).toBeGreaterThan(4.5); // tertiary on night
    expect(ratio('#E3B04B', '#141412')).toBeGreaterThan(4.5); // lit on night
    expect(ratio('#6B655B', '#F2EEE6')).toBeGreaterThan(4.5); // tertiary ink on bone
    expect(ratio('#1C6E7A', '#F2EEE6')).toBeGreaterThan(4.5); // division 06 numerals on bone
    expect(ratio('#17643F', '#FBF9F5')).toBeGreaterThan(4.5); // link on paper
    for (const ink of ['#8A5C08', '#9A3F28', '#7C5A3A', '#16695F', '#536A1C', '#8E3B52', '#5A554C'])
      expect(ratio(ink, '#F2EEE6')).toBeGreaterThan(4.5); // accent text
    for (const acc of ['#C98A17', '#B84F35', '#1F8478', '#6F8A2A', '#7A7468'])
      expect(ratio('#0E0D0C', acc)).toBeGreaterThan(3); // large numerals on accent
  });
});
