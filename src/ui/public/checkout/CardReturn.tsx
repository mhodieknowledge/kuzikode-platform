/**
 * Where the gateway's card window lands (`/pay/card-return`, docs/06 §3b), rebuilt for R4.8. Opened as the checkout's popup, it
 * tells the checkout (same origin only: postMessage to the opener, and a BroadcastChannel in case the opener link was lost) and
 * closes itself. Opened in the same tab (popup blocked, small screen), it shows the live status with the receipt link.
 * Behaviour unchanged from the old island.
 */
import { useEffect, useState } from 'react';
import { Icon } from '../../icons/icon';
import { AttemptResult } from './AttemptResult';
import type { AttemptView } from './useAttemptStatus';
import { CARD_RETURN_CHANNEL, CARD_RETURN_MESSAGE } from './useCheckout';

/** Reports the return to the checkout that opened this window; true once the window should have closed itself. */
function useReportToOpener(attemptId: string) {
  const [inPopup, setInPopup] = useState(false);
  useEffect(() => {
    const msg = { type: CARD_RETURN_MESSAGE, attemptId };
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
  }, [attemptId]);
  return inPopup;
}

export function CardReturn({ initial }: { initial: AttemptView }) {
  const inPopup = useReportToOpener(initial.id);
  return (
    <div className="kz-coattempt-wrap">
      {inPopup ? (
        <p role="status" className="kz-cotest kz-cotest--info">
          <Icon name="status-info" size={20} />
          <span>Card entry is complete. You can close this window and return to the checkout.</span>
        </p>
      ) : null}
      <AttemptResult initial={initial} />
    </div>
  );
}

export default CardReturn;
