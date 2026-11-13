/** Staff account helpers for the admin user menu (logic of the P4.1 menu, extracted in R6.1). */
import { apiFetch } from '../lib/api';

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

export async function signOutAdmin(): Promise<void> {
  await apiFetch('/api/v1/auth/admin/logout', { method: 'POST', body: {} }).catch(() => undefined);
  window.location.assign('/admin/login');
}
