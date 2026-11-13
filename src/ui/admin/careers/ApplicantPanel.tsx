/** One applicant's working panel (R6.2): stage, reviewer, rating and tags; internal notes; email templates; erase. */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { ConfirmSheet } from '../../primitives/sheet';
import { FormSheet } from '../form';
import { PaneBox } from '../PaneBox';
import { stageOptions, TEMPLATE_OPTIONS, useApplicant } from './useCareers';

export function ApplicantPanel({
  id,
  name,
  status,
  rating,
  tags,
  assignedTo,
  reviewers,
  hasEmail,
}: {
  id: string;
  name: string;
  status: string;
  rating: number | null;
  tags: string[];
  assignedTo: string | null;
  reviewers: { id: string; name: string }[];
  hasEmail: boolean;
}) {
  const a = useApplicant(id, { status, rating, tags, assignedTo });
  const [erase, setErase] = useState(false);
  const { v, setV } = a;
  return (
    <div className="kz-astack">
      {a.email || erase ? null : <FormAlert message={a.error} />}
      <PaneBox id="pipe-title" title="Pipeline">
        <div className="kz-astack">
          <SelectField label="Stage" value={v.status} onChange={(e) => setV((x) => ({ ...x, status: e.target.value }))}>
            {stageOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Reviewer"
            value={v.assignedTo}
            onChange={(e) => setV((x) => ({ ...x, assignedTo: e.target.value }))}
            error={a.err('assignedTo')}
          >
            <option value="">Nobody</option>
            {reviewers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectField>
          <fieldset className="kz-field">
            <legend className="kz-label">Rating</legend>
            <div className="kz-aacts-row">
              {[1, 2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  size="sm"
                  variant={v.rating === n ? 'primary' : 'secondary'}
                  aria-pressed={v.rating === n}
                  onClick={() => setV((x) => ({ ...x, rating: x.rating === n ? null : n }))}
                >
                  {n}
                  <span className="sr-only"> of 5</span>
                </Button>
              ))}
            </div>
          </fieldset>
          <TextField
            label="Tags"
            hint="Separate with commas"
            value={v.tags}
            onChange={(e) => setV((x) => ({ ...x, tags: e.target.value }))}
            error={a.err('tags')}
          />
          <div>
            <Button loading={a.busy} onClick={() => void a.save()}>
              Save
            </Button>
          </div>
        </div>
      </PaneBox>
      <PaneBox id="note-title" title="Internal note">
        <div className="kz-astack">
          <TextareaField
            label="Note"
            hint="Only staff see notes."
            rows={3}
            value={a.note}
            onChange={(e) => a.setNote(e.target.value)}
            maxLength={4000}
          />
          <div>
            <Button variant="secondary" disabled={!a.note.trim()} onClick={() => void a.addNote()}>
              Add note
            </Button>
          </div>
        </div>
      </PaneBox>
      <PaneBox id="mail-title" title={`Email ${name}`}>
        {hasEmail ? (
          <div className="kz-aacts-row">
            {TEMPLATE_OPTIONS.map((t) => (
              <Button key={t.value} variant="secondary" size="sm" onClick={() => void a.openEmail(t.value)}>
                {t.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="kz-hint">No email address on file.</p>
        )}
      </PaneBox>
      <div>
        <Button variant="quiet" onClick={() => setErase(true)}>
          Erase applicant
        </Button>
      </div>
      {a.email ? (
        <FormSheet
          open
          onClose={() => a.setEmail(null)}
          title="Email the applicant"
          formId="careers-email"
          submitLabel="Send email"
          busy={a.busy}
          error={a.error}
          onSubmit={(f) => void a.sendEmail(f)}
        >
          <p className="kz-adlg__desc">Edit the message for this person before sending.</p>
          <TextField
            label="Subject"
            name="subject"
            defaultValue={a.email.subject}
            maxLength={200}
            error={a.err('subject')}
          />
          <TextareaField
            label="Message"
            name="body"
            rows={10}
            defaultValue={a.email.body}
            maxLength={6000}
            error={a.err('body')}
          />
        </FormSheet>
      ) : null}
      <ConfirmSheet
        open={erase}
        onClose={() => setErase(false)}
        title={`Erase ${name}?`}
        confirmLabel="Erase applicant"
        danger
        onConfirm={() => a.erase()}
      >
        Deletes the CV and cover letter and removes every personal detail, note and email record. The anonymous entry
        stays for counts. This can't be undone.
      </ConfirmSheet>
    </div>
  );
}
