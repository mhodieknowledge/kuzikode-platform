/**
 * Logic of the admin account islands (R6.2 group 3), carried over unchanged from the pre-redesign
 * `components/admin/AccountActions.tsx`: mark notifications read, revoke sessions, manage two-factor (admin audience).
 */
import { useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';

const reload = () => window.location.reload();
const failure = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');

/** Marks the given notifications read (an empty list means all), then reloads. */
export function useMarkRead() {
  const [busy, setBusy] = useState<string | null>(null);
  const mark = (ids: string[]) => {
    setBusy(ids[0] ?? 'all');
    void apiFetch('/api/v1/admin/notifications/read', { body: { ids } }).finally(reload);
  };
  return { busy, mark };
}

export function useAdminSessions() {
  const [busy, setBusy] = useState<string | null>(null);
  const revoke = (id: string) => {
    setBusy(id);
    void apiFetch(`/api/v1/auth/admin/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }).finally(reload);
  };
  const signOutEverywhere = async () => {
    await apiFetch('/api/v1/auth/admin/logout-all', { method: 'POST', body: {} }).catch(() => undefined);
    window.location.assign('/admin/login');
  };
  return { busy, revoke, signOutEverywhere };
}

/** Turn 2FA off (only when the role does not require it) or get new backup codes; both need password + code. */
export function useAdminMfa() {
  const [mode, setMode] = useState<'disable' | 'codes' | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  async function submit(f: FormData) {
    const body = { password: f.get('password'), code: String(f.get('code') ?? '').replace(/\s/g, '') };
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      if (mode === 'disable') {
        await apiFetch('/api/v1/auth/admin/mfa/disable', { body });
        reload();
      } else {
        const res = await apiFetch<{ data: { backupCodes: string[] } }>('/api/v1/auth/admin/mfa/backup-codes', {
          body,
        });
        setCodes(res.data.backupCodes);
        setMode(null);
      }
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setError(failure(err));
    } finally {
      setBusy(false);
    }
  }
  const open = (m: 'disable' | 'codes' | null) => {
    setMode(m);
    setError(null);
    setErrors({});
  };
  const field = (name: string) => errors[name]?.join(' ');
  return { mode, open, submit, busy, error, codes, field };
}
