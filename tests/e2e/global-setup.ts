import { execFileSync } from 'node:child_process';

/**
 * Local runs reuse the wrangler dev D1 state between runs, so per-IP rate limits for public forms would pile up
 * (every request comes from localhost). Start each run with an empty rate_limits table. CI starts from fresh state.
 */
export default function globalSetup() {
  if (process.env.CI) return;
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--command', 'DELETE FROM rate_limits'], {
    stdio: 'ignore',
  });
}
