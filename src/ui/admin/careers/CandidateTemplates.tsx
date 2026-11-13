/** Candidate email templates (R6.2): subject and message for each of the four emails, saved together. */
import { TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { FormSection, SaveBar } from '../form';
import { TEMPLATE_OPTIONS, useTemplates, type CandidateTemplates } from './useCareers';

export function CandidateTemplatesForm({ initial }: { initial: CandidateTemplates }) {
  const a = useTemplates(initial);
  const { t, setT } = a;
  return (
    <form
      noValidate
      className="kz-aedit"
      onSubmit={(e) => {
        e.preventDefault();
        void a.save();
      }}
    >
      <p className="kz-hint">
        Placeholders: <code>{'{name}'}</code> (first name), <code>{'{position}'}</code>, <code>{'{reference}'}</code>,{' '}
        <code>{'{company}'}</code>. Leave a blank line between paragraphs.
      </p>
      {TEMPLATE_OPTIONS.map(({ value, label }) => {
        const k = value as keyof typeof t;
        return (
          <FormSection key={k} id={`t-${k}`} title={label} cols={1}>
            <TextField
              label={`${label}: subject`}
              value={t[k].subject}
              onChange={(e) => setT({ ...t, [k]: { ...t[k], subject: e.target.value } })}
              maxLength={200}
              error={a.err(`${k}.subject`)}
            />
            <TextareaField
              label={`${label}: message`}
              rows={7}
              value={t[k].body}
              onChange={(e) => setT({ ...t, [k]: { ...t[k], body: e.target.value } })}
              maxLength={6000}
              error={a.err(`${k}.body`)}
            />
          </FormSection>
        );
      })}
      <SaveBar error={a.error} hint={a.saved ? 'Saved.' : undefined}>
        <Button type="submit" loading={a.busy}>
          Save templates
        </Button>
      </SaveBar>
      {a.saved ? (
        <p role="status" className="sr-only">
          Saved.
        </p>
      ) : null}
    </form>
  );
}
