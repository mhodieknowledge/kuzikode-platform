/** Admin → Packages & pricing islands (P4.19): list with comparison order and price review, package editor, add-ons. */
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { formatMoney } from '../../shared/money';
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
  Select,
  Textarea,
} from '../ui';
import {
  Alert,
  DeleteButton,
  SlugField,
  Sortable,
  STATUS_OPTIONS,
  StatusPill,
  slugify,
  useAction,
} from './ServicesAdmin';

type Tab = 'websites' | 'care' | 'email' | 'other';
const TABS: { value: Tab; label: string }[] = [
  { value: 'websites', label: 'Websites' },
  { value: 'care', label: 'Care plans' },
  { value: 'email', label: 'Email & domains' },
  { value: 'other', label: 'Other services' },
];
const UNITS = [
  { value: 'each', label: 'Each' },
  { value: 'page', label: 'Per page' },
  { value: 'mailbox', label: 'Per mailbox' },
  { value: 'month', label: 'Per month' },
  { value: 'year', label: 'Per year' },
  { value: 'hour', label: 'Per hour' },
];

export interface PackageRowView {
  id: string;
  name: string;
  serviceName: string;
  tab: Tab;
  status: string;
  price: string;
  priceReviewRequired: boolean;
  mostPopular: boolean;
}

function ReviewBadge() {
  return (
    <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[12px] font-semibold text-warning-700">
      Price awaiting review
    </span>
  );
}

/** Packages grouped by pricing tab, in comparison order, with price approval. */
export function PackagesList({
  packages,
  canReview,
  reviewOnly,
}: {
  packages: PackageRowView[];
  canReview: boolean;
  reviewOnly: boolean;
}) {
  const a = useAction();
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const flagged = packages.filter((p) => p.priceReviewRequired);
  const row = (p: PackageRowView) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <a href={`/admin/packages/${p.id}`} className="font-semibold text-ink-950 hover:underline">
        {p.name}
      </a>
      <span className="text-[13px] text-ink-600">{p.serviceName}</span>
      <span className="tnum text-[13px] text-ink-800">{p.price}</span>
      <StatusPill status={p.status} />
      {p.mostPopular ? (
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-semibold text-brand-600">
          Most popular
        </span>
      ) : null}
      {p.priceReviewRequired ? <ReviewBadge /> : null}
      {p.priceReviewRequired && canReview ? (
        <Button size="sm" variant="secondary" onClick={() => setConfirm([p.id])}>
          Approve price<span className="sr-only"> of {p.name}</span>
        </Button>
      ) : null}
    </div>
  );
  return (
    <div className="flex flex-col gap-6">
      <Alert message={a.error} />
      {flagged.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning-600/30 bg-warning-50 px-5 py-4">
          <p className="text-sm text-warning-700">
            <strong className="font-semibold">
              {flagged.length} {flagged.length === 1 ? 'package price needs' : 'package prices need'} review.
            </strong>{' '}
            {canReview
              ? 'Check each price, then approve it.'
              : 'An administrator with price approval rights must approve them.'}
          </p>
          {canReview ? (
            <Button variant="secondary" onClick={() => setConfirm([])}>
              Approve all {flagged.length}
            </Button>
          ) : null}
        </div>
      ) : null}
      {reviewOnly ? (
        <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="review-title">
          <h2 id="review-title" className="font-sans text-base font-semibold">
            Awaiting review
          </h2>
          {flagged.length === 0 ? (
            <p className="mt-3 text-sm text-ink-600">Every price has been approved.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {flagged.map((p) => (
                <li key={p.id} className="py-3">
                  {row(p)}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        TABS.map((t) => {
          const items = packages.filter((p) => p.tab === t.value);
          return (
            <section
              key={t.value}
              className="rounded-lg border border-line bg-surface p-6"
              aria-labelledby={`tab-${t.value}`}
            >
              <h2 id={`tab-${t.value}`} className="font-sans text-base font-semibold">
                {t.label}
              </h2>
              <p className="mt-1 text-[13px] text-ink-600">
                Order here is the column order in the /pricing comparison.
              </p>
              {items.length === 0 ? (
                <p className="mt-3 text-sm text-ink-600">No packages in this tab yet.</p>
              ) : (
                <div className="mt-2">
                  <Sortable
                    items={items}
                    saveUrl="/api/v1/admin/packages/order"
                    saveBody={{ tab: t.value }}
                    label={`${t.label} packages`}
                    render={row}
                  />
                </div>
              )}
            </section>
          );
        })
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.length ? 'Approve this price?' : `Approve all ${flagged.length} prices?`}
        description="Approved prices stop showing as suggestions. The approval is recorded in the audit log."
        confirmLabel="Approve"
        onConfirm={() =>
          a.run(async () => {
            await apiFetch('/api/v1/admin/packages/approve-prices', { body: { ids: confirm ?? [] } });
            window.location.reload();
          })
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------- package editor

export interface FeatureValue {
  label: string;
  value: 'included' | 'not_included' | 'text';
  text: string | null;
  tooltip: string | null;
  key: string | null;
}

export interface PackageFormValues {
  id?: string;
  serviceId: string;
  slug: string;
  name: string;
  tagline: string | null;
  billingType: 'one_off' | 'recurring';
  interval: 'month' | 'year' | null;
  priceType: 'fixed' | 'starting_from' | 'custom_quote';
  priceMinor: number | null;
  currency: string | null;
  priceUnit: string | null;
  altPriceZwgMinor: number | null;
  annualPriceMinor: number | null;
  minQuantity: number;
  deliveryTime: string | null;
  revisionRounds: string | null;
  supportPeriod: string | null;
  mostPopular: boolean;
  tab: Tab;
  status: 'active' | 'coming_soon' | 'inactive';
  costNote: string | null;
  priceReviewRequired?: boolean;
  features: FeatureValue[];
}

const blankFeature = (): FeatureValue => ({ label: '', value: 'included', text: null, tooltip: null, key: null });

function FeatureRows({
  features,
  setFeatures,
  errors,
}: {
  features: FeatureValue[];
  setFeatures: (f: FeatureValue[]) => void;
  errors: Record<string, string[]>;
}) {
  const set = (i: number, patch: Partial<FeatureValue>) =>
    setFeatures(features.map((f, k) => (k === i ? { ...f, ...patch } : f)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= features.length) return;
    const next = [...features];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m!);
    setFeatures(next);
  };
  return (
    <div className="flex flex-col gap-3">
      {features.length === 0 ? <p className="text-sm text-ink-600">No feature rows yet.</p> : null}
      <ol className="flex flex-col gap-3">
        {features.map((f, i) => (
          <li key={i} className="rounded-md border border-line p-3">
            <div className="grid gap-3 sm:grid-cols-[2fr_1.2fr_1.2fr]">
              <Field label={`Feature ${i + 1}`} required error={errors[`features.${i}.label`]}>
                <Input value={f.label} onChange={(e) => set(i, { label: e.target.value })} maxLength={120} />
              </Field>
              <Field label="Shown as">
                <Select
                  value={f.value}
                  onChange={(e) => set(i, { value: e.target.value as FeatureValue['value'] })}
                  options={[
                    { value: 'included', label: 'Included (✓)' },
                    { value: 'not_included', label: 'Not included (✕)' },
                    { value: 'text', label: 'A value' },
                  ]}
                />
              </Field>
              {f.value === 'text' ? (
                <Field label="Value" required error={errors[`features.${i}.text`]}>
                  <Input
                    value={f.text ?? ''}
                    onChange={(e) => set(i, { text: e.target.value })}
                    maxLength={120}
                    placeholder="Up to 12"
                  />
                </Field>
              ) : (
                <div />
              )}
              <Field label="Tooltip" hint="Optional explanation" className="sm:col-span-2">
                <Input value={f.tooltip ?? ''} onChange={(e) => set(i, { tooltip: e.target.value })} maxLength={300} />
              </Field>
              <Field
                label="Comparison key"
                hint="Same key = same row in the comparison"
                error={errors[`features.${i}.key`]}
              >
                <Input value={f.key ?? ''} onChange={(e) => set(i, { key: e.target.value })} maxLength={60} />
              </Field>
            </div>
            <div className="mt-2 flex justify-end gap-1">
              <IconButton
                size="sm"
                label={`Move feature ${i + 1} up`}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp size={16} aria-hidden="true" />
              </IconButton>
              <IconButton
                size="sm"
                label={`Move feature ${i + 1} down`}
                disabled={i === features.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown size={16} aria-hidden="true" />
              </IconButton>
              <IconButton
                size="sm"
                label={`Remove feature ${i + 1}`}
                onClick={() => setFeatures(features.filter((_, k) => k !== i))}
              >
                <Trash2 size={16} aria-hidden="true" />
              </IconButton>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <Button
          variant="secondary"
          onClick={() => setFeatures([...features, blankFeature()])}
          disabled={features.length >= 40}
        >
          <Plus size={16} aria-hidden="true" /> Add feature
        </Button>
      </div>
    </div>
  );
}

export function PackageForm({
  initial,
  services,
  currencies,
  inUse,
  canReview,
}: {
  initial: PackageFormValues;
  services: { id: string; name: string; division: string }[];
  currencies: string[];
  inUse: boolean;
  canReview: boolean;
}) {
  const a = useAction();
  const editing = !!initial.id;
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(editing);
  const [priceError, setPriceError] = useState<string | null>(null);
  const set = <K extends keyof PackageFormValues>(k: K, val: PackageFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const currency = v.currency ?? currencies[0] ?? 'USD';
  const priced = v.priceType !== 'custom_quote';
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (priceError) return;
    const { id: _id, priceReviewRequired: _r, ...rest } = v;
    const body = {
      ...rest,
      slug: slugTouched ? v.slug : v.slug || slugify(v.name),
      currency: priced ? currency : null,
      interval: v.billingType === 'recurring' ? (v.interval ?? 'month') : null,
      annualPriceMinor: v.billingType === 'recurring' && v.interval === 'month' ? v.annualPriceMinor : null,
      features: v.features.map((f) => ({ ...f, text: f.value === 'text' ? f.text : null })),
    };
    await a.run(async () => {
      if (editing) await apiFetch(`/api/v1/admin/packages/${initial.id}`, { method: 'PUT', body });
      else await apiFetch('/api/v1/admin/packages', { body });
      window.location.assign('/admin/packages?saved=1');
    });
  }
  const e = a.errors;
  const opt = (k: 'tagline' | 'priceUnit' | 'deliveryTime' | 'revisionRounds' | 'supportPeriod' | 'costNote') => ({
    value: v[k] ?? '',
    onChange: (ev: { target: { value: string } }) => set(k, ev.target.value || null),
  });
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      {editing && v.priceReviewRequired ? (
        <p className="rounded-md border border-warning-600/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          This price is a suggestion awaiting review.{' '}
          {canReview
            ? 'Approve it from the packages list.'
            : 'An administrator with price approval rights must approve it.'}
        </p>
      ) : null}
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="p-basic">
        <h2 id="p-basic" className="font-sans text-base font-semibold">
          Package
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Service" required error={e['serviceId']}>
            <Select
              value={v.serviceId}
              onChange={(ev) => set('serviceId', ev.target.value)}
              placeholder="Choose a service"
              options={services.map((s) => ({ value: s.id, label: `${s.division} · ${s.name}` }))}
            />
          </Field>
          <Field label="Status" required error={e['status']}>
            <Select
              value={v.status}
              onChange={(ev) => set('status', ev.target.value as PackageFormValues['status'])}
              options={STATUS_OPTIONS}
            />
          </Field>
          <Field label="Name" required error={e['name']}>
            <Input value={v.name} onChange={(ev) => set('name', ev.target.value)} maxLength={120} />
          </Field>
          <SlugField
            name={v.name}
            slug={v.slug}
            setSlug={(s) => set('slug', s)}
            touched={slugTouched}
            setTouched={setSlugTouched}
            prefix="Identifier: "
            error={e['slug']}
          />
          <Field label="Tagline" error={e['tagline']} className="sm:col-span-2">
            <Input {...opt('tagline')} maxLength={200} />
          </Field>
          <Field label="Pricing tab" required error={e['tab']}>
            <Select value={v.tab} onChange={(ev) => set('tab', ev.target.value as Tab)} options={TABS} />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox
              label="Most popular (one per tab)"
              checked={v.mostPopular}
              onCheckedChange={(c) => set('mostPopular', c)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="p-price">
        <h2 id="p-price" className="font-sans text-base font-semibold">
          Price
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          Price changes need approval before they stop being "suggested". Quotations copy the price when the package is
          added.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Billing" required error={e['billingType']}>
            <Select
              value={v.billingType}
              onChange={(ev) => set('billingType', ev.target.value as PackageFormValues['billingType'])}
              options={[
                { value: 'one_off', label: 'One-off' },
                { value: 'recurring', label: 'Recurring' },
              ]}
            />
          </Field>
          {v.billingType === 'recurring' ? (
            <Field label="Interval" required error={e['interval']}>
              <Select
                value={v.interval ?? 'month'}
                onChange={(ev) => set('interval', ev.target.value as 'month' | 'year')}
                options={[
                  { value: 'month', label: 'Monthly' },
                  { value: 'year', label: 'Yearly' },
                ]}
              />
            </Field>
          ) : null}
          <Field label="Price type" required error={e['priceType']}>
            <Select
              value={v.priceType}
              onChange={(ev) => set('priceType', ev.target.value as PackageFormValues['priceType'])}
              options={[
                { value: 'fixed', label: 'Fixed price' },
                { value: 'starting_from', label: 'Starting from' },
                { value: 'custom_quote', label: 'Custom quote (no price)' },
              ]}
            />
          </Field>
          {priced ? (
            <>
              <Field label="Currency" required error={e['currency']}>
                <Select
                  value={currency}
                  onChange={(ev) => set('currency', ev.target.value)}
                  options={currencies.map((c) => ({ value: c, label: c }))}
                />
              </Field>
              <Field label="Price" required error={priceError ?? e['priceMinor']}>
                <MoneyInput
                  valueMinor={v.priceMinor}
                  onChangeMinor={(m) => set('priceMinor', m)}
                  currency={currency}
                  onParseError={setPriceError}
                />
              </Field>
              <Field label="Price unit" hint='e.g. "per mailbox"' error={e['priceUnit']}>
                <Input {...opt('priceUnit')} maxLength={40} />
              </Field>
              {currency !== 'ZWG' ? (
                <Field label="Manual ZWG price" hint="Optional; used for ZWG quotations" error={e['altPriceZwgMinor']}>
                  <MoneyInput
                    valueMinor={v.altPriceZwgMinor}
                    onChangeMinor={(m) => set('altPriceZwgMinor', m)}
                    currency="ZWG"
                  />
                </Field>
              ) : null}
              {v.billingType === 'recurring' && (v.interval ?? 'month') === 'month' ? (
                <Field label="Annual price" hint="Optional yearly option" error={e['annualPriceMinor']}>
                  <MoneyInput
                    valueMinor={v.annualPriceMinor}
                    onChangeMinor={(m) => set('annualPriceMinor', m)}
                    currency={currency}
                  />
                </Field>
              ) : null}
            </>
          ) : null}
          <Field label="Minimum quantity" error={e['minQuantity']}>
            <Input
              type="number"
              min={1}
              value={v.minQuantity}
              onChange={(ev) => set('minQuantity', Math.max(1, Number(ev.target.value) || 1))}
            />
          </Field>
        </div>
        <Field
          label="Internal cost note"
          hint="Never shown publicly (e.g. third-party costs included)"
          error={e['costNote']}
          className="mt-4"
        >
          <Textarea rows={2} {...opt('costNote')} maxLength={1000} />
        </Field>
      </section>

      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="p-delivery">
        <h2 id="p-delivery" className="font-sans text-base font-semibold">
          Delivery
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Delivery time" error={e['deliveryTime']}>
            <Input {...opt('deliveryTime')} maxLength={60} placeholder="2–3 weeks" />
          </Field>
          <Field label="Revision rounds" error={e['revisionRounds']}>
            <Input {...opt('revisionRounds')} maxLength={60} placeholder="2 rounds" />
          </Field>
          <Field label="Support period" error={e['supportPeriod']}>
            <Input {...opt('supportPeriod')} maxLength={60} placeholder="30 days" />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="p-features">
        <h2 id="p-features" className="font-sans text-base font-semibold">
          Features
        </h2>
        <p className="mt-1 mb-4 text-sm text-ink-600">In display order. Quotations list the included ones.</p>
        <FeatureRows features={v.features} setFeatures={(f) => set('features', f)} errors={e} />
      </section>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-2">
          <Button type="submit" size="lg" loading={a.busy}>
            {editing ? 'Save package' : 'Create package'}
          </Button>
          <a
            href="/admin/packages"
            className="inline-flex h-12 items-center px-4 text-[15px] font-semibold text-ink-800"
          >
            Cancel
          </a>
        </div>
        {editing && !inUse ? (
          <DeleteButton
            url={`/api/v1/admin/packages/${initial.id}`}
            name={initial.name}
            what="package"
            after="/admin/packages"
          />
        ) : null}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- add-ons

export interface AddonView {
  id: string;
  packageId: string | null;
  packageName: string | null;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  unit: string;
  billingType: 'one_off' | 'recurring';
  active: boolean;
}

type AddonDraft = Omit<AddonView, 'id' | 'packageName'> & { id?: string };
const blankAddon = (currency: string): AddonDraft => ({
  packageId: null,
  name: '',
  description: null,
  priceMinor: 0,
  currency,
  unit: 'each',
  billingType: 'one_off',
  active: true,
});

/** Add-ons table with a create/edit dialog. */
export function AddonsManager({
  addons,
  packages,
  currencies,
}: {
  addons: AddonView[];
  packages: { id: string; name: string }[];
  currencies: string[];
}) {
  const a = useAction();
  const [draft, setDraft] = useState<AddonDraft | null>(null);
  const [remove, setRemove] = useState<AddonView | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const set = <K extends keyof AddonDraft>(k: K, val: AddonDraft[K]) => setDraft((d) => (d ? { ...d, [k]: val } : d));
  const save = () =>
    a.run(async () => {
      if (!draft || priceError) return;
      const { id, ...body } = draft;
      if (id) await apiFetch(`/api/v1/admin/packages/addons/${id}`, { method: 'PUT', body });
      else await apiFetch('/api/v1/admin/packages/addons', { body });
      window.location.reload();
    });
  const unitLabel = (u: string) => UNITS.find((x) => x.value === u)?.label ?? u;
  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface p-6" aria-labelledby="addons-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="addons-title" className="font-sans text-base font-semibold">
            Add-ons
          </h2>
          <p className="mt-1 text-[13px] text-ink-600">Offered with every package, or with one package only.</p>
        </div>
        <Button variant="secondary" onClick={() => setDraft(blankAddon(currencies[0] ?? 'USD'))}>
          <Plus size={16} aria-hidden="true" /> New add-on
        </Button>
      </div>
      <Alert message={draft ? null : a.error} />
      {addons.length === 0 ? (
        <p className="mt-4 text-sm text-ink-600">No add-ons yet.</p>
      ) : (
        <div className="relative mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-[13px] text-ink-600">
              <tr>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Add-on
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Offered with
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-semibold">
                  Price
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="py-2 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {addons.map((x) => (
                <tr key={x.id} className="border-t border-line">
                  <td className="py-2 pr-3 font-medium text-ink-950">{x.name}</td>
                  <td className="py-2 pr-3 text-ink-800">{x.packageName ?? 'Every package'}</td>
                  <td className="tnum py-2 pr-3 text-right text-ink-950">
                    {formatMoney(x.priceMinor, x.currency)}{' '}
                    <span className="text-ink-600">
                      {x.unit === 'each' ? '' : unitLabel(x.unit).toLowerCase()}
                      {x.billingType === 'recurring' ? ' · recurring' : ''}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{x.active ? 'Offered' : 'Not offered'}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const { packageName: _n, ...rest } = x;
                        setDraft(rest);
                      }}
                    >
                      Edit<span className="sr-only"> {x.name}</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRemove(x)}>
                      Delete<span className="sr-only"> {x.name}</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? 'Edit add-on' : 'New add-on'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button loading={a.busy} onClick={() => void save()}>
              Save add-on
            </Button>
          </div>
        }
      >
        {draft ? (
          <div className="flex flex-col gap-4">
            <Alert message={a.error} />
            <Field label="Name" required error={a.errors['name']}>
              <Input value={draft.name} onChange={(e) => set('name', e.target.value)} maxLength={120} />
            </Field>
            <Field label="Description" error={a.errors['description']}>
              <Textarea
                rows={2}
                value={draft.description ?? ''}
                onChange={(e) => set('description', e.target.value || null)}
                maxLength={300}
              />
            </Field>
            <Field label="Offered with" error={a.errors['packageId']}>
              <Select
                value={draft.packageId ?? ''}
                onChange={(e) => set('packageId', e.target.value || null)}
                options={[
                  { value: '', label: 'Every package' },
                  ...packages.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Currency" required error={a.errors['currency']}>
                <Select
                  value={draft.currency}
                  onChange={(e) => set('currency', e.target.value)}
                  options={currencies.map((c) => ({ value: c, label: c }))}
                />
              </Field>
              <Field label="Price" required error={priceError ?? a.errors['priceMinor']}>
                <MoneyInput
                  valueMinor={draft.priceMinor}
                  onChangeMinor={(m) => set('priceMinor', m ?? 0)}
                  currency={draft.currency}
                  onParseError={setPriceError}
                />
              </Field>
              <Field label="Unit" required error={a.errors['unit']}>
                <Select value={draft.unit} onChange={(e) => set('unit', e.target.value)} options={UNITS} />
              </Field>
              <Field label="Billing" required error={a.errors['billingType']}>
                <Select
                  value={draft.billingType}
                  onChange={(e) => set('billingType', e.target.value as AddonDraft['billingType'])}
                  options={[
                    { value: 'one_off', label: 'One-off' },
                    { value: 'recurring', label: 'Recurring' },
                  ]}
                />
              </Field>
            </div>
            <Checkbox label="Offered" checked={draft.active} onCheckedChange={(c) => set('active', c)} />
          </div>
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={remove !== null}
        onOpenChange={(o) => !o && setRemove(null)}
        title={`Delete ${remove?.name ?? 'add-on'}?`}
        description="Quotations that already include it keep their lines."
        confirmLabel="Delete add-on"
        destructive
        onConfirm={() =>
          a.run(async () => {
            await apiFetch(`/api/v1/admin/packages/addons/${remove!.id}`, { method: 'DELETE' });
            window.location.reload();
          })
        }
      />
    </section>
  );
}
