/**
 * Workspace light/dark theme (R5.4, PANEL_DESIGN_SPEC §2 "remembered per device"). The choice lives in a plain cookie scoped to
 * /portal (1 year, SameSite=Lax, readable by the page: it holds no secret), so PortalLayout can render `data-theme` on <html>
 * server-side with no flash. Switching updates the attribute at once; no server call.
 */
import { useState } from 'react';

export type WorkspaceTheme = 'light' | 'dark';
export const THEME_COOKIE = 'kz_theme';

export function readTheme(value: string | undefined): WorkspaceTheme {
  return value === 'dark' ? 'dark' : 'light';
}

export function applyTheme(next: WorkspaceTheme) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${THEME_COOKIE}=${next}; Path=/portal; Max-Age=31536000; SameSite=Lax${secure}`;
  if (next === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  window.dispatchEvent(new CustomEvent('kz:theme', { detail: next }));
}

/** Current theme for a toggle control; starts from the server-rendered value. */
export function useTheme(initial: WorkspaceTheme) {
  const [theme, setTheme] = useState<WorkspaceTheme>(initial);
  const toggle = () => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const next: WorkspaceTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };
  return { theme, toggle };
}
