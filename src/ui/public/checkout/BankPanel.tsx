import { Icon } from '../../icons/icon';
import { Button, TextField } from '../../primitives';
import { Turnstile } from '../forms/Turnstile';
import { useBankNotice } from './useCheckout';

/**
 * Bank transfer: the amount and the reference to quote, the bank details as a mono slip, then "I've paid, notify Kuzikode" (a
 * note for finance; nothing is marked paid).
 */
export function BankPanel({
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
  const n = useBankNotice(endpoint, publicPage);
  return (
    <div className="kz-costep">
      <div className="kz-costep__head">
        <h3 className="kz-costep__h">Pay by bank transfer</h3>
        <p className="kz-costep__hint">
          Transfer <strong className="kz-mono">{amount}</strong> and use{' '}
          <strong className="kz-mono">{bank.reference}</strong> as the reference:
        </p>
      </div>
      <p className="kz-cobank__slip">{bank.details}</p>
      {n.sent ? (
        <p role="status" className="kz-cobank__sent">
          <Icon name="status-ok" size={20} />
          <span>
            Thank you. We have told our finance team. Your invoice is updated once the transfer arrives in our account,
            usually within one to two working days.
          </span>
        </p>
      ) : (
        <form
          className="kz-cobank__form"
          onSubmit={(e) => {
            e.preventDefault();
            void n.notify();
          }}
        >
          <p className="kz-costep__hint">Already paid? Let us know so we can look out for it.</p>
          <div className="kz-cobank__grid">
            <TextField
              label="Paid by (name on the account)"
              value={n.payerName}
              onChange={(e) => n.setPayerName(e.target.value)}
              maxLength={120}
              autoComplete="name"
            />
            <TextField
              label="Bank reference"
              optional
              value={n.reference}
              onChange={(e) => n.setReference(e.target.value)}
              maxLength={80}
            />
          </div>
          {publicPage && siteKey ? <Turnstile siteKey={siteKey} onToken={n.onToken} resetSignal={n.reset} /> : null}
          {n.error ? (
            <p role="alert" className="kz-error">
              <Icon name="status-danger" size={16} className="mt-0.5" />
              {n.error}
            </p>
          ) : null}
          <Button type="submit" variant="secondary" loading={n.busy} className="kz-cobank__go">
            I've paid, notify Kuzikode
          </Button>
        </form>
      )}
    </div>
  );
}
