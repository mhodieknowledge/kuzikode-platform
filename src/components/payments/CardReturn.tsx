/**
 * Where the gateway's card window lands (`/pay/card-return`, docs/06 §3b). Opened as the checkout's popup, it tells the
 * checkout (same origin only: postMessage to the opener, and a BroadcastChannel in case the opener link was lost) and
 * closes itself. Opened in the same tab (popup blocked, small screen), it shows the live status with the receipt link.
 */
import { useEffect, useState } from 'react';
import { AttemptStatus, type AttemptView } from '../portal/AttemptStatus';
import { CARD_RETURN_CHANNEL, CARD_RETURN_MESSAGE } from './CheckoutPage';

export function CardReturn({ initial }: { initial: AttemptView }) {
  const [inPopup, setInPopup] = useState(false);

  useEffect(() => {
    const msg = { type: CARD_RETURN_MESSAGE, attemptId: initial.id };
    let opener: Window | null = null;
    try {
      opener = window.opener && !window.opener.closed ? (window.opener as Window) : null;
      // Reading the opener's origin throws unless it is our own page.
      if (opener && opener.location.origin !== window.location.origin) opener = null;
    } catch {
      opener = null;
    }
    try {
      const channel = new BroadcastChannel(CARD_RETURN_CHANNEL);
      channel.postMessage(msg);
      channel.close();
    } catch {
      // No BroadcastChannel: the checkout still sees the result by polling.
    }
    if (!opener) return;
    opener.postMessage(msg, window.location.origin);
    // Give the message a moment, then close (allowed: the checkout opened this window). If the browser keeps the
    // window open, say where to go.
    const t = window.setTimeout(() => {
      setInPopup(true);
      window.close();
    }, 300);
    return () => window.clearTimeout(t);
  }, [initial.id]);

  return (
    <div className="flex flex-col gap-4">
      {inPopup ? (
        <p role="status" className="text-sm text-ink-800">
          Card entry is complete. You can close this window and return to the checkout.
        </p>
      ) : null}
      <AttemptStatus initial={initial} />
    </div>
  );
}
