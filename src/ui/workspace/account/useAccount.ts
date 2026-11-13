/**
 * Logic of the workspace account page (extracted from the pre-R5.4 components/portal/PortalAccount.tsx and the portal uses of
 * components/admin/AccountActions.tsx, unchanged in behaviour): profile, email verification, 2FA management, devices.
 */
import { useState } from 'react';
import { ApiError, apiFetch } from '../../lib/api';

const failure = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');

export function useProfile() {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(f: FormData) {
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      await apiFetch('/api/v1/auth/portal/profile', {
        method: 'PUT',
        body: { name: String(f.get('name') ?? ''), phone: String(f.get('phone') ?? '') },
      });
      setMessage({ ok: true, text: 'Your details have been saved.' });
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fields);
      setMessage({ ok: false, text: failure(err) });
    } finally {
      setBusy(false);
    }
  }
  const field = (name: string) => errors[name]?.join(' ');
  return { save, busy, message, field };
}

export function useSendVerification() {
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const send = () => {
    setState('busy');
    apiFetch('/api/v1/auth/portal/email/send-verification', { method: 'POST', body: {} })
      .then(() => setState('sent'))
      .catch((err: unknown) => {
        setError(failure(err));
        setState('error');
      });
  };
  return { state, error, send };
}

/** Turn 2FA off or make new backup codes; both need the password + a code. */
export function useMfaManage() {
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
        await apiFetch('/api/v1/auth/portal/mfa/disable', { body });
        window.location.reload();
      } else {
        const res = await apiFetch<{ data: { backupCodes: string[] } }>('/api/v1/auth/portal/mfa/backup-codes', {
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
    setErrors({});
    setError(null);
  };
  const field = (name: string) => errors[name]?.join(' ');
  return { mode, open, submit, busy, error, field, codes };
}

/** Sign out one other device (reloads), or every device including this one (back to sign-in). */
export function useSessions() {
  const [busy, setBusy] = useState<string | null>(null);
  const revoke = (sessionId: string) => {
    setBusy(sessionId);
    void apiFetch(`/api/v1/auth/portal/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }).finally(() =>
      window.location.reload(),
    );
  };
  const signOutEverywhere = async () => {
    await apiFetch('/api/v1/auth/portal/logout-all', { method: 'POST', body: {} }).catch(() => undefined);
    window.location.assign('/portal/login');
  };
  return { busy, revoke, signOutEverywhere };
}
