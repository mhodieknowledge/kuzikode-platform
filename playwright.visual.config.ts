import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/**
 * Redesign visual loop (docs/redesign/BRIEF.md B.2). Not part of the e2e suite.
 *   SHOOT="/,/pricing,/portal,/admin" SHOOT_SET=core npx playwright test -c playwright.visual.config.ts
 * Sets: all (10 viewports) · core (375, 390, 430, 768, 1440) · quick (390, 1440). Output: .shots/<label>/ (git-ignored).
 * Expects the local server from playwright.config.ts to be running on :8787 (reused if up).
 */
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = !process.env.CI && existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {};

export default defineConfig({
  testDir: './tests/visual',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  workers: 4,
  reporter: 'list',
  timeout: 180_000,
  use: { baseURL: 'http://localhost:8787', trace: 'off' },
  projects: [{ name: 'visual', use: { ...devices['Desktop Chrome'], launchOptions } }],
  webServer: {
    command: `npm run build && npx wrangler d1 migrations apply DB --local && node scripts/seed.ts --env local && npx wrangler dev --port 8787`,
    url: 'http://localhost:8787/api/health',
    timeout: 240_000,
    reuseExistingServer: true,
  },
});
