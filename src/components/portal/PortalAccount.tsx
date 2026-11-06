/** Portal account pieces (P5.1): the header menu, the profile form and the "verify your email" action. */
import { ChevronDown } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch, Button, DropdownMenu, Field, Input } from '../ui';

export function PortalUserMenu({ name, email }: { name: string; email: string }) {
  async function signOut() {
    await apiFetch('/api/v1/auth/portal/logout', { method: 'POST', body: {} }).catch(() => undefined);
    window.location.assign('/portal/login');
  }
  return (
    <DropdownMenu
      trigger={
        <button
          type="button"
          className="inline-flex h-10 max-w-[14rem] items-center gap-2 rounded-sm px-2 text-left hover:bg-ink-950/5"
        >
          <span className="sr-only">Account menu: </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink-950">{name}</span>
            <span className="hidden truncate text-[12px] text-ink-600 sm:block">{email}</span>
          </span>
          <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-ink-600" />
        </button>
      }
      items={[
        { label: 'Your account', href: '/portal/account' },
        { label: 'Signed-in devices', href: '/portal/account/sessions' },
        { label: 'Sign out', onSelect: () => void signOut(), danger: true },
      ]}
    />
  );
}

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
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
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setMessage({ ok: false, text: err.message });
      } else setMessage({ ok: false, text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-5">
      {message ? (
        <p
          role={message.ok ? 'status' : 'alert'}
          className={
            message.ok
              ? 'rounded-sm bg-success-50 px-4 py-3 text-sm text-success-700'
              : 'rounded-sm border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700'
          }
        >
          {message.text}
        </p>
      ) : null}
      <Field label="Name" required error={errors['name']}>
        <Input name="name" autoComplete="name" defaultValue={name} maxLength={120} />
      </Field>
      <Field label="Phone" hint="Optional. Include the country code, e.g. +263 77 123 4567." error={errors['phone']}>
        <Input name="phone" type="tel" autoComplete="tel" defaultValue={phone} maxLength={40} />
      </Field>
      <div>
        <Button type="submit" loading={busy}>
          Save details
        </Button>
      </div>
    </form>
  );
}

export function SendVerificationButton() {
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  if (state === 'sent')
    return (
      <p role="status" className="text-sm text-success-700">
        We have sent you a link. It expires in 24 hours.
      </p>
    );
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          variant="secondary"
          loading={state === 'busy'}
          onClick={() => {
            setState('busy');
            apiFetch('/api/v1/auth/portal/email/send-verification', { method: 'POST', body: {} })
              .then(() => setState('sent'))
              .catch((err: unknown) => {
                setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
                setState('error');
              });
          }}
        >
          Send verification email
        </Button>
      </div>
      {state === 'error' ? (
        <p role="alert" className="text-sm text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
