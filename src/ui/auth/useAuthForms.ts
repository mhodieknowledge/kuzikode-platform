/**
 * Logic of the sign-in and account-security forms (extracted from the pre-R5.4 components/auth/AuthForms.tsx, unchanged in
 * behaviour). Every call goes to /api/v1/auth/<audience>/…; the server enforces lockout, Turnstile after failures, password rules
 * and 2FA. The markup lives in AuthForms.tsx beside this file.
 */
import { useCallback, useState } from 'react';
import { ApiError, apiFetch } from '../lib/api';

export type Audience = 'admin' | 'portal';
const base = (a: Audience) => `/api/v1/auth/${a}`;
const go = (href: string) => window.location.assign(href);
const code = (f: FormData, name = 'code') => String(f.get(name) ?? '').replace(/\s/g, '');

/** Runs a submit: busy flag, field errors (422) and one form-level message. */
export function useAuthSubmit() {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(
          err.status === 422 && Object.keys(err.fields).length ? 'Please check the highlighted fields.' : err.message,
        );
      } else setFormError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const field = (name: string) => errors[name]?.join(' ');
  return { errors, field, formError, busy, run, setFormError };
}

/** Turnstile state for forms that show the check (always for sign-up, after failures for sign-in). */
function useCheck() {
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const onToken = useCallback((t: string | null) => setToken(t), []);
  return { token, reset, onToken, again: () => setReset((n) => n + 1) };
}

interface LoginData {
  data: { mustChangePassword: boolean; mfaRequired: boolean; mfaEnrolmentRequired: boolean };
}

export function useLogin(audience: Audience, next: string) {
  const s = useAuthSubmit();
  const check = useCheck();
  const [needsCheck, setNeedsCheck] = useState(false);
  const submit = (f: FormData) =>
    s.run(async () => {
      try {
        const res = await apiFetch<LoginData>(`${base(audience)}/login`, {
          body: { email: f.get('email'), password: f.get('password'), turnstileToken: check.token ?? undefined },
        });
        const d = res.data;
        go(
          d.mustChangePassword
            ? `/${audience}/password`
            : d.mfaRequired
              ? `/${audience}/mfa?next=${encodeURIComponent(next)}`
              : d.mfaEnrolmentRequired
                ? `/${audience}/mfa/setup`
                : next,
        );
      } catch (err) {
        if (err instanceof ApiError && err.fields['turnstile']) setNeedsCheck(true);
        check.again();
        throw err;
      }
    });
  return { ...s, submit, needsCheck, check };
}

export function useForgotPassword(audience: Audience) {
  const s = useAuthSubmit();
  const [message, setMessage] = useState<string | null>(null);
  const submit = (f: FormData) =>
    s.run(async () => {
      const res = await apiFetch<{ data: { message: string } }>(`${base(audience)}/password/forgot`, {
        body: { email: f.get('email') },
      });
      setMessage(res.data.message);
    });
  return { ...s, submit, message };
}

/** Reset (from the email link) and accept-invitation: token + new password (+ name for invitations). */
export function useSetPassword(token: string, mode: 'reset' | 'invite') {
  const s = useAuthSubmit();
  const [done, setDone] = useState(false);
  const submit = async (f: FormData) => {
    if (f.get('password') !== f.get('confirm')) {
      s.setFormError('The two passwords do not match.');
      return;
    }
    await s.run(async () => {
      if (mode === 'reset') {
        await apiFetch('/api/v1/auth/password/reset', { body: { token, password: f.get('password') } });
      } else {
        const name = String(f.get('name') ?? '').trim();
        await apiFetch('/api/v1/auth/invitations/accept', {
          body: { token, password: f.get('password'), ...(name ? { name } : {}) },
        });
      }
      setDone(true);
    });
  };
  return { ...s, submit, done };
}

export function useChangePassword(audience: Audience, forced: boolean) {
  const s = useAuthSubmit();
  const [done, setDone] = useState(false);
  const submit = async (form: HTMLFormElement) => {
    const f = new FormData(form);
    setDone(false);
    if (f.get('newPassword') !== f.get('confirm')) {
      s.setFormError('The two new passwords do not match.');
      return;
    }
    await s.run(async () => {
      await apiFetch(`${base(audience)}/password/change`, {
        body: { currentPassword: f.get('currentPassword'), newPassword: f.get('newPassword') },
      });
      if (forced) go(`/${audience}`);
      else {
        form.reset();
        setDone(true);
      }
    });
  };
  return { ...s, submit, done };
}

export function useMfaVerify(audience: Audience, next: string) {
  const s = useAuthSubmit();
  const submit = (f: FormData) =>
    s.run(async () => {
      await apiFetch(`${base(audience)}/mfa/verify`, { body: { code: code(f) } });
      go(next);
    });
  return { ...s, submit };
}

/** 2FA enrolment: start (secret + otpauth URI) → confirm with a code → backup codes, shown once. */
export function useMfaSetup(audience: Audience) {
  const s = useAuthSubmit();
  const [secret, setSecret] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const start = () =>
    s.run(async () => {
      const res = await apiFetch<{ data: { secret: string; otpauthUri: string } }>(`${base(audience)}/mfa/enrol`, {
        method: 'POST',
        body: {},
      });
      setSecret(res.data);
    });
  const confirm = (f: FormData) =>
    s.run(async () => {
      const res = await apiFetch<{ data: { backupCodes: string[] } }>(`${base(audience)}/mfa/enrol/confirm`, {
        body: { code: code(f) },
      });
      setCodes(res.data.backupCodes);
    });
  return { ...s, secret, codes, start, confirm };
}

/** Optional portal self-registration; the password is chosen from the email link. */
export function useRegister() {
  const s = useAuthSubmit();
  const check = useCheck();
  const [message, setMessage] = useState<string | null>(null);
  const submit = (f: FormData) => {
    const company = String(f.get('company') ?? '').trim();
    return s.run(async () => {
      try {
        const res = await apiFetch<{ data: { message: string } }>('/api/v1/auth/portal/register', {
          body: {
            name: String(f.get('name') ?? ''),
            email: f.get('email'),
            ...(company ? { company } : {}),
            turnstileToken: check.token ?? undefined,
          },
        });
        setMessage(res.data.message);
      } catch (err) {
        check.again();
        throw err;
      }
    });
  };
  return { ...s, submit, message, check };
}

/** Confirms an email address from the verification link (one click, so link scanners can't use it up). */
export function useVerifyEmail(token: string) {
  const s = useAuthSubmit();
  const [done, setDone] = useState(false);
  const confirm = () =>
    s.run(async () => {
      await apiFetch('/api/v1/auth/email/verify', { body: { token } });
      setDone(true);
    });
  return { ...s, confirm, done };
}
