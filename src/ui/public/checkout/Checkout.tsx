/**
 * Kuzikode's own checkout (docs/06 §3b), rebuilt from scratch for R4.8. Logic lives in `useCheckout` (unchanged behaviour); this
 * file only draws its states. References: IMG_5018 (icon-over-label method tiles, form beside a sticky summary), IMG_5016
 * (phone number first for mobile money, the fee on its own line before the total), IMG_5014 (receipt ticket with a perforated
 * edge, no countdown pressure), IMG_5013 (the bill above selectable payment methods, money in mono).
 *
 * Stages: choose (tiles + the selected method's step) · bank (tiles + bank slip) · waiting (road strip: done / now in gold /
 * next) · done (receipt or "not completed"). Emerald is used only for the one primary action of each stage.
 */
import { Icon, type IconName } from '../../icons/icon';
import { Button, CheckRow, Field, LinkButton } from '../../primitives';
import { formatMoney } from '../../../shared/money';
import { Turnstile } from '../forms/Turnstile';
import { BankPanel } from './BankPanel';
import { OtpBoxes } from './OtpBoxes';
import { Ledger, RoadStrip, mmss, type Stop } from './parts';
import {
  BANK,
  needsPhone,
  useCheckout,
  type CheckoutMethod,
  type CheckoutProps,
  type CheckoutSavedCard,
  type StartView,
} from './useCheckout';
import { WalletCode } from './WalletCode';

export type { CheckoutMethod, CheckoutProps, CheckoutSavedCard } from './useCheckout';

const cardLabel = (c: CheckoutSavedCard) => (c.last4 ? `${c.brand} •••• ${c.last4}` : c.brand);
const cardExpiry = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { month: '2-digit', year: '2-digit', timeZone: 'Africa/Harare' }).format(
        new Date(iso),
      )
    : null;

function methodIcon(m: CheckoutMethod): IconName {
  if (m.code === BANK) return 'bank';
  if (m.flow === 'redirect') return 'pay';
  return needsPhone(m) ? 'smartphone' : 'wallet';
}

/** The short line under a tile's name: how this method is approved. */
function methodTag(m: CheckoutMethod): string {
  if (m.code === BANK) return 'From your bank';
  if (m.flow === 'redirect') return 'Secure window';
  if (m.needs.includes('otp')) return 'Code by SMS';
  if (needsPhone(m)) return 'Prompt on phone';
  return 'Code for the app';
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

/** The middle stop of the road: what the payer does now. */
function actionStop(attempt: StartView | null): string {
  if (attempt?.flow === 'redirect') return 'Card entry';
  if (attempt?.instructions?.otpRequired) return 'Code from SMS';
  if (attempt?.instructions?.authorizationCode) return 'Approve in app';
  return 'Approve on phone';
}

const joined = (e: string[] | undefined) => (e?.length ? e.join(' ') : undefined);

export function Checkout(p: CheckoutProps) {
  const c = useCheckout(p);
  const money = (m: number) => formatMoney(m, p.currency, p.minorDigits);
  const amount = money(p.amountDueMinor);
  const { method, attempt, status } = c;

  if (!c.options.length || p.amountDueMinor <= 0) {
    return (
      <section className="kz-copay" aria-labelledby="pay-h">
        <div className="kz-copanel kz-copanel--quiet">
          <Icon name={p.amountDueMinor <= 0 ? 'status-ok' : 'status-info'} size={24} className="kz-copanel__icon" />
          <h2 id="pay-h" className="kz-copanel__h">
            {p.amountDueMinor <= 0 ? 'Nothing to pay' : 'Online payment is not available right now'}
          </h2>
          <p className="kz-cotext">
            {p.amountDueMinor <= 0
              ? `Invoice ${p.invoiceNumber} has no balance to pay.`
              : 'Please try again later, or contact us and we will help you pay.'}
          </p>
          <a href={p.backHref} className="kz-coback">
            <Icon name="arrow-left" size={16} />
            <span>Back to invoice {p.invoiceNumber}</span>
          </a>
        </div>
      </section>
    );
  }

  const roadWaiting: Stop[] = [
    { label: 'Payment started', state: 'done' },
    { label: c.confirming ? 'Done on your side' : actionStop(attempt), state: c.confirming ? 'done' : 'now' },
    { label: c.confirming ? 'Confirming' : 'Confirmed', state: c.confirming ? 'now' : 'next' },
  ];

  return (
    <section className="kz-copay" aria-labelledby="pay-h">
      {p.testMode ? (
        <p className="kz-cotest">
          <Icon name="status-warn" size={20} />
          <span>TEST PAYMENT: no real money moves.</span>
        </p>
      ) : null}
      <div role="status" aria-live="polite" className="sr-only">
        {c.phase === 'waiting'
          ? c.confirming
            ? 'Confirming your payment.'
            : 'Waiting for approval.'
          : c.phase === 'succeeded'
            ? 'Payment received.'
            : c.phase === 'failed'
              ? `Payment not completed. ${status?.message ?? ''}`
              : ''}
      </div>

      {c.stage === 'choose' || c.stage === 'bank' ? (
        <div className="kz-copanel">
          <h2 id="pay-h" className="kz-copanel__h">
            Choose how to pay
          </h2>
          <fieldset className="kz-cotiles">
            <legend className="sr-only">Payment method</legend>
            {c.options.map((m) => (
              <label key={m.code} className="kz-cotile">
                <input
                  type="radio"
                  name="method"
                  value={m.code}
                  checked={c.selected === m.code}
                  onChange={() => c.choose(m.code)}
                  className="kz-cotile__input"
                />
                <Icon name={methodIcon(m)} size={24} className="kz-cotile__icon" />
                <span className="kz-cotile__name">{m.name}</span>
                <span className="kz-cotile__tag">{methodTag(m)}</span>
                <span className="kz-cotile__tick" aria-hidden="true">
                  <Icon name="check" size={16} />
                </span>
              </label>
            ))}
          </fieldset>

          {c.stage === 'bank' && p.bankTransfer ? (
            <BankPanel
              bank={p.bankTransfer}
              amount={amount}
              endpoint={p.endpoints.bankNotice}
              publicPage={c.publicPage}
              {...(p.turnstileSiteKey ? { siteKey: p.turnstileSiteKey } : {})}
            />
          ) : method ? (
            <form
              className="kz-costep"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void c.pay();
              }}
            >
              <div className="kz-costep__head">
                <h3 className="kz-costep__h">Pay with {method.name}</h3>
                <p className="kz-costep__hint">{methodHint(method, c.savedCards.length)}</p>
              </div>
              {needsPhone(method) ? (
                <Field
                  label={`${method.name} number`}
                  hint="The mobile number of the wallet you are paying from."
                  error={joined(c.errors['phone'])}
                >
                  {(f) => (
                    <input
                      {...f}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      value={c.phone}
                      onChange={(e) => c.setPhone(e.target.value)}
                      placeholder="0771 234 567"
                      className="kz-input kz-coinput-phone"
                    />
                  )}
                </Field>
              ) : null}
              {method.flow === 'redirect' && c.savedCards.length ? (
                <fieldset className="kz-cocards">
                  <legend className="kz-label">Card</legend>
                  {[...c.savedCards, null].map((card) => {
                    const value = card ? card.id : 'new';
                    return (
                      <label key={value} className="kz-choice kz-choice--radio">
                        <input
                          type="radio"
                          name="card"
                          value={value}
                          checked={c.cardChoice === value}
                          onChange={() => c.setCardChoice(value)}
                        />
                        <span className="kz-choice__mark" aria-hidden="true">
                          <Icon name="check" size={16} />
                        </span>
                        <span className="kz-choice__text">
                          <span className="font-semibold">{card ? cardLabel(card) : 'Use a new card'}</span>
                          {card?.expiresAt ? (
                            <span className="kz-choice__hint">Saved · expires {cardExpiry(card.expiresAt)}</span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              ) : null}
              {c.errors['savedCardId'] ? <p className="kz-error">{joined(c.errors['savedCardId'])}</p> : null}
              {method.flow === 'redirect' && c.canSaveCard && c.cardChoice === 'new' ? (
                <CheckRow checked={c.saveCard} onChange={(e) => c.setSaveCard(e.target.checked)}>
                  Save this card for faster payments next time. Only a secure token from our payment partner is kept,
                  never your card number.
                </CheckRow>
              ) : null}
              <Ledger
                className="kz-costep__ledger"
                rows={[
                  { k: 'Kuzikode fee', v: 'None', mono: false },
                  { k: 'Total to pay', v: amount, total: true },
                ]}
              />
              {c.errors['methodCode'] ? <p className="kz-error">{joined(c.errors['methodCode'])}</p> : null}
              {c.publicPage && p.turnstileSiteKey ? (
                <Turnstile siteKey={p.turnstileSiteKey} onToken={c.onToken} resetSignal={c.reset} />
              ) : null}
              {c.errors['turnstile'] ? <p className="kz-error">{joined(c.errors['turnstile'])}</p> : null}
              {c.formError ? (
                <p role="alert" className="kz-coalert">
                  <Icon name="status-danger" size={20} />
                  {c.formError}
                </p>
              ) : null}
              <Button type="submit" size="lg" loading={c.busy} className="kz-costep__pay">
                Pay {amount}
              </Button>
              {method.flow === 'redirect' ? (
                <p className="kz-costep__note">
                  <Icon name="lock" size={16} />
                  <span>
                    {c.savedCards.some((s) => s.id === c.cardChoice)
                      ? 'Your saved card is charged right here. No card details are needed.'
                      : "For your security, card details are entered once in our payment partner's secure window. Kuzikode never sees your card number."}
                  </span>
                </p>
              ) : null}
            </form>
          ) : (
            <p className="kz-costep__empty">Select a method to continue.</p>
          )}
        </div>
      ) : null}

      {c.stage === 'waiting' && attempt ? (
        <div className="kz-copanel">
          <RoadStrip stops={roadWaiting} />
          <h2 id="pay-h" className="kz-copanel__h">
            {c.gaveUp
              ? 'Still waiting?'
              : c.confirming
                ? 'Confirming your payment'
                : c.inCardWindow
                  ? 'Complete card entry in the secure window…'
                  : 'Waiting for approval'}
          </h2>
          <p className="kz-cotext">
            {c.gaveUp
              ? 'We have not had a confirmation yet. If you approved the payment, it will show on your invoice as soon as it is confirmed.'
              : c.inCardWindow
                ? "For your security, card details are entered once in our payment partner's secure window. Kuzikode never sees your card number."
                : (attempt.instructions?.text ?? attempt.message)}
          </p>
          {c.inCardWindow && c.windowClosed && !c.confirming ? (
            <p className="kz-cometa" data-testid="card-window-closed">
              Closed the secure window before finishing? Open it again, or choose another method.
            </p>
          ) : null}
          {!c.gaveUp ? (
            <p className="kz-cometa">
              <span className="kz-mono">{amount}</span>, and we keep checking for{' '}
              <span className="kz-mono">{mmss(c.remainingMs)}</span> more
            </p>
          ) : null}

          {attempt.instructions?.authorizationCode ? (
            <WalletCode
              code={attempt.instructions.authorizationCode}
              expiresAt={attempt.instructions.authorizationExpiresAt}
              methodCode={attempt.methodCode}
              methodName={method?.name ?? 'wallet'}
            />
          ) : null}

          {attempt.instructions?.otpRequired && attempt.otpUrl ? (
            <OtpBoxes url={attempt.otpUrl} onDone={c.otpAccepted} />
          ) : null}

          <div className="kz-coactions">
            {c.gaveUp ? <Button onClick={c.checkAgain}>Check again</Button> : null}
            {c.inCardWindow && !c.confirming ? (
              <Button onClick={c.reopenCardWindow}>Open secure window</Button>
            ) : null}
            <Button variant="secondary" onClick={() => c.backToChoose(false)}>
              Choose another method
            </Button>
          </div>
        </div>
      ) : null}

      {c.stage === 'done' && status ? (
        status.phase === 'succeeded' ? (
          <div className="kz-copanel" data-co-paid>
            <RoadStrip
              stops={[
                { label: 'Payment started', state: 'done' },
                { label: 'Approved', state: 'done' },
                { label: 'Paid', state: 'done' },
              ]}
            />
            <div className="kz-coresult">
              <Icon name="status-ok" size={32} className="kz-coresult__icon kz-coresult__icon--ok" />
              <div className="kz-coresult__text">
                <h2 id="pay-h" className="kz-copanel__h">
                  Payment received
                </h2>
                <p className="kz-cotext">{status.message}</p>
              </div>
            </div>
            <div className="kz-coslip">
              <Ledger
                rows={[
                  { k: 'Amount paid', v: amount, total: true },
                  { k: 'Invoice', v: p.invoiceNumber },
                  ...(status.payment ? [{ k: 'Receipt', v: status.payment.receiptNumber }] : []),
                ]}
              />
            </div>
            <div className="kz-coactions">
              {c.receiptHref ? (
                <LinkButton href={c.receiptHref} download lead="download">
                  Download receipt (PDF)
                </LinkButton>
              ) : null}
              <a href={p.backHref} className="kz-coback">
                <Icon name="arrow-left" size={16} />
                <span>Back to invoice {p.invoiceNumber}</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="kz-copanel">
            <div className="kz-coresult">
              <Icon name="status-danger" size={32} className="kz-coresult__icon kz-coresult__icon--danger" />
              <div className="kz-coresult__text">
                <h2 id="pay-h" className="kz-copanel__h">
                  Payment not completed
                </h2>
                <p className="kz-cotext">{status.message}</p>
              </div>
            </div>
            <div className="kz-coactions">
              <Button onClick={() => c.backToChoose(true)}>Try again</Button>
              <Button variant="secondary" onClick={() => c.backToChoose(false)}>
                Choose another method
              </Button>
            </div>
          </div>
        )
      ) : null}

      <p className="kz-cosafe">
        <Icon name="lock" size={16} />
        <span>
          Payments are processed securely by our payment partner. Kuzikode never sees or stores your PIN or card number.
        </span>
      </p>
    </section>
  );
}

export default Checkout;
