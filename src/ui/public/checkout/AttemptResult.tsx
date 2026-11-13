/**
 * Live status of one payment attempt on the public return pages (`/pay/return`, `/pay/card-return`), rebuilt for R4.8. Logic in
 * `useAttemptStatus` (unchanged polling). Waiting shows the road strip (started → confirming in gold → confirmed); the outcome
 * shows the receipt slip (IMG_5014) with the receipt download and the way back to the invoice.
 */
import { Icon } from '../../icons/icon';
import { LinkButton } from '../../primitives';
import { formatMoney } from '../../../shared/money';
import { paymentMethodLabel } from '../../../shared/payment-methods';
import { Ledger, RoadStrip } from './parts';
import { useAttemptStatus, type AttemptView } from './useAttemptStatus';

export type { AttemptView } from './useAttemptStatus';

export function AttemptResult({ initial }: { initial: AttemptView }) {
  const { attempt: a, gaveUp, links } = useAttemptStatus(initial);
  const ok = a.phase === 'succeeded';
  const failed = a.phase === 'failed';
  return (
    <div className="kz-coattempt">
      {ok || a.phase === 'waiting' ? (
        <RoadStrip
          stops={[
            { label: 'Payment started', state: 'done' },
            { label: ok ? 'Confirmed' : 'Confirming', state: ok ? 'done' : 'now' },
            { label: 'Paid', state: ok ? 'done' : 'next' },
          ]}
        />
      ) : null}
      <div role="status" aria-live="polite" className="kz-coresult">
        <Icon
          name={ok ? 'status-ok' : failed ? 'status-danger' : 'status-pending'}
          size={32}
          className={`kz-coresult__icon kz-coresult__icon--${ok ? 'ok' : failed ? 'danger' : 'wait'}`}
        />
        <div className="kz-coresult__text">
          <h2 className="kz-copanel__h">
            {ok ? 'Payment received' : failed ? 'Payment not completed' : 'Waiting for confirmation'}
          </h2>
          <p className="kz-cotext">
            {gaveUp
              ? 'This is taking longer than usual. You can leave this page; the invoice updates as soon as the payment is confirmed.'
              : a.message}
          </p>
        </div>
      </div>
      <div className="kz-coslip">
        <Ledger
          rows={[
            { k: 'Amount', v: formatMoney(a.amountMinor, a.currency), total: true },
            { k: 'Invoice', v: a.invoice.number },
            {
              k: 'Method',
              v: `${paymentMethodLabel(a.method)}${a.payerPhone ? ` · ${a.payerPhone}` : ''}`,
              mono: false,
            },
            ...(a.payment ? [{ k: 'Receipt', v: a.payment.receiptNumber }] : []),
          ]}
        />
      </div>
      <div className="kz-coactions">
        {links.receipt ? (
          <LinkButton href={links.receipt} download lead="download">
            Download receipt (PDF)
          </LinkButton>
        ) : null}
        <a href={links.invoice} className="kz-coback">
          <Icon name="arrow-left" size={16} />
          <span>Back to invoice {a.invoice.number}</span>
        </a>
      </div>
    </div>
  );
}

export default AttemptResult;
