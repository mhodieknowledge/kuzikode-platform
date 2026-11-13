import { useCallback, useState, type FormEvent } from 'react';
import { ApiError, apiFetch } from '../../lib/api';

/**
 * Job application submission (docs/12 §B.1): logic only, extracted from the old ApplicationForm (BRIEF B.0). Posts multipart
 * form data (`data` JSON + `cv` + optional `coverLetterFile`) to the unchanged endpoints: the posting's
 * `/api/v1/public/careers/:slug/applications`, or `/api/v1/public/careers/applications` for a general application. The server
 * re-validates everything, including the CV's real file type; field errors come back joined per field (`file` maps to `cv`).
 */
export function useApplication(slug: string | null) {
  const [cv, setCv] = useState<File | null>(null);
  const [letterFile, setLetterFile] = useState<File | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const onToken = useCallback((t: string | null) => setToken(t), []);
  const setAnswer = useCallback((id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v })), []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!cv) {
      setErrors({ cv: 'Attach your CV as a PDF or Word document.' });
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
        const fields = Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v.join(' ')]));
        if (fields['file']) fields['cv'] = fields['file'];
        setErrors(fields);
        setFormError(fields['posting'] ?? (err.status === 422 ? 'Please check the highlighted fields.' : err.message));
      } else setFormError('Something went wrong. Please try again.');
      setReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  return {
    submit,
    cv,
    setCv,
    letterFile,
    setLetterFile,
    answers,
    setAnswer,
    consent,
    setConsent,
    errors,
    formError,
    busy,
    reference,
    onToken,
    reset,
  };
}
