/** Accept / decline on the public quotation page. Acceptance needs a typed name and a confirmation tick. */
import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch, Button, Checkbox, Field, Input, Textarea } from '../ui';

export function QuotationResponse({ token, total }: { token: string; total: string }) {
  const [mode, setMode] = useState<'accept' | 'reject'>('accept');
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | 'accepted' | 'rejected'>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const body =
        mode === 'accept'
          ? { decision: 'accept', name: f.get('name'), agree }
          : { decision: 'reject', reason: f.get('reason') };
      const res = await apiFetch<{ data: { status: 'accepted' | 'rejected' } }>(
        `/api/v1/public/quotations/${token}/respond`,
        { body },
      );
      setDone(res.data.status);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(err.status === 422 ? 'Please check the highlighted fields.' : err.message);
      } else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div role="status" className="rounded-lg border border-success-700/30 bg-success-50 p-6 text-success-700">
        <p className="font-semibold">
          {done === 'accepted' ? 'Thank you. You have accepted this quotation.' : 'Thank you for letting us know.'}
        </p>
        <p className="mt-1 text-sm">
          {done === 'accepted'
            ? 'We will be in touch shortly with the next steps and an invoice.'
            : 'We have recorded that you declined this quotation. Reply to our email if you would like changes.'}
        </p>
      </div>
    );
  return (
    <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="respond-title">
      <h2 id="respond-title" className="font-sans text-lg font-semibold">
        Your response
      </h2>
      <div className="mt-3 flex gap-2" role="group" aria-label="Choose a response">
        <Button
          variant={mode === 'accept' ? 'primary' : 'secondary'}
          onClick={() => setMode('accept')}
          aria-pressed={mode === 'accept'}
        >
          Accept
        </Button>
        <Button
          variant={mode === 'reject' ? 'primary' : 'secondary'}
          onClick={() => setMode('reject')}
          aria-pressed={mode === 'reject'}
        >
          Decline
        </Button>
      </div>
      <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
        {error ? (
          <p
            role="alert"
            className="rounded-sm border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700"
          >
            {error}
          </p>
        ) : null}
        {mode === 'accept' ? (
          <>
            <Field label="Your full name" required error={errors['name']}>
              <Input name="name" maxLength={120} autoComplete="name" />
            </Field>
            <div>
              <Checkbox
                label={`I accept this quotation (${total}) and its terms on behalf of the client named above.`}
                checked={agree}
                onCheckedChange={setAgree}
              />
              {errors['agree'] ? (
                <p className="mt-1 text-[13px] font-medium text-danger-600">{errors['agree'][0]}</p>
              ) : null}
            </div>
            <p className="text-[13px] text-ink-600">
              We record your name, the time and your IP address as confirmation.
            </p>
            <div>
              <Button type="submit" size="lg" loading={busy}>
                Accept quotation
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field label="Reason" hint="Optional. It helps us improve our offer." error={errors['reason']}>
              <Textarea name="reason" rows={3} maxLength={1000} />
            </Field>
            <div>
              <Button type="submit" size="lg" variant="secondary" loading={busy}>
                Decline quotation
              </Button>
            </div>
          </>
        )}
      </form>
    </section>
  );
}
