/**
 * Accept / decline a quotation (R4.8, rebuilt from scratch): public /q/:token and the workspace. A two-way switch (Accept |
 * Decline) over one short form: acceptance needs a typed name and a confirmation tick that repeats the total; declining takes an
 * optional reason. The answer replaces the form with a calm confirmation (status role).
 */
import { Icon } from '../icons/icon';
import { Button, CheckRow, TextField, TextareaField } from '../primitives';
import { useQuotationResponse } from './useQuotationResponse';

/** `token` for the public link page; `endpoint` for the signed-in workspace (same body and answers). */
export function QuotationResponse({
  token,
  endpoint,
  total,
  doneHref,
}: {
  token?: string;
  endpoint?: string;
  total: string;
  /** When set, the page reloads to this address after answering (workspace). */
  doneHref?: string;
}) {
  const url = endpoint ?? `/api/v1/public/quotations/${token ?? ''}/respond`;
  const r = useQuotationResponse({ url, doneHref });

  if (r.done)
    return (
      <div role="status" className="kz-qresp kz-qresp--done">
        <Icon name="status-ok" size={24} />
        <div>
          <p className="kz-qresp__h">
            {r.done === 'accepted' ? 'Thank you. You have accepted this quotation.' : 'Thank you for letting us know.'}
          </p>
          <p>
            {r.done === 'accepted'
              ? 'We will be in touch shortly with the next steps and an invoice.'
              : 'We have recorded that you declined this quotation. Reply to our email if you would like changes.'}
          </p>
        </div>
      </div>
    );

  return (
    <section className="kz-qresp" aria-labelledby="respond-title" id="respond">
      <h2 id="respond-title" className="kz-qresp__h">
        Your response
      </h2>
      <div className="kz-qresp__switch" role="group" aria-label="Choose a response">
        {(
          [
            ['accept', 'Accept', 'check'],
            ['reject', 'Decline', 'close'],
          ] as const
        ).map(([value, label, icon]) => (
          <button
            key={value}
            type="button"
            aria-pressed={r.mode === value}
            onClick={() => r.setMode(value)}
            className="kz-qresp__opt"
          >
            <Icon name={icon} size={16} />
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={r.submit} noValidate className="kz-qresp__form">
        {r.error ? (
          <p role="alert" className="kz-qresp__alert">
            <Icon name="status-danger" size={16} />
            {r.error}
          </p>
        ) : null}
        {r.mode === 'accept' ? (
          <>
            <TextField
              label="Your full name"
              name="name"
              maxLength={120}
              autoComplete="name"
              required
              error={r.errors['name']?.[0]}
            />
            <div>
              <CheckRow checked={r.agree} onChange={(e) => r.setAgree(e.currentTarget.checked)}>
                I accept this quotation ({total}) and its terms on behalf of the client named above.
              </CheckRow>
              {r.errors['agree'] ? <p className="kz-error">{r.errors['agree'][0]}</p> : null}
            </div>
            <p className="kz-qresp__fine">We record your name, the time and your IP address as confirmation.</p>
            <Button type="submit" size="lg" loading={r.busy} className="kz-qresp__go">
              Accept quotation
            </Button>
          </>
        ) : (
          <>
            <TextareaField
              label="Reason"
              optional
              hint="It helps us improve our offer."
              name="reason"
              rows={3}
              maxLength={1000}
              error={r.errors['reason']?.[0]}
            />
            <Button type="submit" size="lg" variant="secondary" loading={r.busy} className="kz-qresp__go">
              Decline quotation
            </Button>
          </>
        )}
      </form>
    </section>
  );
}
