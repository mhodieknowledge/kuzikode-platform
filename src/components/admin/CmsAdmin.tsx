/** CMS islands (P4.15): section draft editor, page publishing, portfolio, products, announcements, media library. */
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { FieldDef } from '../../shared/cms-fields';
import {
  apiFetch,
  Button,
  Checkbox,
  ConfirmDialog,
  DateInput,
  Dialog,
  Field,
  IconButton,
  Input,
  RichTextEditor,
  Select,
  Textarea,
} from '../ui';
import { Alert, useAction } from './actions';

const api = (path: string, init: { method?: string; body?: unknown } = {}) =>
  apiFetch<{ data: { id?: string } }>(`/api/v1/admin/cms${path}`, init);
const reload = () => window.location.reload();

export interface MediaOption {
  id: string;
  file_id: string;
  alt_text: string;
}

// ---------------------------------------------------------------- section editor

type Value = Record<string, unknown>;

function FieldInput({
  def,
  value,
  onChange,
  idPrefix,
  errors,
}: {
  def: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  idPrefix: string;
  errors: Record<string, string[]>;
}) {
  const err = errors[`${idPrefix}${def.key}`];
  const label = def.optional ? `${def.label} (optional)` : def.label;
  switch (def.kind) {
    case 'text':
      return (
        <Field label={label} error={err}>
          <Input value={String(value ?? '')} maxLength={def.max} onChange={(e) => onChange(e.target.value)} />
        </Field>
      );
    case 'textarea':
      return (
        <Field label={label} error={err}>
          <Textarea
            rows={3}
            value={String(value ?? '')}
            maxLength={def.max}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      );
    case 'html':
      return (
        <Field label={label} error={err}>
          <RichTextEditor label={def.label} value={String(value ?? '')} onChange={onChange} minHeight={200} />
        </Field>
      );
    case 'cta': {
      const v = (value ?? {}) as { label?: string; href?: string };
      const set = (patch: Partial<typeof v>) => {
        const next = { ...v, ...patch };
        onChange(def.optional && !next.label && !next.href ? undefined : next);
      };
      return (
        <fieldset className="grid gap-3 rounded-sm border border-line p-3 sm:grid-cols-2">
          <legend className="px-1 text-sm font-medium text-ink-950">{label}</legend>
          <Field label="Button text" error={errors[`${idPrefix}${def.key}.label`]}>
            <Input value={v.label ?? ''} maxLength={60} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field
            label="Link"
            hint="A page like /contact or a full https:// address."
            error={errors[`${idPrefix}${def.key}.href`]}
          >
            <Input value={v.href ?? ''} maxLength={500} onChange={(e) => set({ href: e.target.value })} />
          </Field>
        </fieldset>
      );
    }
    case 'strings': {
      const list = (Array.isArray(value) ? value : []) as string[];
      return (
        <Field label={`${label} (one per line)`} error={err}>
          <Textarea
            rows={Math.max(3, list.length + 1)}
            value={list.join('\n')}
            onChange={(e) =>
              onChange(
                e.target.value
                  .split('\n')
                  .map((s) => s.trimStart())
                  .filter((s, i, a) => s || i < a.length - 1),
              )
            }
          />
        </Field>
      );
    }
    case 'items': {
      const list = (Array.isArray(value) ? value : []) as Value[];
      const setItem = (i: number, v: Value) => onChange(list.map((x, j) => (j === i ? v : x)));
      return (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium text-ink-950">{label}</legend>
          {list.map((item, i) => (
            <div key={i} className="rounded-sm border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-ink-600">
                  {def.label} {i + 1}
                </p>
                <Button size="sm" variant="ghost" onClick={() => onChange(list.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              </div>
              <div className="grid gap-3">
                {(def.item ?? []).map((f) => (
                  <FieldInput
                    key={f.key}
                    def={f}
                    value={item[f.key]}
                    onChange={(v) => setItem(i, { ...item, [f.key]: v === '' && f.optional ? undefined : v })}
                    idPrefix={`${idPrefix}${def.key}.${i}.`}
                    errors={errors}
                  />
                ))}
              </div>
            </div>
          ))}
          {list.length < (def.maxItems ?? 20) ? (
            <Button size="sm" variant="secondary" className="self-start" onClick={() => onChange([...list, {}])}>
              Add {def.label.toLowerCase().replace(/s$/, '')}
            </Button>
          ) : null}
          {err ? <p className="text-[13px] text-danger-600">{err[0]}</p> : null}
        </fieldset>
      );
    }
  }
}

export function SectionEditor({
  pageKey,
  sectionKey,
  typeLabel,
  fields,
  draft,
  visible,
  changed,
  first,
  last,
}: {
  pageKey: string;
  sectionKey: string;
  typeLabel: string;
  fields: FieldDef[];
  draft: Value;
  visible: boolean;
  changed: boolean;
  first: boolean;
  last: boolean;
}) {
  const a = useAction();
  const [value, setValue] = useState<Value>(draft);
  const [saved, setSaved] = useState(false);
  const base = `/pages/${pageKey}/sections/${sectionKey}`;
  const clean = (v: Value): Value => Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined));
  return (
    <section className="rounded-lg border border-line bg-surface p-5" aria-label={`Section ${sectionKey}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-base font-semibold">{typeLabel}</h2>
          <p className="text-[12px] text-ink-600">
            {sectionKey}
            {visible ? '' : ' · hidden'}
            {changed ? ' · unpublished changes' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            label={`Move ${sectionKey} up`}
            disabled={first}
            onClick={() => a.run(async () => (await api(`${base}/move`, { body: { direction: 'up' } }), reload()))}
          >
            <ArrowUp size={16} aria-hidden="true" />
          </IconButton>
          <IconButton
            label={`Move ${sectionKey} down`}
            disabled={last}
            onClick={() => a.run(async () => (await api(`${base}/move`, { body: { direction: 'down' } }), reload()))}
          >
            <ArrowDown size={16} aria-hidden="true" />
          </IconButton>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              a.run(async () => (await api(`${base}/visibility`, { body: { visible: !visible } }), reload()))
            }
          >
            {visible ? 'Hide' : 'Show'}
          </Button>
        </div>
      </div>
      <form
        noValidate
        className="mt-4 flex flex-col gap-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          setSaved(false);
          void a.run(async () => {
            await api(base, { method: 'PUT', body: { content: clean(value) } });
            setSaved(true);
          });
        }}
      >
        {fields.map((f) => (
          <FieldInput
            key={f.key}
            def={f}
            value={value[f.key]}
            onChange={(v) => setValue({ ...value, [f.key]: v === '' && f.optional ? undefined : v })}
            idPrefix=""
            errors={a.errors}
          />
        ))}
        <Alert message={a.error} />
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" loading={a.busy}>
            Save draft
          </Button>
          {saved ? (
            <p role="status" className="text-sm text-success-700">
              Draft saved. Preview it, then publish.
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

export function PublishBar({
  pageKey,
  previewHref,
  liveHref,
}: {
  pageKey: string;
  previewHref: string;
  liveHref: string;
}) {
  const a = useAction();
  const [confirm, setConfirm] = useState<null | 'publish' | 'discard'>(null);
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <a
          href={previewHref}
          target="_blank"
          rel="noopener"
          className="inline-flex h-10 items-center rounded-sm border border-line bg-surface px-4 text-sm font-semibold text-ink-950 hover:border-ink-400"
        >
          Preview drafts
        </a>
        <a
          href={liveHref}
          target="_blank"
          rel="noopener"
          className="inline-flex h-10 items-center px-2 text-sm font-semibold text-brand-600 underline"
        >
          View live page
        </a>
        <Button variant="ghost" onClick={() => setConfirm('discard')}>
          Discard changes
        </Button>
        <Button onClick={() => setConfirm('publish')}>Publish page</Button>
      </div>
      <Alert message={a.error} />
      <ConfirmDialog
        open={confirm === 'publish'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Publish this page?"
        description="All saved drafts on this page go live now and the site cache is refreshed."
        confirmLabel="Publish"
        onConfirm={() => a.run(async () => (await api(`/pages/${pageKey}/publish`, { body: {} }), reload()))}
      />
      <ConfirmDialog
        open={confirm === 'discard'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Discard unpublished changes?"
        description="Every section goes back to what is live now."
        confirmLabel="Discard"
        destructive
        onConfirm={() => a.run(async () => (await api(`/pages/${pageKey}/discard`, { body: {} }), reload()))}
      />
    </div>
  );
}

export function PageMetaForm({
  pageKey,
  initial,
  media,
}: {
  pageKey: string;
  initial: { title: string; seoTitle: string | null; seoDescription: string | null; ogImageId: string | null };
  media: MediaOption[];
}) {
  const a = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        setSaved(false);
        void a.run(async () => {
          await api(`/pages/${pageKey}`, {
            method: 'PUT',
            body: {
              title: f.get('title'),
              seoTitle: f.get('seoTitle'),
              seoDescription: f.get('seoDescription'),
              ogImageId: f.get('ogImageId') || null,
            },
          });
          setSaved(true);
        });
      }}
    >
      <Field label="Page title" required error={a.errors['title']}>
        <Input name="title" defaultValue={initial.title} maxLength={120} />
      </Field>
      <Field label="Search title" hint="Up to 70 characters. Empty uses the page title." error={a.errors['seoTitle']}>
        <Input name="seoTitle" defaultValue={initial.seoTitle ?? ''} maxLength={70} />
      </Field>
      <Field label="Search description" hint="Up to 170 characters." error={a.errors['seoDescription']}>
        <Textarea name="seoDescription" rows={3} defaultValue={initial.seoDescription ?? ''} maxLength={170} />
      </Field>
      <Field label="Share image" hint="Shown when the page is shared." error={a.errors['ogImageId']}>
        <Select
          name="ogImageId"
          defaultValue={initial.ogImageId ?? ''}
          options={[{ value: '', label: 'Default' }, ...media.map((m) => ({ value: m.id, label: m.alt_text }))]}
        />
      </Field>
      <Alert message={a.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" loading={a.busy}>
          Save details
        </Button>
        {saved ? (
          <p role="status" className="text-sm text-success-700">
            Saved and live.
          </p>
        ) : null}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- portfolio

export interface PortfolioValues {
  slug: string;
  name: string;
  clientName: string | null;
  showClientName: boolean;
  category: string;
  summary: string;
  description: string | null;
  challenge: string | null;
  solution: string | null;
  technologies: string[];
  completionDate: string | null;
  externalUrl: string | null;
  coverMediaId: string | null;
  galleryMediaIds: string[];
  featured: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
}

export function PortfolioForm({
  id,
  status,
  initial,
  media,
}: {
  id?: string;
  status?: string;
  initial: PortfolioValues;
  media: MediaOption[];
}) {
  const a = useAction();
  const [v, setV] = useState(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch: Partial<PortfolioValues>) => setV({ ...v, ...patch });
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await a.run(async () => {
      const res = await api(id ? `/portfolio/${id}` : '/portfolio', { method: id ? 'PUT' : 'POST', body: v });
      window.location.assign(`/admin/cms/portfolio/${id ?? res.data.id}`);
    });
  }
  const e = a.errors;
  const mediaOptions = media.map((m) => ({ value: m.id, label: m.alt_text }));
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className="grid gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-2">
        <Field label="Project name" required error={e['name']}>
          <Input value={v.name} maxLength={120} onChange={(x) => set({ name: x.target.value })} />
        </Field>
        <Field label="Address" required hint="Shown as /work/your-address." error={e['slug']}>
          <Input value={v.slug} maxLength={80} onChange={(x) => set({ slug: x.target.value })} />
        </Field>
        <Field label="Category" required error={e['category']}>
          <Input value={v.category} maxLength={60} onChange={(x) => set({ category: x.target.value })} />
        </Field>
        <Field label="Completed" error={e['completionDate']}>
          <DateInput value={v.completionDate ?? ''} onChange={(x) => set({ completionDate: x.target.value || null })} />
        </Field>
        <Field label="Client name" hint="Only shown with the client's permission." error={e['clientName']}>
          <Input
            value={v.clientName ?? ''}
            maxLength={120}
            onChange={(x) => set({ clientName: x.target.value || null })}
          />
        </Field>
        <div className="flex items-end">
          <Checkbox
            label="The client agreed to be named"
            checked={v.showClientName}
            onCheckedChange={(c) => set({ showClientName: c })}
          />
        </div>
        <Field label="Summary" required error={e['summary']} className="sm:col-span-2">
          <Textarea rows={2} value={v.summary} maxLength={300} onChange={(x) => set({ summary: x.target.value })} />
        </Field>
        <Field label="Overview" error={e['description']} className="sm:col-span-2">
          <RichTextEditor
            label="Overview"
            value={v.description ?? ''}
            onChange={(h) => set({ description: h || null })}
          />
        </Field>
        <Field label="The challenge" error={e['challenge']} className="sm:col-span-2">
          <RichTextEditor
            label="The challenge"
            value={v.challenge ?? ''}
            onChange={(h) => set({ challenge: h || null })}
          />
        </Field>
        <Field label="Our solution" error={e['solution']} className="sm:col-span-2">
          <RichTextEditor
            label="Our solution"
            value={v.solution ?? ''}
            onChange={(h) => set({ solution: h || null })}
          />
        </Field>
        <Field label="Technologies" hint="Separate with commas." error={e['technologies']}>
          <Input
            value={v.technologies.join(', ')}
            onChange={(x) =>
              set({
                technologies: x.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          />
        </Field>
        <Field label="Live site" hint="Optional https:// address." error={e['externalUrl']}>
          <Input value={v.externalUrl ?? ''} onChange={(x) => set({ externalUrl: x.target.value || null })} />
        </Field>
        <Field label="Cover image" error={e['coverMediaId']}>
          <Select
            value={v.coverMediaId ?? ''}
            onChange={(x) => set({ coverMediaId: x.target.value || null })}
            options={[{ value: '', label: 'No cover image' }, ...mediaOptions]}
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
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium text-ink-950">Gallery</legend>
          {media.length === 0 ? (
            <p className="text-sm text-ink-600">Upload images in the media library first.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {media.map((m) => (
                <Checkbox
                  key={m.id}
                  label={m.alt_text}
                  checked={v.galleryMediaIds.includes(m.id)}
                  onCheckedChange={(c) =>
                    set({
                      galleryMediaIds: c ? [...v.galleryMediaIds, m.id] : v.galleryMediaIds.filter((x) => x !== m.id),
                    })
                  }
                />
              ))}
            </div>
          )}
        </fieldset>
        <div className="sm:col-span-2">
          <Checkbox
            label="Feature on the home page"
            checked={v.featured}
            onCheckedChange={(c) => set({ featured: c })}
          />
        </div>
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
          {id ? 'Save' : 'Create draft'}
        </Button>
        {id ? (
          <>
            <a
              href={`/work/${initial.slug}?preview=1`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-12 items-center rounded-sm border border-line bg-surface px-4 text-[15px] font-semibold text-ink-950 hover:border-ink-400"
            >
              Preview
            </a>
            <Button
              size="lg"
              variant="secondary"
              onClick={() =>
                a.run(async () => {
                  await api(`/portfolio/${id}/status`, {
                    body: { status: status === 'published' ? 'draft' : 'published' },
                  });
                  reload();
                })
              }
            >
              {status === 'published' ? 'Unpublish' : 'Publish'}
            </Button>
            {status !== 'published' ? (
              <Button size="lg" variant="ghost" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this case study?"
        description="It was never published or has been unpublished. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          a.run(async () => {
            await api(`/portfolio/${id}`, { method: 'DELETE' });
            window.location.assign('/admin/cms/portfolio');
          })
        }
      />
    </form>
  );
}

// ---------------------------------------------------------------- products & announcements

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  status: 'in_development' | 'beta' | 'available';
  interest_form_enabled: number;
  sort_order: number;
  published: number;
}

const PRODUCT_STATUS = [
  { value: 'in_development', label: 'In development' },
  { value: 'beta', label: 'Beta' },
  { value: 'available', label: 'Available' },
];

export function ProductsManager({ products }: { products: ProductRow[] }) {
  const a = useAction();
  const [editing, setEditing] = useState<ProductRow | 'new' | null>(null);
  const [flags, setFlags] = useState({ interest: false, published: false });
  const current = editing && editing !== 'new' ? editing : null;
  const open = (p: ProductRow | 'new') => {
    setFlags(
      p === 'new'
        ? { interest: false, published: false }
        : { interest: p.interest_form_enabled === 1, published: p.published === 1 },
    );
    setEditing(p);
  };
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => open('new')}>New product</Button>
      </div>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {products.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-ink-600">No products yet.</li>
        ) : null}
        {products.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-ink-950">{p.name}</p>
              <p className="text-[12px] text-ink-600">
                /{p.slug} · {PRODUCT_STATUS.find((s) => s.value === p.status)?.label} ·{' '}
                {p.published ? 'shown on the website' : 'hidden'}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => open(p)}>
              Edit
            </Button>
          </li>
        ))}
      </ul>
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        size="lg"
        title={current ? `Edit ${current.name}` : 'New product'}
      >
        <form
          noValidate
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void a.run(async () => {
              await api(current ? `/products/${current.id}` : '/products', {
                method: current ? 'PUT' : 'POST',
                body: {
                  slug: f.get('slug'),
                  name: f.get('name'),
                  tagline: f.get('tagline'),
                  description: f.get('description'),
                  status: f.get('status'),
                  sortOrder: Number(f.get('sortOrder') ?? 0) || 0,
                  interestFormEnabled: flags.interest,
                  published: flags.published,
                },
              });
              reload();
            });
          }}
        >
          <Field label="Name" required error={a.errors['name']}>
            <Input name="name" defaultValue={current?.name ?? ''} maxLength={80} />
          </Field>
          <Field label="Address" required error={a.errors['slug']}>
            <Input name="slug" defaultValue={current?.slug ?? ''} maxLength={80} />
          </Field>
          <Field label="Tagline" error={a.errors['tagline']} className="sm:col-span-2">
            <Input name="tagline" defaultValue={current?.tagline ?? ''} maxLength={160} />
          </Field>
          <Field label="Description" required error={a.errors['description']} className="sm:col-span-2">
            <Textarea name="description" rows={4} defaultValue={current?.description ?? ''} maxLength={5000} />
          </Field>
          <Field label="Status" error={a.errors['status']}>
            <Select name="status" defaultValue={current?.status ?? 'in_development'} options={PRODUCT_STATUS} />
          </Field>
          <Field label="Order" error={a.errors['sortOrder']}>
            <Input name="sortOrder" type="number" min={0} defaultValue={current?.sort_order ?? 0} />
          </Field>
          <Checkbox
            label="Offer the 'keep me posted' form"
            checked={flags.interest}
            onCheckedChange={(c) => setFlags({ ...flags, interest: c })}
          />
          <Checkbox
            label="Show on the website"
            checked={flags.published}
            onCheckedChange={(c) => setFlags({ ...flags, published: c })}
          />
          <div className="sm:col-span-2">
            <Alert message={a.error} />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
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

interface AnnouncementRow {
  id: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  level: 'info' | 'important';
  starts_at: string | null;
  ends_at: string | null;
  active: number;
}

const toLocal = (iso: string | null) => (iso ? iso.slice(0, 16) : '');

export function AnnouncementsManager({ announcements }: { announcements: AnnouncementRow[] }) {
  const a = useAction();
  const [editing, setEditing] = useState<AnnouncementRow | 'new' | null>(null);
  const [active, setActive] = useState(true);
  const current = editing && editing !== 'new' ? editing : null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button
          onClick={() => {
            setActive(true);
            setEditing('new');
          }}
        >
          New announcement
        </Button>
      </div>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {announcements.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-ink-600">No announcements.</li>
        ) : null}
        {announcements.map((n) => (
          <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium text-ink-950">{n.message}</p>
              <p className="text-[12px] text-ink-600">
                {n.active ? 'Active' : 'Off'} · {n.level}
                {n.starts_at ? ` · from ${n.starts_at.slice(0, 16).replace('T', ' ')} UTC` : ''}
                {n.ends_at ? ` · until ${n.ends_at.slice(0, 16).replace('T', ' ')} UTC` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setActive(n.active === 1);
                  setEditing(n);
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete announcement: ${n.message}`}
                onClick={() => a.run(async () => (await api(`/announcements/${n.id}`, { method: 'DELETE' }), reload()))}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Alert message={editing ? null : a.error} />
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? 'Edit announcement' : 'New announcement'}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void a.run(async () => {
              await api(current ? `/announcements/${current.id}` : '/announcements', {
                method: current ? 'PUT' : 'POST',
                body: {
                  message: f.get('message'),
                  linkUrl: f.get('linkUrl'),
                  linkLabel: f.get('linkLabel'),
                  level: f.get('level'),
                  startsAt: f.get('startsAt'),
                  endsAt: f.get('endsAt'),
                  active,
                },
              });
              reload();
            });
          }}
        >
          <Field label="Message" required error={a.errors['message']}>
            <Textarea name="message" rows={2} defaultValue={current?.message ?? ''} maxLength={240} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Link" hint="Optional, e.g. /contact." error={a.errors['linkUrl']}>
              <Input name="linkUrl" defaultValue={current?.link_url ?? ''} maxLength={500} />
            </Field>
            <Field label="Link text" error={a.errors['linkLabel']}>
              <Input name="linkLabel" defaultValue={current?.link_label ?? ''} maxLength={40} />
            </Field>
            <Field label="Starts (UTC)" error={a.errors['startsAt']}>
              <Input name="startsAt" type="datetime-local" defaultValue={toLocal(current?.starts_at ?? null)} />
            </Field>
            <Field label="Ends (UTC)" error={a.errors['endsAt']}>
              <Input name="endsAt" type="datetime-local" defaultValue={toLocal(current?.ends_at ?? null)} />
            </Field>
            <Field label="Style">
              <Select
                name="level"
                defaultValue={current?.level ?? 'info'}
                options={[
                  { value: 'info', label: 'Information' },
                  { value: 'important', label: 'Important' },
                ]}
              />
            </Field>
          </div>
          <Checkbox label="Active" checked={active} onCheckedChange={setActive} />
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

// ---------------------------------------------------------------- media library

interface MediaItem extends MediaOption {
  caption: string | null;
  folder: string | null;
  width: number | null;
  height: number | null;
  original_name: string;
}

export function MediaLibrary({ media, canManage }: { media: MediaItem[]; canManage: boolean }) {
  const a = useAction();
  const [editing, setEditing] = useState<MediaItem | null>(null);
  return (
    <div className="flex flex-col gap-6">
      {canManage ? (
        <form
          noValidate
          className="grid gap-4 rounded-lg border border-line bg-surface p-5 sm:grid-cols-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            const form = new FormData(ev.currentTarget);
            void a.run(async () => {
              await apiFetch('/api/v1/admin/cms/media', { method: 'POST', body: form });
              reload();
            });
          }}
        >
          <Field label="Image" required hint="PNG, JPEG, WebP or AVIF up to 5 MB. No SVG." error={a.errors['file']}>
            <Input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/avif" />
          </Field>
          <Field
            label="Alt text"
            required
            hint="What the image shows, for people who can't see it."
            error={a.errors['altText']}
          >
            <Input name="altText" maxLength={300} />
          </Field>
          <Field label="Caption" error={a.errors['caption']}>
            <Input name="caption" maxLength={300} />
          </Field>
          <Field label="Folder" hint="Optional, to group images." error={a.errors['folder']}>
            <Input name="folder" maxLength={60} />
          </Field>
          <div className="sm:col-span-2">
            <Alert message={editing ? null : a.error} />
            <Button type="submit" loading={a.busy}>
              Upload image
            </Button>
          </div>
        </form>
      ) : null}
      {media.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface px-4 py-10 text-center text-sm text-ink-600">
          No images yet.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {media.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-lg border border-line bg-surface">
              <img
                src={`/media/${m.file_id}`}
                alt={m.alt_text}
                loading="lazy"
                className="aspect-[4/3] w-full bg-canvas object-cover"
                {...(m.width && m.height ? { width: m.width, height: m.height } : {})}
              />
              <div className="p-3">
                <p className="line-clamp-2 text-sm text-ink-950">{m.alt_text}</p>
                <p className="mt-1 text-[12px] text-ink-600">
                  {m.original_name}
                  {m.width && m.height ? ` · ${m.width}×${m.height}` : ''}
                  {m.folder ? ` · ${m.folder}` : ''}
                </p>
                {canManage ? (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete image: ${m.alt_text}`}
                      onClick={() => a.run(async () => (await api(`/media/${m.id}`, { method: 'DELETE' }), reload()))}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title="Edit image details">
        {editing ? (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              const f = new FormData(ev.currentTarget);
              void a.run(async () => {
                await api(`/media/${editing.id}`, {
                  method: 'PUT',
                  body: { altText: f.get('altText'), caption: f.get('caption'), folder: f.get('folder') },
                });
                reload();
              });
            }}
          >
            <Field label="Alt text" required error={a.errors['altText']}>
              <Input name="altText" defaultValue={editing.alt_text} maxLength={300} />
            </Field>
            <Field label="Caption" error={a.errors['caption']}>
              <Input name="caption" defaultValue={editing.caption ?? ''} maxLength={300} />
            </Field>
            <Field label="Folder" error={a.errors['folder']}>
              <Input name="folder" defaultValue={editing.folder ?? ''} maxLength={60} />
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
        ) : null}
      </Dialog>
    </div>
  );
}
