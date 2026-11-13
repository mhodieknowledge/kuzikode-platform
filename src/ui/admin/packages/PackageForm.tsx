/**
 * Create / edit a package (R6.2): package details, price (money inputs are mono and right-aligned), delivery and the feature
 * rows. Pricing presentation only: fields, validation and the request body are unchanged (see usePackages.packageBody).
 */
import { useState, type FormEvent } from 'react';
import { Field, SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { MoneyInput } from '../../primitives/money';
import { CheckItem, FormSection, SaveBar } from '../form';
import { moveItem, patchAt, STATUS_OPTIONS } from '../website/lib';
import { AddRow, DeleteAction, RepeatRow, SlugField } from '../website/parts';
import {
  blankFeature,
  packageBody,
  TABS,
  usePackageSave,
  type FeatureValue,
  type PackageFormValues,
  type Tab,
} from './usePackages';

function FeatureRows({
  features,
  setFeatures,
  err,
}: {
  features: FeatureValue[];
  setFeatures: (f: FeatureValue[]) => void;
  err: (key: string) => string | undefined;
}) {
  const set = (i: number, patch: Partial<FeatureValue>) => setFeatures(patchAt(features, i, patch));
  return (
    <>
      {features.length === 0 ? <p className="kz-hint">No feature rows yet.</p> : null}
      <ol className="kz-wsr-list">
        {features.map((f, i) => (
          <RepeatRow
            key={i}
            noun="feature"
            index={i}
            count={features.length}
            onMove={(to) => {
              const next = moveItem(features, i, to);
              if (next) setFeatures(next);
            }}
            onRemove={() => setFeatures(features.filter((_, k) => k !== i))}
          >
            <TextField
              label={`Feature ${i + 1}`}
              value={f.label}
              onChange={(e) => set(i, { label: e.target.value })}
              maxLength={120}
              error={err(`features.${i}.label`)}
            />
            <SelectField
              label="Shown as"
              value={f.value}
              onChange={(e) => set(i, { value: e.target.value as FeatureValue['value'] })}
            >
              <option value="included">Included (✓)</option>
              <option value="not_included">Not included (✕)</option>
              <option value="text">A value</option>
            </SelectField>
            {f.value === 'text' ? (
              <TextField
                label="Value"
                value={f.text ?? ''}
                onChange={(e) => set(i, { text: e.target.value })}
                maxLength={120}
                placeholder="Up to 12"
                error={err(`features.${i}.text`)}
              />
            ) : null}
            <TextField
              label="Tooltip"
              hint="Optional explanation"
              value={f.tooltip ?? ''}
              onChange={(e) => set(i, { tooltip: e.target.value })}
              maxLength={300}
            />
            <TextField
              label="Comparison key"
              hint="Same key = same row in the comparison"
              value={f.key ?? ''}
              onChange={(e) => set(i, { key: e.target.value })}
              maxLength={60}
              error={err(`features.${i}.key`)}
            />
          </RepeatRow>
        ))}
      </ol>
      <AddRow
        label="Add feature"
        onAdd={() => setFeatures([...features, blankFeature()])}
        disabled={features.length >= 40}
      />
    </>
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
  const a = usePackageSave(initial.id);
  const editing = !!initial.id;
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(editing);
  const [priceError, setPriceError] = useState<string | null>(null);
  const set = <K extends keyof PackageFormValues>(k: K, val: PackageFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const currency = v.currency ?? currencies[0] ?? 'USD';
  const priced = v.priceType !== 'custom_quote';
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (priceError) return;
    void a.save(packageBody(v, slugTouched, currency));
  }
  const opt = (k: 'tagline' | 'priceUnit' | 'deliveryTime' | 'revisionRounds' | 'supportPeriod' | 'costNote') => ({
    value: v[k] ?? '',
    onChange: (ev: { target: { value: string } }) => set(k, ev.target.value || null),
  });
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      {editing && v.priceReviewRequired ? (
        <p className="kz-anotice">
          <span>
            This price is a suggestion awaiting review.{' '}
            {canReview
              ? 'Approve it from the packages list.'
              : 'An administrator with price approval rights must approve it.'}
          </span>
        </p>
      ) : null}
      <FormSection id="p-basic" title="Package" description="How the package is named and where it appears.">
        <SelectField
          label="Service"
          value={v.serviceId}
          onChange={(ev) => set('serviceId', ev.target.value)}
          error={a.err('serviceId')}
        >
          <option value="">Choose a service</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.division} · {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Status"
          value={v.status}
          onChange={(ev) => set('status', ev.target.value as PackageFormValues['status'])}
          error={a.err('status')}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Name"
          value={v.name}
          onChange={(ev) => set('name', ev.target.value)}
          maxLength={120}
          error={a.err('name')}
        />
        <SlugField
          name={v.name}
          slug={v.slug}
          setSlug={(s) => set('slug', s)}
          touched={slugTouched}
          setTouched={setSlugTouched}
          prefix="Identifier: "
          error={a.err('slug')}
        />
        <TextField label="Tagline" {...opt('tagline')} maxLength={200} error={a.err('tagline')} className="kz-span-2" />
        <SelectField
          label="Pricing tab"
          value={v.tab}
          onChange={(ev) => set('tab', ev.target.value as Tab)}
          error={a.err('tab')}
        >
          {TABS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectField>
        <div className="kz-wsf__end">
          <CheckItem checked={v.mostPopular} onChange={(e) => set('mostPopular', e.target.checked)}>
            Most popular (one per tab)
          </CheckItem>
        </div>
      </FormSection>

      <FormSection
        id="p-price"
        title="Price"
        description='Price changes need approval before they stop being "suggested". Quotations copy the price when the package is added.'
      >
        <SelectField
          label="Billing"
          value={v.billingType}
          onChange={(ev) => set('billingType', ev.target.value as PackageFormValues['billingType'])}
          error={a.err('billingType')}
        >
          <option value="one_off">One-off</option>
          <option value="recurring">Recurring</option>
        </SelectField>
        {v.billingType === 'recurring' ? (
          <SelectField
            label="Interval"
            value={v.interval ?? 'month'}
            onChange={(ev) => set('interval', ev.target.value as 'month' | 'year')}
            error={a.err('interval')}
          >
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </SelectField>
        ) : null}
        <SelectField
          label="Price type"
          value={v.priceType}
          onChange={(ev) => set('priceType', ev.target.value as PackageFormValues['priceType'])}
          error={a.err('priceType')}
        >
          <option value="fixed">Fixed price</option>
          <option value="starting_from">Starting from</option>
          <option value="custom_quote">Custom quote (no price)</option>
        </SelectField>
        {priced ? (
          <>
            <SelectField
              label="Currency"
              value={currency}
              onChange={(ev) => set('currency', ev.target.value)}
              error={a.err('currency')}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
            <Field label="Price" error={priceError ?? a.err('priceMinor')}>
              {(p) => (
                <MoneyInput
                  {...p}
                  valueMinor={v.priceMinor}
                  onChangeMinor={(m) => set('priceMinor', m)}
                  currency={currency}
                  onParseError={setPriceError}
                />
              )}
            </Field>
            <TextField
              label="Price unit"
              hint='e.g. "per mailbox"'
              {...opt('priceUnit')}
              maxLength={40}
              error={a.err('priceUnit')}
            />
            {currency !== 'ZWG' ? (
              <Field
                label="Manual ZWG price"
                hint="Optional; used for ZWG quotations"
                error={a.err('altPriceZwgMinor')}
              >
                {(p) => (
                  <MoneyInput
                    {...p}
                    valueMinor={v.altPriceZwgMinor}
                    onChangeMinor={(m) => set('altPriceZwgMinor', m)}
                    currency="ZWG"
                  />
                )}
              </Field>
            ) : null}
            {v.billingType === 'recurring' && (v.interval ?? 'month') === 'month' ? (
              <Field label="Annual price" hint="Optional yearly option" error={a.err('annualPriceMinor')}>
                {(p) => (
                  <MoneyInput
                    {...p}
                    valueMinor={v.annualPriceMinor}
                    onChangeMinor={(m) => set('annualPriceMinor', m)}
                    currency={currency}
                  />
                )}
              </Field>
            ) : null}
          </>
        ) : null}
        <TextField
          label="Minimum quantity"
          type="number"
          min={1}
          inputMode="numeric"
          value={v.minQuantity}
          onChange={(ev) => set('minQuantity', Math.max(1, Number(ev.target.value) || 1))}
          error={a.err('minQuantity')}
        />
        <TextareaField
          label="Internal cost note"
          hint="Never shown publicly (e.g. third-party costs included)"
          rows={2}
          {...opt('costNote')}
          maxLength={1000}
          error={a.err('costNote')}
          className="kz-span-2"
        />
      </FormSection>

      <FormSection id="p-delivery" title="Delivery" description="Shown on the pricing page and in quotations.">
        <TextField
          label="Delivery time"
          {...opt('deliveryTime')}
          maxLength={60}
          placeholder="2–3 weeks"
          error={a.err('deliveryTime')}
        />
        <TextField
          label="Revision rounds"
          {...opt('revisionRounds')}
          maxLength={60}
          placeholder="2 rounds"
          error={a.err('revisionRounds')}
        />
        <TextField
          label="Support period"
          {...opt('supportPeriod')}
          maxLength={60}
          placeholder="30 days"
          error={a.err('supportPeriod')}
        />
      </FormSection>

      <FormSection
        id="p-features"
        title="Features"
        description="In display order. Quotations list the included ones."
        wide
        cols={1}
      >
        <FeatureRows features={v.features} setFeatures={(f) => set('features', f)} err={a.err} />
      </FormSection>

      {editing && !inUse ? (
        <FormSection
          id="p-remove"
          title="Remove"
          description="A package that quotations use can't be deleted."
          cols={1}
        >
          <div>
            <DeleteAction
              buttonLabel="Delete package"
              title={`Delete ${initial.name}?`}
              description="This can't be undone. A package that is in use can't be deleted; set it to hidden instead."
              confirmLabel="Delete package"
              call={a.remove}
              after="/admin/packages"
            />
          </div>
        </FormSection>
      ) : null}
      <SaveBar error={a.error}>
        <a href="/admin/packages" className="kz-btn kz-btn--secondary">
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          {editing ? 'Save package' : 'Create package'}
        </Button>
      </SaveBar>
    </form>
  );
}
