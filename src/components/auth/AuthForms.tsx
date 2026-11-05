/**
 * Sign-in and account-security forms shared by the admin and portal areas (docs/07 §2). Every form talks to
 * /api/v1/auth/<audience>/…; the server enforces lockout, Turnstile after failures, password rules and 2FA.
 */
import { CheckCircle2 } from 'lucide-react';
import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, apiFetch, Button, Field, Input, QrCode } from '../ui';
import { Turnstile } from '../forms/Turnstile';

type Audience = 'admin' | 'portal';
const base = (a: Audience) => `/api/v1/auth/${a}`;

function useSubmit() {
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
  return { errors, formError, busy, run, setFormError };
}

function FormAlert({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-sm border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700">
      {message}
    </p>
  ) : null;
}

function Done({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-start gap-3">
      <CheckCircle2 size={28} className="text-success-600" aria-hidden="true" />
      <h2 className="text-xl font-bold tracking-display">{title}</h2>
      <div className="text-[15px] text-ink-600">{children}</div>
    </div>
  );
}

const go = (href: string) => window.location.assign(href);

interface LoginData {
  data: { mustChangePassword: boolean; mfaRequired: boolean; mfaEnrolmentRequired: boolean };
}

/** Email + password. Shows Turnstile only after the server asks for it (after repeated failures). */
export function LoginForm({ audience, next, siteKey }: { audience: Audience; next: string; siteKey: string }) {
  const s = useSubmit();
  const [needsCheck, setNeedsCheck] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const onToken = useCallback((t: string | null) => setToken(t), []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await s.run(async () => {
      try {
        const res = await apiFetch<LoginData>(`${base(audience)}/login`, {
          body: { email: f.get('email'), password: f.get('password'), turnstileToken: token ?? undefined },
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
        setReset((n) => n + 1);
        throw err;
      }
    });
  }

  return (
    <form onSubmit={submit} method="post" noValidate className="flex flex-col gap-5">
      <FormAlert message={s.formError} />
      <Field label="Email" required error={s.errors['email']}>
        <Input name="email" type="email" autoComplete="username" maxLength={254} />
      </Field>
      <Field label="Password" required error={s.errors['password']}>
        <Input name="password" type="password" autoComplete="current-password" maxLength={128} />
      </Field>
      {needsCheck ? (
        <div className="flex flex-col gap-1">
          <Turnstile siteKey={siteKey} onToken={onToken} resetSignal={reset} />
          {s.errors['turnstile'] ? (
            <p className="text-[13px] font-medium text-danger-600">{s.errors['turnstile'].join(' ')}</p>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" size="lg" loading={s.busy}>
        Sign in
      </Button>
      <a
        href={`/${audience}/forgot-password`}
        className="text-sm font-semibold text-brand-600 underline underline-offset-2"
      >
        Forgot your password?
      </a>
    </form>
  );
}

export function ForgotPasswordForm({ audience }: { audience: Audience }) {
  const s = useSubmit();
  const [message, setMessage] = useState<string | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await s.run(async () => {
      const res = await apiFetch<{ data: { message: string } }>(`${base(audience)}/password/forgot`, {
        body: { email: f.get('email') },
      });
      setMessage(res.data.message);
    });
  }
  if (message)
    return (
      <Done title="Check your email">
        <p>{message}</p>
      </Done>
    );
  return (
    <form onSubmit={submit} method="post" noValidate className="flex flex-col gap-5">
      <FormAlert message={s.formError} />
      <Field label="Email" required error={s.errors['email']}>
        <Input name="email" type="email" autoComplete="username" maxLength={254} />
      </Field>
      <Button type="submit" size="lg" loading={s.busy}>
        Send reset link
      </Button>
    </form>
  );
}

const PASSWORD_HINT = 'At least 12 characters. Avoid common passwords and anything easy to guess.';

/** Reset (from email link) and accept-invitation share this: token + new password (+ name for invitations). */
export function SetPasswordForm({
  audience,
  token,
  mode,
}: {
  audience: Audience;
  token: string;
  mode: 'reset' | 'invite';
}) {
  const s = useSubmit();
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
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
  }
  if (done)
    return (
      <Done title={mode === 'reset' ? 'Your password has been changed' : 'Your account is ready'}>
        <p>
          <a href={`/${audience}/login`} className="font-semibold text-brand-600 underline underline-offset-2">
            Sign in
          </a>{' '}
          with your new password.
        </p>
      </Done>
    );
  return (
    <form onSubmit={submit} method="post" noValidate className="flex flex-col gap-5">
      <FormAlert message={s.formError} />
      {s.errors['token'] ? <FormAlert message={s.errors['token'].join(' ')} /> : null}
      {mode === 'invite' ? (
        <Field label="Your name" hint="Optional, if you want to change it" error={s.errors['name']}>
          <Input name="name" autoComplete="name" maxLength={120} />
        </Field>
      ) : null}
      <Field label="New password" required hint={PASSWORD_HINT} error={s.errors['password']}>
        <Input name="password" type="password" autoComplete="new-password" maxLength={128} />
      </Field>
      <Field label="Confirm new password" required>
        <Input name="confirm" type="password" autoComplete="new-password" maxLength={128} />
      </Field>
      <Button type="submit" size="lg" loading={s.busy}>
        {mode === 'reset' ? 'Change password' : 'Create account'}
      </Button>
    </form>
  );
}

export function ChangePasswordForm({ audience, forced }: { audience: Audience; forced: boolean }) {
  const s = useSubmit();
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
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
  }
  return (
    <form onSubmit={submit} method="post" noValidate className="flex flex-col gap-5">
      {done ? (
        <p role="status" className="rounded-sm bg-success-50 px-4 py-3 text-sm text-success-700">
          Password changed. Your other sessions have been signed out.
        </p>
      ) : null}
      <FormAlert message={s.formError} />
      <Field label="Current password" required error={s.errors['currentPassword']}>
        <Input name="currentPassword" type="password" autoComplete="current-password" maxLength={128} />
      </Field>
      <Field label="New password" required hint={PASSWORD_HINT} error={s.errors['newPassword']}>
        <Input name="newPassword" type="password" autoComplete="new-password" maxLength={128} />
      </Field>
      <Field label="Confirm new password" required>
        <Input name="confirm" type="password" autoComplete="new-password" maxLength={128} />
      </Field>
      <div>
        <Button type="submit" size="lg" loading={s.busy}>
          Change password
        </Button>
      </div>
    </form>
  );
}

export function MfaVerifyForm({ audience, next }: { audience: Audience; next: string }) {
  const s = useSubmit();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await s.run(async () => {
      await apiFetch(`${base(audience)}/mfa/verify`, {
        body: { code: String(f.get('code') ?? '').replace(/\s/g, '') },
      });
      go(next);
    });
  }
  return (
    <form onSubmit={submit} method="post" noValidate className="flex flex-col gap-5">
      <FormAlert message={s.formError} />
      <Field
        label="Authentication code"
        required
        hint="The 6-digit code from your app, or one of your backup codes."
        error={s.errors['code']}
      >
        <Input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={20} />
      </Field>
      <Button type="submit" size="lg" loading={s.busy}>
        Verify
      </Button>
    </form>
  );
}

/** 2FA enrolment: QR code + manual key → confirm with a code → show backup codes once. */
export function MfaSetupForm({ audience, after }: { audience: Audience; after: string }) {
  const s = useSubmit();
  const [secret, setSecret] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  async function start() {
    await s.run(async () => {
      const res = await apiFetch<{ data: { secret: string; otpauthUri: string } }>(`${base(audience)}/mfa/enrol`, {
        method: 'POST',
        body: {},
      });
      setSecret(res.data);
    });
  }
  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await s.run(async () => {
      const res = await apiFetch<{ data: { backupCodes: string[] } }>(`${base(audience)}/mfa/enrol/confirm`, {
        body: { code: String(f.get('code') ?? '').replace(/\s/g, '') },
      });
      setCodes(res.data.backupCodes);
    });
  }

  if (codes)
    return (
      <Done title="Two-factor authentication is on">
        <p>
          Save these backup codes somewhere safe. Each one works once if you lose your phone. They will not be shown
          again.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-[15px] text-ink-950" aria-label="Backup codes">
          {codes.map((c) => (
            <li key={c} className="rounded-sm bg-canvas px-3 py-1.5">
              {c}
            </li>
          ))}
        </ul>
        <a href={after} className="mt-6 inline-flex font-semibold text-brand-600 underline underline-offset-2">
          Continue
        </a>
      </Done>
    );
  if (!secret)
    return (
      <div className="flex flex-col gap-4">
        <FormAlert message={s.formError} />
        <p className="text-[15px] text-ink-600">
          You will need an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.
        </p>
        <div>
          <Button type="button" size="lg" loading={s.busy} onClick={() => void start()}>
            Set up two-factor authentication
          </Button>
        </div>
      </div>
    );
  return (
    <form onSubmit={confirm} method="post" noValidate className="flex flex-col gap-5">
      <FormAlert message={s.formError} />
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] text-ink-800">
        <li>Scan this QR code with your authenticator app.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <QrCode value={secret.otpauthUri} label="QR code for your authenticator app" />
      <p className="text-[13px] text-ink-600">
        Can't scan it? Enter this key instead:{' '}
        <code className="rounded-sm bg-canvas px-1.5 py-0.5 font-mono text-ink-950 break-all">{secret.secret}</code>
      </p>
      <Field label="Code from the app" required error={s.errors['code']}>
        <Input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} />
      </Field>
      <div>
        <Button type="submit" size="lg" loading={s.busy}>
          Turn on two-factor authentication
        </Button>
      </div>
    </form>
  );
}
