/**
 * Checkout logic (docs/06 §3b), extracted unchanged from the old CheckoutPage (BRIEF B.0: logic reused, UI rebuilt). It renders
 * nothing: `Checkout.tsx` draws the states this hook exposes. Shared by `/pay/[invoiceToken]` and `/portal/invoices/[id]/pay`.
 * It works only from the page's `CheckoutView` and the attempt views our API returns: no gateway names or gateway-specific
 * branches. Every gateway detail (prompt text, wallet code, OTP step, card page) arrives as normalized fields.
 *
 * Cards (docs/06 §3b): a saved card is charged right here (express). A new card is entered once in the gateway's secure window,
 * opened as a centred popup straight from the click; the checkout stays behind it, polls, and hears back from `/pay/card-return`
 * (postMessage, plus a BroadcastChannel in case the opener link was lost). If the popup is blocked or the screen is narrow, the
 * card page opens in this tab and returns to `/pay/card-return`.
 */
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { ApiError, apiFetch, newIdempotencyKey } from '../../lib/api';
import { normalizeZimPhone } from '../../../shared/payment-methods';

export interface CheckoutMethod {
  code: string;
  name: string;
  flow: 'redirect' | 'express';
  needs: string[];
}

/** A saved card as the server shows it: never the token. */
export interface CheckoutSavedCard {
  id: string;
  brand: string;
  last4: string | null;
  expiresAt: string | null;
  isDefault: boolean;
}

export interface CheckoutProps {
  mode: 'public' | 'portal';
  currency: string;
  minorDigits: number;
  amountDueMinor: number;
  invoiceNumber: string;
  methods: CheckoutMethod[];
  bankTransfer: { details: string; reference: string } | null;
  phone: string | null;
  /** Portal only: saved cards and whether a new card may be saved. */
  cards?: { saved: CheckoutSavedCard[]; canSave: boolean };
  testMode: boolean;
  endpoints: { pay: string; bankNotice: string };
  /** The invoice page to go back to. */
  backHref: string;
  /** Public pages only: Turnstile protects the pay action. */
  turnstileSiteKey?: string;
}

export type Phase = 'waiting' | 'succeeded' | 'failed';
export type Stage = 'choose' | 'waiting' | 'done' | 'bank';

/** `AttemptStart` from the pay / OTP endpoints, plus the URLs the server gave us for this attempt. */
export interface StartView {
  attemptId: string;
  phase: Phase;
  message: string;
  flow: 'redirect' | 'express';
  methodCode: string | null;
  redirectUrl: string | null;
  instructions: {
    text: string | null;
    authorizationCode: string | null;
    authorizationExpiresAt: string | null;
    otpRequired: boolean;
  } | null;
  testMode: boolean;
  statusUrl?: string;
  otpUrl?: string;
}

/** The status endpoint's view (portal or signed public). */
export interface StatusView {
  id: string;
  phase: Phase;
  message: string;
  payment: { id: string; receiptNumber: string } | null;
  links?: { receipt: string | null };
}

/** The message `/pay/card-return` sends to the checkout that opened the card window. */
export const CARD_RETURN_MESSAGE = 'kuzikode:card-return';
export const CARD_RETURN_CHANNEL = 'kuzikode-card-return';
const CARD_WINDOW = { name: 'kuzikode_card', width: 480, height: 720, minScreen: 640 };

export const BANK = 'bank_transfer';
export const WAIT_LIMIT_MS = 10 * 60_000;
const POLL_MS = 3000;

/** Opens (or reuses) the centred card window. Must run inside the click handler, or browsers block it. */
function openCardWindow(url: string): Window | null {
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - CARD_WINDOW.width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - CARD_WINDOW.height) / 2));
  try {
    return window.open(
      url,
      CARD_WINDOW.name,
      `popup=yes,width=${CARD_WINDOW.width},height=${CARD_WINDOW.height},left=${left},top=${top}`,
    );
  } catch {
    return null;
  }
}

/** Our status endpoint's view of the attempt (null when the request failed; the next poll tries again). */
const fetchStatus = (url: string) =>
  apiFetch<{ data: StatusView }>(url)
    .then((res) => res.data)
    .catch(() => null);

/** Wall-clock time for the countdown (only ever read in effects and event handlers). */
const nowMs = () => Date.now();

export const needsPhone = (m: CheckoutMethod | undefined) => !!m?.needs.includes('phone');

export function useCheckout(p: CheckoutProps) {
  const options: CheckoutMethod[] = [
    ...p.methods,
    ...(p.bankTransfer ? [{ code: BANK, name: 'Bank transfer', flow: 'express' as const, needs: [] }] : []),
  ];
  const [selected, setSelected] = useState<string>(options.length === 1 ? options[0]!.code : '');
  const [phone, setPhone] = useState(p.phone ?? '');
  const [stage, setStage] = useState<Stage>('choose');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<StartView | null>(null);
  const [status, setStatus] = useState<StatusView | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [pollTick, setPollTick] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const savedCards = p.cards?.saved ?? [];
  const canSaveCard = !!p.cards?.canSave;
  const [cardChoice, setCardChoice] = useState<string>(savedCards[0]?.id ?? 'new');
  const [saveCard, setSaveCard] = useState(false);
  const [windowClosed, setWindowClosed] = useState(false);
  const cardWindow = useRef<Window | null>(null);
  const lock = useRef(false);
  const onToken = useCallback((t: string | null) => setToken(t), []);
  const method = options.find((m) => m.code === selected);
  const publicPage = p.mode === 'public';

  const waiting = stage === 'waiting';
  const gaveUp = waiting && now - startedAt >= WAIT_LIMIT_MS;
  const inCardWindow = waiting && attempt?.flow === 'redirect';

  // Live status: poll our endpoint every 3 s for up to 10 minutes (the server asks the gateway at most every 5 s).
  useEffect(() => {
    if (!waiting || gaveUp || !attempt?.statusUrl) return;
    const url = attempt.statusUrl;
    const t = window.setTimeout(() => {
      void fetchStatus(url)
        .then((d) => {
          if (!d) return;
          setStatus(d);
          if (d.phase !== 'waiting') setStage('done');
        })
        .finally(() => setPollTick((n) => n + 1));
    }, POLL_MS);
    return () => window.clearTimeout(t);
  }, [waiting, gaveUp, attempt?.statusUrl, pollTick]);

  // The card window reports back when the gateway returns (same origin only), so the result shows at once.
  useEffect(() => {
    if (!inCardWindow || !attempt?.statusUrl) return;
    const url = attempt.statusUrl;
    const id = attempt.attemptId;
    const onReturn = (data: unknown) => {
      const d = data as { type?: unknown; attemptId?: unknown } | null;
      if (!d || d.type !== CARD_RETURN_MESSAGE || d.attemptId !== id) return;
      setConfirming(true);
      void fetchStatus(url).then((s) => {
        if (!s) return;
        setStatus(s);
        if (s.phase !== 'waiting') setStage('done');
      });
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin) onReturn(e.data);
    };
    window.addEventListener('message', onMessage);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CARD_RETURN_CHANNEL);
      channel.onmessage = (e: MessageEvent) => onReturn(e.data);
    } catch {
      channel = null;
    }
    // Notice when the customer closes the card window without finishing.
    const watch = window.setInterval(() => {
      if (cardWindow.current?.closed) setWindowClosed(true);
    }, 1000);
    return () => {
      window.removeEventListener('message', onMessage);
      channel?.close();
      window.clearInterval(watch);
    };
  }, [inCardWindow, attempt?.statusUrl, attempt?.attemptId]);

  // The result is on our page now: the card window is no longer needed.
  useEffect(() => {
    if (stage !== 'waiting' && cardWindow.current && !cardWindow.current.closed) {
      cardWindow.current.close();
      cardWindow.current = null;
    }
  }, [stage]);

  // Countdown tick.
  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(() => setNow(nowMs()), 1000);
    return () => window.clearInterval(t);
  }, [waiting]);

  async function pay() {
    if (lock.current || !method || method.code === BANK) return;
    setErrors({});
    setFormError(null);
    if (needsPhone(method) && !normalizeZimPhone(phone)) {
      setErrors({ phone: ['Enter a Zimbabwean mobile number, like 0771 234 567.'] });
      return;
    }
    if (publicPage && !token) {
      setErrors({ turnstile: ['Complete the security check and try again.'] });
      return;
    }
    const isCard = method.flow === 'redirect';
    const savedCard = isCard ? savedCards.find((c) => c.id === cardChoice) : undefined;
    // A new card: open the secure window now, from the click (browsers block popups opened later), and point it at
    // the gateway's card page once we have it. Narrow screens use this tab instead.
    let win: Window | null = null;
    if (isCard && !savedCard && window.innerWidth >= CARD_WINDOW.minScreen) {
      win = openCardWindow('');
      try {
        if (win) win.document.title = 'Secure card payment';
      } catch {
        // Not ours to touch any more; fine.
      }
    }
    lock.current = true;
    setBusy(true);
    let leaving = false;
    let handedOff = false;
    try {
      const res = await apiFetch<{ data: StartView }>(p.endpoints.pay, {
        body: {
          methodCode: method.code,
          ...(needsPhone(method) ? { phone } : {}),
          ...(savedCard ? { savedCardId: savedCard.id } : {}),
          ...(isCard && !savedCard && canSaveCard && saveCard ? { saveCard: true } : {}),
          ...(publicPage ? { turnstileToken: token } : {}),
        },
        idempotencyKey: newIdempotencyKey(),
      });
      const d = res.data;
      if (d.phase === 'waiting' && d.redirectUrl) {
        if (win && !win.closed) {
          // Card entry in the secure window on top of our checkout, which waits and polls behind it.
          win.location.href = d.redirectUrl;
          cardWindow.current = win;
          handedOff = true;
          setWindowClosed(false);
        } else {
          // Popup blocked or a small screen: the card page opens here and returns to /pay/card-return.
          leaving = true;
          window.location.assign(d.redirectUrl);
          return;
        }
      }
      setAttempt(d);
      setStatus({ id: d.attemptId, phase: d.phase, message: d.message, payment: null });
      setConfirming(false);
      setStartedAt(nowMs());
      setNow(nowMs());
      setStage(d.phase === 'waiting' ? 'waiting' : 'done');
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      else setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      if (win && !handedOff && !leaving && !win.closed) win.close();
      if (!leaving) {
        lock.current = false;
        setBusy(false);
        if (publicPage) setReset((n) => n + 1);
      }
    }
  }

  function reopenCardWindow() {
    const url = attempt?.redirectUrl;
    if (!url) return;
    const win = window.innerWidth >= CARD_WINDOW.minScreen ? openCardWindow(url) : null;
    if (!win) {
      window.location.assign(url);
      return;
    }
    cardWindow.current = win;
    setWindowClosed(false);
    win.focus();
  }

  function backToChoose(keepMethod: boolean) {
    setStage('choose');
    setAttempt(null);
    setStatus(null);
    setErrors({});
    setFormError(null);
    if (!keepMethod) setSelected('');
  }

  /** Picking a method tile (bank transfer opens the bank panel instead of the pay form). */
  function choose(code: string) {
    setSelected(code);
    setStage(code === BANK ? 'bank' : 'choose');
    setErrors({});
    setFormError(null);
  }

  /** The OTP was accepted: stay on "Confirming" until our status endpoint reports the outcome (with the receipt). */
  function otpAccepted(d: StartView) {
    if (!attempt) return;
    setAttempt({ ...attempt, ...d, statusUrl: attempt.statusUrl, otpUrl: attempt.otpUrl });
    setStatus({ id: d.attemptId, phase: d.phase, message: d.message, payment: null });
    setConfirming(true);
    setStartedAt(nowMs());
  }

  /** "Check again" after the 10-minute window: restart the polling window. */
  function checkAgain() {
    setStartedAt(nowMs());
    setNow(nowMs());
  }

  const phase: Phase | null = stage === 'done' ? (status?.phase ?? null) : stage === 'waiting' ? 'waiting' : null;
  const receiptHref =
    status?.payment &&
    (publicPage ? (status.links?.receipt ?? null) : `/api/v1/portal/payments/${status.payment.id}/receipt`);

  return {
    options,
    method,
    selected,
    choose,
    phone,
    setPhone,
    stage,
    busy,
    errors,
    formError,
    attempt,
    status,
    phase,
    receiptHref,
    confirming,
    gaveUp,
    inCardWindow,
    windowClosed,
    remainingMs: WAIT_LIMIT_MS - (now - startedAt),
    savedCards,
    canSaveCard,
    cardChoice,
    setCardChoice,
    saveCard,
    setSaveCard,
    publicPage,
    onToken,
    reset,
    pay,
    reopenCardWindow,
    backToChoose,
    otpAccepted,
    checkAgain,
  };
}

const OTP_LEN = 6;

/** One-time code: 6 boxes, auto-advance, backspace goes back, paste fills all. Submitted to our OTP endpoint. */
export function useOtp(url: string, onDone: (d: StartView) => void) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  async function submit(code: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: StartView }>(url, { body: { otp: code } });
      onDone(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError ? (err.fields['otp']?.join(' ') ?? err.message) : 'Something went wrong. Try again.',
      );
      setDigits(Array(OTP_LEN).fill(''));
      boxes.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  function set(i: number, v: string) {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < OTP_LEN - 1) boxes.current[i + 1]?.focus();
    if (next.every(Boolean)) void submit(next.join(''));
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const code = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN);
    if (!code) return;
    e.preventDefault();
    const next = Array.from({ length: OTP_LEN }, (_, i) => code[i] ?? '');
    setDigits(next);
    boxes.current[Math.min(code.length, OTP_LEN - 1)]?.focus();
    if (code.length === OTP_LEN) void submit(code);
  }

  const complete = digits.every(Boolean);
  return {
    length: OTP_LEN,
    digits,
    busy,
    error,
    boxes,
    complete,
    set,
    onKey,
    onPaste,
    submitAll: () => {
      if (complete) void submit(digits.join(''));
    },
  };
}

/** Bank transfer "I've paid, notify Kuzikode": a note for finance; nothing is marked paid. */
export function useBankNotice(endpoint: string, publicPage: boolean) {
  const [payerName, setPayerName] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const onToken = useCallback((t: string | null) => setToken(t), []);

  async function notify() {
    if (busy) return;
    if (publicPage && !token) {
      setError('Complete the security check and try again.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(endpoint, {
        body: {
          ...(payerName.trim() ? { payerName: payerName.trim() } : {}),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(publicPage ? { turnstileToken: token } : {}),
        },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      if (publicPage) setReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  return { payerName, setPayerName, reference, setReference, busy, sent, error, onToken, reset, notify };
}
