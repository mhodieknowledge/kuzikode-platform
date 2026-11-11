import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
  return {
    resolve: { alias: { '@': path.join(import.meta.dirname, 'src') } },
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'node',
            include: ['tests/unit/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
          },
        },
        {
          // Opt-in real gateway calls in test mode (P6.5): `npm run test:payments:live`. Never in verify or default CI.
          extends: true,
          test: {
            name: 'payments-live',
            environment: 'node',
            include: ['tests/live/**/*.live.test.ts'],
            testTimeout: 120_000,
          },
        },
        {
          extends: true,
          plugins: [
            cloudflareTest({
              main: './tests/helpers/test-worker.ts',
              wrangler: { configPath: './wrangler.jsonc' },
              miniflare: {
                bindings: {
                  TEST_MIGRATIONS: migrations,
                  HMAC_SECRET: 'test-hmac-secret-0123456789abcdef0123456789abcdef',
                  DATA_ENCRYPTION_KEY: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
                  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
                },
              },
            }),
          ],
          test: {
            name: 'integration',
            include: ['tests/integration/**/*.test.ts'],
            setupFiles: ['./tests/helpers/apply-migrations.ts'],
          },
        },
      ],
    },
  };
});
