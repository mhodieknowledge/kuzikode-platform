/**
 * Create / edit a job posting (R6.2): role, salary (money inputs are mono and right-aligned), dates in Harare time and the extra
 * applicant questions. Labels and the request body are unchanged (see useCareers.postingBody).
 */
import { useState, type FormEvent } from 'react';
import { Field, SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { MoneyInput } from '../../primitives/money';
import { RichText } from '../../primitives/RichText';
import { CheckItem, FormSection, SaveBar } from '../form';
import { firstListError, fromHarareInput, moveItem, patchAt, slugify, toHarareInput } from '../website/lib';
import { AddRow, RepeatRow } from '../website/parts';
import {
  blankQuestion,
  postingBody,
  usePostingSave,
  type ListText,
  type PostingFormValues,
  type Question,
} from './useCareers';

function QuestionsEditor({
  questions,
  setQuestions,
  err,
  listError,
}: {
  questions: Question[];
  setQuestions: (q: Question[]) => void;
  err: (key: string) => string | undefined;
  listError: string | undefined;
}) {
  const set = (i: number, patch: Partial<Question>) => setQuestions(patchAt(questions, i, patch));
  return (
    <>
      {listError ? <p className="kz-error">{listError}</p> : null}
      {questions.length === 0 ? <p className="kz-hint">No extra questions.</p> : null}
      <ol className="kz-wsr-list">
        {questions.map((q, i) => (
          <RepeatRow
            key={q.id}
            noun="question"
            index={i}
            count={questions.length}
            onMove={(to) => {
              const next = moveItem(questions, i, to);
              if (next) setQuestions(next);
            }}
            onRemove={() => setQuestions(questions.filter((_, k) => k !== i))}
            aside={
              <CheckItem checked={q.required} onChange={(e) => set(i, { required: e.target.checked })}>
                Required
              </CheckItem>
            }
          >
            <TextField
              label={`Question ${i + 1}`}
              value={q.label}
              onChange={(e) => set(i, { label: e.target.value })}
              maxLength={200}
              error={err(`questions.${i}.label`)}
            />
            <SelectField
              label="Answer type"
              value={q.type}
              onChange={(e) => set(i, { type: e.target.value as Question['type'] })}
            >
              <option value="short_text">Short text</option>
              <option value="long_text">Long text</option>
              <option value="yes_no">Yes / no</option>
              <option value="select">Choose one</option>
            </SelectField>
            {q.type === 'select' ? (
              <TextareaField
                label="Choices (one per line)"
                rows={3}
                value={(q.options ?? []).join('\n')}
                onChange={(e) => set(i, { options: e.target.value.split('\n').map((x) => x.trim()) })}
                error={err(`questions.${i}.options`)}
              />
            ) : null}
          </RepeatRow>
        ))}
      </ol>
      <AddRow
        label="Add question"
        onAdd={() => setQuestions([...questions, blankQuestion()])}
        disabled={questions.length >= 5}
        note="Up to 5."
      />
    </>
  );
}

export function PostingForm({ initial, currencies }: { initial: PostingFormValues; currencies: string[] }) {
  const a = usePostingSave(initial.id);
  const editing = !!initial.id;
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(editing);
  const [listText, setListText] = useState<ListText>({
    responsibilities: initial.responsibilities.join('\n'),
    requirements: initial.requirements.join('\n'),
    niceToHaves: initial.niceToHaves.join('\n'),
    offer: initial.offer.join('\n'),
  });
  const set = <K extends keyof PostingFormValues>(k: K, val: PostingFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const salaryCurrency = v.salaryCurrency ?? currencies[0] ?? 'USD';
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void a.save(postingBody(v, listText, slugTouched, salaryCurrency));
  }
  const listField = (k: keyof ListText, label: string) => (
    <TextareaField
      label={label}
      hint="One per line"
      rows={4}
      value={listText[k]}
      onChange={(ev) => setListText((t) => ({ ...t, [k]: ev.target.value }))}
      error={a.err(k)}
    />
  );
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection id="p-role" title="Role" description="What applicants read on /careers.">
        <TextField
          label="Job title"
          value={v.title}
          onChange={(ev) => set('title', ev.target.value)}
          maxLength={120}
          error={a.err('title')}
        />
        <TextField
          label="Web address"
          hint={`/careers/${slugTouched ? v.slug : v.slug || slugify(v.title) || '…'}`}
          value={slugTouched ? v.slug : v.slug || slugify(v.title)}
          onChange={(ev) => {
            setSlugTouched(true);
            set('slug', ev.target.value.toLowerCase());
          }}
          maxLength={80}
          error={a.err('slug')}
        />
        <TextField
          label="Department"
          value={v.department}
          onChange={(ev) => set('department', ev.target.value)}
          maxLength={80}
          error={a.err('department')}
        />
        <TextField
          label="Location"
          value={v.location}
          onChange={(ev) => set('location', ev.target.value)}
          maxLength={120}
          error={a.err('location')}
        />
        <SelectField
          label="Employment type"
          value={v.employmentType}
          onChange={(ev) => set('employmentType', ev.target.value as PostingFormValues['employmentType'])}
          error={a.err('employmentType')}
        >
          <option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option>
          <option value="contract">Contract</option>
          <option value="internship">Internship</option>
          <option value="attachment">Industrial attachment</option>
        </SelectField>
        <SelectField
          label="Workplace"
          value={v.workplace}
          onChange={(ev) => set('workplace', ev.target.value as PostingFormValues['workplace'])}
          error={a.err('workplace')}
        >
          <option value="onsite">On-site</option>
          <option value="hybrid">Hybrid</option>
          <option value="remote">Remote</option>
        </SelectField>
        <TextareaField
          label="Summary"
          rows={2}
          value={v.summary}
          onChange={(ev) => set('summary', ev.target.value)}
          maxLength={400}
          error={a.err('summary')}
          className="kz-span-2"
        />
        <Field label="Description" error={a.err('description')} className="kz-span-2">
          {(p) => (
            <RichText
              {...p}
              label="Description"
              value={v.description}
              onChange={(d) => set('description', d)}
              minHeight={140}
            />
          )}
        </Field>
        {listField('responsibilities', 'Responsibilities')}
        {listField('requirements', 'Requirements')}
        {listField('niceToHaves', 'Nice to have')}
        {listField('offer', 'What we offer')}
        <TextareaField
          label="How to apply"
          hint="Optional extra instructions"
          rows={2}
          value={v.howToApply ?? ''}
          onChange={(ev) => set('howToApply', ev.target.value || null)}
          maxLength={2000}
          error={a.err('howToApply')}
          className="kz-span-2"
        />
      </FormSection>
      <FormSection
        id="p-salary"
        title="Salary"
        description='Optional. Shown on the website only if you tick "Show salary".'
      >
        <SelectField
          label="Currency"
          value={salaryCurrency}
          onChange={(ev) => set('salaryCurrency', ev.target.value)}
          error={a.err('salaryCurrency')}
        >
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Per"
          value={v.salaryPeriod ?? 'month'}
          onChange={(ev) => set('salaryPeriod', ev.target.value as 'hour' | 'month' | 'year')}
          error={a.err('salaryPeriod')}
        >
          <option value="hour">Hour</option>
          <option value="month">Month</option>
          <option value="year">Year</option>
        </SelectField>
        <Field label="From" error={a.err('salaryMinMinor')}>
          {(p) => (
            <MoneyInput
              {...p}
              valueMinor={v.salaryMinMinor}
              onChangeMinor={(m) => set('salaryMinMinor', m)}
              currency={salaryCurrency}
            />
          )}
        </Field>
        <Field label="To" error={a.err('salaryMaxMinor')}>
          {(p) => (
            <MoneyInput
              {...p}
              valueMinor={v.salaryMaxMinor}
              onChangeMinor={(m) => set('salaryMaxMinor', m)}
              currency={salaryCurrency}
            />
          )}
        </Field>
        <div className="kz-span-2">
          <CheckItem checked={v.showSalary} onChange={(e) => set('showSalary', e.target.checked)}>
            Show salary on the website
          </CheckItem>
          {a.err('showSalary') ? <p className="kz-error">{a.err('showSalary')}</p> : null}
        </div>
      </FormSection>
      <FormSection id="p-dates" title="Dates" description="Times are Harare time.">
        <TextField
          label="Opens (Harare time)"
          hint="Leave empty to open as soon as you press Open"
          type="datetime-local"
          value={toHarareInput(v.opensAt)}
          onChange={(ev) => set('opensAt', fromHarareInput(ev.target.value))}
          error={a.err('opensAt')}
        />
        <TextField
          label="Closes (Harare time)"
          hint="The posting closes automatically then"
          type="datetime-local"
          value={toHarareInput(v.closesAt)}
          onChange={(ev) => set('closesAt', fromHarareInput(ev.target.value))}
          error={a.err('closesAt')}
        />
      </FormSection>
      <FormSection
        id="p-questions"
        title="Extra questions for applicants"
        description="Shown on the application form after the standard fields."
        wide
        cols={1}
      >
        <QuestionsEditor
          questions={v.questions}
          setQuestions={(q) => set('questions', q)}
          err={a.err}
          listError={firstListError(a.errors, 'questions')}
        />
      </FormSection>
      <SaveBar error={a.error}>
        <a href="/admin/careers" className="kz-btn kz-btn--secondary">
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          {editing ? 'Save posting' : 'Create draft'}
        </Button>
      </SaveBar>
    </form>
  );
}
