import { Icon } from '../../icons/icon';
import { useNewsletter } from './useNewsletter';

/** Footer newsletter field on sign: one pill input with the submit knob inside it. */
export default function Newsletter({ source }: { source: string }) {
  const { state, error, submit } = useNewsletter(source);
  if (state === 'sent') {
    return (
      <p role="status" className="mt-3 flex items-center gap-2 text-white">
        <Icon name="status-ok" className="text-[#5ed6a0]" /> Check your inbox and confirm your subscription.
      </p>
    );
  }
  return (
    // method="post" keeps the address out of the URL if someone submits before hydration (the page ignores the POST).
    <form onSubmit={submit} method="post" noValidate className="mt-3 grid gap-2">
      <label htmlFor="newsletter-email" className="text-small text-on-sign-2">
        Occasional updates and new articles. Unsubscribe any time.
      </label>
      <div className="relative">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          enterKeyHint="send"
          required
          maxLength={254}
          placeholder="you@example.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'newsletter-error' : undefined}
          className="min-h-[52px] w-full rounded-full border border-sign-700 bg-sign-900 py-3 pr-[120px] pl-5 text-[1.0625rem] text-white placeholder:text-on-sign-3 focus-visible:border-mint-400 focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={state === 'busy'}
          className="kz-btn kz-btn--primary kz-btn--sm absolute top-1.5 right-1.5 bottom-1.5 min-h-0"
        >
          {state === 'busy' ? <span className="kz-spinner" aria-hidden="true" /> : null}
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
        <p id="newsletter-error" role="alert" className="flex items-center gap-2 text-small text-[#ffb4ab]">
          <Icon name="status-danger" size={16} /> {error}
        </p>
      ) : null}
      <a href="/legal/privacy" className="text-micro text-on-sign-3 underline underline-offset-4 hover:text-white">
        How we handle your email address
      </a>
    </form>
  );
}
