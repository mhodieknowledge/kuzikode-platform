import { CheckCircle2 } from 'lucide-react';
import { useCallback, useState, type FormEvent } from 'react';
import { ApiError, apiFetch, Button, Checkbox, Field, Input, Textarea } from '../ui';
import { Turnstile } from './Turnstile';

/** Consultation request with up to three preferred times (docs/12 §C.8), used when no booking link is configured. */
export default function ConsultationForm({ siteKey }: { siteKey: string }) {
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const onToken = useCallback((t: string | null) => setToken(t), []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const times = ['slot1', 'slot2', 'slot3']
      .map((k) => String(f.get(k) ?? '').trim())
      .filter(Boolean)
      .map((v) => {
        const d = new Date(v);
        return Number.isNaN(d.getTime())
          ? v
          : new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short' }).format(d) + ' (your time)';
      });
    if (times.length === 0) {
      setErrors({ preferredTimes: ['Suggest at least one time that suits you.'] });
      setFormError('Please check the highlighted fields.');
      return;
    }
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await apiFetch<{ data: { reference: string } }>('/api/v1/public/enquiries', {
        body: {
          kind: 'consultation',
          category: 'consultation',
          name: f.get('name'),
          email: f.get('email'),
          phone: f.get('phone'),
          organisation: f.get('organisation'),
          message: f.get('message'),
          preferredTimes: times,
          consent,
          turnstileToken: token ?? undefined,
          website: f.get('website'),
        },
      });
      setReference(res.data.reference);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setFormError(err.status === 422 ? 'Please check the highlighted fields.' : err.message);
      } else setFormError('Something went wrong. Please try again.');
      setReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 py-6">
        <CheckCircle2 size={32} className="text-success-600" aria-hidden="true" />
        <h2 className="text-2xl font-bold tracking-display">Thank you. We will confirm a time.</h2>
        <p className="text-ink-600">
          Your reference is <strong className="font-mono text-ink-950">{reference}</strong>. We will email you to
          confirm one of your suggested times, usually within one business day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {formError ? (
        <p
          role="alert"
          className="rounded-sm border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700"
        >
          {formError}
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" required error={errors['name']}>
          <Input name="name" autoComplete="name" maxLength={120} />
        </Field>
        <Field label="Email" required error={errors['email']}>
          <Input name="email" type="email" autoComplete="email" maxLength={254} />
        </Field>
        <Field label="Phone" hint="Optional" error={errors['phone']}>
          <Input name="phone" type="tel" autoComplete="tel" maxLength={40} />
        </Field>
        <Field label="Organisation" hint="Optional" error={errors['organisation']}>
          <Input name="organisation" autoComplete="organization" maxLength={160} />
        </Field>
      </div>
      <Field label="What would you like to discuss?" required error={errors['message']}>
        <Textarea name="message" rows={4} maxLength={5000} />
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-ink-950">
          Suggest up to three times that suit you
          <span className="ml-0.5 text-danger-600" aria-hidden="true">
            *
          </span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Field key={n} label={`Option ${n}`} hint={n === 1 ? 'Required' : 'Optional'}>
              <Input name={`slot${n}`} type="datetime-local" />
            </Field>
          ))}
        </div>
        {errors['preferredTimes'] ? (
          <p className="text-[13px] font-medium text-danger-600">{errors['preferredTimes'].join(' ')}</p>
        ) : null}
      </fieldset>
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="flex flex-col gap-1">
        <Checkbox
          label={
            <>
              I agree that Kuzikode may use these details to arrange the call, as described in the{' '}
              <a href="/legal/privacy" className="font-medium text-brand-600 underline underline-offset-2">
                privacy policy
              </a>
              .
            </>
          }
          checked={consent}
          onCheckedChange={setConsent}
        />
        {errors['consent'] ? (
          <p className="text-[13px] font-medium text-danger-600">{errors['consent'].join(' ')}</p>
        ) : null}
      </div>
      <Turnstile siteKey={siteKey} onToken={onToken} resetSignal={reset} />
      {errors['turnstile'] ? (
        <p className="text-[13px] font-medium text-danger-600">{errors['turnstile'].join(' ')}</p>
      ) : null}
      <div>
        <Button type="submit" size="lg" loading={busy}>
          Request a consultation
        </Button>
      </div>
    </form>
  );
}
