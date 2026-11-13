/**
 * Create / edit a case study (R6.2): details, story (rich text), links and gallery, search fields, and, once saved,
 * publishing (preview, publish / unpublish, delete drafts). Labels are the e2e contract.
 */
import { useState, type FormEvent } from 'react';
import { Field, SelectField, TextareaField, TextField } from '../../primitives';
import { Button, LinkButton } from '../../primitives/button';
import { RichText } from '../../primitives/RichText';
import { CheckItem, FormSection, SaveBar } from '../form';
import { splitCsv, toggleId } from '../website/lib';
import { DeleteAction, mediaOptions, type MediaOption } from '../website/parts';
import { usePortfolio, type PortfolioValues } from './useCms';

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
  const a = usePortfolio(id, status);
  const [v, setV] = useState(initial);
  const set = (patch: Partial<PortfolioValues>) => setV((p) => ({ ...p, ...patch }));
  const [tech, setTech] = useState(initial.technologies.join(', '));
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void a.save({ ...v, technologies: splitCsv(tech) });
  }
  const richField = (key: 'description' | 'challenge' | 'solution', label: string) => (
    <Field label={label} error={a.err(key)} className="kz-span-2">
      {(p) => <RichText {...p} label={label} value={v[key] ?? ''} onChange={(h) => set({ [key]: h || null })} />}
    </Field>
  );
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection id="pf-details" title="Case study" description="The project as visitors see it on Our work.">
        <TextField
          label="Project name"
          value={v.name}
          maxLength={120}
          onChange={(x) => set({ name: x.target.value })}
          error={a.err('name')}
        />
        <TextField
          label="Address"
          hint="Shown as /work/your-address."
          value={v.slug}
          maxLength={80}
          onChange={(x) => set({ slug: x.target.value })}
          error={a.err('slug')}
        />
        <TextField
          label="Category"
          value={v.category}
          maxLength={60}
          onChange={(x) => set({ category: x.target.value })}
          error={a.err('category')}
        />
        <TextField
          label="Completed"
          type="date"
          value={v.completionDate ?? ''}
          onChange={(x) => set({ completionDate: x.target.value || null })}
          error={a.err('completionDate')}
        />
        <TextField
          label="Client name"
          hint="Only shown with the client's permission."
          value={v.clientName ?? ''}
          maxLength={120}
          onChange={(x) => set({ clientName: x.target.value || null })}
          error={a.err('clientName')}
        />
        <div className="kz-wsf__end">
          <CheckItem checked={v.showClientName} onChange={(e) => set({ showClientName: e.target.checked })}>
            The client agreed to be named
          </CheckItem>
        </div>
        <TextareaField
          label="Summary"
          rows={2}
          value={v.summary}
          maxLength={300}
          onChange={(x) => set({ summary: x.target.value })}
          error={a.err('summary')}
          className="kz-span-2"
        />
      </FormSection>
      <FormSection id="pf-story" title="The story" description="Overview, challenge and solution." cols={1}>
        {richField('description', 'Overview')}
        {richField('challenge', 'The challenge')}
        {richField('solution', 'Our solution')}
      </FormSection>
      <FormSection id="pf-media" title="Links and images" description="Technologies, live site, cover and gallery.">
        <TextField
          label="Technologies"
          hint="Separate with commas."
          value={tech}
          onChange={(x) => setTech(x.target.value)}
          error={a.err('technologies')}
        />
        <TextField
          label="Live site"
          hint="Optional https:// address."
          value={v.externalUrl ?? ''}
          onChange={(x) => set({ externalUrl: x.target.value || null })}
          error={a.err('externalUrl')}
        />
        <SelectField
          label="Cover image"
          value={v.coverMediaId ?? ''}
          onChange={(x) => set({ coverMediaId: x.target.value || null })}
          error={a.err('coverMediaId')}
        >
          <option value="">No cover image</option>
          {mediaOptions(media).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Order"
          hint="Lower numbers come first."
          type="number"
          min={0}
          inputMode="numeric"
          value={v.sortOrder}
          onChange={(x) => set({ sortOrder: Number(x.target.value) || 0 })}
          error={a.err('sortOrder')}
        />
        <fieldset className="kz-wsg kz-span-2">
          <legend>Gallery</legend>
          {media.length === 0 ? (
            <p className="kz-hint">Upload images in the media library first.</p>
          ) : (
            <div className="kz-acheckgrid">
              {media.map((m) => (
                <CheckItem
                  key={m.id}
                  checked={v.galleryMediaIds.includes(m.id)}
                  onChange={(e) => set({ galleryMediaIds: toggleId(v.galleryMediaIds, m.id, e.target.checked) })}
                >
                  {m.alt_text}
                </CheckItem>
              ))}
            </div>
          )}
        </fieldset>
        <CheckItem checked={v.featured} onChange={(e) => set({ featured: e.target.checked })} className="kz-span-2">
          Feature on the home page
        </CheckItem>
      </FormSection>
      <FormSection id="pf-seo" title="Search engines" description="Optional. Empty uses the name and summary.">
        <TextField
          label="Search title"
          value={v.seoTitle ?? ''}
          maxLength={70}
          onChange={(x) => set({ seoTitle: x.target.value || null })}
          error={a.err('seoTitle')}
        />
        <TextField
          label="Search description"
          value={v.seoDescription ?? ''}
          maxLength={170}
          onChange={(x) => set({ seoDescription: x.target.value || null })}
          error={a.err('seoDescription')}
        />
      </FormSection>
      {id ? (
        <FormSection
          id="pf-publish"
          title="Publishing"
          description={status === 'published' ? 'Live on the website.' : 'A draft: not on the website.'}
          cols={1}
        >
          <div className="kz-aacts-row">
            <LinkButton variant="secondary" href={`/work/${initial.slug}?preview=1`} target="_blank" rel="noopener">
              Preview
            </LinkButton>
            <Button variant="secondary" onClick={() => void a.toggleStatus()}>
              {status === 'published' ? 'Unpublish' : 'Publish'}
            </Button>
            {status !== 'published' ? (
              <DeleteAction
                buttonLabel="Delete"
                title="Delete this case study?"
                description="It was never published or has been unpublished. This can't be undone."
                confirmLabel="Delete"
                call={a.remove}
                after="/admin/cms/portfolio"
              />
            ) : null}
          </div>
        </FormSection>
      ) : null}
      <SaveBar error={a.error}>
        <a href="/admin/cms/portfolio" className="kz-btn kz-btn--secondary">
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          {id ? 'Save' : 'Create draft'}
        </Button>
      </SaveBar>
    </form>
  );
}
