import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEME_COOKIE, readTheme } from '../../src/ui/workspace/theme';

describe('workspace theme (R5.4)', () => {
  it('reads the cookie value, defaulting to light for anything but "dark"', () => {
    expect(THEME_COOKIE).toBe('kz_theme');
    expect(readTheme('dark')).toBe('dark');
    expect(readTheme('light')).toBe('light');
    expect(readTheme(undefined)).toBe('light');
    expect(readTheme('DARK')).toBe('light');
    expect(readTheme('<script>')).toBe('light');
  });

  it('scopes the dark tokens to the workspace body and keeps paper documents light', () => {
    const css = readFileSync('src/ui/tokens/workspace.css', 'utf8');
    expect(css).toContain("[data-theme='dark'] .kz-wsbody {");
    expect(css).toContain("[data-theme='dark'] .kz-wsbody .kz-doc {");
    // Nothing outside the workspace reacts to the attribute.
    for (const file of ['public.css', 'components.css', 'auth.css', 'documents.css'])
      expect(readFileSync(`src/ui/tokens/${file}`, 'utf8')).not.toContain('data-theme');
  });

  it('only the workspace layout renders the attribute, from the cookie', () => {
    const layout = readFileSync('src/layouts/PortalLayout.astro', 'utf8');
    expect(layout).toContain('Astro.cookies.get(THEME_COOKIE)');
    for (const file of ['PublicLayout.astro', 'AuthLayout.astro'])
      expect(readFileSync(`src/layouts/${file}`, 'utf8')).not.toMatch(/theme=\{/);
  });
});
