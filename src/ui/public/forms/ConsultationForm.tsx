import { useState } from 'react';
import { Icon } from '../../icons/icon';
import { Button, CheckRow, TextField, TextareaField } from '../../primitives';
import { Turnstile } from './Turnstile';
import { useEnquiry } from './useEnquiry';

const fmt = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short' }).format(d) + ' (your time)';
};

/**
 * Consultation request with up to three preferred times (docs/12 §C.8), used when no booking link is configured. Rebuilt for
 * R4.6: two numbered parts (your details and topic → times that suit you), the times as three slots in a row on wider screens and
 * stacked on phones. Endpoint and payload unchanged.
 */
export default function ConsultationForm({ siteKey }: { siteKey: string }) {
  const [consent, setConsent] = useState(false);
  const { submit, errors, formError, busy, reference, onToken, reset } = useEnquiry((f, token) => {
    const times = ['slot1', 'slot2', 'slot3']
      .map((k) => String(f.get(k) ?? '').trim())
      .filter(Boolean)
      .map(fmt);
    if (times.length === 0) return { errors: { preferredTimes: 'Suggest at least one time that suits you.' } };
    return {
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
    };
  });

  if (reference) {
    return (
      <div role="status" className="kz-sent">
        <Icon name="status-ok" size={32} />
        <h2 className="kz-sent__title">Thank you. We will confirm a time.</h2>
        <p>
          Your reference is <strong className="kz-sent__ref">{reference}</strong>. We will email you to confirm one of
          your suggested times, usually within one business day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="kz-eform">
      {formError ? (
        <p role="alert" className="kz-eform__alert">
          <Icon name="status-danger" size={20} />
          {formError}
        </p>
      ) : null}
      <fieldset className="kz-eform__part">
        <legend>
          <span className="kz-eform__n">01</span> About you and the call
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
        <TextareaField
          label="What would you like to discuss?"
          name="message"
          rows={4}
          maxLength={5000}
          error={errors['message']}
        />
      </fieldset>
      <fieldset className="kz-eform__part" aria-describedby={errors['preferredTimes'] ? 'times-error' : undefined}>
        <legend>
          <span className="kz-eform__n">02</span> Times that suit you
        </legend>
        <p className="kz-hint">Suggest up to three, in your local time. We confirm one by email.</p>
        <div className="kz-eform__slots">
          {[1, 2, 3].map((n) => (
            <TextField
              key={n}
              label={`Option ${n}`}
              name={`slot${n}`}
              type="datetime-local"
              optional={n > 1}
            />
          ))}
        </div>
        {errors['preferredTimes'] ? (
          <p className="kz-error" id="times-error">
            <Icon name="status-danger" size={16} />
            {errors['preferredTimes']}
          </p>
        ) : null}
      </fieldset>
      <div className="kz-hp" aria-hidden="true">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="kz-eform__foot">
        <CheckRow checked={consent} onChange={(e) => setConsent(e.target.checked)}>
          I agree that Kuzikode may use these details to arrange the call, as described in the{' '}
          <a href="/legal/privacy">privacy policy</a>.
        </CheckRow>
        {errors['consent'] ? <p className="kz-error">{errors['consent']}</p> : null}
        <Turnstile siteKey={siteKey} onToken={onToken} resetSignal={reset} />
        {errors['turnstile'] ? <p className="kz-error">{errors['turnstile']}</p> : null}
        <Button type="submit" size="lg" loading={busy} className="kz-eform__send">
          Request a consultation
        </Button>
      </div>
    </form>
  );
}
