/** Admin → Services islands (P4.6): sortable divisions/services, division and service editors. */
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState, type DragEvent, type FormEvent } from 'react';
import { CMS_ICONS } from '../../shared/icons';
import {
  ApiError,
  apiFetch,
  Button,
  Checkbox,
  ConfirmDialog,
  Field,
  IconButton,
  Input,
  MoneyInput,
  RichTextEditor,
  Select,
  Textarea,
} from '../ui';

export function useAction() {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(err.status === 422 ? 'Please check the highlighted fields.' : err.message);
      } else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return { errors, error, busy, run };
}

export function Alert({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-sm border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700">
      {message}
    </p>
  ) : null;
}

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Active (shown)' },
  { value: 'coming_soon', label: 'Coming soon (shown, no quote button)' },
  { value: 'inactive', label: 'Hidden' },
];
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-success-50 text-success-700' },
  coming_soon: { label: 'Coming soon', cls: 'bg-warning-50 text-warning-700' },
  inactive: { label: 'Hidden', cls: 'bg-ink-950/5 text-ink-800' },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? { label: status, cls: 'bg-ink-950/5 text-ink-800' };
  return <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${s.cls}`}>{s.label}</span>;
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

// ---------------------------------------------------------------- sortable list

interface Item {
  id: string;
  name: string;
}

/**
 * A reorderable list: drag by the handle, or use the Move up/down buttons (keyboard and screen-reader friendly).
 * Each change is saved at once; on failure the previous order is restored.
 */
export function Sortable<T extends Item>({
  items: initial,
  saveUrl,
  saveBody,
  label,
  render,
}: {
  items: T[];
  saveUrl: string;
  /** Extra fields sent with the new order (e.g. which pricing tab). */
  saveBody?: Record<string, unknown>;
  label: string;
  render: (item: T) => React.ReactNode;
}) {
  const [items, setItems] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const a = useAction();
  const save = (next: T[], moved: T) => {
    const prev = items;
    setItems(next);
    void a.run(async () => {
      try {
        await apiFetch(saveUrl, { body: { ...saveBody, ids: next.map((i) => i.id) } });
        setStatus(`${moved.name} moved to position ${next.indexOf(moved) + 1} of ${next.length}.`);
      } catch (err) {
        setItems(prev);
        throw err;
      }
    });
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m!);
    save(next, m!);
  };
  const onDrop = (e: DragEvent, target: string) => {
    e.preventDefault();
    if (!dragging || dragging === target) return;
    move(
      items.findIndex((i) => i.id === dragging),
      items.findIndex((i) => i.id === target),
    );
    setDragging(null);
  };
  return (
    <div>
      <Alert message={a.error} />
      <p className="sr-only" role="status">
        {status}
      </p>
      <ul aria-label={label} className="divide-y divide-line">
        {items.map((item, i) => (
          <li
            key={item.id}
            onDragOver={(e) => dragging && e.preventDefault()}
            onDrop={(e) => onDrop(e, item.id)}
            className={`flex items-center gap-2 py-2 ${dragging === item.id ? 'opacity-50' : ''}`}
          >
            <span
              draggable
              onDragStart={(e) => {
                setDragging(item.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.id);
              }}
              onDragEnd={() => setDragging(null)}
              className="cursor-grab text-ink-400"
              aria-hidden="true"
              title="Drag to reorder"
            >
              <GripVertical size={18} />
            </span>
            <div className="min-w-0 flex-1">{render(item)}</div>
            <IconButton
              size="sm"
              label={`Move ${item.name} up`}
              disabled={i === 0 || a.busy}
              onClick={() => move(i, i - 1)}
            >
              <ArrowUp size={16} aria-hidden="true" />
            </IconButton>
            <IconButton
              size="sm"
              label={`Move ${item.name} down`}
              disabled={i === items.length - 1 || a.busy}
              onClick={() => move(i, i + 1)}
            >
              <ArrowDown size={16} aria-hidden="true" />
            </IconButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface CatalogueDivision {
  id: string;
  name: string;
  slug: string;
  status: string;
  featured: boolean;
  services: { id: string; name: string; slug: string; status: string; featured: boolean; price: string }[];
}

/** The services overview: divisions in order, each with its services in order. */
export function CatalogueList({ divisions }: { divisions: CatalogueDivision[] }) {
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="div-order">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="div-order" className="font-sans text-base font-semibold">
              Divisions
            </h2>
            <p className="text-[13px] text-ink-600">The order here is the order on the website.</p>
          </div>
          <a
            href="/admin/services/divisions/new"
            className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-line bg-surface px-4 text-sm font-semibold text-ink-950 hover:border-ink-400"
          >
            <Plus size={16} aria-hidden="true" /> New division
          </a>
        </div>
        <div className="mt-3">
          <Sortable
            label="Divisions"
            items={divisions}
            saveUrl="/api/v1/admin/catalogue/categories/order"
            render={(d) => (
              <div className="flex flex-wrap items-center gap-2">
                <a href={`/admin/services/divisions/${d.id}`} className="font-semibold text-ink-950 hover:underline">
                  {d.name}
                </a>
                <StatusPill status={d.status} />
                {d.featured ? <span className="text-[12px] font-semibold text-brand-600">Featured</span> : null}
                <span className="text-[12px] text-ink-600">
                  {d.services.length} {d.services.length === 1 ? 'service' : 'services'}
                </span>
              </div>
            )}
          />
        </div>
      </section>
      {divisions.map((d) => (
        <section key={d.id} className="rounded-lg border border-line bg-surface p-6" aria-labelledby={`svc-${d.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={`svc-${d.id}`} className="font-sans text-base font-semibold">
              {d.name}
            </h2>
            <a
              href={`/admin/services/new?division=${encodeURIComponent(d.id)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-sm px-3 text-sm font-semibold text-brand-600 hover:bg-brand-50"
            >
              <Plus size={16} aria-hidden="true" /> Add service<span className="sr-only"> to {d.name}</span>
            </a>
          </div>
          {d.services.length === 0 ? (
            <p className="mt-2 text-sm text-ink-600">No services yet.</p>
          ) : (
            <div className="mt-2">
              <Sortable
                label={`${d.name} services`}
                items={d.services}
                saveUrl={`/api/v1/admin/catalogue/categories/${d.id}/services/order`}
                render={(s) => (
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`/admin/services/${s.id}`} className="font-medium text-ink-950 hover:underline">
                      {s.name}
                    </a>
                    <StatusPill status={s.status} />
                    {s.featured ? <span className="text-[12px] font-semibold text-brand-600">Featured</span> : null}
                    <span className="text-[12px] text-ink-600">{s.price}</span>
                  </div>
                )}
              />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- forms

export function DeleteButton({ url, name, after, what }: { url: string; name: string; after: string; what: string }) {
  const [open, setOpen] = useState(false);
  const a = useAction();
  return (
    <div className="flex flex-col gap-2">
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Trash2 size={16} aria-hidden="true" /> Delete {what}
      </Button>
      <Alert message={a.error} />
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${name}?`}
        description={`This can't be undone. A ${what} that is in use can't be deleted; set it to hidden instead.`}
        confirmLabel={`Delete ${what}`}
        destructive
        onConfirm={() =>
          a.run(async () => {
            await apiFetch(url, { method: 'DELETE' });
            window.location.assign(after);
          })
        }
      />
    </div>
  );
}

export function SlugField({
  name,
  slug,
  setSlug,
  touched,
  setTouched,
  prefix,
  error,
}: {
  name: string;
  slug: string;
  setSlug: (s: string) => void;
  touched: boolean;
  setTouched: (b: boolean) => void;
  prefix: string;
  error: string[] | undefined;
}) {
  return (
    <Field label="Web address" required hint={`${prefix}${slug || slugify(name) || '…'}`} error={error}>
      <Input
        value={touched ? slug : slug || slugify(name)}
        onChange={(e) => {
          setTouched(true);
          setSlug(e.target.value.toLowerCase());
        }}
        maxLength={80}
        autoComplete="off"
      />
    </Field>
  );
}

export interface DivisionFormValues {
  id?: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  benefits: { title: string; body: string }[];
  deliverables: string[];
  faq: { q: string; a: string }[];
  icon: string | null;
  status: 'active' | 'coming_soon' | 'inactive';
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

/** Create or edit a division (service category). */
export function DivisionForm({ initial }: { initial: DivisionFormValues }) {
  const a = useAction();
  const editing = !!initial.id;
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(editing);
  const [description, setDescription] = useState(initial.description);
  const [benefits, setBenefits] = useState(initial.benefits);
  const [deliverables, setDeliverables] = useState(initial.deliverables);
  const [faq, setFaq] = useState(initial.faq);
  const [featured, setFeatured] = useState(initial.featured);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      slug: slugTouched ? slug : slug || slugify(name),
      name,
      summary: f.get('summary'),
      description,
      benefits: benefits.filter((b) => b.title.trim() || b.body.trim()),
      deliverables: deliverables.map((d) => d.trim()).filter(Boolean),
      faq: faq.filter((x) => x.q.trim() || x.a.trim()),
      icon: f.get('icon') || null,
      status: f.get('status'),
      featured,
      seoTitle: f.get('seoTitle'),
      seoDescription: f.get('seoDescription'),
    };
    await a.run(async () => {
      if (editing) await apiFetch(`/api/v1/admin/catalogue/categories/${initial.id}`, { method: 'PUT', body });
      else await apiFetch('/api/v1/admin/catalogue/categories', { body });
      window.location.assign('/admin/services?saved=1');
    });
  }
  const e = a.errors;
  const listError = (key: string) =>
    Object.entries(e)
      .filter(([k]) => k === key || k.startsWith(`${key}.`))
      .flatMap(([, v]) => v);
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="d-basic">
        <h2 id="d-basic" className="font-sans text-base font-semibold">
          Division
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={e['name']}>
            <Input value={name} onChange={(ev) => setName(ev.target.value)} maxLength={120} />
          </Field>
          <SlugField
            name={name}
            slug={slug}
            setSlug={setSlug}
            touched={slugTouched}
            setTouched={setSlugTouched}
            prefix="/services/"
            error={e['slug']}
          />
          <Field label="Status" required error={e['status']}>
            <Select name="status" defaultValue={initial.status} options={STATUS_OPTIONS} />
          </Field>
          <Field label="Icon" error={e['icon']}>
            <Select
              name="icon"
              defaultValue={initial.icon ?? ''}
              options={[{ value: '', label: 'None' }, ...CMS_ICONS.map((i) => ({ value: i, label: i }))]}
            />
          </Field>
          <Field
            label="Summary"
            required
            hint="One or two sentences for cards and the menu."
            error={e['summary']}
            className="sm:col-span-2"
          >
            <Textarea name="summary" rows={2} defaultValue={initial.summary} maxLength={300} />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox label="Feature on the home page" checked={featured} onCheckedChange={setFeatured} />
          </div>
        </div>
        <div className="mt-4">
          <Field label="Description" error={e['description']}>
            <RichTextEditor label="Description" value={description} onChange={setDescription} />
          </Field>
        </div>
      </section>

      <fieldset className="rounded-lg border border-line bg-surface p-6">
        <legend className="px-1 font-sans text-base font-semibold">Benefits</legend>
        <Alert message={listError('benefits')[0] ?? null} />
        <ol className="mt-2 flex flex-col gap-4">
          {benefits.map((b, i) => (
            <li key={i} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <Field label={`Benefit ${i + 1} title`}>
                <Input
                  value={b.title}
                  maxLength={120}
                  onChange={(ev) =>
                    setBenefits(benefits.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x)))
                  }
                />
              </Field>
              <Field label={`Benefit ${i + 1} description`}>
                <Input
                  value={b.body}
                  maxLength={400}
                  onChange={(ev) =>
                    setBenefits(benefits.map((x, j) => (j === i ? { ...x, body: ev.target.value } : x)))
                  }
                />
              </Field>
              <IconButton
                label={`Remove benefit ${i + 1}`}
                onClick={() => setBenefits(benefits.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ol>
        {benefits.length < 12 ? (
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => setBenefits([...benefits, { title: '', body: '' }])}
          >
            Add benefit
          </Button>
        ) : null}
      </fieldset>

      <fieldset className="rounded-lg border border-line bg-surface p-6">
        <legend className="px-1 font-sans text-base font-semibold">Typical deliverables</legend>
        <Alert message={listError('deliverables')[0] ?? null} />
        <ol className="mt-2 flex flex-col gap-3">
          {deliverables.map((d, i) => (
            <li key={i} className="flex items-end gap-2">
              <Field label={`Deliverable ${i + 1}`} hideLabel className="flex-1">
                <Input
                  value={d}
                  maxLength={200}
                  onChange={(ev) => setDeliverables(deliverables.map((x, j) => (j === i ? ev.target.value : x)))}
                />
              </Field>
              <IconButton
                label={`Remove deliverable ${i + 1}`}
                onClick={() => setDeliverables(deliverables.filter((_, j) => j !== i))}
              >
                <Trash2 size={16} aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ol>
        {deliverables.length < 20 ? (
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setDeliverables([...deliverables, ''])}>
            Add deliverable
          </Button>
        ) : null}
      </fieldset>

      <fieldset className="rounded-lg border border-line bg-surface p-6">
        <legend className="px-1 font-sans text-base font-semibold">Questions and answers</legend>
        <Alert message={listError('faq')[0] ?? null} />
        <ol className="mt-2 flex flex-col gap-4">
          {faq.map((x, i) => (
            <li key={i} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="flex flex-col gap-3">
                <Field label={`Question ${i + 1}`}>
                  <Input
                    value={x.q}
                    maxLength={200}
                    onChange={(ev) => setFaq(faq.map((y, j) => (j === i ? { ...y, q: ev.target.value } : y)))}
                  />
                </Field>
                <Field label={`Answer ${i + 1}`}>
                  <Textarea
                    rows={2}
                    value={x.a}
                    maxLength={2000}
                    onChange={(ev) => setFaq(faq.map((y, j) => (j === i ? { ...y, a: ev.target.value } : y)))}
                  />
                </Field>
              </div>
              <IconButton label={`Remove question ${i + 1}`} onClick={() => setFaq(faq.filter((_, j) => j !== i))}>
                <Trash2 size={16} aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ol>
        {faq.length < 20 ? (
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setFaq([...faq, { q: '', a: '' }])}>
            Add question
          </Button>
        ) : null}
      </fieldset>

      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="d-seo">
        <h2 id="d-seo" className="font-sans text-base font-semibold">
          Search engines
        </h2>
        <p className="mt-1 text-sm text-ink-600">Optional. When empty, the name and summary are used.</p>
        <div className="mt-4 grid gap-4">
          <Field label="SEO title" hint="Up to 70 characters." error={e['seoTitle']}>
            <Input name="seoTitle" defaultValue={initial.seoTitle ?? ''} maxLength={70} />
          </Field>
          <Field label="SEO description" hint="Up to 170 characters." error={e['seoDescription']}>
            <Textarea name="seoDescription" rows={2} defaultValue={initial.seoDescription ?? ''} maxLength={170} />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-2">
          <Button type="submit" size="lg" loading={a.busy}>
            {editing ? 'Save division' : 'Create division'}
          </Button>
          <a
            href="/admin/services"
            className="inline-flex h-12 items-center px-4 text-[15px] font-semibold text-ink-800"
          >
            Cancel
          </a>
        </div>
        {editing ? (
          <DeleteButton
            url={`/api/v1/admin/catalogue/categories/${initial.id}`}
            name={initial.name}
            what="division"
            after="/admin/services"
          />
        ) : null}
      </div>
    </form>
  );
}

export interface ServiceFormValues {
  id?: string;
  categoryId: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  pricingModel: 'fixed' | 'hourly' | 'starting_from' | 'custom_quote';
  priceMinor: number | null;
  currency: string | null;
  status: 'active' | 'coming_soon' | 'inactive';
  featured: boolean;
}

const PRICING_OPTIONS = [
  { value: 'custom_quote', label: 'Custom quote' },
  { value: 'fixed', label: 'Fixed price' },
  { value: 'starting_from', label: 'Starting from' },
  { value: 'hourly', label: 'Hourly rate' },
];

/** Create or edit a service within a division. */
export function ServiceForm({
  initial,
  divisions,
  currencies,
  inUse,
}: {
  initial: ServiceFormValues;
  divisions: { id: string; name: string; slug: string }[];
  currencies: string[];
  inUse: boolean;
}) {
  const a = useAction();
  const editing = !!initial.id;
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(editing);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [pricing, setPricing] = useState(initial.pricingModel);
  const [currency, setCurrency] = useState(initial.currency ?? currencies[0] ?? 'USD');
  const [price, setPrice] = useState<number | null>(initial.priceMinor);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [description, setDescription] = useState(initial.description);
  const [featured, setFeatured] = useState(initial.featured);
  const division = divisions.find((d) => d.id === categoryId);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (priceError) return;
    const f = new FormData(e.currentTarget);
    const priced = pricing !== 'custom_quote';
    const body = {
      categoryId,
      slug: slugTouched ? slug : slug || slugify(name),
      name,
      summary: f.get('summary'),
      description,
      pricingModel: pricing,
      priceMinor: priced ? price : null,
      currency: priced ? currency : null,
      status: f.get('status'),
      featured,
    };
    await a.run(async () => {
      if (editing) await apiFetch(`/api/v1/admin/catalogue/services/${initial.id}`, { method: 'PUT', body });
      else await apiFetch('/api/v1/admin/catalogue/services', { body });
      window.location.assign('/admin/services?saved=1');
    });
  }
  const e = a.errors;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="s-basic">
        <h2 id="s-basic" className="font-sans text-base font-semibold">
          Service
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Division" required error={e['categoryId']}>
            <Select
              value={categoryId}
              onChange={(ev) => setCategoryId(ev.target.value)}
              options={divisions.map((d) => ({ value: d.id, label: d.name }))}
            />
          </Field>
          <Field label="Status" required error={e['status']}>
            <Select name="status" defaultValue={initial.status} options={STATUS_OPTIONS} />
          </Field>
          <Field label="Name" required error={e['name']}>
            <Input value={name} onChange={(ev) => setName(ev.target.value)} maxLength={120} />
          </Field>
          <SlugField
            name={name}
            slug={slug}
            setSlug={setSlug}
            touched={slugTouched}
            setTouched={setSlugTouched}
            prefix={`/contact?category=${division?.slug ?? '…'}&service=`}
            error={e['slug']}
          />
          <Field label="Summary" required error={e['summary']} className="sm:col-span-2">
            <Textarea name="summary" rows={2} defaultValue={initial.summary} maxLength={300} />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox label="Featured" checked={featured} onCheckedChange={setFeatured} />
          </div>
        </div>
        <div className="mt-4">
          <Field label="Description" error={e['description']}>
            <RichTextEditor label="Description" value={description} onChange={setDescription} />
          </Field>
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="s-price">
        <h2 id="s-price" className="font-sans text-base font-semibold">
          Pricing
        </h2>
        <p className="mt-1 text-sm text-ink-600">Shown on the division page and used as the default in quotations.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Pricing model" required error={e['pricingModel']}>
            <Select
              value={pricing}
              onChange={(ev) => setPricing(ev.target.value as ServiceFormValues['pricingModel'])}
              options={PRICING_OPTIONS}
            />
          </Field>
          {pricing !== 'custom_quote' ? (
            <>
              <Field label="Currency" required error={e['currency']}>
                <Select
                  value={currency}
                  onChange={(ev) => setCurrency(ev.target.value)}
                  options={currencies.map((c) => ({ value: c, label: c }))}
                />
              </Field>
              <Field
                label={pricing === 'hourly' ? 'Rate per hour' : 'Price'}
                required
                error={priceError ?? e['priceMinor']}
              >
                <MoneyInput
                  valueMinor={price}
                  onChangeMinor={setPrice}
                  currency={currency}
                  onParseError={setPriceError}
                />
              </Field>
            </>
          ) : null}
        </div>
      </section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-2">
          <Button type="submit" size="lg" loading={a.busy}>
            {editing ? 'Save service' : 'Create service'}
          </Button>
          <a
            href="/admin/services"
            className="inline-flex h-12 items-center px-4 text-[15px] font-semibold text-ink-800"
          >
            Cancel
          </a>
        </div>
        {editing && !inUse ? (
          <DeleteButton
            url={`/api/v1/admin/catalogue/services/${initial.id}`}
            name={initial.name}
            what="service"
            after="/admin/services"
          />
        ) : null}
      </div>
    </form>
  );
}
