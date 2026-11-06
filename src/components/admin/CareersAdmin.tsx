/** Admin → Careers islands (P4.21): posting editor and actions, applicant pipeline, applicant panel, email templates. */
import { ArrowDown, ArrowUp, Plus, Star, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  apiFetch,
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  Field,
  IconButton,
  Input,
  MoneyInput,
  RichTextEditor,
  Select,
  Textarea,
} from '../ui';
import { Alert, useAction } from './actions';
import { slugify } from './ServicesAdmin';

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};
export const PIPELINE = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'] as const;

// ---------------------------------------------------------------- posting editor

interface Question {
  id: string;
  label: string;
  type: 'short_text' | 'long_text' | 'yes_no' | 'select';
  required: boolean;
  options?: string[];
}

export interface PostingFormValues {
  id?: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'internship' | 'attachment';
  workplace: 'onsite' | 'hybrid' | 'remote';
  salaryMinMinor: number | null;
  salaryMaxMinor: number | null;
  salaryCurrency: string | null;
  salaryPeriod: 'hour' | 'month' | 'year' | null;
  showSalary: boolean;
  summary: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  niceToHaves: string[];
  offer: string[];
  howToApply: string | null;
  questions: Question[];
  opensAt: string | null;
  closesAt: string | null;
}

/** ISO → value for <input type="datetime-local"> (Harare time, UTC+2). */
const toLocal = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() + 2 * 3600_000).toISOString().slice(0, 16) : '';
const fromLocal = (v: string) => (v ? new Date(`${v}:00+02:00`).toISOString() : null);
const lines = (v: string) =>
  v
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

function QuestionsEditor({
  questions,
  setQuestions,
  errors,
}: {
  questions: Question[];
  setQuestions: (q: Question[]) => void;
  errors: Record<string, string[]>;
}) {
  const set = (i: number, patch: Partial<Question>) =>
    setQuestions(questions.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= questions.length) return;
    const next = [...questions];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m!);
    setQuestions(next);
  };
  return (
    <div className="flex flex-col gap-3">
      {errors['questions'] ? <p className="text-[13px] text-danger-700">{errors['questions'].join(' ')}</p> : null}
      {questions.length === 0 ? <p className="text-sm text-ink-600">No extra questions.</p> : null}
      <ol className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <li key={q.id} className="rounded-md border border-line p-3">
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <Field label={`Question ${i + 1}`} required error={errors[`questions.${i}.label`]}>
                <Input value={q.label} onChange={(e) => set(i, { label: e.target.value })} maxLength={200} />
              </Field>
              <Field label="Answer type">
                <Select
                  value={q.type}
                  onChange={(e) => set(i, { type: e.target.value as Question['type'] })}
                  options={[
                    { value: 'short_text', label: 'Short text' },
                    { value: 'long_text', label: 'Long text' },
                    { value: 'yes_no', label: 'Yes / no' },
                    { value: 'select', label: 'Choose one' },
                  ]}
                />
              </Field>
              {q.type === 'select' ? (
                <Field
                  label="Choices (one per line)"
                  error={errors[`questions.${i}.options`]}
                  className="sm:col-span-2"
                >
                  <Textarea
                    rows={3}
                    value={(q.options ?? []).join('\n')}
                    onChange={(e) => set(i, { options: e.target.value.split('\n').map((x) => x.trim()) })}
                  />
                </Field>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Checkbox label="Required" checked={q.required} onCheckedChange={(c) => set(i, { required: c })} />
              <div className="flex gap-1">
                <IconButton
                  size="sm"
                  label={`Move question ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </IconButton>
                <IconButton
                  size="sm"
                  label={`Move question ${i + 1} down`}
                  disabled={i === questions.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown size={16} aria-hidden="true" />
                </IconButton>
                <IconButton
                  size="sm"
                  label={`Remove question ${i + 1}`}
                  onClick={() => setQuestions(questions.filter((_, k) => k !== i))}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </IconButton>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <Button
          variant="secondary"
          disabled={questions.length >= 5}
          onClick={() =>
            setQuestions([
              ...questions,
              { id: `q${Date.now().toString(36)}`, label: '', type: 'short_text', required: false },
            ])
          }
        >
          <Plus size={16} aria-hidden="true" /> Add question
        </Button>
        <span className="ml-3 text-[13px] text-ink-600">Up to 5.</span>
      </div>
    </div>
  );
}

export function PostingForm({ initial, currencies }: { initial: PostingFormValues; currencies: string[] }) {
  const a = useAction();
  const editing = !!initial.id;
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(editing);
  const [listText, setListText] = useState({
    responsibilities: initial.responsibilities.join('\n'),
    requirements: initial.requirements.join('\n'),
    niceToHaves: initial.niceToHaves.join('\n'),
    offer: initial.offer.join('\n'),
  });
  const set = <K extends keyof PostingFormValues>(k: K, val: PostingFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const salaryCurrency = v.salaryCurrency ?? currencies[0] ?? 'USD';
  const hasSalary = v.salaryMinMinor != null || v.salaryMaxMinor != null;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { id: _id, ...rest } = v;
    const body = {
      ...rest,
      slug: slugTouched ? v.slug : v.slug || slugify(v.title),
      salaryCurrency: hasSalary ? salaryCurrency : null,
      salaryPeriod: hasSalary ? (v.salaryPeriod ?? 'month') : null,
      responsibilities: lines(listText.responsibilities),
      requirements: lines(listText.requirements),
      niceToHaves: lines(listText.niceToHaves),
      offer: lines(listText.offer),
      questions: v.questions.map((q) => ({
        ...q,
        ...(q.type === 'select' ? { options: (q.options ?? []).filter(Boolean) } : { options: undefined }),
      })),
    };
    await a.run(async () => {
      if (editing) {
        await apiFetch(`/api/v1/admin/careers/postings/${initial.id}`, { method: 'PUT', body });
        window.location.assign(`/admin/careers/${initial.id}?saved=1`);
      } else {
        const res = await apiFetch<{ data: { id: string } }>('/api/v1/admin/careers/postings', { body });
        window.location.assign(`/admin/careers/${res.data.id}?saved=1`);
      }
    });
  }
  const e = a.errors;
  const listField = (k: keyof typeof listText, label: string) => (
    <Field label={label} hint="One per line" error={e[k]}>
      <Textarea rows={4} value={listText[k]} onChange={(ev) => setListText((t) => ({ ...t, [k]: ev.target.value }))} />
    </Field>
  );
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="p-role">
        <h2 id="p-role" className="font-sans text-base font-semibold">
          Role
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Job title" required error={e['title']}>
            <Input value={v.title} onChange={(ev) => set('title', ev.target.value)} maxLength={120} />
          </Field>
          <Field
            label="Web address"
            required
            hint={`/careers/${slugTouched ? v.slug : v.slug || slugify(v.title) || '…'}`}
            error={e['slug']}
          >
            <Input
              value={slugTouched ? v.slug : v.slug || slugify(v.title)}
              onChange={(ev) => {
                setSlugTouched(true);
                set('slug', ev.target.value.toLowerCase());
              }}
              maxLength={80}
            />
          </Field>
          <Field label="Department" required error={e['department']}>
            <Input value={v.department} onChange={(ev) => set('department', ev.target.value)} maxLength={80} />
          </Field>
          <Field label="Location" required error={e['location']}>
            <Input value={v.location} onChange={(ev) => set('location', ev.target.value)} maxLength={120} />
          </Field>
          <Field label="Employment type" required error={e['employmentType']}>
            <Select
              value={v.employmentType}
              onChange={(ev) => set('employmentType', ev.target.value as PostingFormValues['employmentType'])}
              options={[
                { value: 'full_time', label: 'Full-time' },
                { value: 'part_time', label: 'Part-time' },
                { value: 'contract', label: 'Contract' },
                { value: 'internship', label: 'Internship' },
                { value: 'attachment', label: 'Industrial attachment' },
              ]}
            />
          </Field>
          <Field label="Workplace" required error={e['workplace']}>
            <Select
              value={v.workplace}
              onChange={(ev) => set('workplace', ev.target.value as PostingFormValues['workplace'])}
              options={[
                { value: 'onsite', label: 'On-site' },
                { value: 'hybrid', label: 'Hybrid' },
                { value: 'remote', label: 'Remote' },
              ]}
            />
          </Field>
          <Field label="Summary" required error={e['summary']} className="sm:col-span-2">
            <Textarea rows={2} value={v.summary} onChange={(ev) => set('summary', ev.target.value)} maxLength={400} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Description" error={e['description']}>
            <RichTextEditor
              label="Description"
              value={v.description}
              onChange={(d) => set('description', d)}
              minHeight={140}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {listField('responsibilities', 'Responsibilities')}
          {listField('requirements', 'Requirements')}
          {listField('niceToHaves', 'Nice to have')}
          {listField('offer', 'What we offer')}
          <Field
            label="How to apply"
            hint="Optional extra instructions"
            error={e['howToApply']}
            className="sm:col-span-2"
          >
            <Textarea
              rows={2}
              value={v.howToApply ?? ''}
              onChange={(ev) => set('howToApply', ev.target.value || null)}
              maxLength={2000}
            />
          </Field>
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="p-salary">
        <h2 id="p-salary" className="font-sans text-base font-semibold">
          Salary
        </h2>
        <p className="mt-1 text-sm text-ink-600">Optional. Shown on the website only if you tick "Show salary".</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Field label="Currency" error={e['salaryCurrency']}>
            <Select
              value={salaryCurrency}
              onChange={(ev) => set('salaryCurrency', ev.target.value)}
              options={currencies.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="From" error={e['salaryMinMinor']}>
            <MoneyInput
              valueMinor={v.salaryMinMinor}
              onChangeMinor={(m) => set('salaryMinMinor', m)}
              currency={salaryCurrency}
            />
          </Field>
          <Field label="To" error={e['salaryMaxMinor']}>
            <MoneyInput
              valueMinor={v.salaryMaxMinor}
              onChangeMinor={(m) => set('salaryMaxMinor', m)}
              currency={salaryCurrency}
            />
          </Field>
          <Field label="Per" error={e['salaryPeriod']}>
            <Select
              value={v.salaryPeriod ?? 'month'}
              onChange={(ev) => set('salaryPeriod', ev.target.value as 'hour' | 'month' | 'year')}
              options={[
                { value: 'hour', label: 'Hour' },
                { value: 'month', label: 'Month' },
                { value: 'year', label: 'Year' },
              ]}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Checkbox
            label="Show salary on the website"
            checked={v.showSalary}
            onCheckedChange={(c) => set('showSalary', c)}
          />
          {e['showSalary'] ? <p className="mt-1 text-[13px] text-danger-700">{e['showSalary'].join(' ')}</p> : null}
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="p-dates">
        <h2 id="p-dates" className="font-sans text-base font-semibold">
          Dates
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Opens (Harare time)" hint="Leave empty to open as soon as you press Open" error={e['opensAt']}>
            <Input
              type="datetime-local"
              value={toLocal(v.opensAt)}
              onChange={(ev) => set('opensAt', fromLocal(ev.target.value))}
            />
          </Field>
          <Field label="Closes (Harare time)" hint="The posting closes automatically then" error={e['closesAt']}>
            <Input
              type="datetime-local"
              value={toLocal(v.closesAt)}
              onChange={(ev) => set('closesAt', fromLocal(ev.target.value))}
            />
          </Field>
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="p-questions">
        <h2 id="p-questions" className="font-sans text-base font-semibold">
          Extra questions for applicants
        </h2>
        <div className="mt-4">
          <QuestionsEditor questions={v.questions} setQuestions={(q) => set('questions', q)} errors={e} />
        </div>
      </section>
      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={a.busy}>
          {editing ? 'Save posting' : 'Create draft'}
        </Button>
        <a href="/admin/careers" className="inline-flex h-12 items-center px-4 text-[15px] font-semibold text-ink-800">
          Cancel
        </a>
      </div>
    </form>
  );
}

/** Open / close / archive / reopen / duplicate. Which buttons show depends on the status. */
export function PostingActions({ id, status }: { id: string; status: 'draft' | 'open' | 'closed' | 'archived' }) {
  const a = useAction();
  const [confirm, setConfirm] = useState<'open' | 'closed' | 'archived' | 'draft' | null>(null);
  const post = (path: string, body: unknown) =>
    a.run(async () => {
      const res = await apiFetch<{ data?: { id?: string } }>(`/api/v1/admin/careers/postings/${id}/${path}`, { body });
      window.location.assign(res.data?.id ? `/admin/careers/${res.data.id}?saved=1` : `/admin/careers/${id}`);
    });
  const label = {
    open: status === 'closed' ? 'Reopen' : 'Open for applications',
    closed: 'Close posting',
    archived: 'Archive posting',
    draft: 'Restore as draft',
  };
  const options: ('open' | 'closed' | 'archived' | 'draft')[] =
    status === 'draft'
      ? ['open', 'archived']
      : status === 'open'
        ? ['closed']
        : status === 'closed'
          ? ['open', 'archived']
          : ['draft'];
  return (
    <div className="flex flex-col gap-2">
      <Alert message={a.error} />
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button key={o} variant={o === 'open' ? 'primary' : 'secondary'} onClick={() => setConfirm(o)}>
            {label[o]}
          </Button>
        ))}
        <Button variant="ghost" loading={a.busy} onClick={() => void post('duplicate', {})}>
          Duplicate
        </Button>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? `${label[confirm]}?` : ''}
        description={
          confirm === 'open'
            ? 'It appears on /careers (from its opening time) and accepts applications until it closes.'
            : confirm === 'closed'
              ? 'It stops accepting applications. Applicants are kept for the retention period.'
              : confirm === 'archived'
                ? 'It disappears from the website.'
                : 'It becomes an editable draft again.'
        }
        confirmLabel={confirm ? label[confirm] : ''}
        onConfirm={() => post('status', { status: confirm })}
      />
    </div>
  );
}

// ---------------------------------------------------------------- pipeline

export interface ApplicantCard {
  id: string;
  reference: string;
  name: string;
  posting: string | null;
  status: string;
  rating: number | null;
  tags: string[];
  assignee: string | null;
  createdAt: string;
  erased: boolean;
}

function Rating({ value }: { value: number | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px] text-ink-800" aria-label={`Rated ${value} of 5`}>
      <Star size={12} aria-hidden="true" className="fill-accent-500 text-accent-500" /> {value}
    </span>
  );
}

/** List or kanban of applicants, with "Move to" on each card and bulk reject (+ regret email). */
export function ApplicantsPipeline({
  items,
  view,
  canManage,
}: {
  items: ApplicantCard[];
  view: 'list' | 'board';
  canManage: boolean;
}) {
  const a = useAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [regret, setRegret] = useState(true);
  const [status, setStatus] = useState('');
  const move = (id: string, to: string) =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/careers/applications/${id}`, { method: 'PATCH', body: { status: to } });
      setStatus(`Moved to ${STATUS_LABELS[to]}.`);
      window.location.reload();
    });
  const toggle = (id: string, on: boolean) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  const card = (c: ApplicantCard) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <a href={`/admin/careers/applications/${c.id}`} className="font-semibold text-ink-950 hover:underline">
          {c.name}
        </a>
        <Rating value={c.rating} />
      </div>
      <p className="text-[12px] text-ink-600">
        {c.reference}
        {c.posting ? ` · ${c.posting}` : ''}
        {c.assignee ? ` · ${c.assignee}` : ''}
      </p>
      {c.tags.length ? (
        <p className="flex flex-wrap gap-1">
          {c.tags.map((t) => (
            <span key={t} className="rounded-full bg-ink-950/5 px-2 py-0.5 text-[11px] text-ink-800">
              {t}
            </span>
          ))}
        </p>
      ) : null}
      {canManage && !c.erased ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label={`Move ${c.name} to`}
            className="h-8 text-[13px]"
            value={c.status}
            onChange={(e) => void move(c.id, e.target.value)}
            options={PIPELINE.map((s) => ({ value: s, label: STATUS_LABELS[s]! }))}
          />
          {!['rejected', 'withdrawn', 'hired'].includes(c.status) ? (
            <Checkbox label="Select" checked={selected.includes(c.id)} onCheckedChange={(on) => toggle(c.id, on)} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <Alert message={rejectOpen ? null : a.error} />
      <p className="sr-only" role="status">
        {status}
      </p>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={selected.length === 0} onClick={() => setRejectOpen(true)}>
            Reject selected ({selected.length})
          </Button>
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-6 text-sm text-ink-600">No applicants match.</p>
      ) : view === 'board' ? (
        <div className="relative overflow-x-auto pb-2">
          <div className="grid min-w-[1100px] grid-cols-7 gap-3" role="list" aria-label="Pipeline">
            {PIPELINE.map((s) => {
              const col = items.filter((c) => c.status === s);
              return (
                <section
                  key={s}
                  role="listitem"
                  aria-label={`${STATUS_LABELS[s]} (${col.length})`}
                  className="rounded-lg bg-ink-950/[0.03] p-2"
                >
                  <h2 className="px-1 pb-2 text-[13px] font-semibold text-ink-800">
                    {STATUS_LABELS[s]} <span className="text-ink-600">({col.length})</span>
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {col.map((c) => (
                      <li key={c.id} className="rounded-md border border-line bg-surface p-3 text-sm">
                        {card(c)}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 text-sm">
              <div className="min-w-0 flex-1">{card(c)}</div>
              <span className="shrink-0 rounded-full bg-ink-950/5 px-2 py-0.5 text-[12px] font-semibold text-ink-800">
                {STATUS_LABELS[c.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={`Reject ${selected.length} ${selected.length === 1 ? 'applicant' : 'applicants'}?`}
        description="They move to Rejected. The regret email uses your saved template."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={a.busy}
              onClick={() =>
                void a.run(async () => {
                  await apiFetch('/api/v1/admin/careers/applications/reject', {
                    body: { ids: selected, sendRegret: regret },
                  });
                  window.location.reload();
                })
              }
            >
              Reject
            </Button>
          </div>
        }
      >
        <Alert message={a.error} />
        <Checkbox label="Send the regret email" checked={regret} onCheckedChange={setRegret} />
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------- one applicant

const TEMPLATE_OPTIONS = [
  { value: 'received', label: 'Application received' },
  { value: 'interview', label: 'Interview invitation' },
  { value: 'regret', label: 'Regret (not progressing)' },
  { value: 'offer', label: 'Offer' },
];

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
  const a = useAction();
  const [v, setV] = useState({ status, rating, tags: tags.join(', '), assignedTo: assignedTo ?? '' });
  const [note, setNote] = useState('');
  const [email, setEmail] = useState<{ template: string; subject: string; body: string } | null>(null);
  const [erase, setErase] = useState(false);
  const save = () =>
    a.run(async () => {
      await apiFetch(`/api/v1/admin/careers/applications/${id}`, {
        method: 'PATCH',
        body: {
          status: v.status,
          rating: v.rating,
          tags: v.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          assignedTo: v.assignedTo || null,
        },
      });
      window.location.reload();
    });
  const openEmail = (template: string) =>
    a.run(async () => {
      const res = await apiFetch<{ data: { subject: string; body: string } }>(
        `/api/v1/admin/careers/applications/${id}/email-draft?template=${template}`,
      );
      setEmail({ template, ...res.data });
    });
  return (
    <div className="flex flex-col gap-6">
      <Alert message={email || erase ? null : a.error} />
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="pipe-title">
        <h2 id="pipe-title" className="font-sans text-base font-semibold">
          Pipeline
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Stage">
            <Select
              value={v.status}
              onChange={(e) => setV((x) => ({ ...x, status: e.target.value }))}
              options={PIPELINE.map((s) => ({ value: s, label: STATUS_LABELS[s]! }))}
            />
          </Field>
          <Field label="Reviewer" error={a.errors['assignedTo']}>
            <Select
              value={v.assignedTo}
              onChange={(e) => setV((x) => ({ ...x, assignedTo: e.target.value }))}
              options={[{ value: '', label: 'Nobody' }, ...reviewers.map((r) => ({ value: r.id, label: r.name }))]}
            />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1 text-sm font-medium text-ink-950">Rating</legend>
            <div className="flex flex-wrap gap-2">
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
          <Field label="Tags" hint="Separate with commas" className="sm:col-span-2" error={a.errors['tags']}>
            <Input value={v.tags} onChange={(e) => setV((x) => ({ ...x, tags: e.target.value }))} />
          </Field>
        </div>
        <div className="mt-4">
          <Button loading={a.busy} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="note-title">
        <h2 id="note-title" className="font-sans text-base font-semibold">
          Internal note
        </h2>
        <Field label="Note" hint="Only staff see notes." className="mt-3">
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} />
        </Field>
        <Button
          className="mt-3"
          variant="secondary"
          disabled={!note.trim()}
          onClick={() =>
            void a.run(async () => {
              await apiFetch(`/api/v1/admin/careers/applications/${id}/notes`, { body: { body: note } });
              window.location.reload();
            })
          }
        >
          Add note
        </Button>
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="mail-title">
        <h2 id="mail-title" className="font-sans text-base font-semibold">
          Email {name}
        </h2>
        {hasEmail ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {TEMPLATE_OPTIONS.map((t) => (
              <Button key={t.value} variant="secondary" size="sm" onClick={() => void openEmail(t.value)}>
                {t.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-600">No email address on file.</p>
        )}
      </section>
      <div>
        <Button variant="ghost" onClick={() => setErase(true)}>
          Erase applicant
        </Button>
      </div>
      <Dialog
        open={email !== null}
        onOpenChange={(o) => !o && setEmail(null)}
        title="Email the applicant"
        description="Edit the message for this person before sending."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEmail(null)}>
              Cancel
            </Button>
            <Button
              loading={a.busy}
              onClick={() =>
                void a.run(async () => {
                  await apiFetch(`/api/v1/admin/careers/applications/${id}/email`, { body: email });
                  window.location.reload();
                })
              }
            >
              Send email
            </Button>
          </div>
        }
      >
        {email ? (
          <div className="flex flex-col gap-4">
            <Alert message={a.error} />
            <Field label="Subject" error={a.errors['subject']}>
              <Input
                value={email.subject}
                onChange={(e) => setEmail({ ...email, subject: e.target.value })}
                maxLength={200}
              />
            </Field>
            <Field label="Message" error={a.errors['body']}>
              <Textarea
                rows={10}
                value={email.body}
                onChange={(e) => setEmail({ ...email, body: e.target.value })}
                maxLength={6000}
              />
            </Field>
          </div>
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={erase}
        onOpenChange={setErase}
        title={`Erase ${name}?`}
        description="Deletes the CV and cover letter and removes every personal detail, note and email record. The anonymous entry stays for counts. This can't be undone."
        confirmLabel="Erase applicant"
        destructive
        onConfirm={() =>
          a.run(async () => {
            await apiFetch(`/api/v1/admin/careers/applications/${id}/erase`, { body: {} });
            window.location.reload();
          })
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------- templates

export function CandidateTemplatesForm({
  initial,
}: {
  initial: Record<'received' | 'interview' | 'regret' | 'offer', { subject: string; body: string }>;
}) {
  const a = useAction();
  const [t, setT] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        void a.run(async () => {
          await apiFetch('/api/v1/admin/careers/templates', { method: 'PUT', body: t });
          setSaved(true);
        });
      }}
    >
      <Alert message={a.error} />
      <p className="text-sm text-ink-600">
        Placeholders: <code>{'{name}'}</code> (first name), <code>{'{position}'}</code>, <code>{'{reference}'}</code>,{' '}
        <code>{'{company}'}</code>. Leave a blank line between paragraphs.
      </p>
      {TEMPLATE_OPTIONS.map(({ value, label }) => {
        const k = value as keyof typeof t;
        return (
          <section key={k} className="rounded-lg border border-line bg-surface p-6" aria-labelledby={`t-${k}`}>
            <h2 id={`t-${k}`} className="font-sans text-base font-semibold">
              {label}
            </h2>
            <div className="mt-4 grid gap-4">
              <Field label={`${label}: subject`} error={a.errors[`${k}.subject`]}>
                <Input
                  value={t[k].subject}
                  onChange={(e) => setT({ ...t, [k]: { ...t[k], subject: e.target.value } })}
                  maxLength={200}
                />
              </Field>
              <Field label={`${label}: message`} error={a.errors[`${k}.body`]}>
                <Textarea
                  rows={7}
                  value={t[k].body}
                  onChange={(e) => setT({ ...t, [k]: { ...t[k], body: e.target.value } })}
                  maxLength={6000}
                />
              </Field>
            </div>
          </section>
        );
      })}
      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" loading={a.busy}>
          Save templates
        </Button>
        {saved ? (
          <p role="status" className="text-sm text-success-700">
            Saved.
          </p>
        ) : null}
      </div>
    </form>
  );
}
