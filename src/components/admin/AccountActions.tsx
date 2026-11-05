import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch, Button, ConfirmDialog, Field, Input } from '../ui';

const reload = () => window.location.reload();

export function MarkAllReadButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={busy}
      onClick={() => {
        setBusy(true);
        void apiFetch('/api/v1/admin/notifications/read', { body: { ids: [] } }).finally(reload);
      }}
    >
      Mark all as read
    </Button>
  );
}

/** Revoke one other session, or every session (which signs this browser out too). */
export function SessionActions({ sessionId }: { sessionId?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (sessionId)
    return (
      <Button
        variant="secondary"
        size="sm"
        loading={busy}
        onClick={() => {
          setBusy(true);
          void apiFetch(`/api/v1/auth/admin/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }).finally(
            reload,
          );
        }}
      >
        Sign out
      </Button>
    );
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Sign out everywhere
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Sign out of every device?"
        description="This signs out every session, including this one. You will need to sign in again."
        confirmLabel="Sign out everywhere"
        destructive
        onConfirm={async () => {
          await apiFetch('/api/v1/auth/admin/logout-all', { method: 'POST', body: {} }).catch(() => undefined);
          window.location.assign('/admin/login');
        }}
      />
    </>
  );
}

/** Turn 2FA off (only when the role does not require it) or get new backup codes; both need password + code. */
export function MfaManage({ canDisable }: { canDisable: boolean }) {
  const [mode, setMode] = useState<'disable' | 'codes' | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
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
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(err.message);
      } else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {codes ? (
        <div role="status" className="rounded-md bg-canvas p-4">
          <p className="text-sm font-semibold text-ink-950">New backup codes. Your old codes no longer work.</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5" aria-label="Backup codes">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {mode ? (
        <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-4">
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger-600">
              {error}
            </p>
          ) : null}
          <Field label="Password" required error={errors['password']}>
            <Input name="password" type="password" autoComplete="current-password" maxLength={128} />
          </Field>
          <Field label="Authentication code" required error={errors['code']}>
            <Input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={20} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant={mode === 'disable' ? 'danger' : 'primary'} loading={busy}>
              {mode === 'disable' ? 'Turn off two-factor authentication' : 'Create new backup codes'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setMode('codes')}>
            New backup codes
          </Button>
          {canDisable ? (
            <Button variant="ghost" onClick={() => setMode('disable')}>
              Turn off
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
