import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Local cloud sessions ship a preinstalled Chromium; CI runs `npx playwright install chromium` instead.
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';
const launchOptions = !process.env.CI && existsSync(LOCAL_CHROMIUM) ? { executablePath: LOCAL_CHROMIUM } : {};

const PORT = Number(process.env.PORT ?? 8787);

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions } }],
  webServer: {
    command: `npm run build && npx wrangler d1 migrations apply DB --local && node scripts/seed.ts --env local && npx wrangler dev --port ${PORT} --var PUBLIC_SITE_URL:http://localhost:${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
