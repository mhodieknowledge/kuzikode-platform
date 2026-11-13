import { useState } from 'react';
import { Icon } from '../../icons/icon';
import { Button, CheckRow, TextField, TextareaField } from '../../primitives';
import { Turnstile } from './Turnstile';
import { useEnquiry } from './useEnquiry';

interface Props {
  product: string;
  productName: string;
  siteKey: string;
}

/**
 * "Register interest" for a product in development (R4.7, rebuilt). Creates a `product_interest` enquiry through the shared
 * enquiry hook (unchanged endpoint and fields) and promises nothing: no dates, no offers. Phones: one column, the action full width.
 */
export default function InterestForm({ product, productName, siteKey }: Props) {
  const [consent, setConsent] = useState(false);
  const { submit, errors, formError, busy, reference, onToken, reset } = useEnquiry((f, token) => ({
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
  }));

  if (reference) {
    return (
      <div role="status" className="kz-sent">
        <Icon name="status-ok" size={32} />
        <p className="kz-sent__title">Thank you.</p>
        <p>
          We have noted your interest (reference <strong className="kz-sent__ref">{reference}</strong>) and will be in
          touch when there is news.
        </p>
      </div>
    );
  }

  const other = [errors['consent'], errors['turnstile'], errors['product']].filter(Boolean).join(' ');
  return (
    <form
      onSubmit={submit}
      noValidate
      className="kz-eform kz-iform"
      aria-describedby={formError ? 'interest-form-error' : undefined}
    >
      {formError ? (
        <p id="interest-form-error" role="alert" className="kz-eform__alert">
          <Icon name="status-danger" size={20} />
          {formError}
        </p>
      ) : null}
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
      </div>
      <TextField
        label="Organisation"
        name="organisation"
        autoComplete="organization"
        maxLength={160}
        optional
        error={errors['organisation']}
      />
      <TextareaField
        label="What would you use it for?"
        name="message"
        rows={3}
        maxLength={5000}
        defaultValue={`I would like to hear about ${productName} as it develops.`}
        error={errors['message']}
      />
      <div className="kz-hp" aria-hidden="true">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="kz-eform__foot">
        <CheckRow checked={consent} onChange={(e) => setConsent(e.target.checked)}>
          I agree that Kuzikode may contact me about this product, as described in the{' '}
          <a href="/legal/privacy">privacy policy</a>.
        </CheckRow>
        {other ? <p className="kz-error">{other}</p> : null}
        <Turnstile siteKey={siteKey} onToken={onToken} resetSignal={reset} />
        <Button type="submit" loading={busy} className="kz-eform__send">
          Register interest
        </Button>
      </div>
    </form>
  );
}
