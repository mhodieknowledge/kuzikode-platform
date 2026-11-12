import { CheckCircle2 } from 'lucide-react';
import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { BUDGET_RANGES, GENERAL_CATEGORIES } from '../../shared/schemas/enquiries';
import { ApiError, apiFetch, Button, Checkbox, Field, Input, Select, Textarea } from '../ui';
import { Turnstile } from './Turnstile';

export interface DivisionOption {
  slug: string;
  name: string;
  services: { slug: string; name: string }[];
}

interface Props {
  divisions: DivisionOption[];
  siteKey: string;
  initialCategory?: string | undefined;
  initialService?: string | undefined;
  /** Package chosen on the pricing or division page ("Request this package"). */
  initialPackage?: { slug: string; name: string } | undefined;
}

/** Contact / quotation request form (PRD §3.6). */
export default function ContactForm({ divisions, siteKey, initialCategory, initialService, initialPackage }: Props) {
  const validDivision = divisions.some((d) => d.slug === initialCategory);
  const [category, setCategory] = useState(
    validDivision || GENERAL_CATEGORIES.some((c) => c.value === initialCategory) ? (initialCategory ?? '') : '',
  );
  const [service, setService] = useState(validDivision ? (initialService ?? '') : '');
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const onToken = useCallback((t: string | null) => setToken(t), []);

  const division = divisions.find((d) => d.slug === category);
  const categoryOptions = useMemo(
    () => [
      ...GENERAL_CATEGORIES.filter((c) => c.value !== 'consultation').map((c) => ({ value: c.value, label: c.label })),
      ...divisions.map((d) => ({ value: d.slug, label: d.name })),
    ],
    [divisions],
  );

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await apiFetch<{ data: { reference: string } }>('/api/v1/public/enquiries', {
        body: {
          kind: 'contact',
          name: f.get('name'),
          email: f.get('email'),
          phone: f.get('phone'),
          organisation: f.get('organisation'),
          category,
          service: service || undefined,
          budgetRange: f.get('budgetRange') || undefined,
          message: f.get('message'),
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
        <h2 className="text-2xl font-bold tracking-display">Thank you. We have your message.</h2>
        <p className="text-ink-600">
          Your reference is <strong className="font-mono text-ink-950">{reference}</strong>. We have sent a confirmation
          to your email and will reply, usually within one business day.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-5"
      aria-describedby={formError ? 'contact-form-error' : undefined}
    >
      {formError ? (
        <p
          id="contact-form-error"
          role="alert"
          className="rounded-sm border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700"
        >
          {formError}
        </p>
      ) : null}
      {initialPackage ? (
        <p className="text-[15px] text-ink-600" data-package={initialPackage.slug}>
          Package: <strong className="text-ink-950">{initialPackage.name}</strong>
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
        <Field label="What is this about?" required error={errors['category']}>
          <Select
            name="category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setService('');
            }}
            placeholder="Choose a category"
            options={categoryOptions}
          />
        </Field>
        {division ? (
          <Field label="Service" hint="Optional" error={errors['service']}>
            <Select
              name="service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="Any / not sure"
              options={division.services.map((s) => ({ value: s.slug, label: s.name }))}
            />
          </Field>
        ) : (
          <div />
        )}
        <Field label="Budget range" hint="Optional" error={errors['budgetRange']}>
          <Select
            name="budgetRange"
            defaultValue=""
            placeholder="Prefer not to say"
            options={BUDGET_RANGES.map((b) => ({ value: b, label: b }))}
          />
        </Field>
      </div>
      <Field label="Message" required error={errors['message']} hint="What do you need, and by when?">
        <Textarea
          name="message"
          rows={6}
          maxLength={5000}
          defaultValue={initialPackage ? `I'd like to request the ${initialPackage.name} package.\n\n` : undefined}
        />
      </Field>
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
              I agree that Kuzikode may use these details to reply to me, as described in the{' '}
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
          Send message
        </Button>
      </div>
    </form>
  );
}
