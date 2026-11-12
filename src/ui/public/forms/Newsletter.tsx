import { Icon } from '../../icons/icon';
import { useNewsletter } from './useNewsletter';

/** Footer newsletter on night: a field and a separate Subscribe button (never one pill with a knob). Logic: useNewsletter. */
export default function Newsletter({ source }: { source: string }) {
  const { state, error, submit } = useNewsletter(source);
  if (state === 'sent') {
    return (
      <p role="status" className="mt-3 flex items-center gap-2 text-on-night">
        <Icon name="status-ok" className="text-gold-400" /> Check your inbox and confirm your subscription.
      </p>
    );
  }
  return (
    // method="post" keeps the address out of the URL if someone submits before hydration (the page ignores the POST).
    <form onSubmit={submit} method="post" noValidate className="kz-news mt-3">
      <label htmlFor="newsletter-email" className="kz-news__label">
        Occasional updates and new articles. Unsubscribe any time.
      </label>
      <div className="kz-news__row">
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
          className="kz-news__input"
        />
        <button type="submit" disabled={state === 'busy'} className="kz-btn kz-btn--secondary">
          {state === 'busy' ? <span className="kz-spinner" aria-hidden="true" /> : null}
          <span>Subscribe</span>
        </button>
      </div>
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error ? (
        <p id="newsletter-error" role="alert" className="flex items-center gap-2 text-small text-[#f2a58f]">
          <Icon name="status-danger" size={16} /> {error}
        </p>
      ) : null}
      <a href="/legal/privacy" className="kz-footer__link text-micro">
        How we handle your email address
      </a>
    </form>
  );
}
