/** Create / edit a division (service category) (R6.2): details, benefits, deliverables, Q&A and search fields. */
import { useState, type FormEvent } from 'react';
import { CMS_ICONS } from '../../../shared/icons';
import { Field, SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { RichText } from '../../primitives/RichText';
import { CheckItem, FormSection, SaveBar } from '../form';
import { firstListError, patchAt, STATUS_OPTIONS } from '../website/lib';
import { AddRow, DeleteAction, RepeatRow, SlugField } from '../website/parts';
import { divisionBody, useCatalogueSave, type DivisionFormValues } from './useServices';

export function DivisionForm({ initial }: { initial: DivisionFormValues }) {
  const a = useCatalogueSave('division', initial.id);
  const editing = !!initial.id;
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(editing);
  const [description, setDescription] = useState(initial.description);
  const [benefits, setBenefits] = useState(initial.benefits);
  const [deliverables, setDeliverables] = useState(initial.deliverables);
  const [faq, setFaq] = useState(initial.faq);
  const [featured, setFeatured] = useState(initial.featured);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void a.save(
      divisionBody(new FormData(e.currentTarget), {
        name,
        slug,
        slugTouched,
        description,
        benefits,
        deliverables,
        faq,
        featured,
      }),
    );
  }
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection
        id="d-basic"
        title="Division"
        description="How the division appears on the website and in quotations."
      >
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
          prefix="/services/"
          error={a.err('slug')}
        />
        <SelectField label="Status" name="status" defaultValue={initial.status} error={a.err('status')}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Icon" name="icon" defaultValue={initial.icon ?? ''} error={a.err('icon')}>
          <option value="">None</option>
          {CMS_ICONS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </SelectField>
        <TextareaField
          label="Summary"
          hint="One or two sentences for cards and the menu."
          name="summary"
          rows={2}
          defaultValue={initial.summary}
          maxLength={300}
          error={a.err('summary')}
          className="kz-span-2"
        />
        <CheckItem checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="kz-span-2">
          Feature on the home page
        </CheckItem>
        <Field label="Description" error={a.err('description')} className="kz-span-2">
          {(p) => <RichText {...p} label="Description" value={description} onChange={setDescription} />}
        </Field>
      </FormSection>

      <FormSection id="d-benefits" title="Benefits" description="Up to 12, shown on the division page." wide cols={1}>
        {firstListError(a.errors, 'benefits') ? (
          <p className="kz-error">{firstListError(a.errors, 'benefits')}</p>
        ) : null}
        <ol className="kz-wsr-list">
          {benefits.map((b, i) => (
            <RepeatRow
              key={i}
              noun="benefit"
              index={i}
              count={benefits.length}
              onRemove={() => setBenefits(benefits.filter((_, j) => j !== i))}
            >
              <TextField
                label={`Benefit ${i + 1} title`}
                value={b.title}
                maxLength={120}
                onChange={(ev) => setBenefits(patchAt(benefits, i, { title: ev.target.value }))}
              />
              <TextField
                label={`Benefit ${i + 1} description`}
                value={b.body}
                maxLength={400}
                onChange={(ev) => setBenefits(patchAt(benefits, i, { body: ev.target.value }))}
              />
            </RepeatRow>
          ))}
        </ol>
        {benefits.length < 12 ? (
          <AddRow label="Add benefit" onAdd={() => setBenefits([...benefits, { title: '', body: '' }])} />
        ) : null}
      </FormSection>

      <FormSection id="d-deliver" title="Typical deliverables" description="Up to 20 short lines." wide cols={1}>
        {firstListError(a.errors, 'deliverables') ? (
          <p className="kz-error">{firstListError(a.errors, 'deliverables')}</p>
        ) : null}
        <ol className="kz-wsr-list">
          {deliverables.map((d, i) => (
            <RepeatRow
              key={i}
              noun="deliverable"
              index={i}
              count={deliverables.length}
              onRemove={() => setDeliverables(deliverables.filter((_, j) => j !== i))}
            >
              <TextField
                label={`Deliverable ${i + 1}`}
                value={d}
                maxLength={200}
                onChange={(ev) => setDeliverables(deliverables.map((x, j) => (j === i ? ev.target.value : x)))}
              />
            </RepeatRow>
          ))}
        </ol>
        {deliverables.length < 20 ? (
          <AddRow label="Add deliverable" onAdd={() => setDeliverables([...deliverables, ''])} />
        ) : null}
      </FormSection>

      <FormSection
        id="d-faq"
        title="Questions and answers"
        description="Up to 20, shown on the division page."
        wide
        cols={1}
      >
        {firstListError(a.errors, 'faq') ? <p className="kz-error">{firstListError(a.errors, 'faq')}</p> : null}
        <ol className="kz-wsr-list">
          {faq.map((x, i) => (
            <RepeatRow
              key={i}
              noun="question"
              index={i}
              count={faq.length}
              onRemove={() => setFaq(faq.filter((_, j) => j !== i))}
            >
              <TextField
                label={`Question ${i + 1}`}
                value={x.q}
                maxLength={200}
                onChange={(ev) => setFaq(patchAt(faq, i, { q: ev.target.value }))}
              />
              <TextareaField
                label={`Answer ${i + 1}`}
                rows={2}
                value={x.a}
                maxLength={2000}
                onChange={(ev) => setFaq(patchAt(faq, i, { a: ev.target.value }))}
              />
            </RepeatRow>
          ))}
        </ol>
        {faq.length < 20 ? <AddRow label="Add question" onAdd={() => setFaq([...faq, { q: '', a: '' }])} /> : null}
      </FormSection>

      <FormSection id="d-seo" title="Search engines" description="Optional. When empty, the name and summary are used.">
        <TextField
          label="SEO title"
          hint="Up to 70 characters."
          name="seoTitle"
          defaultValue={initial.seoTitle ?? ''}
          maxLength={70}
          error={a.err('seoTitle')}
        />
        <TextareaField
          label="SEO description"
          hint="Up to 170 characters."
          name="seoDescription"
          rows={2}
          defaultValue={initial.seoDescription ?? ''}
          maxLength={170}
          error={a.err('seoDescription')}
        />
      </FormSection>

      {editing ? (
        <FormSection id="d-remove" title="Remove" description="A division that has services can't be deleted." cols={1}>
          <div>
            <DeleteAction
              buttonLabel="Delete division"
              title={`Delete ${initial.name}?`}
              description="This can't be undone. A division that is in use can't be deleted; set it to hidden instead."
              confirmLabel="Delete division"
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
          {editing ? 'Save division' : 'Create division'}
        </Button>
      </SaveBar>
    </form>
  );
}
