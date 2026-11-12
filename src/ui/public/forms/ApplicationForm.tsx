import type { CustomQuestion } from '../../../shared/schemas/careers';
import { Icon } from '../../icons/icon';
import { Button, CheckRow, SelectField, TextField, TextareaField } from '../../primitives';
import { FileField } from './FileField';
import { Turnstile } from './Turnstile';
import { useApplication } from './useApplication';

interface Props {
  /** Posting slug, or null for a general application. */
  slug: string | null;
  position: string;
  questions: CustomQuestion[];
  siteKey: string;
}

const DOC_ACCEPT = '.pdf,.docx';
const DOC_MAX = 5 * 1024 * 1024;

/**
 * Job application (docs/12 §B.1), rebuilt for R4.7. Numbered parts (IMG_5015 step progress, set as a ruled sequence): 01 About
 * you → 02 Your CV and links → 03 Cover letter → 04 The role's own questions (when the posting has any) → 05 Availability; then
 * consent, Turnstile and one action. Phones: one column, 16 px inputs, the action full width. Endpoints and fields unchanged.
 */
export default function ApplicationForm({ slug, position, questions, siteKey }: Props) {
  const a = useApplication(slug);
  const { errors } = a;

  if (a.reference) {
    return (
      <div role="status" className="kz-sent">
        <Icon name="status-ok" size={32} />
        <h2 className="kz-sent__title">Thank you for applying.</h2>
        <p>
          Your reference is <strong className="kz-sent__ref">{a.reference}</strong>. We have emailed you a confirmation
          and will be in touch if we would like to take your application for {position} further.
        </p>
      </div>
    );
  }

  const parts = questions.length > 0 ? ['04', '05'] : [null, '04'];
  return (
    <form
      onSubmit={a.submit}
      method="post"
      noValidate
      className="kz-eform kz-aform"
      aria-describedby={a.formError ? 'application-form-error' : undefined}
    >
      {a.formError ? (
        <p id="application-form-error" role="alert" className="kz-eform__alert">
          <Icon name="status-danger" size={20} />
          {a.formError}
        </p>
      ) : null}

      <fieldset className="kz-eform__part">
        <legend>
          <span className="kz-eform__n">01</span> About you
        </legend>
        <div className="kz-eform__grid">
          <TextField label="Full name" name="fullName" autoComplete="name" maxLength={120} error={errors['fullName']} />
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
            label="Where are you based?"
            name="location"
            autoComplete="address-level2"
            maxLength={120}
            optional
            error={errors['location']}
          />
        </div>
      </fieldset>

      <fieldset className="kz-eform__part">
        <legend>
          <span className="kz-eform__n">02</span> Your CV and links
        </legend>
        <FileField
          label="CV"
          accept={DOC_ACCEPT}
          maxBytes={DOC_MAX}
          hint="Required. PDF or Word (.docx), up to 5 MB."
          error={errors['cv']}
          onFile={a.setCv}
        />
        <div className="kz-eform__grid">
          <TextField
            label="LinkedIn profile"
            name="linkedinUrl"
            type="url"
            inputMode="url"
            maxLength={300}
            optional
            placeholder="https://"
            error={errors['linkedinUrl']}
          />
          <TextField
            label="Portfolio or GitHub"
            name="portfolioUrl"
            type="url"
            inputMode="url"
            maxLength={300}
            optional
            placeholder="https://"
            error={errors['portfolioUrl']}
          />
        </div>
      </fieldset>

      <fieldset className="kz-eform__part">
        <legend>
          <span className="kz-eform__n">03</span> Cover letter
        </legend>
        <TextareaField
          label="Cover letter"
          name="coverLetter"
          rows={6}
          maxLength={8000}
          hint="Optional. Type it here or attach a file below."
          error={errors['coverLetter']}
        />
        <FileField
          label="Cover letter file"
          accept={DOC_ACCEPT}
          maxBytes={DOC_MAX}
          optional
          hint="PDF or Word (.docx), up to 5 MB."
          error={errors['coverLetterFile']}
          onFile={a.setLetterFile}
        />
      </fieldset>

      {questions.length > 0 ? (
        <fieldset className="kz-eform__part">
          <legend>
            <span className="kz-eform__n">{parts[0]}</span> About this role
          </legend>
          {questions.map((q) => {
            const e = errors[`answers.${q.id}`];
            const value = a.answers[q.id] ?? '';
            const optional = !q.required;
            if (q.type === 'long_text')
              return (
                <TextareaField
                  key={q.id}
                  label={q.label}
                  optional={optional}
                  rows={4}
                  maxLength={4000}
                  value={value}
                  onChange={(ev) => a.setAnswer(q.id, ev.target.value)}
                  error={e}
                />
              );
            if (q.type === 'yes_no' || q.type === 'select') {
              const options =
                q.type === 'yes_no'
                  ? [
                      { value: 'yes', label: 'Yes' },
                      { value: 'no', label: 'No' },
                    ]
                  : (q.options ?? []).map((o) => ({ value: o, label: o }));
              return (
                <SelectField
                  key={q.id}
                  label={q.label}
                  optional={optional}
                  value={value}
                  onChange={(ev) => a.setAnswer(q.id, ev.target.value)}
                  error={e}
                >
                  <option value="">Choose…</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectField>
              );
            }
            return (
              <TextField
                key={q.id}
                label={q.label}
                optional={optional}
                maxLength={300}
                value={value}
                onChange={(ev) => a.setAnswer(q.id, ev.target.value)}
                error={e}
              />
            );
          })}
        </fieldset>
      ) : null}

      <fieldset className="kz-eform__part">
        <legend>
          <span className="kz-eform__n">{parts[1]}</span> Availability
        </legend>
        <div className="kz-eform__grid">
          <TextField
            label="Notice period or start date"
            name="noticePeriod"
            maxLength={120}
            optional
            error={errors['noticePeriod']}
          />
          <TextField
            label="Salary expectation"
            name="salaryExpectation"
            maxLength={120}
            optional
            error={errors['salaryExpectation']}
          />
        </div>
      </fieldset>

      <div className="kz-hp" aria-hidden="true">
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="kz-eform__foot">
        <p className="kz-eform__summary" aria-live="polite">
          <span>You are applying for</span> {position}
          {a.cv ? ` · CV: ${a.cv.name}` : ''}
        </p>
        <CheckRow checked={a.consent} onChange={(e) => a.setConsent(e.target.checked)}>
          I agree that Kuzikode may use these details to consider my application and keep them for 12 months after the
          position closes, as described in the <a href="/legal/privacy">privacy policy</a>.
        </CheckRow>
        {errors['consent'] ? <p className="kz-error">{errors['consent']}</p> : null}
        <Turnstile siteKey={siteKey} onToken={a.onToken} resetSignal={a.reset} />
        {errors['turnstile'] ? <p className="kz-error">{errors['turnstile']}</p> : null}
        <Button type="submit" size="lg" loading={a.busy} className="kz-eform__send">
          Submit application
        </Button>
      </div>
    </form>
  );
}
