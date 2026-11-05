import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch } from '../ui';

/** Footer newsletter sign-up (docs/12 §C.10): double opt-in, so success means "check your inbox". */
export default function NewsletterForm({ source }: { source: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState('busy');
    setError(null);
    try {
      await apiFetch('/api/v1/public/newsletter', {
        body: { email: f.get('email'), source, website: f.get('website') },
      });
      setState('sent');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.fields['email']?.join(' ') ?? err.message)
          : 'Something went wrong. Please try again.',
      );
      setState('idle');
    }
  }

  if (state === 'sent') {
    return (
      <p role="status" className="mt-4 text-sm text-white">
        Check your inbox and confirm your subscription.
      </p>
    );
  }
  return (
    // method="post" keeps the address out of the URL if someone submits before hydration (the page ignores the POST).
    <form onSubmit={submit} method="post" noValidate className="mt-4 flex flex-col gap-2">
      <label htmlFor="newsletter-email" className="text-sm text-white/70">
        Occasional updates and new articles. Unsubscribe any time.
      </label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="you@example.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'newsletter-error' : undefined}
          className="h-10 min-w-0 flex-1 rounded-sm border border-white/20 bg-white/5 px-3 text-sm text-white placeholder:text-white/40 focus-visible:border-white focus-visible:outline-2 focus-visible:outline-white"
        />
        <button
          type="submit"
          disabled={state === 'busy'}
          className="inline-flex h-10 items-center rounded-sm bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-60"
        >
          Subscribe
        </button>
      </div>
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error ? (
        <p id="newsletter-error" role="alert" className="text-[13px] font-medium text-danger-50">
          {error}
        </p>
      ) : null}
      <p className="text-[12px] text-white/50">
        <a href="/legal/privacy" className="underline hover:text-white">
          How we handle your email address
        </a>
      </p>
    </form>
  );
}
