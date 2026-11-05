import { CheckCircle2 } from 'lucide-react';
import { useCallback, useState, type FormEvent } from 'react';
import type { CustomQuestion } from '../../shared/schemas/careers';
import { ApiError, apiFetch, Button, Checkbox, Field, FileUpload, Input, Select, Textarea } from '../ui';
import { Turnstile } from './Turnstile';

interface Props {
  /** Posting slug, or null for a general application. */
  slug: string | null;
  position: string;
  questions: CustomQuestion[];
  siteKey: string;
}

const CV_ACCEPT = '.pdf,.docx';
const CV_MAX = 5 * 1024 * 1024;

/** Job application form (docs/12 §B.1). The server re-validates everything, including the CV's real file type. */
export default function ApplicationForm({ slug, position, questions, siteKey }: Props) {
  const [cv, setCv] = useState<File | null>(null);
  const [letterFile, setLetterFile] = useState<File | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
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
    if (!cv) {
      setErrors({ cv: ['Attach your CV as a PDF or Word document.'] });
      setFormError('Please check the highlighted fields.');
      return;
    }
    const body = new FormData();
    body.set(
      'data',
      JSON.stringify({
        fullName: f.get('fullName'),
        email: f.get('email'),
        phone: f.get('phone') || undefined,
        location: f.get('location') || undefined,
        linkedinUrl: f.get('linkedinUrl') || undefined,
        portfolioUrl: f.get('portfolioUrl') || undefined,
        coverLetter: f.get('coverLetter') || undefined,
        answers,
        noticePeriod: f.get('noticePeriod') || undefined,
        salaryExpectation: f.get('salaryExpectation') || undefined,
        consent,
        turnstileToken: token ?? undefined,
        website: f.get('website') || undefined,
      }),
    );
    body.set('cv', cv);
    if (letterFile) body.set('coverLetterFile', letterFile);
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const path = slug
        ? `/api/v1/public/careers/${encodeURIComponent(slug)}/applications`
        : '/api/v1/public/careers/applications';
      const res = await apiFetch<{ data: { reference: string } }>(path, { body });
      setReference(res.data.reference);
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = { ...err.fields };
        if (fields['file']) fields['cv'] = fields['file'];
        setErrors(fields);
        setFormError(
          fields['posting']?.join(' ') ?? (err.status === 422 ? 'Please check the highlighted fields.' : err.message),
        );
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
        <h2 className="text-2xl font-bold tracking-display">Thank you for applying.</h2>
        <p className="text-ink-600">
          Your reference is <strong className="font-mono text-ink-950">{reference}</strong>. We have emailed you a
          confirmation and will be in touch if we would like to take your application for {position} further.
        </p>
      </div>
    );
  }

  const err = (k: string) => errors[k];
  return (
    <form onSubmit={submit} method="post" noValidate className="flex flex-col gap-5">
      {formError ? (
        <p
          role="alert"
          className="rounded-sm border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700"
        >
          {formError}
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" required error={err('fullName')}>
          <Input name="fullName" autoComplete="name" maxLength={120} />
        </Field>
        <Field label="Email" required error={err('email')}>
          <Input name="email" type="email" autoComplete="email" maxLength={254} />
        </Field>
        <Field label="Phone" hint="Optional" error={err('phone')}>
          <Input name="phone" type="tel" autoComplete="tel" maxLength={40} />
        </Field>
        <Field label="Where are you based?" hint="Optional" error={err('location')}>
          <Input name="location" autoComplete="address-level2" maxLength={120} />
        </Field>
        <Field label="LinkedIn profile" hint="Optional, https://…" error={err('linkedinUrl')}>
          <Input name="linkedinUrl" type="url" inputMode="url" maxLength={300} />
        </Field>
        <Field label="Portfolio or GitHub" hint="Optional, https://…" error={err('portfolioUrl')}>
          <Input name="portfolioUrl" type="url" inputMode="url" maxLength={300} />
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        <FileUpload
          label="CV (required)"
          accept={CV_ACCEPT}
          maxBytes={CV_MAX}
          hint="PDF or Word (.docx), up to 5 MB"
          onFile={setCv}
        />
        {err('cv') ? <p className="text-[13px] font-medium text-danger-600">{err('cv')!.join(' ')}</p> : null}
      </div>
      <Field label="Cover letter" hint="Optional. Type it here or attach a file below." error={err('coverLetter')}>
        <Textarea name="coverLetter" rows={6} maxLength={8000} />
      </Field>
      <FileUpload
        label="Cover letter file (optional)"
        accept={CV_ACCEPT}
        maxBytes={CV_MAX}
        hint="PDF or Word (.docx), up to 5 MB"
        onFile={setLetterFile}
      />
      {questions.map((q) => {
        const e = err(`answers.${q.id}`);
        const set = (v: string) => setAnswers((a) => ({ ...a, [q.id]: v }));
        const value = answers[q.id] ?? '';
        if (q.type === 'long_text')
          return (
            <Field key={q.id} label={q.label} required={q.required} error={e}>
              <Textarea rows={4} maxLength={4000} value={value} onChange={(ev) => set(ev.target.value)} />
            </Field>
          );
        if (q.type === 'yes_no' || q.type === 'select')
          return (
            <Field key={q.id} label={q.label} required={q.required} error={e}>
              <Select
                value={value}
                onChange={(ev) => set(ev.target.value)}
                placeholder="Choose…"
                options={
                  q.type === 'yes_no'
                    ? [
                        { value: 'yes', label: 'Yes' },
                        { value: 'no', label: 'No' },
                      ]
                    : (q.options ?? []).map((o) => ({ value: o, label: o }))
                }
              />
            </Field>
          );
        return (
          <Field key={q.id} label={q.label} required={q.required} error={e}>
            <Input maxLength={300} value={value} onChange={(ev) => set(ev.target.value)} />
          </Field>
        );
      })}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Availability or notice period" hint="Optional" error={err('noticePeriod')}>
          <Input name="noticePeriod" maxLength={120} />
        </Field>
        <Field label="Salary expectation" hint="Optional" error={err('salaryExpectation')}>
          <Input name="salaryExpectation" maxLength={120} />
        </Field>
      </div>
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
              I agree that Kuzikode may use these details to consider my application and keep them for 12 months after
              the position closes, as described in the{' '}
              <a href="/legal/privacy" className="font-medium text-brand-600 underline underline-offset-2">
                privacy policy
              </a>
              .
            </>
          }
          checked={consent}
          onCheckedChange={setConsent}
        />
        {err('consent') ? <p className="text-[13px] font-medium text-danger-600">{err('consent')!.join(' ')}</p> : null}
      </div>
      <Turnstile siteKey={siteKey} onToken={onToken} resetSignal={reset} />
      {err('turnstile') ? (
        <p className="text-[13px] font-medium text-danger-600">{err('turnstile')!.join(' ')}</p>
      ) : null}
      <div>
        <Button type="submit" size="lg" loading={busy}>
          Submit application
        </Button>
      </div>
    </form>
  );
}
