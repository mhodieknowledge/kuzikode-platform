import { expect, test } from '@playwright/test';
import { ownIp } from './helpers';

/** R3.3: section reveal and page transitions respect `prefers-reduced-motion`; nothing stays hidden. */
test.use(ownIp('motion'));

test('reduced motion: nothing is hidden for a reveal and no entrance animation runs', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  for (const path of ['/', '/dev/ui']) {
    await page.goto(path);
    await expect(page.locator('.kz-reveal')).toHaveCount(0);
    const running = await page.evaluate(
      () =>
        document
          .getAnimations()
          // Reduced motion shortens every animation to 0.01 ms; one caught in its only frame is not an entrance animation.
          .filter((a) => {
            const t = a.effect?.getComputedTiming();
            return a.playState === 'running' && t?.iterations !== Infinity && Number(t?.duration) > 1;
          }).length,
    );
    expect(running, `${path}: running entrance animations`).toBe(0);
    for (const el of await page.locator('[data-reveal]').all()) await expect(el).toBeVisible();
  }
  await ctx.close();
});

test('with motion: a section below the fold reveals once when scrolled into view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dev/ui');
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  const section = page.locator('section[aria-labelledby="status"]');
  await expect(section).toHaveClass(/kz-reveal/);
  await expect(section).not.toHaveClass(/is-in/);
  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveClass(/is-in/);
  await expect(section).toHaveCSS('opacity', '1');
});
