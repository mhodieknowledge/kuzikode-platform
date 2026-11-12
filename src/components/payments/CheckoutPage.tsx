/**
 * Kuzikode's own checkout (docs/06 §3b), shared by `/pay/[invoiceToken]` and `/portal/invoices/[id]/pay`. It renders only
 * from the page's `CheckoutView` (methods of the routed account) and the attempt views our API returns: no gateway
 * names or gateway-specific branches. Every gateway detail (prompt text, wallet code, OTP step, card page) arrives as
 * normalized fields.
 *
 * Cards (docs/06 §3b): a saved card is charged right here (express). A new card is entered once in the gateway's
 * secure window, opened as a centred popup straight from the click; the checkout stays behind it, polls, and hears back
 * from `/pay/card-return` (postMessage, plus a BroadcastChannel in case the opener link was lost). If the popup is
 * blocked or the screen is narrow, the card page opens in this tab and returns to `/pay/card-return`.
 */
import { CheckCircle2, Clock, CreditCard, Landmark, Smartphone, Wallet, XCircle, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { ApiError, Button, Field, Input, QrCode, Spinner, apiFetch, cn, newIdempotencyKey } from '../ui';
import { Turnstile } from '../../ui/public/forms/Turnstile';
import { formatMoney } from '../../shared/money';
import { normalizeZimPhone, walletDeepLink } from '../../shared/payment-methods';

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

/** The message `/pay/card-return` sends to the checkout that opened the card window. */
export const CARD_RETURN_MESSAGE = 'kuzikode:card-return';
export const CARD_RETURN_CHANNEL = 'kuzikode-card-return';
const CARD_WINDOW = { name: 'kuzikode_card', width: 480, height: 720, minScreen: 640 };

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

const cardLabel = (c: CheckoutSavedCard) => (c.last4 ? `${c.brand} •••• ${c.last4}` : c.brand);
const cardExpiry = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { month: '2-digit', year: '2-digit', timeZone: 'Africa/Harare' }).format(
        new Date(iso),
      )
    : null;

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

/** `AttemptStart` from the pay / OTP endpoints, plus the URLs the server gave us for this attempt. */
interface StartView {
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
interface StatusView {
  id: string;
  phase: Phase;
  message: string;
  payment: { id: string; receiptNumber: string } | null;
  links?: { receipt: string | null };
}

type Phase = 'waiting' | 'succeeded' | 'failed';
type Stage = 'choose' | 'waiting' | 'done' | 'bank';

const POLL_MS = 3000;
const WAIT_LIMIT_MS = 10 * 60_000;
const BANK = 'bank_transfer';

/** Our status endpoint's view of the attempt (null when the request failed; the next poll tries again). */
const fetchStatus = (url: string) =>
  apiFetch<{ data: StatusView }>(url)
    .then((res) => res.data)
    .catch(() => null);

/** Wall-clock time for the countdown (only ever read in effects and event handlers). */
const nowMs = () => Date.now();

const needsPhone = (m: CheckoutMethod | undefined) => !!m?.needs.includes('phone');

function methodIcon(m: CheckoutMethod): LucideIcon {
  if (m.flow === 'redirect') return CreditCard;
  return needsPhone(m) ? Smartphone : Wallet;
}

function methodHint(m: CheckoutMethod, savedCards: number): string {
  if (m.flow === 'redirect')
    return savedCards
      ? 'Pay with your saved card or add a new one.'
      : "Enter your card once in our payment partner's secure window.";
  if (m.needs.includes('otp')) return 'We send a one-time code to your phone to confirm.';
  if (needsPhone(m)) return 'Approve the prompt on your phone with your PIN.';
  return 'Get a code to approve in your wallet app.';
}

const clock = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }).format(
    new Date(iso),
  );

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function CheckoutPage(p: CheckoutProps) {
  const money = (m: number) => formatMoney(m, p.currency, p.minorDigits);
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

  const phase: Phase | null = stage === 'done' ? (status?.phase ?? null) : stage === 'waiting' ? 'waiting' : null;
  const receiptHref =
    status?.payment &&
    (publicPage ? (status.links?.receipt ?? null) : `/api/v1/portal/payments/${status.payment.id}/receipt`);

  if (!options.length || p.amountDueMinor <= 0) {
    return (
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="pay-h">
        <h2 id="pay-h" className="text-lg font-semibold">
          {p.amountDueMinor <= 0 ? 'Nothing to pay' : 'Online payment is not available right now'}
        </h2>
        <p className="mt-2 text-[15px] text-ink-800">
          {p.amountDueMinor <= 0
            ? `Invoice ${p.invoiceNumber} has no balance to pay.`
            : 'Please try again later, or contact us and we will help you pay.'}
        </p>
        <a href={p.backHref} className="mt-4 inline-block font-semibold text-brand-600 underline underline-offset-2">
          Back to invoice {p.invoiceNumber}
        </a>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5" aria-labelledby="pay-h">
      {p.testMode ? (
        <p className="rounded-sm border border-warning-600/40 bg-warning-50 px-4 py-2 text-sm font-semibold text-warning-700">
          TEST PAYMENT: no real money moves.
        </p>
      ) : null}
      <div role="status" aria-live="polite" className="sr-only">
        {phase === 'waiting'
          ? confirming
            ? 'Confirming your payment.'
            : 'Waiting for approval.'
          : phase === 'succeeded'
            ? 'Payment received.'
            : phase === 'failed'
              ? `Payment not completed. ${status?.message ?? ''}`
              : ''}
      </div>

      {stage === 'choose' || stage === 'bank' ? (
        <div className="rounded-lg border border-line bg-surface p-5 md:p-6">
          <h2 id="pay-h" className="text-lg font-semibold">
            Choose how to pay
          </h2>
          <fieldset className="mt-4">
            <legend className="sr-only">Payment method</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {options.map((m) => {
                const Icon = m.code === BANK ? Landmark : methodIcon(m);
                const checked = selected === m.code;
                return (
                  <label
                    key={m.code}
                    className={cn(
                      'flex min-h-[64px] cursor-pointer items-start gap-3 rounded-md border bg-surface px-4 py-3 transition-colors',
                      'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500',
                      checked ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-ink-400',
                    )}
                  >
                    <input
                      type="radio"
                      name="method"
                      value={m.code}
                      checked={checked}
                      onChange={() => {
                        setSelected(m.code);
                        setStage(m.code === BANK ? 'bank' : 'choose');
                        setErrors({});
                        setFormError(null);
                      }}
                      className="sr-only"
                    />
                    <Icon size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-600" />
                    <span className="flex flex-col">
                      <span className="font-semibold text-ink-950">{m.name}</span>
                      <span className="text-[13px] text-ink-600">
                        {m.code === BANK ? 'Pay from your bank, then let us know.' : methodHint(m, savedCards.length)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {stage === 'bank' && p.bankTransfer ? (
            <BankPanel
              bank={p.bankTransfer}
              amount={money(p.amountDueMinor)}
              endpoint={p.endpoints.bankNotice}
              publicPage={publicPage}
              {...(p.turnstileSiteKey ? { siteKey: p.turnstileSiteKey } : {})}
            />
          ) : method ? (
            <form
              className="mt-5 flex flex-col gap-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void pay();
              }}
            >
              {needsPhone(method) ? (
                <Field
                  label={`${method.name} number`}
                  hint="The mobile number of the wallet you are paying from."
                  error={errors['phone']}
                  required
                >
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0771 234 567"
                  />
                </Field>
              ) : null}
              {method.flow === 'redirect' && savedCards.length ? (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium text-ink-950">Card</legend>
                  {[...savedCards, null].map((c) => {
                    const value = c ? c.id : 'new';
                    const checked = cardChoice === value;
                    return (
                      <label
                        key={value}
                        className={cn(
                          'flex min-h-[48px] cursor-pointer items-center gap-3 rounded-sm border px-3 py-2',
                          'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500',
                          checked ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-ink-400',
                        )}
                      >
                        <input
                          type="radio"
                          name="card"
                          value={value}
                          checked={checked}
                          onChange={() => setCardChoice(value)}
                          className="size-4 accent-brand-600"
                        />
                        <CreditCard size={18} aria-hidden="true" className="shrink-0 text-brand-600" />
                        <span className="flex flex-col text-sm">
                          <span className="font-semibold text-ink-950">{c ? cardLabel(c) : 'Use a new card'}</span>
                          {c?.expiresAt ? (
                            <span className="text-[13px] text-ink-600">Saved · expires {cardExpiry(c.expiresAt)}</span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              ) : null}
              {errors['savedCardId'] ? (
                <p className="text-[13px] font-medium text-danger-600">{errors['savedCardId'].join(' ')}</p>
              ) : null}
              {method.flow === 'redirect' && canSaveCard && cardChoice === 'new' ? (
                <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-sm text-ink-800">
                  <input
                    type="checkbox"
                    checked={saveCard}
                    onChange={(e) => setSaveCard(e.target.checked)}
                    className="mt-0.5 size-4 accent-brand-600"
                  />
                  <span>
                    Save this card for faster payments next time. Only a secure token from our payment partner is kept,
                    never your card number.
                  </span>
                </label>
              ) : null}
              {errors['methodCode'] ? (
                <p className="text-[13px] font-medium text-danger-600">{errors['methodCode'].join(' ')}</p>
              ) : null}
              {publicPage && p.turnstileSiteKey ? (
                <Turnstile siteKey={p.turnstileSiteKey} onToken={onToken} resetSignal={reset} />
              ) : null}
              {errors['turnstile'] ? (
                <p className="text-[13px] font-medium text-danger-600">{errors['turnstile'].join(' ')}</p>
              ) : null}
              {formError ? (
                <p role="alert" className="text-sm font-medium text-danger-600">
                  {formError}
                </p>
              ) : null}
              <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">
                Pay {money(p.amountDueMinor)}
              </Button>
              {method.flow === 'redirect' ? (
                <p className="text-[13px] text-ink-600">
                  {savedCards.some((c) => c.id === cardChoice)
                    ? 'Your saved card is charged right here. No card details are needed.'
                    : "For your security, card details are entered once in our payment partner's secure window. Kuzikode never sees your card number."}
                </p>
              ) : null}
            </form>
          ) : (
            <p className="mt-4 text-sm text-ink-600">Select a method to continue.</p>
          )}
        </div>
      ) : null}

      {stage === 'waiting' && attempt ? (
        <div className="rounded-lg border border-line bg-surface p-5 md:p-6">
          <div className="flex items-start gap-3">
            {gaveUp ? (
              <Clock size={26} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-600" />
            ) : (
              <Spinner size={26} label="" />
            )}
            <div className="min-w-0">
              <h2 id="pay-h" className="text-xl font-bold tracking-display">
                {gaveUp
                  ? 'Still waiting?'
                  : confirming
                    ? 'Confirming your payment'
                    : inCardWindow
                      ? 'Complete card entry in the secure window…'
                      : 'Waiting for approval'}
              </h2>
              <p className="mt-1 text-[15px] text-ink-800">
                {gaveUp
                  ? 'We have not had a confirmation yet. If you approved the payment, it will show on your invoice as soon as it is confirmed.'
                  : inCardWindow
                    ? "For your security, card details are entered once in our payment partner's secure window. Kuzikode never sees your card number."
                    : (attempt.instructions?.text ?? attempt.message)}
              </p>
              {inCardWindow && windowClosed && !confirming ? (
                <p className="mt-2 text-[13px] text-ink-600" data-testid="card-window-closed">
                  Closed the secure window before finishing? Open it again, or choose another method.
                </p>
              ) : null}
              {!gaveUp ? (
                <p className="mt-1 text-[13px] text-ink-600 tabular-nums">
                  {money(p.amountDueMinor)} · checking for {mmss(WAIT_LIMIT_MS - (now - startedAt))} more
                </p>
              ) : null}
            </div>
          </div>

          {attempt.instructions?.authorizationCode ? (
            <WalletCode
              code={attempt.instructions.authorizationCode}
              expiresAt={attempt.instructions.authorizationExpiresAt}
              methodCode={attempt.methodCode}
              methodName={method?.name ?? 'wallet'}
            />
          ) : null}

          {attempt.instructions?.otpRequired && attempt.otpUrl ? (
            <OtpForm
              url={attempt.otpUrl}
              onDone={(d) => {
                setAttempt({ ...attempt, ...d, statusUrl: attempt.statusUrl, otpUrl: attempt.otpUrl });
                setStatus({ id: d.attemptId, phase: d.phase, message: d.message, payment: null });
                // Stay on "Confirming" until our status endpoint reports the outcome (with the receipt).
                setConfirming(true);
                setStartedAt(nowMs());
              }}
            />
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            {gaveUp ? (
              <Button
                onClick={() => {
                  setStartedAt(nowMs());
                  setNow(nowMs());
                }}
              >
                Check again
              </Button>
            ) : null}
            {inCardWindow && !confirming ? <Button onClick={reopenCardWindow}>Open secure window</Button> : null}
            <Button variant="secondary" onClick={() => backToChoose(false)}>
              Choose another method
            </Button>
          </div>
        </div>
      ) : null}

      {stage === 'done' && status ? (
        <div className="rounded-lg border border-line bg-surface p-5 md:p-6">
          <div className="flex items-start gap-3">
            {status.phase === 'succeeded' ? (
              <CheckCircle2 size={28} aria-hidden="true" className="mt-0.5 shrink-0 text-success-600" />
            ) : (
              <XCircle size={28} aria-hidden="true" className="mt-0.5 shrink-0 text-danger-600" />
            )}
            <div className="min-w-0">
              <h2 id="pay-h" className="text-xl font-bold tracking-display">
                {status.phase === 'succeeded' ? 'Payment received' : 'Payment not completed'}
              </h2>
              <p className="mt-1 text-[15px] text-ink-800">{status.message}</p>
            </div>
          </div>
          {status.phase === 'succeeded' ? (
            <>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 rounded-md bg-canvas px-4 py-3 text-sm">
                <dt className="text-ink-600">Amount</dt>
                <dd className="font-mono font-semibold tabular-nums text-ink-950">{money(p.amountDueMinor)}</dd>
                <dt className="text-ink-600">Invoice</dt>
                <dd className="font-mono text-ink-950">{p.invoiceNumber}</dd>
                {status.payment ? (
                  <>
                    <dt className="text-ink-600">Receipt</dt>
                    <dd className="font-mono text-ink-950">{status.payment.receiptNumber}</dd>
                  </>
                ) : null}
              </dl>
              <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {receiptHref ? (
                  <a href={receiptHref} download className="font-semibold text-brand-600 underline underline-offset-2">
                    Download receipt (PDF)
                  </a>
                ) : null}
                <a href={p.backHref} className="font-semibold text-brand-600 underline underline-offset-2">
                  Back to invoice {p.invoiceNumber}
                </a>
              </p>
            </>
          ) : (
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={() => backToChoose(true)}>Try again</Button>
              <Button variant="secondary" onClick={() => backToChoose(false)}>
                Choose another method
              </Button>
            </div>
          )}
        </div>
      ) : null}

      <p className="text-center text-[12px] text-ink-600">
        Payments are processed securely by our payment partner. Kuzikode never sees or stores your PIN or card number.
      </p>
    </section>
  );
}

/** Wallet authorization code (e.g. InnBucks): the code, a QR drawn in our page, the app link and the expiry. */
function WalletCode({
  code,
  expiresAt,
  methodCode,
  methodName,
}: {
  code: string;
  expiresAt: string | null;
  methodCode: string | null;
  methodName: string;
}) {
  const link = walletDeepLink(methodCode, code);
  return (
    <div className="mt-5 flex flex-col items-center gap-4 rounded-md bg-canvas px-4 py-5 text-center sm:flex-row sm:text-left">
      <QrCode value={code} size={168} label={`QR code for ${methodName} payment code ${code}`} />
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-600">Payment code</p>
        <p className="font-mono text-3xl font-bold tracking-wider text-ink-950" data-testid="wallet-code">
          {code}
        </p>
        {expiresAt ? <p className="text-[13px] text-ink-600">Valid until {clock(expiresAt)} (Harare time)</p> : null}
        {link ? (
          <a
            href={link}
            className="inline-flex h-11 items-center justify-center rounded-sm bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            Open {methodName} app
          </a>
        ) : null}
      </div>
    </div>
  );
}

/** One-time code: 6 boxes, auto-advance, backspace goes back, paste fills all. Submitted to our OTP endpoint. */
function OtpForm({ url, onDone }: { url: string; onDone: (d: StartView) => void }) {
  const LEN = 6;
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''));
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
      setDigits(Array(LEN).fill(''));
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
    if (d && i < LEN - 1) boxes.current[i + 1]?.focus();
    if (next.every(Boolean)) void submit(next.join(''));
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const code = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN);
    if (!code) return;
    e.preventDefault();
    const next = Array.from({ length: LEN }, (_, i) => code[i] ?? '');
    setDigits(next);
    boxes.current[Math.min(code.length, LEN - 1)]?.focus();
    if (code.length === LEN) void submit(code);
  }

  return (
    <form
      className="mt-5 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (digits.every(Boolean)) void submit(digits.join(''));
      }}
    >
      <fieldset>
        <legend className="text-sm font-medium text-ink-950">One-time code from the SMS</legend>
        <div className="mt-2 flex gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                boxes.current[i] = el;
              }}
              value={d}
              onChange={(e) => set(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
              onPaste={onPaste}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              aria-label={`Digit ${i + 1} of ${LEN}`}
              aria-invalid={error ? true : undefined}
              disabled={busy}
              className="h-12 w-11 rounded-sm border border-line bg-surface text-center font-mono text-xl text-ink-950 focus-visible:border-brand-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
            />
          ))}
        </div>
      </fieldset>
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-danger-600">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={busy} disabled={!digits.every(Boolean)} className="self-start">
        Confirm code
      </Button>
    </form>
  );
}

/** Bank details + "I've paid, notify Kuzikode" (a note for finance; nothing is marked paid). */
function BankPanel({
  bank,
  amount,
  endpoint,
  publicPage,
  siteKey,
}: {
  bank: { details: string; reference: string };
  amount: string;
  endpoint: string;
  publicPage: boolean;
  siteKey?: string;
}) {
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

  return (
    <div className="mt-5 flex flex-col gap-4">
      <p className="text-sm text-ink-800">
        Transfer <strong className="tabular-nums">{amount}</strong> and use{' '}
        <strong className="font-mono">{bank.reference}</strong> as the reference:
      </p>
      <p className="whitespace-pre-line rounded-sm bg-canvas px-4 py-3 font-mono text-sm text-ink-950">
        {bank.details}
      </p>
      {sent ? (
        <p
          role="status"
          className="rounded-sm border border-success-600/30 bg-success-50 px-4 py-3 text-sm text-ink-950"
        >
          Thank you. We have told our finance team. Your invoice is updated once the transfer arrives in our account,
          usually within one to two working days.
        </p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void notify();
          }}
        >
          <p className="text-sm text-ink-800">Already paid? Let us know so we can look out for it.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Paid by (name on the account)">
              <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} maxLength={120} />
            </Field>
            <Field label="Bank reference (optional)">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} />
            </Field>
          </div>
          {publicPage && siteKey ? <Turnstile siteKey={siteKey} onToken={onToken} resetSignal={reset} /> : null}
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger-600">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="secondary" loading={busy} className="self-start">
            I've paid, notify Kuzikode
          </Button>
        </form>
      )}
    </div>
  );
}
