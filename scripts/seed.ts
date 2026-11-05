/**
 * Applies seed files to a D1 database through wrangler.
 *   node scripts/seed.ts --env local|staging|production [--dev]
 * local:      base + nonprod + dev
 * staging:    base + nonprod (+ dev only with --dev)
 * production: base only. Refuses --dev and never applies nonprod.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export type SeedEnv = 'local' | 'staging' | 'production';

export class SeedGuardError extends Error {}

export function planSeeds(env: string, opts: { dev?: boolean } = {}): string[] {
  if (env === 'production') {
    if (opts.dev) throw new SeedGuardError('Refusing to apply the fictional dev seed to production.');
    return ['seeds/base.sql'];
  }
  if (env === 'staging') return ['seeds/base.sql', 'seeds/nonprod.sql', ...(opts.dev ? ['seeds/dev.sql'] : [])];
  if (env === 'local') return ['seeds/base.sql', 'seeds/nonprod.sql', 'seeds/dev.sql'];
  throw new SeedGuardError(`Unknown env "${env}". Use local, staging or production.`);
}

export function wranglerArgs(env: SeedEnv, file: string): string[] {
  const target = env === 'local' ? ['--local'] : ['--remote', '--env', env];
  return ['wrangler', 'd1', 'execute', 'DB', ...target, '--file', file, '--yes'];
}

function main(argv: string[]): void {
  const envIdx = argv.indexOf('--env');
  const env = envIdx >= 0 ? (argv[envIdx + 1] ?? '') : '';
  const files = planSeeds(env, { dev: argv.includes('--dev') });
  for (const file of files) {
    console.log(`Applying ${file} to ${env}…`);
    execFileSync('npx', wranglerArgs(env as SeedEnv, file), { stdio: 'inherit' });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
