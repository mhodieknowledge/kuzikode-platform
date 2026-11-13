/** Create / edit a service within a division (R6.2): details, description and pricing (price shown mono, right-aligned). */
import { useState, type FormEvent } from 'react';
import { Field, SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { MoneyInput } from '../../primitives/money';
import { RichText } from '../../primitives/RichText';
import { CheckItem, FormSection, SaveBar } from '../form';
import { STATUS_OPTIONS } from '../website/lib';
import { DeleteAction, SlugField } from '../website/parts';
import { PRICING_OPTIONS, serviceBody, useCatalogueSave, type ServiceFormValues } from './useServices';

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
  const a = useCatalogueSave('service', initial.id);
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
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (priceError) return;
    void a.save(
      serviceBody(new FormData(e.currentTarget), {
        categoryId,
        name,
        slug,
        slugTouched,
        description,
        pricing,
        price,
        currency,
        featured,
      }),
    );
  }
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection id="s-basic" title="Service" description="How the service appears on its division page.">
        <SelectField
          label="Division"
          value={categoryId}
          onChange={(ev) => setCategoryId(ev.target.value)}
          error={a.err('categoryId')}
        >
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Status" name="status" defaultValue={initial.status} error={a.err('status')}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Name"
          value={name}
          maxLength={120}
          onChange={(ev) => setName(ev.target.value)}
          error={a.err('name')}
        />
        <SlugField
          name={name}
          slug={slug}
          setSlug={setSlug}
          touched={slugTouched}
          setTouched={setSlugTouched}
          prefix={`/contact?category=${division?.slug ?? '…'}&service=`}
          error={a.err('slug')}
        />
        <TextareaField
          label="Summary"
          name="summary"
          rows={2}
          defaultValue={initial.summary}
          maxLength={300}
          error={a.err('summary')}
          className="kz-span-2"
        />
        <CheckItem checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="kz-span-2">
          Featured
        </CheckItem>
        <Field label="Description" error={a.err('description')} className="kz-span-2">
          {(p) => <RichText {...p} label="Description" value={description} onChange={setDescription} />}
        </Field>
      </FormSection>
      <FormSection
        id="s-price"
        title="Pricing"
        description="Shown on the division page and used as the default in quotations."
      >
        <SelectField
          label="Pricing model"
          value={pricing}
          onChange={(ev) => setPricing(ev.target.value as ServiceFormValues['pricingModel'])}
          error={a.err('pricingModel')}
        >
          {PRICING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        {pricing !== 'custom_quote' ? (
          <>
            <SelectField
              label="Currency"
              value={currency}
              onChange={(ev) => setCurrency(ev.target.value)}
              error={a.err('currency')}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
            <Field label={pricing === 'hourly' ? 'Rate per hour' : 'Price'} error={priceError ?? a.err('priceMinor')}>
              {(p) => (
                <MoneyInput
                  {...p}
                  valueMinor={price}
                  onChangeMinor={setPrice}
                  currency={currency}
                  onParseError={setPriceError}
                />
              )}
            </Field>
          </>
        ) : null}
      </FormSection>
      {editing && !inUse ? (
        <FormSection
          id="s-remove"
          title="Remove"
          description="A service that quotations or packages use can't be deleted."
          cols={1}
        >
          <div>
            <DeleteAction
              buttonLabel="Delete service"
              title={`Delete ${initial.name}?`}
              description="This can't be undone. A service that is in use can't be deleted; set it to hidden instead."
              confirmLabel="Delete service"
              call={a.remove}
              after="/admin/services"
            />
          </div>
        </FormSection>
      ) : null}
      <SaveBar error={a.error}>
        <a href="/admin/services" className="kz-btn kz-btn--secondary">
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          {editing ? 'Save service' : 'Create service'}
        </Button>
      </SaveBar>
    </form>
  );
}
