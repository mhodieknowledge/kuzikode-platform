/**
 * Sign-in and account-security forms for the admin and portal auth screens (R5.4, PANEL_DESIGN_SPEC §4), plus the change-password
 * form reused on the account pages. Markup only: the logic is in useAuthForms.ts. Field names, labels and button names are the
 * contract the e2e specs and the visual harness use (Email, Password, "Sign in", "Confirm new password", …): keep them.
 */
import type { FormEvent, ReactNode } from 'react';
import { Icon } from '../icons/icon';
import { Button, LinkButton, TextField } from '../primitives';
import { Turnstile } from '../public/forms/Turnstile';
import { FormAlert } from './FormAlert';
import { QrCode } from './QrCode';
import {
  type Audience,
  useChangePassword,
  useForgotPassword,
  useLogin,
  useMfaSetup,
  useMfaVerify,
  useRegister,
  useSetPassword,
  useVerifyEmail,
} from './useAuthForms';

const PASSWORD_HINT = 'At least 12 characters. Avoid common passwords and anything easy to guess.';
const data = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  return new FormData(e.currentTarget);
};

/** Success state that replaces a form: a check, a short title and what to do next. */
function Done({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="status" className="kz-done">
      <span className="kz-done__mark" aria-hidden="true">
        <Icon name="check" size={20} />
      </span>
      <h2 className="kz-done__title">{title}</h2>
      <div className="kz-done__body">{children}</div>
    </div>
  );
}

function Check({
  siteKey,
  onToken,
  reset,
  error,
}: {
  siteKey: string;
  onToken: (t: string | null) => void;
  reset: number;
  error: string | undefined;
}) {
  return (
    <div className="kz-authform__check">
      <Turnstile siteKey={siteKey} onToken={onToken} resetSignal={reset} />
      {error ? <p className="kz-error">{error}</p> : null}
    </div>
  );
}

/** Email + password. Turnstile only appears after the server asks for it (after repeated failures). */
export function LoginForm({ audience, next, siteKey }: { audience: Audience; next: string; siteKey: string }) {
  const s = useLogin(audience, next);
  return (
    <form onSubmit={(e) => void s.submit(data(e))} method="post" noValidate className="kz-authform">
      <FormAlert message={s.formError} />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        maxLength={254}
        required
        error={s.field('email')}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        maxLength={128}
        required
        error={s.field('password')}
      />
      {s.needsCheck ? (
        <Check siteKey={siteKey} onToken={s.check.onToken} reset={s.check.reset} error={s.field('turnstile')} />
      ) : null}
      <div className="kz-authform__go">
        <Button type="submit" size="lg" block loading={s.busy}>
          Sign in
        </Button>
        <a href={`/${audience}/forgot-password`} className="kz-authlink">
          Forgot your password?
        </a>
      </div>
    </form>
  );
}

export function ForgotPasswordForm({ audience }: { audience: Audience }) {
  const s = useForgotPassword(audience);
  if (s.message)
    return (
      <Done title="Check your email">
        <p>{s.message}</p>
      </Done>
    );
  return (
    <form onSubmit={(e) => void s.submit(data(e))} method="post" noValidate className="kz-authform">
      <FormAlert message={s.formError} />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        maxLength={254}
        required
        error={s.field('email')}
      />
      <Button type="submit" size="lg" block loading={s.busy}>
        Send reset link
      </Button>
    </form>
  );
}

/** Reset (from the email link) and accept-invitation share this form. */
export function SetPasswordForm({
  audience,
  token,
  mode,
}: {
  audience: Audience;
  token: string;
  mode: 'reset' | 'invite';
}) {
  const s = useSetPassword(token, mode);
  if (s.done)
    return (
      <Done title={mode === 'reset' ? 'Your password has been changed' : 'Your account is ready'}>
        <p>Sign in with your new password.</p>
        <LinkButton href={`/${audience}/login`} arrow className="kz-done__go">
          Sign in
        </LinkButton>
      </Done>
    );
  return (
    <form onSubmit={(e) => void s.submit(data(e))} method="post" noValidate className="kz-authform">
      <FormAlert message={s.formError} />
      <FormAlert message={s.field('token')} />
      {mode === 'invite' ? (
        <TextField
          label="Your name"
          name="name"
          autoComplete="name"
          maxLength={120}
          hint="Optional, if you want to change it"
          error={s.field('name')}
        />
      ) : null}
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        required
        hint={PASSWORD_HINT}
        error={s.field('password')}
      />
      <TextField
        label="Confirm new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        required
      />
      <Button type="submit" size="lg" block loading={s.busy}>
        {mode === 'reset' ? 'Change password' : 'Create account'}
      </Button>
    </form>
  );
}

/** Forced change after sign-in (auth screen) or a voluntary change on the account / security page. */
export function ChangePasswordForm({ audience, forced }: { audience: Audience; forced: boolean }) {
  const s = useChangePassword(audience, forced);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void s.submit(e.currentTarget);
      }}
      method="post"
      noValidate
      className="kz-authform"
    >
      {s.done ? (
        <p role="status" className="kz-okline">
          <Icon name="status-ok" size={20} />
          <span>Password changed. Your other sessions have been signed out.</span>
        </p>
      ) : null}
      <FormAlert message={s.formError} />
      <TextField
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        maxLength={128}
        required
        error={s.field('currentPassword')}
      />
      <TextField
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        required
        hint={PASSWORD_HINT}
        error={s.field('newPassword')}
      />
      <TextField
        label="Confirm new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        required
      />
      <div className={forced ? undefined : 'kz-authform__bar'}>
        <Button
          type="submit"
          size={forced ? 'lg' : 'md'}
          block={forced}
          variant={forced ? 'primary' : 'secondary'}
          loading={s.busy}
        >
          Change password
        </Button>
      </div>
    </form>
  );
}

export function MfaVerifyForm({ audience, next }: { audience: Audience; next: string }) {
  const s = useMfaVerify(audience, next);
  return (
    <form onSubmit={(e) => void s.submit(data(e))} method="post" noValidate className="kz-authform">
      <FormAlert message={s.formError} />
      <TextField
        label="Authentication code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={20}
        required
        className="kz-authform__code"
        hint="The 6-digit code from your app, or one of your backup codes."
        error={s.field('code')}
      />
      <Button type="submit" size="lg" block loading={s.busy}>
        Verify
      </Button>
    </form>
  );
}

/** Backup codes, shown once (after enrolment or when new ones are made). */
export function BackupCodes({ codes }: { codes: string[] }) {
  return (
    <ol className="kz-codes" aria-label="Backup codes">
      {codes.map((c) => (
        <li key={c}>{c}</li>
      ))}
    </ol>
  );
}

/** 2FA enrolment: QR code + manual key → confirm with a code → backup codes once. */
export function MfaSetupForm({ audience, after }: { audience: Audience; after: string }) {
  const s = useMfaSetup(audience);
  if (s.codes)
    return (
      <Done title="Two-factor authentication is on">
        <p>
          Save these backup codes somewhere safe. Each one works once if you lose your phone. They will not be shown
          again.
        </p>
        <BackupCodes codes={s.codes} />
        <LinkButton href={after} arrow className="kz-done__go">
          Continue
        </LinkButton>
      </Done>
    );
  if (!s.secret)
    return (
      <div className="kz-authform">
        <FormAlert message={s.formError} />
        <p className="kz-authform__lead">
          You will need an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.
        </p>
        <Button type="button" size="lg" block loading={s.busy} onClick={() => void s.start()}>
          Set up two-factor authentication
        </Button>
      </div>
    );
  return (
    <form onSubmit={(e) => void s.confirm(data(e))} method="post" noValidate className="kz-authform">
      <FormAlert message={s.formError} />
      <ol className="kz-mfasteps">
        <li>
          <span className="kz-mfasteps__n" aria-hidden="true">
            1
          </span>
          <div className="kz-mfasteps__body">
            <p>Scan this QR code with your authenticator app.</p>
            <QrCode value={s.secret.otpauthUri} label="QR code for your authenticator app" />
            <p className="kz-mfasteps__key">
              Can't scan it? Enter this key instead: <code>{s.secret.secret}</code>
            </p>
          </div>
        </li>
        <li>
          <span className="kz-mfasteps__n" aria-hidden="true">
            2
          </span>
          <div className="kz-mfasteps__body">
            <p>Enter the 6-digit code the app shows.</p>
            <TextField
              label="Code from the app"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              required
              className="kz-authform__code"
              error={s.field('code')}
            />
          </div>
        </li>
      </ol>
      <Button type="submit" size="lg" block loading={s.busy}>
        Turn on two-factor authentication
      </Button>
    </form>
  );
}

/** Optional portal self-registration (only rendered when the setting is on). */
export function RegisterForm({ siteKey }: { siteKey: string }) {
  const s = useRegister();
  if (s.message)
    return (
      <Done title="Check your email">
        <p>{s.message}</p>
        <p>Once your account is set up, our team links it to your company. Until then the portal stays empty.</p>
      </Done>
    );
  return (
    <form onSubmit={(e) => void s.submit(data(e))} method="post" noValidate className="kz-authform">
      <FormAlert message={s.formError} />
      <TextField label="Your name" name="name" autoComplete="name" maxLength={120} required error={s.field('name')} />
      <TextField
        label="Company"
        name="company"
        autoComplete="organization"
        maxLength={160}
        hint="Optional. Helps us link your account to the right client."
        error={s.field('company')}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        required
        error={s.field('email')}
      />
      <Check siteKey={siteKey} onToken={s.check.onToken} reset={s.check.reset} error={s.field('turnstile')} />
      <Button type="submit" size="lg" block loading={s.busy}>
        Create account
      </Button>
    </form>
  );
}

export function VerifyEmailForm({ audience, token }: { audience: Audience; token: string }) {
  const s = useVerifyEmail(token);
  if (s.done)
    return (
      <Done title="Your email is confirmed">
        <LinkButton href={`/${audience}`} arrow className="kz-done__go">
          Continue
        </LinkButton>
      </Done>
    );
  return (
    <div className="kz-authform">
      <FormAlert message={s.field('token') ?? s.formError} />
      <Button size="lg" block loading={s.busy} onClick={() => void s.confirm()}>
        Confirm my email address
      </Button>
    </div>
  );
}
