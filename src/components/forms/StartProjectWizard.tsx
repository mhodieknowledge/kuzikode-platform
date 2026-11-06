import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { BUDGET_RANGES } from '../../shared/schemas/enquiries';
import { formatPriceTag, packagePrice } from '../../shared/service-display';
import {
  indicativeEstimate,
  TIMELINES,
  WIZARD_FEATURES,
  WIZARD_STEPS,
  type EstimateAddon,
  type EstimatePackage,
} from '../../shared/wizard';
import { ApiError, apiFetch, Button, Checkbox, cn, Field, FileUpload, Input, Select, Textarea } from '../ui';
import { Turnstile } from './Turnstile';

export interface WizardDivision {
  slug: string;
  name: string;
  summary: string;
  services: { slug: string; name: string }[];
}

export interface WizardPackage extends EstimatePackage {
  slug: string;
  name: string;
  tagline: string | null;
  categorySlug: string;
  serviceSlug: string;
  priceUnit: string | null;
  annualPriceMinor: number | null;
  mostPopular: boolean;
}

export interface WizardAddon extends EstimateAddon {
  id: string;
  name: string;
  description: string | null;
}

interface Props {
  divisions: WizardDivision[];
  packages: WizardPackage[];
  addons: WizardAddon[];
  showPrices: boolean;
  siteKey: string;
  initialPackage?: string | undefined;
  initialCategory?: string | undefined;
}

interface Draft {
  step: number;
  category: string;
  service: string;
  pkg: string;
  addons: string[];
  features: string[];
  budgetRange: string;
  timeline: string;
  websiteUrl: string;
  description: string;
  name: string;
  email: string;
  phone: string;
  organisation: string;
}

const STORAGE_KEY = 'kz:start-project:v1';
const ACCEPT = '.pdf,.docx,.xlsx,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp';
const MAX_BYTES = 10 * 1024 * 1024;

/** Which step owns each server-side field error, so a 422 sends the visitor to the right place. */
const FIELD_STEP: Record<string, number> = {
  category: 0,
  service: 0,
  package: 1,
  addons: 2,
  features: 2,
  budgetRange: 3,
  timeline: 3,
  websiteUrl: 3,
  description: 3,
  file: 3,
  attachment: 3,
  name: 4,
  email: 4,
  phone: 4,
  organisation: 4,
  consent: 4,
  turnstile: 4,
};

function readDraft(): Partial<Draft> | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Draft>) : null;
  } catch {
    return null;
  }
}

function writeDraft(d: Draft | null) {
  try {
    if (d) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode, blocked): the wizard still works, it just doesn't resume */
  }
}

function initialDraft(props: Props): Draft {
  const pkg = props.packages.find((p) => p.slug === props.initialPackage);
  const category =
    pkg?.categorySlug ?? (props.divisions.some((d) => d.slug === props.initialCategory) ? props.initialCategory! : '');
  return {
    step: pkg ? 1 : 0,
    category,
    service: pkg?.serviceSlug ?? '',
    pkg: pkg?.slug ?? '',
    addons: [],
    features: [],
    budgetRange: '',
    timeline: '',
    websiteUrl: '',
    description: '',
    name: '',
    email: '',
    phone: '',
    organisation: '',
  };
}

const intervalLabel = { month: 'per month', year: 'per year' } as const;

/** Start-a-Project wizard (docs/12 §C.2). */
export default function StartProjectWizard(props: Props) {
  const { divisions, packages, addons, showPrices, siteKey } = props;
  const [d, setD] = useState<Draft>(() => initialDraft(props));
  const [restored, setRestored] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const onToken = useCallback((t: string | null) => setToken(t), []);

  // Resume a saved draft after hydration, unless the visitor arrived with a package preselected.
  useEffect(() => {
    if (!props.initialPackage) {
      const saved = readDraft();
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from sessionStorage after hydration
        setD((cur) => ({ ...cur, ...saved }));
        setRestored(true);
      }
    }
  }, [props.initialPackage]);

  useEffect(() => {
    if (!reference) writeDraft(d);
  }, [d, reference]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [d.step]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }));
  const toggle = (k: 'addons' | 'features', v: string, on: boolean) =>
    setD((cur) => ({ ...cur, [k]: on ? [...new Set([...cur[k], v])] : cur[k].filter((x) => x !== v) }));

  const division = divisions.find((x) => x.slug === d.category);
  const divisionPackages = packages.filter((p) => p.categorySlug === d.category);
  const pkg = divisionPackages.find((p) => p.slug === d.pkg) ?? null;
  const chosenAddons = addons.filter((a) => d.addons.includes(a.id));
  const estimate = showPrices ? indicativeEstimate(pkg, chosenAddons) : null;

  function validateStep(step: number): Record<string, string[]> {
    const e: Record<string, string[]> = {};
    if (step === 0 && !division) e['category'] = ['Choose what you need.'];
    if (step === 3) {
      if (!d.budgetRange) e['budgetRange'] = ['Choose a budget range.'];
      if (!d.timeline) e['timeline'] = ['Choose a timeline.'];
      if (d.description.trim().length < 10) e['description'] = ['Tell us a little more (at least 10 characters).'];
      if (d.websiteUrl && !/^https?:\/\/\S+\.\S+/i.test(d.websiteUrl))
        e['websiteUrl'] = ['Enter a full web address starting with https://'];
    }
    return e;
  }

  function go(step: number) {
    setFormError(null);
    setD((cur) => ({ ...cur, step }));
  }

  function next() {
    const e = validateStep(d.step);
    setErrors(e);
    if (Object.keys(e).length === 0) go(Math.min(d.step + 1, WIZARD_STEPS.length - 1));
  }

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (d.step < WIZARD_STEPS.length - 1) return next();
    const honeypot = new FormData(ev.currentTarget).get('website');
    const form = new FormData();
    form.set(
      'data',
      JSON.stringify({
        category: d.category,
        service: d.service || undefined,
        package: d.pkg || undefined,
        addons: d.addons,
        features: d.features,
        budgetRange: d.budgetRange,
        timeline: d.timeline,
        websiteUrl: d.websiteUrl || undefined,
        description: d.description,
        name: d.name,
        email: d.email,
        phone: d.phone || undefined,
        organisation: d.organisation || undefined,
        consent,
        turnstileToken: token ?? undefined,
        website: typeof honeypot === 'string' ? honeypot : undefined,
      }),
    );
    if (file) form.set('attachment', file);
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await apiFetch<{ data: { reference: string } }>('/api/v1/public/project-requests', { body: form });
      writeDraft(null);
      setReference(res.data.reference);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        const steps = Object.keys(err.fields)
          .map((k) => FIELD_STEP[k])
          .filter((s): s is number => s !== undefined);
        if (steps.length) go(Math.min(...steps));
        setFormError(err.status === 422 ? 'Please check the highlighted fields.' : err.message);
      } else setFormError('Something went wrong. Please try again.');
      setReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <div
        role="status"
        className="flex flex-col items-start gap-3 rounded-lg border border-line bg-surface p-6 md:p-10"
      >
        <CheckCircle2 size={32} className="text-success-600" aria-hidden="true" />
        <h2 className="text-2xl font-bold tracking-display">Thank you. We have your project brief.</h2>
        <p className="text-ink-600">
          Your reference is <strong className="font-mono text-ink-950">{reference}</strong>. We have sent a confirmation
          to your email. We will review your brief and reply, usually within one business day, with questions or a
          written quotation.
        </p>
      </div>
    );
  }

  const stepTitle = WIZARD_STEPS[d.step]!;
  const last = d.step === WIZARD_STEPS.length - 1;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <form
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-5 md:p-8"
        aria-labelledby="wizard-step-title"
      >
        <ol className="flex flex-wrap gap-x-4 gap-y-2 text-[13px]" aria-label="Progress">
          {WIZARD_STEPS.map((s, i) => (
            <li key={s} aria-current={i === d.step ? 'step' : undefined} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                  i === d.step
                    ? 'bg-brand-600 text-white'
                    : i < d.step
                      ? 'bg-brand-50 text-brand-600'
                      : 'bg-ink-950/5 text-ink-600',
                )}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className={cn(i === d.step ? 'font-semibold text-ink-950' : 'text-ink-600', 'max-sm:sr-only')}>
                {s}
                {i < d.step ? <span className="sr-only"> (done)</span> : null}
              </span>
            </li>
          ))}
        </ol>

        <div>
          <p className="text-[13px] font-medium text-ink-600">
            Step {d.step + 1} of {WIZARD_STEPS.length}
          </p>
          <h2
            id="wizard-step-title"
            ref={heading}
            tabIndex={-1}
            className="mt-1 text-2xl font-bold tracking-display outline-none"
          >
            {stepTitle}
          </h2>
          {restored && d.step === 0 ? (
            <p className="mt-1 text-[13px] text-ink-600">We restored the answers you started earlier in this tab.</p>
          ) : null}
        </div>

        {formError ? (
          <p
            role="alert"
            className="rounded-sm border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700"
          >
            {formError}
          </p>
        ) : null}

        {d.step === 0 ? (
          <div className="flex flex-col gap-5">
            <fieldset>
              <legend className="mb-3 text-sm font-medium text-ink-950">
                What do you need help with?
                <span className="ml-0.5 text-danger-600" aria-hidden="true">
                  *
                </span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {divisions.map((x) => (
                  <label
                    key={x.slug}
                    className={cn(
                      'flex cursor-pointer gap-3 rounded-md border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500',
                      d.category === x.slug ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-ink-400',
                    )}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={x.slug}
                      checked={d.category === x.slug}
                      onChange={() => setD((cur) => ({ ...cur, category: x.slug, service: '', pkg: '', addons: [] }))}
                      className="mt-1 accent-brand-600"
                    />
                    <span>
                      <span className="block font-semibold text-ink-950">{x.name}</span>
                      <span className="mt-0.5 block text-[13px] leading-5 text-ink-600">{x.summary}</span>
                    </span>
                  </label>
                ))}
              </div>
              {errors['category'] ? (
                <p className="mt-2 text-[13px] font-medium text-danger-600">{errors['category'].join(' ')}</p>
              ) : null}
            </fieldset>
            {division ? (
              <Field label="Which service?" hint="Optional" error={errors['service']}>
                <Select
                  value={d.service}
                  onChange={(e) => set('service', e.target.value)}
                  placeholder="Not sure yet"
                  options={division.services.map((s) => ({ value: s.slug, label: s.name }))}
                />
              </Field>
            ) : null}
          </div>
        ) : null}

        {d.step === 1 ? (
          <fieldset>
            <legend className="mb-3 text-sm font-medium text-ink-950">
              Start from a package, or describe a custom project
            </legend>
            <div className="flex flex-col gap-3">
              {divisionPackages.map((p) => {
                const price = packagePrice(p);
                return (
                  <label
                    key={p.slug}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-md border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500',
                      d.pkg === p.slug ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-ink-400',
                    )}
                  >
                    <input
                      type="radio"
                      name="package"
                      value={p.slug}
                      checked={d.pkg === p.slug}
                      onChange={() => setD((cur) => ({ ...cur, pkg: p.slug, service: p.serviceSlug }))}
                      className="mt-1 accent-brand-600"
                    />
                    <span className="flex flex-1 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                      <span>
                        <span className="font-semibold text-ink-950">{p.name}</span>
                        {p.mostPopular ? (
                          <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                            Most popular
                          </span>
                        ) : null}
                        {p.tagline ? <span className="block text-[13px] text-ink-600">{p.tagline}</span> : null}
                      </span>
                      <span className="tnum shrink-0 text-sm font-semibold text-ink-950">
                        {price.prefix ? `${price.prefix} ` : ''}
                        {price.amount}
                        {price.suffix ? <span className="font-normal text-ink-600"> {price.suffix}</span> : null}
                      </span>
                    </span>
                  </label>
                );
              })}
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-md border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500',
                  d.pkg === '' ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-ink-400',
                )}
              >
                <input
                  type="radio"
                  name="package"
                  value=""
                  checked={d.pkg === ''}
                  onChange={() => set('pkg', '')}
                  className="mt-1 accent-brand-600"
                />
                <span>
                  <span className="font-semibold text-ink-950">Custom project or not sure</span>
                  <span className="block text-[13px] text-ink-600">
                    We will scope it with you and quote it separately.
                  </span>
                </span>
              </label>
            </div>
            {errors['package'] ? (
              <p className="mt-2 text-[13px] font-medium text-danger-600">{errors['package'].join(' ')}</p>
            ) : null}
          </fieldset>
        ) : null}

        {d.step === 2 ? (
          <div className="flex flex-col gap-8">
            <fieldset>
              <legend className="mb-3 text-sm font-medium text-ink-950">Features you are interested in</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {WIZARD_FEATURES.map((f) => (
                  <Checkbox
                    key={f.value}
                    label={f.label}
                    checked={d.features.includes(f.value)}
                    onCheckedChange={(on) => toggle('features', f.value, on)}
                  />
                ))}
              </div>
            </fieldset>
            {addons.length > 0 ? (
              <fieldset>
                <legend className="mb-3 text-sm font-medium text-ink-950">Add-ons</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  {addons.map((a) => (
                    <Checkbox
                      key={a.id}
                      label={
                        <>
                          {a.name}
                          {a.priceMinor !== null ? (
                            <span className="tnum text-ink-600"> · {formatPriceTag(a.priceMinor, a.currency)}</span>
                          ) : null}
                        </>
                      }
                      description={a.description ?? undefined}
                      checked={d.addons.includes(a.id)}
                      onCheckedChange={(on) => toggle('addons', a.id, on)}
                    />
                  ))}
                </div>
                {errors['addons'] ? (
                  <p className="mt-2 text-[13px] font-medium text-danger-600">{errors['addons'].join(' ')}</p>
                ) : null}
              </fieldset>
            ) : null}
          </div>
        ) : null}

        {d.step === 3 ? (
          <div className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Budget range" required error={errors['budgetRange']}>
                <Select
                  value={d.budgetRange}
                  onChange={(e) => set('budgetRange', e.target.value)}
                  placeholder="Choose a range"
                  options={BUDGET_RANGES.map((b) => ({ value: b, label: b }))}
                />
              </Field>
              <Field label="When do you need it?" required error={errors['timeline']}>
                <Select
                  value={d.timeline}
                  onChange={(e) => set('timeline', e.target.value)}
                  placeholder="Choose a timeline"
                  options={TIMELINES.map((t) => ({ value: t, label: t }))}
                />
              </Field>
            </div>
            <Field label="Existing website" hint="Optional, e.g. https://example.co.zw" error={errors['websiteUrl']}>
              <Input
                type="url"
                inputMode="url"
                value={d.websiteUrl}
                onChange={(e) => set('websiteUrl', e.target.value)}
                maxLength={300}
              />
            </Field>
            <Field
              label="Tell us about the project"
              required
              hint="Who it is for, what it should do, and anything you already have."
              error={errors['description']}
            >
              <Textarea
                rows={6}
                value={d.description}
                onChange={(e) => set('description', e.target.value)}
                maxLength={5000}
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <FileUpload
                label="Attach a brief (optional)"
                accept={ACCEPT}
                maxBytes={MAX_BYTES}
                hint="PDF, Word, Excel, PowerPoint, text or images, up to 10 MB"
                onFile={(f) => setFile(f)}
              />
              {file ? (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="w-fit text-[13px] font-semibold text-brand-600 underline-offset-2 hover:underline"
                >
                  Remove {file.name}
                </button>
              ) : null}
              {errors['file'] || errors['attachment'] ? (
                <p className="text-[13px] font-medium text-danger-600">
                  {[...(errors['file'] ?? []), ...(errors['attachment'] ?? [])].join(' ')}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {d.step === 4 ? (
          <div className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Your name" required error={errors['name']}>
                <Input
                  value={d.name}
                  onChange={(e) => set('name', e.target.value)}
                  autoComplete="name"
                  maxLength={120}
                />
              </Field>
              <Field label="Email" required error={errors['email']}>
                <Input
                  type="email"
                  value={d.email}
                  onChange={(e) => set('email', e.target.value)}
                  autoComplete="email"
                  maxLength={254}
                />
              </Field>
              <Field label="Phone" hint="Optional" error={errors['phone']}>
                <Input
                  type="tel"
                  value={d.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  autoComplete="tel"
                  maxLength={40}
                />
              </Field>
              <Field label="Organisation" hint="Optional" error={errors['organisation']}>
                <Input
                  value={d.organisation}
                  onChange={(e) => set('organisation', e.target.value)}
                  autoComplete="organization"
                  maxLength={160}
                />
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
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-line pt-5">
          {d.step > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => go(d.step - 1)}
              icon={<ArrowLeft size={16} aria-hidden="true" />}
            >
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="lg" loading={busy}>
            {last ? 'Send project brief' : 'Continue'}
            {last ? null : <ArrowRight size={16} aria-hidden="true" />}
          </Button>
        </div>
      </form>

      <aside
        aria-label="Your selection"
        className="flex h-fit flex-col gap-4 rounded-lg bg-canvas p-5 lg:sticky lg:top-24"
      >
        <h2 className="font-sans text-base font-semibold text-ink-950">Your selection</h2>
        <dl className="flex flex-col gap-3 text-sm">
          <div>
            <dt className="text-[13px] text-ink-600">Area</dt>
            <dd className="font-medium text-ink-950">{division?.name ?? 'Not chosen yet'}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-ink-600">Package</dt>
            <dd className="font-medium text-ink-950">{pkg?.name ?? 'Custom project or not sure'}</dd>
          </div>
          {chosenAddons.length > 0 ? (
            <div>
              <dt className="text-[13px] text-ink-600">Add-ons</dt>
              <dd className="font-medium text-ink-950">{chosenAddons.map((a) => a.name).join(', ')}</dd>
            </div>
          ) : null}
        </dl>
        {estimate ? (
          <div className="border-t border-line pt-4" data-estimate>
            <p className="text-[13px] text-ink-600">Indicative price</p>
            {estimate.oneOffHighMinor > 0 ? (
              <p className="tnum text-xl font-bold text-ink-950">
                {formatPriceTag(estimate.oneOffLowMinor, estimate.currency)}
                {estimate.oneOffHighMinor !== estimate.oneOffLowMinor
                  ? ` – ${formatPriceTag(estimate.oneOffHighMinor, estimate.currency)}`
                  : ''}
                <span className="ml-1 text-sm font-normal text-ink-600">one-off</span>
              </p>
            ) : null}
            {estimate.recurring.map((r) => (
              <p key={r.interval} className="tnum text-sm font-semibold text-ink-950">
                {estimate.oneOffHighMinor > 0 ? '+ ' : ''}
                {formatPriceTag(r.amountMinor, estimate.currency)}{' '}
                <span className="font-normal text-ink-600">{intervalLabel[r.interval]}</span>
              </p>
            ))}
            <p className="mt-2 text-[12px] leading-5 text-ink-600">Indicative only, confirmed in a quotation.</p>
          </div>
        ) : (
          <p className="border-t border-line pt-4 text-[13px] leading-5 text-ink-600">
            We confirm scope and price in a written quotation after reading your brief.
          </p>
        )}
      </aside>
    </div>
  );
}
