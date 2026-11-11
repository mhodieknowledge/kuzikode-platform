/** The package must stay extractable: no imports of the app or of non-portable modules (docs/06 §0). */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', 'src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });

describe('package boundaries', () => {
  it('imports only its own files (no app code, no Node built-ins, no dependencies)', () => {
    const bad: string[] = [];
    for (const f of files(root)) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bfrom\s+'([^']+)'|import\(\s*'([^']+)'\s*\)/g)) {
        const spec = m[1] ?? m[2]!;
        const local = spec.startsWith('./') || (spec.startsWith('../') && !join(f, '..', spec).includes('/src/../'));
        const resolved = join(f, '..', spec);
        if (!local || !resolved.startsWith(root)) bad.push(`${f.slice(root.length)} → ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
