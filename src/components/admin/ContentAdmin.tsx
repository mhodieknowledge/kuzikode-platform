/** Admin → Content islands (P4.22): article editor, categories, industry editor, FAQ, testimonials, technologies. */
import { useState, type FormEvent } from 'react';
import {
  apiFetch,
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  RichTextEditor,
  Select,
  Textarea,
} from '../ui';
import { Alert, useAction } from './actions';
import type { MediaOption } from './CmsAdmin';

const api = (path: string, init: { method?: string; body?: unknown } = {}) =>
  apiFetch<{ data: { id?: string } }>(`/api/v1/admin/content${path}`, init);
const reload = () => window.location.reload();
const toLocal = (iso: string | null) => (iso ? iso.slice(0, 16) : '');

const FAQ_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'projects', label: 'Projects' },
  { value: 'pricing', label: 'Pricing & payments' },
  { value: 'support', label: 'Support' },
  { value: 'careers', label: 'Careers' },
];

function DeleteButton({
  label,
  path,
  description,
  redirect,
}: {
  label: string;
  path: string;
  description: string;
  /** Where to go afterwards; defaults to reloading the current page. */
  redirect?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button size="sm" variant="ghost" aria-label={`Delete ${label}`} onClick={() => setOpen(true)}>
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${label}?`}
        description={error ?? description}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await api(path, { method: 'DELETE' });
            if (redirect) window.location.assign(redirect);
            else reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not delete.');
          }
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------- insights

export interface PostValues {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverMediaId: string | null;
  categoryId: string | null;
  tags: string[];
  authorDisplayName: string;
  status: 'draft' | 'scheduled' | 'published';
  publishAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export function PostEditor({
  id,
  initial,
  categories,
  media,
}: {
  id?: string;
  initial: PostValues;
  categories: { id: string; name: string }[];
  media: MediaOption[];
}) {
  const a = useAction();
  const [v, setV] = useState(initial);
  const [tags, setTags] = useState(initial.tags.join(', '));
  const set = (patch: Partial<PostValues>) => setV({ ...v, ...patch });
  const e = a.errors;
  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    await a.run(async () => {
      const body = {
        ...v,
        publishAt: v.status === 'scheduled' ? v.publishAt : null,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const res = await api(id ? `/posts/${id}` : '/posts', { method: id ? 'PUT' : 'POST', body });
      window.location.assign(`/admin/content/insights/${id ?? res.data.id}?saved=1`);
    });
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className="grid gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-2">
        <Field label="Title" required error={e['title']} className="sm:col-span-2">
          <Input value={v.title} maxLength={140} onChange={(x) => set({ title: x.target.value })} />
        </Field>
        <Field label="Address" required hint="Shown as /insights/your-address." error={e['slug']}>
          <Input value={v.slug} maxLength={80} onChange={(x) => set({ slug: x.target.value.trim().toLowerCase() })} />
        </Field>
        <Field label="Category" error={e['categoryId']}>
          <Select
            value={v.categoryId ?? ''}
            onChange={(x) => set({ categoryId: x.target.value || null })}
            options={[{ value: '', label: 'No category' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </Field>
        <Field
          label="Summary"
          required
          hint="One or two sentences for lists and search results."
          error={e['excerpt']}
          className="sm:col-span-2"
        >
          <Textarea rows={2} value={v.excerpt} maxLength={300} onChange={(x) => set({ excerpt: x.target.value })} />
        </Field>
        <Field label="Article" required error={e['body']} className="sm:col-span-2">
          <RichTextEditor label="Article" value={v.body} minHeight={320} onChange={(html) => set({ body: html })} />
        </Field>
        <Field label="Tags" hint="Separate with commas, up to 10." error={e['tags']}>
          <Input value={tags} maxLength={400} onChange={(x) => setTags(x.target.value)} />
        </Field>
        <Field label="Author shown" required error={e['authorDisplayName']}>
          <Input
            value={v.authorDisplayName}
            maxLength={80}
            onChange={(x) => set({ authorDisplayName: x.target.value })}
          />
        </Field>
        <Field label="Cover image" hint="From the media library." error={e['coverMediaId']}>
          <Select
            value={v.coverMediaId ?? ''}
            onChange={(x) => set({ coverMediaId: x.target.value || null })}
            options={[
              { value: '', label: 'No cover image' },
              ...media.map((m) => ({ value: m.id, label: m.alt_text })),
            ]}
          />
        </Field>
        <Field label="Status" error={e['status']}>
          <Select
            value={v.status}
            onChange={(x) => set({ status: x.target.value as PostValues['status'] })}
            options={[
              { value: 'draft', label: 'Draft (not on the website)' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'published', label: 'Published' },
            ]}
          />
        </Field>
        {v.status === 'scheduled' ? (
          <Field label="Publish at (UTC)" required error={e['publishAt']}>
            <Input
              type="datetime-local"
              value={toLocal(v.publishAt)}
              onChange={(x) => set({ publishAt: x.target.value || null })}
            />
          </Field>
        ) : null}
        <Field label="Search title" error={e['seoTitle']}>
          <Input value={v.seoTitle ?? ''} maxLength={70} onChange={(x) => set({ seoTitle: x.target.value || null })} />
        </Field>
        <Field label="Search description" error={e['seoDescription']}>
          <Input
            value={v.seoDescription ?? ''}
            maxLength={170}
            onChange={(x) => set({ seoDescription: x.target.value || null })}
          />
        </Field>
      </section>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" loading={a.busy}>
          {id ? 'Save' : 'Create article'}
        </Button>
        {id && initial.status === 'published' ? (
          <a
            href={`/insights/${initial.slug}`}
            target="_blank"
            rel="noopener"
            className="inline-flex h-12 items-center rounded-sm border border-line bg-surface px-4 text-[15px] font-semibold text-ink-950 hover:border-ink-400"
          >
            View on the website
          </a>
        ) : null}
        {id && initial.status === 'draft' ? (
          <DeleteButton
            label="article"
            path={`/posts/${id}`}
            redirect="/admin/content/insights"
            description="The draft is removed permanently. Published articles must be moved back to draft first."
          />
        ) : null}
      </div>
    </form>
  );
}

export function CategoriesManager({
  categories,
}: {
  categories: { id: string; slug: string; name: string; sort_order: number; posts: number }[];
}) {
  const a = useAction();
  const [editing, setEditing] = useState<(typeof categories)[number] | 'new' | null>(null);
  const current = editing && editing !== 'new' ? editing : null;
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {categories.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <span className="text-sm text-ink-950">
              {c.name} <span className="text-ink-600">· {c.posts} articles</span>
            </span>
            <span className="flex gap-1">
              <Button size="sm" variant="ghost" aria-label={`Edit category ${c.name}`} onClick={() => setEditing(c)}>
                Edit
              </Button>
              {c.posts === 0 ? (
                <DeleteButton
                  label={`category ${c.name}`}
                  path={`/post-categories/${c.id}`}
                  description="The category is removed."
                />
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <div>
        <Button variant="secondary" onClick={() => setEditing('new')}>
          New category
        </Button>
      </div>
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? 'Edit category' : 'New category'}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void a.run(async () => {
              await api(current ? `/post-categories/${current.id}` : '/post-categories', {
                method: current ? 'PUT' : 'POST',
                body: { name: f.get('name'), slug: f.get('slug'), sortOrder: Number(f.get('sortOrder')) || 0 },
              });
              reload();
            });
          }}
        >
          <Field label="Name" required error={a.errors['name']}>
            <Input name="name" defaultValue={current?.name ?? ''} maxLength={60} />
          </Field>
          <Field label="Address" required hint="Lowercase with hyphens, e.g. guides." error={a.errors['slug']}>
            <Input name="slug" defaultValue={current?.slug ?? ''} maxLength={80} />
          </Field>
          <Field label="Order" error={a.errors['sortOrder']}>
            <Input name="sortOrder" type="number" min={0} defaultValue={current?.sort_order ?? 0} />
          </Field>
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------- industries

export interface IndustryValues {
  slug: string;
  name: string;
  summary: string;
  challenges: { title: string; body: string }[];
  body: string | null;
  icon: string | null;
  status: 'draft' | 'published';
  sortOrder: number;
  serviceIds: string[];
  seoTitle: string | null;
  seoDescription: string | null;
}

export function IndustryEditor({
  id,
  initial,
  services,
  icons,
}: {
  id?: string;
  initial: IndustryValues;
  services: { id: string; name: string; division: string }[];
  icons: readonly string[];
}) {
  const a = useAction();
  const [v, setV] = useState(initial);
  const set = (patch: Partial<IndustryValues>) => setV({ ...v, ...patch });
  const e = a.errors;
  const setChallenge = (i: number, patch: Partial<{ title: string; body: string }>) =>
    set({ challenges: v.challenges.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const divisions = [...new Set(services.map((s) => s.division))];
  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    await a.run(async () => {
      const res = await api(id ? `/industries/${id}` : '/industries', { method: id ? 'PUT' : 'POST', body: v });
      window.location.assign(`/admin/content/industries/${id ?? res.data.id}?saved=1`);
    });
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className="grid gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-2">
        <Field label="Industry name" required error={e['name']}>
          <Input value={v.name} maxLength={80} onChange={(x) => set({ name: x.target.value })} />
        </Field>
        <Field label="Address" required hint="Shown as /industries/your-address." error={e['slug']}>
          <Input value={v.slug} maxLength={80} onChange={(x) => set({ slug: x.target.value.trim().toLowerCase() })} />
        </Field>
        <Field label="Summary" required error={e['summary']} className="sm:col-span-2">
          <Textarea rows={2} value={v.summary} maxLength={300} onChange={(x) => set({ summary: x.target.value })} />
        </Field>
        <Field label="Icon" error={e['icon']}>
          <Select
            value={v.icon ?? ''}
            onChange={(x) => set({ icon: x.target.value || null })}
            options={[{ value: '', label: 'Default' }, ...icons.map((i) => ({ value: i, label: i }))]}
          />
        </Field>
        <Field label="Status" error={e['status']}>
          <Select
            value={v.status}
            onChange={(x) => set({ status: x.target.value as IndustryValues['status'] })}
            options={[
              { value: 'draft', label: 'Draft (not on the website)' },
              { value: 'published', label: 'Published' },
            ]}
          />
        </Field>
        <Field label="Order" hint="Lower numbers come first." error={e['sortOrder']}>
          <Input
            type="number"
            min={0}
            value={v.sortOrder}
            onChange={(x) => set({ sortOrder: Number(x.target.value) || 0 })}
          />
        </Field>
        <Field label="More detail" error={e['body']} className="sm:col-span-2">
          <RichTextEditor label="More detail" value={v.body ?? ''} onChange={(html) => set({ body: html || null })} />
        </Field>
      </section>
      <fieldset className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
        <legend className="px-1 text-base font-semibold text-ink-950">Challenges we help with</legend>
        {v.challenges.length === 0 ? <p className="text-sm text-ink-600">No challenges listed yet.</p> : null}
        {v.challenges.map((c, i) => (
          <div key={i} className="grid gap-3 border-b border-line pb-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <Field label={`Challenge ${i + 1}`} error={e[`challenges.${i}.title`]}>
              <Input value={c.title} maxLength={100} onChange={(x) => setChallenge(i, { title: x.target.value })} />
            </Field>
            <Field label="How we help" error={e[`challenges.${i}.body`]}>
              <Input value={c.body} maxLength={400} onChange={(x) => setChallenge(i, { body: x.target.value })} />
            </Field>
            <Button
              type="button"
              variant="ghost"
              aria-label={`Remove challenge ${i + 1}`}
              onClick={() => set({ challenges: v.challenges.filter((_, j) => j !== i) })}
            >
              Remove
            </Button>
          </div>
        ))}
        {v.challenges.length < 8 ? (
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => set({ challenges: [...v.challenges, { title: '', body: '' }] })}
            >
              Add challenge
            </Button>
          </div>
        ) : null}
      </fieldset>
      <fieldset className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6">
        <legend className="px-1 text-base font-semibold text-ink-950">Relevant services</legend>
        {e['serviceIds'] ? <Alert message={e['serviceIds'].join(' ')} /> : null}
        {divisions.map((d) => (
          <div key={d}>
            <p className="mb-1.5 text-sm font-semibold text-ink-800">{d}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {services
                .filter((s) => s.division === d)
                .map((s) => (
                  <Checkbox
                    key={s.id}
                    label={s.name}
                    checked={v.serviceIds.includes(s.id)}
                    onCheckedChange={(c) =>
                      set({ serviceIds: c ? [...v.serviceIds, s.id] : v.serviceIds.filter((x) => x !== s.id) })
                    }
                  />
                ))}
            </div>
          </div>
        ))}
      </fieldset>
      <section className="grid gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-2">
        <Field label="Search title" error={e['seoTitle']}>
          <Input value={v.seoTitle ?? ''} maxLength={70} onChange={(x) => set({ seoTitle: x.target.value || null })} />
        </Field>
        <Field label="Search description" error={e['seoDescription']}>
          <Input
            value={v.seoDescription ?? ''}
            maxLength={170}
            onChange={(x) => set({ seoDescription: x.target.value || null })}
          />
        </Field>
      </section>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" loading={a.busy}>
          {id ? 'Save' : 'Create industry'}
        </Button>
        {id ? (
          <DeleteButton
            label="industry"
            path={`/industries/${id}`}
            redirect="/admin/content/industries"
            description="The industry page is removed from the website."
          />
        ) : null}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- FAQ

interface FaqRow {
  id: string;
  category: string;
  question: string;
  answer: string;
  service_id: string | null;
  service_name: string | null;
  sort_order: number;
  published: number;
}

export function FaqManager({ faqs, services }: { faqs: FaqRow[]; services: { id: string; name: string }[] }) {
  const a = useAction();
  const [editing, setEditing] = useState<FaqRow | 'new' | null>(null);
  const [published, setPublished] = useState(true);
  const current = editing && editing !== 'new' ? editing : null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          onClick={() => {
            setPublished(true);
            setEditing('new');
          }}
        >
          New question
        </Button>
      </div>
      {FAQ_CATEGORIES.map((cat) => {
        const rows = faqs.filter((f) => f.category === cat.value);
        return rows.length ? (
          <section key={cat.value} aria-label={cat.label}>
            <h2 className="mb-2 text-base font-semibold">{cat.label}</h2>
            <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
              {rows.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-950">{f.question}</p>
                    <p className="text-[12px] text-ink-600">
                      {f.published ? 'Published' : 'Hidden'}
                      {f.service_name ? ` · ${f.service_name}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit question: ${f.question}`}
                      onClick={() => {
                        setPublished(f.published === 1);
                        setEditing(f);
                      }}
                    >
                      Edit
                    </Button>
                    <DeleteButton label="question" path={`/faqs/${f.id}`} description={f.question} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null;
      })}
      {faqs.length === 0 ? <p className="text-sm text-ink-600">No questions yet.</p> : null}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? 'Edit question' : 'New question'}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void a.run(async () => {
              await api(current ? `/faqs/${current.id}` : '/faqs', {
                method: current ? 'PUT' : 'POST',
                body: {
                  category: f.get('category'),
                  question: f.get('question'),
                  answer: f.get('answer'),
                  serviceId: f.get('serviceId'),
                  sortOrder: Number(f.get('sortOrder')) || 0,
                  published,
                },
              });
              reload();
            });
          }}
        >
          <Field label="Category" error={a.errors['category']}>
            <Select name="category" defaultValue={current?.category ?? 'general'} options={FAQ_CATEGORIES} />
          </Field>
          <Field label="Question" required error={a.errors['question']}>
            <Input name="question" defaultValue={current?.question ?? ''} maxLength={200} />
          </Field>
          <Field label="Answer" required error={a.errors['answer']}>
            <Textarea name="answer" rows={4} defaultValue={current?.answer ?? ''} maxLength={2000} />
          </Field>
          <Field label="Related service" hint="Optional." error={a.errors['serviceId']}>
            <Select
              name="serviceId"
              defaultValue={current?.service_id ?? ''}
              options={[{ value: '', label: 'None' }, ...services.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </Field>
          <Field label="Order" error={a.errors['sortOrder']}>
            <Input name="sortOrder" type="number" min={0} defaultValue={current?.sort_order ?? 0} />
          </Field>
          <Checkbox label="Show on the website" checked={published} onCheckedChange={setPublished} />
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------- testimonials

interface TestimonialRow {
  id: string;
  client_id: string;
  client_name: string;
  project_id: string | null;
  project_name: string | null;
  author_name: string;
  author_role: string | null;
  quote: string;
  consent_date: string;
  published: number;
  sort_order: number;
}

export function TestimonialsManager({
  items,
  clients,
  projects,
  today,
}: {
  items: TestimonialRow[];
  clients: { id: string; name: string }[];
  projects: { id: string; client_id: string; name: string }[];
  today: string;
}) {
  const a = useAction();
  const [editing, setEditing] = useState<TestimonialRow | 'new' | null>(null);
  const [clientId, setClientId] = useState('');
  const [consent, setConsent] = useState(false);
  const [published, setPublished] = useState(false);
  const current = editing && editing !== 'new' ? editing : null;
  const open = (row: TestimonialRow | 'new') => {
    setClientId(row === 'new' ? '' : row.client_id);
    setConsent(row !== 'new');
    setPublished(row === 'new' ? false : row.published === 1);
    setEditing(row);
  };
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => open('new')} disabled={clients.length === 0}>
          New testimonial
        </Button>
        {clients.length === 0 ? (
          <p className="mt-2 text-sm text-ink-600">
            Add the client record first: every testimonial must come from a real client.
          </p>
        ) : null}
      </div>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {items.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-ink-600">
            No testimonials. The website hides the testimonials block until one is published.
          </li>
        ) : null}
        {items.map((t) => (
          <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 max-w-2xl">
              <p className="text-ink-950">“{t.quote}”</p>
              <p className="mt-1 text-[12px] text-ink-600">
                {t.author_name}
                {t.author_role ? `, ${t.author_role}` : ''} · {t.client_name}
                {t.project_name ? ` · ${t.project_name}` : ''} · consent {t.consent_date} ·{' '}
                {t.published ? 'Published' : 'Hidden'}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Edit testimonial from ${t.author_name}`}
                onClick={() => open(t)}
              >
                Edit
              </Button>
              <DeleteButton label="testimonial" path={`/testimonials/${t.id}`} description={`From ${t.author_name}.`} />
            </div>
          </li>
        ))}
      </ul>
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? 'Edit testimonial' : 'New testimonial'}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void a.run(async () => {
              await api(current ? `/testimonials/${current.id}` : '/testimonials', {
                method: current ? 'PUT' : 'POST',
                body: {
                  clientId,
                  projectId: f.get('projectId'),
                  authorName: f.get('authorName'),
                  authorRole: f.get('authorRole'),
                  quote: f.get('quote'),
                  consentObtained: consent,
                  consentDate: f.get('consentDate'),
                  published,
                  sortOrder: Number(f.get('sortOrder')) || 0,
                },
              });
              reload();
            });
          }}
        >
          <Field label="Client" required error={a.errors['clientId']}>
            <Select
              value={clientId}
              onChange={(x) => setClientId(x.target.value)}
              options={[
                { value: '', label: 'Choose a client' },
                ...clients.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </Field>
          <Field label="Project" hint="Optional." error={a.errors['projectId']}>
            <Select
              key={clientId}
              name="projectId"
              defaultValue={current?.client_id === clientId ? (current?.project_id ?? '') : ''}
              options={[
                { value: '', label: 'None' },
                ...projects.filter((p) => p.client_id === clientId).map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Person quoted" required error={a.errors['authorName']}>
              <Input name="authorName" defaultValue={current?.author_name ?? ''} maxLength={100} />
            </Field>
            <Field label="Their role" error={a.errors['authorRole']}>
              <Input name="authorRole" defaultValue={current?.author_role ?? ''} maxLength={100} />
            </Field>
          </div>
          <Field label="Quote" required hint="Their words, unedited apart from spelling." error={a.errors['quote']}>
            <Textarea name="quote" rows={4} defaultValue={current?.quote ?? ''} maxLength={800} />
          </Field>
          <Checkbox
            label="The client agreed in writing to this quote being published"
            checked={consent}
            onCheckedChange={setConsent}
          />
          {a.errors['consentObtained'] ? <Alert message={a.errors['consentObtained'].join(' ')} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date consent was given" required error={a.errors['consentDate']}>
              <Input name="consentDate" type="date" max={today} defaultValue={current?.consent_date ?? ''} />
            </Field>
            <Field label="Order" error={a.errors['sortOrder']}>
              <Input name="sortOrder" type="number" min={0} defaultValue={current?.sort_order ?? 0} />
            </Field>
          </div>
          <Checkbox label="Show on the website" checked={published} onCheckedChange={setPublished} />
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------- technologies

interface TechRow {
  id: string;
  name: string;
  category: string;
  logo_svg_path: string | null;
  sort_order: number;
  published: number;
}

export function TechnologiesManager({ items }: { items: TechRow[] }) {
  const a = useAction();
  const [editing, setEditing] = useState<TechRow | 'new' | null>(null);
  const [published, setPublished] = useState(true);
  const current = editing && editing !== 'new' ? editing : null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          onClick={() => {
            setPublished(true);
            setEditing('new');
          }}
        >
          New technology
        </Button>
      </div>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {items.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-ink-600">No technologies listed.</li>
        ) : null}
        {items.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <span className="text-sm text-ink-950">
              {t.name}{' '}
              <span className="text-ink-600">
                · {t.category}
                {t.published ? '' : ' · Hidden'}
              </span>
            </span>
            <span className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Edit ${t.name}`}
                onClick={() => {
                  setPublished(t.published === 1);
                  setEditing(t);
                }}
              >
                Edit
              </Button>
              <DeleteButton
                label={t.name}
                path={`/technologies/${t.id}`}
                description="It is removed from the technologies strip."
              />
            </span>
          </li>
        ))}
      </ul>
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? 'Edit technology' : 'New technology'}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void a.run(async () => {
              await api(current ? `/technologies/${current.id}` : '/technologies', {
                method: current ? 'PUT' : 'POST',
                body: {
                  name: f.get('name'),
                  category: f.get('category'),
                  logoSvgPath: f.get('logoSvgPath'),
                  sortOrder: Number(f.get('sortOrder')) || 0,
                  published,
                },
              });
              reload();
            });
          }}
        >
          <Field label="Name" required error={a.errors['name']}>
            <Input name="name" defaultValue={current?.name ?? ''} maxLength={40} />
          </Field>
          <Field label="Group" required hint="For example Languages, Frameworks, Cloud." error={a.errors['category']}>
            <Input name="category" defaultValue={current?.category ?? ''} maxLength={40} />
          </Field>
          <Field
            label="Logo"
            hint="Optional site path to a monochrome SVG, e.g. /tech/react.svg."
            error={a.errors['logoSvgPath']}
          >
            <Input name="logoSvgPath" defaultValue={current?.logo_svg_path ?? ''} maxLength={200} />
          </Field>
          <Field label="Order" error={a.errors['sortOrder']}>
            <Input name="sortOrder" type="number" min={0} defaultValue={current?.sort_order ?? 0} />
          </Field>
          <Checkbox label="Show on the website" checked={published} onCheckedChange={setPublished} />
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
