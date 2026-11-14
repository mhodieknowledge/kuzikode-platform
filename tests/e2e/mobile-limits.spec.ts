import { expect, test, type Page } from '@playwright/test';
import { ownIp } from './helpers';

/**
 * BRIEF B.1a mobile hard limits (R2.6; typography per REFINEMENTS §8: H1 <= 38 px, H2 <= 30 px, body >= 16 px), enforced at 360, 390 and 430 px on every rebuilt public page.
 * A page joins REBUILT when its new UI ships (R3–R4); legacy pages are not held to limits they were never designed for, and
 * legacy sections still inside a rebuilt page are wrapped in [data-legacy] until their own rebuild (the home's below-hero sections, R4.1).
 */
test.use(ownIp('mobile-limits'));

const REBUILT = ['/', '/dev/ui'];
const PHONES = [
  [360, 740],
  [390, 844],
  [430, 932],
] as const;

interface Measure {
  overflow: number;
  h1: { size: number; lines: number; weight: number }[];
  h2: { text: string; size: number; lines: number }[];
  smallBody: string[];
  wrappedButtons: string[];
  shortButtons: string[];
}

async function measure(page: Page): Promise<Measure> {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const lines = (el: Element) => {
      const s = getComputedStyle(el);
      const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2;
      return Math.round(el.getBoundingClientRect().height / lh);
    };
    const all = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel)).filter(visible);
    const main = document.querySelector('main') ?? document.body;
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h1: all('h1').map((h) => ({
        size: parseFloat(getComputedStyle(h).fontSize),
        lines: lines(h),
        weight: Number(getComputedStyle(h).fontWeight),
      })),
      h2: all('main h2')
        .filter((h) => !h.closest('[data-legacy]'))
        .map((h) => ({
          text: (h.textContent ?? '').trim().slice(0, 40),
          size: parseFloat(getComputedStyle(h).fontSize),
          lines: lines(h),
        })),
      // Body copy: paragraphs and list items of running text in main (meta/captions are allowed down to 12 px).
      smallBody: Array.from(main.querySelectorAll<HTMLElement>('p:not([class*="proof"]):not(small), li > p'))
        .filter(visible)
        .filter((p) => !p.closest('[data-legacy]'))
        .filter((p) => (p.textContent ?? '').trim().length > 60 && parseFloat(getComputedStyle(p).fontSize) < 16)
        .map((p) => (p.textContent ?? '').trim().slice(0, 40)),
      // Labelled buttons only (icon-only buttons have no label to wrap); the label is the button's first text span.
      wrappedButtons: all<HTMLElement>('.kz-btn')
        .filter((b) => (b.textContent ?? '').trim().length > 0)
        .filter((b) => {
          const label = Array.from(b.querySelectorAll('span')).find((sp) => (sp.textContent ?? '').trim()) ?? b;
          return label.getBoundingClientRect().height > parseFloat(getComputedStyle(label).fontSize) * 1.9;
        })
        .map((b) => (b.textContent ?? '').trim()),
      shortButtons: all<HTMLElement>('main .kz-btn')
        .filter((b) => !b.closest('[data-legacy]'))
        .filter((b) => b.getBoundingClientRect().height < 40)
        .map((b) => (b.textContent ?? '').trim()),
    };
  });
}

for (const path of REBUILT) {
  test(`B.1a phone limits hold on ${path}`, async ({ page }) => {
    for (const [width, height] of PHONES) {
      await page.setViewportSize({ width, height });
      const res = await page.goto(path);
      expect(res!.status()).toBe(200);
      await page.waitForTimeout(150);
      const m = await measure(page);
      const at = `${path} @ ${width}px`;
      expect(m.overflow, `${at}: horizontal overflow`).toBeLessThanOrEqual(0);
      for (const h of m.h1) {
        expect(h.size, `${at}: H1 size`).toBeLessThanOrEqual(38);
        expect(h.size, `${at}: H1 size`).toBeGreaterThanOrEqual(28);
        expect(h.lines, `${at}: H1 lines`).toBeLessThanOrEqual(4);
        expect(h.weight, `${at}: H1 weight`).toBeLessThanOrEqual(700);
      }
      for (const h of m.h2) {
        expect(h.size, `${at}: H2 "${h.text}" size`).toBeLessThanOrEqual(30);
        expect(h.lines, `${at}: H2 "${h.text}" lines`).toBeLessThanOrEqual(3);
      }
      expect(m.smallBody, `${at}: body text under 16 px`).toEqual([]);
      expect(m.wrappedButtons, `${at}: button labels that wrap`).toEqual([]);
      expect(m.shortButtons, `${at}: buttons under 40 px`).toEqual([]);
    }
  });
}

test('home first screen shows the headline, a primary action and a visual (B.1a, B.0e)', async ({ page }) => {
  for (const [width, height] of PHONES) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const inView = async (sel: string) =>
      page
        .locator(sel)
        .first()
        .evaluate((el, h) => {
          const r = el.getBoundingClientRect();
          return r.top < h && r.bottom > 0 && r.height > 0;
        }, height);
    expect(await inView('h1'), `h1 in first screen @ ${width}`).toBe(true);
    expect(await inView('[data-hero-cta]'), `primary action in first screen @ ${width}`).toBe(true);
    expect(await inView('.kz-hw, main img'), `visual in first screen @ ${width}`).toBe(true);
    const hero = await page.locator('.kz-hero__grid').evaluate((el) => el.getBoundingClientRect().height);
    expect(hero, `hero height ≤ 85svh @ ${width}`).toBeLessThanOrEqual(height * 0.85);
  }
});
