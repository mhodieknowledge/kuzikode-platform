import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** Cloudflare's documented dummy site keys: no real challenge is needed in tests and local development. */
const isTestKey = (k: string) => /^[123]x0{20}A[AB]$/.test(k);

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('turnstile failed to load'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Cloudflare Turnstile widget (bot protection). Reports a token via onToken; null when it expires or fails. */
export function Turnstile({
  siteKey,
  onToken,
  resetSignal = 0,
}: {
  siteKey: string;
  onToken: (t: string | null) => void;
  resetSignal?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  const test = isTestKey(siteKey);

  useEffect(() => {
    if (test) {
      onToken(siteKey.startsWith('1x') ? 'XXXX.DUMMY.TOKEN.XXXX' : null);
      return;
    }
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return;
        widget.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          callback: (t: string) => onToken(t),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
          appearance: 'interaction-only',
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
    };
  }, [siteKey, test, onToken]);

  useEffect(() => {
    if (resetSignal && widget.current) window.turnstile?.reset(widget.current);
  }, [resetSignal]);

  if (test) return null;
  return (
    <div>
      <div ref={box} />
      {failed ? (
        <p role="alert" className="text-[13px] text-danger-600">
          The security check could not load. Check your connection and refresh the page.
        </p>
      ) : null}
    </div>
  );
}
