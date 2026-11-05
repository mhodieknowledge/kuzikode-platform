import { CheckCircle2 } from 'lucide-react';
import { useCallback, useState, type FormEvent } from 'react';
import { ApiError, apiFetch, Button, Checkbox, Field, Input, Textarea } from '../ui';
import { Turnstile } from './Turnstile';

/** "Register interest" for a product in development. Creates a product_interest enquiry; promises nothing. */
export default function InterestForm({
  product,
  productName,
  siteKey,
}: {
  product: string;
  productName: string;
  siteKey: string;
}) {
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const onToken = useCallback((t: string | null) => setToken(t), []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    try {
      const res = await apiFetch<{ data: { reference: string } }>('/api/v1/public/enquiries', {
        body: {
          kind: 'product_interest',
          category: 'product_interest',
          product,
          name: f.get('name'),
          email: f.get('email'),
          organisation: f.get('organisation'),
          message: f.get('message'),
          consent,
          turnstileToken: token ?? undefined,
          website: f.get('website'),
        },
      });
      setDone(res.data.reference);
    } catch (err) {
      setErrors(err instanceof ApiError ? err.fields : { _: ['Something went wrong. Please try again.'] });
      setReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="flex items-start gap-3">
        <CheckCircle2 size={24} className="mt-0.5 shrink-0 text-success-600" aria-hidden="true" />
        <p className="text-ink-800">
          Thank you. We have noted your interest (reference <strong className="font-mono">{done}</strong>) and will be
          in touch when there is news.
        </p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required error={errors['name']}>
          <Input name="name" autoComplete="name" />
        </Field>
        <Field label="Email" required error={errors['email']}>
          <Input name="email" type="email" autoComplete="email" />
        </Field>
      </div>
      <Field label="Organisation" hint="Optional" error={errors['organisation']}>
        <Input name="organisation" autoComplete="organization" />
      </Field>
      <Field label="What would you use it for?" required error={errors['message']}>
        <Textarea name="message" rows={3} defaultValue={`I would like to hear about ${productName} as it develops.`} />
      </Field>
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Checkbox
        label={
          <>
            I agree that Kuzikode may contact me about this product, as described in the{' '}
            <a href="/legal/privacy" className="font-medium text-brand-600 underline underline-offset-2">
              privacy policy
            </a>
            .
          </>
        }
        checked={consent}
        onCheckedChange={setConsent}
      />
      {errors['consent'] || errors['turnstile'] || errors['_'] || errors['product'] ? (
        <p role="alert" className="text-[13px] font-medium text-danger-600">
          {[
            ...(errors['consent'] ?? []),
            ...(errors['turnstile'] ?? []),
            ...(errors['_'] ?? []),
            ...(errors['product'] ?? []),
          ].join(' ')}
        </p>
      ) : null}
      <Turnstile siteKey={siteKey} onToken={onToken} resetSignal={reset} />
      <div>
        <Button type="submit" loading={busy}>
          Register interest
        </Button>
      </div>
    </form>
  );
}
