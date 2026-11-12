import { useMemo, useState } from 'react';
import { BUDGET_RANGES, GENERAL_CATEGORIES } from '../../../shared/schemas/enquiries';
import { Icon } from '../../icons/icon';
import { Button, CheckRow, SelectField, TextField, TextareaField } from '../../primitives';
import { Turnstile } from './Turnstile';
import { useEnquiry } from './useEnquiry';

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

/**
 * Contact / quotation request (PRD §3.6), rebuilt for R4.6. Three numbered parts (what you need → your details → your message),
 * then a "you are sending" line that previews the request before it is committed (DESIGN_DIRECTION §3 raise), consent, Turnstile and
 * one action. Phones: one column, 16 px inputs, the action full width. Endpoint and fields unchanged.
 */
export default function ContactForm({ divisions, siteKey, initialCategory, initialService, initialPackage }: Props) {
  const validDivision = divisions.some((d) => d.slug === initialCategory);
  const [category, setCategory] = useState(
    validDivision || GENERAL_CATEGORIES.some((c) => c.value === initialCategory) ? (initialCategory ?? '') : '',
  );
  const [service, setService] = useState(validDivision ? (initialService ?? '') : '');
  const [consent, setConsent] = useState(false);
  const division = divisions.find((d) => d.slug === category);
  const categoryOptions = useMemo(
    () => [
      ...GENERAL_CATEGORIES.filter((c) => c.value !== 'consultation').map((c) => ({ value: c.value, label: c.label })),
      ...divisions.map((d) => ({ value: d.slug, label: d.name })),
    ],
    [divisions],
  );
  const { submit, errors, formError, busy, reference, onToken, reset } = useEnquiry((f, token) => ({
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
  }));

  if (reference) {
    return (
      <div role="status" className="kz-sent">
        <Icon name="status-ok" size={32} />
        <h2 className="kz-sent__title">Thank you. We have your message.</h2>
        <p>
          Your reference is <strong className="kz-sent__ref">{reference}</strong>. We have sent a confirmation to your
          email and will reply, usually within one business day.
        </p>
      </div>
    );
  }

  const summary = [
    categoryOptions.find((c) => c.value === category)?.label,
    division?.services.find((s) => s.slug === service)?.name,
    initialPackage ? `${initialPackage.name} package` : undefined,
  ].filter(Boolean);
  const sending = summary.length > 0 ? summary.join(' → ') : 'A message to Kuzikode';

  return (
    <form onSubmit={submit} noValidate className="kz-eform" aria-describedby={formError ? 'contact-form-error' : undefined}>
      {formError ? (
        <p id="contact-form-error" role="alert" className="kz-eform__alert">
          <Icon name="status-danger" size={20} />
          {formError}
        </p>
      ) : null}
      {initialPackage ? (
        <p className="kz-eform__pkg" data-package={initialPackage.slug}>
          <Icon name="packages" size={20} />
          <span>
            Package: <strong>{initialPackage.name}</strong>
          </span>
        </p>
      ) : null}

      <fieldset className="kz-eform__part">
        <legend>
          <span className="kz-eform__n">01</span> What you need
        </legend>
        <div className="kz-eform__grid">
          <SelectField
            label="What is this about?"
            name="category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setService('');
            }}
            error={errors['category']}
          >
            <option value="">Choose a category</option>
            {categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
          {division ? (
            <SelectField
              label="Service"
              name="service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              optional
              error={errors['service']}
            >
              <option value="">Any / not sure</option>
              {division.services.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </SelectField>
          ) : null}
          <SelectField label="Budget range" name="budgetRange" defaultValue="" optional error={errors['budgetRange']}>
            <option value="">Prefer not to say</option>
            {BUDGET_RANGES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </SelectField>
        </div>
      </fieldset>

      <fieldset className="kz-eform__part">
        <legend>
          <span className="kz-eform__n">02</span> Your details
        </legend>
        <div className="kz-eform__grid">
          <TextField label="Your name" name="name" autoComplete="name" maxLength={120} error={errors['name']} />
          <TextField
            label="Email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            error={errors['email']}
          />
          <TextField
            label="Phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            optional
            error={errors['phone']}
          />
          <TextField
            label="Organisation"
            name="organisation"
            autoComplete="organization"
            maxLength={160}
            optional
            error={errors['organisation']}
          />
        </div>
      </fieldset>

      <fieldset className="kz-eform__part">
        <legend>
          <span className="kz-eform__n">03</span> Your message
        </legend>
        <TextareaField
          label="Message"
          name="message"
          rows={6}
          maxLength={5000}
          hint="What do you need, and by when?"
          error={errors['message']}
          defaultValue={initialPackage ? `I'd like to request the ${initialPackage.name} package.\n\n` : undefined}
        />
      </fieldset>

      <div className="kz-hp" aria-hidden="true">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="kz-eform__foot">
        <p className="kz-eform__summary" aria-live="polite">
          <span>You are sending</span> {sending}
        </p>
        <CheckRow checked={consent} onChange={(e) => setConsent(e.target.checked)}>
          I agree that Kuzikode may use these details to reply to me, as described in the{' '}
          <a href="/legal/privacy">privacy policy</a>.
        </CheckRow>
        {errors['consent'] ? <p className="kz-error">{errors['consent']}</p> : null}
        <Turnstile siteKey={siteKey} onToken={onToken} resetSignal={reset} />
        {errors['turnstile'] ? <p className="kz-error">{errors['turnstile']}</p> : null}
        <Button type="submit" size="lg" loading={busy} className="kz-eform__send">
          Send message
        </Button>
      </div>
    </form>
  );
}
