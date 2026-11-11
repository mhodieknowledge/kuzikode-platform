// Standalone test config, so the package keeps its tests after extraction (`npm test` here). The root vitest
// "unit" project also runs these files on every `npm run verify`.
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'node', include: ['test/**/*.test.ts'] } });
