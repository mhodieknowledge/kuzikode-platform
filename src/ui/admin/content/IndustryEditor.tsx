/** Create / edit an industry page (R6.2): details, "challenges we help with" rows, related services and search fields. */
import { useState, type FormEvent } from 'react';
import { Field, SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { FormAlert } from '../../auth/FormAlert';
import { RichText } from '../../primitives/RichText';
import { CheckItem, FormSection, SaveBar } from '../form';
import { contentApi, firstListError, patchAt, toggleId } from '../website/lib';
import { AddRow, DeleteAction, RepeatRow } from '../website/parts';
import { useIndustrySave, type IndustryValues } from './useContent';

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
  const a = useIndustrySave(id);
  const [v, setV] = useState(initial);
  const set = (patch: Partial<IndustryValues>) => setV((p) => ({ ...p, ...patch }));
  const divisions = [...new Set(services.map((s) => s.division))];
  function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    void a.save(v);
  }
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection id="in-details" title="Industry" description="The page at /industries/<address>.">
        <TextField
          label="Industry name"
          value={v.name}
          maxLength={80}
          onChange={(x) => set({ name: x.target.value })}
          error={a.err('name')}
        />
        <TextField
          label="Address"
          hint="Shown as /industries/your-address."
          value={v.slug}
          maxLength={80}
          onChange={(x) => set({ slug: x.target.value.trim().toLowerCase() })}
          error={a.err('slug')}
        />
        <TextareaField
          label="Summary"
          rows={2}
          value={v.summary}
          maxLength={300}
          onChange={(x) => set({ summary: x.target.value })}
          error={a.err('summary')}
          className="kz-span-2"
        />
        <SelectField
          label="Icon"
          value={v.icon ?? ''}
          onChange={(x) => set({ icon: x.target.value || null })}
          error={a.err('icon')}
        >
          <option value="">Default</option>
          {icons.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Status"
          value={v.status}
          onChange={(x) => set({ status: x.target.value as IndustryValues['status'] })}
          error={a.err('status')}
        >
          <option value="draft">Draft (not on the website)</option>
          <option value="published">Published</option>
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
        <Field label="More detail" error={a.err('body')} className="kz-span-2">
          {(p) => (
            <RichText
              {...p}
              label="More detail"
              value={v.body ?? ''}
              onChange={(html) => set({ body: html || null })}
            />
          )}
        </Field>
      </FormSection>
      <FormSection id="in-challenges" title="Challenges we help with" wide cols={1}>
        {v.challenges.length === 0 ? <p className="kz-hint">No challenges listed yet.</p> : null}
        <ol className="kz-wsr-list">
          {v.challenges.map((c, i) => (
            <RepeatRow
              key={i}
              noun="challenge"
              index={i}
              count={v.challenges.length}
              onRemove={() => set({ challenges: v.challenges.filter((_, j) => j !== i) })}
            >
              <TextField
                label={`Challenge ${i + 1}`}
                value={c.title}
                maxLength={100}
                onChange={(x) => set({ challenges: patchAt(v.challenges, i, { title: x.target.value }) })}
                error={a.err(`challenges.${i}.title`)}
              />
              <TextField
                label="How we help"
                value={c.body}
                maxLength={400}
                onChange={(x) => set({ challenges: patchAt(v.challenges, i, { body: x.target.value }) })}
                error={a.err(`challenges.${i}.body`)}
              />
            </RepeatRow>
          ))}
        </ol>
        {v.challenges.length < 8 ? (
          <AddRow label="Add challenge" onAdd={() => set({ challenges: [...v.challenges, { title: '', body: '' }] })} />
        ) : null}
      </FormSection>
      <FormSection
        id="in-services"
        title="Relevant services"
        description="Shown as links on the industry page."
        wide
        cols={1}
      >
        <FormAlert message={firstListError(a.errors, 'serviceIds') ?? null} />
        <div className="kz-acheckgrid">
          {divisions.map((d) => (
            <div key={d}>
              <p className="kz-acheckgrid__g">{d}</p>
              <ul>
                {services
                  .filter((s) => s.division === d)
                  .map((s) => (
                    <li key={s.id}>
                      <CheckItem
                        checked={v.serviceIds.includes(s.id)}
                        onChange={(e) => set({ serviceIds: toggleId(v.serviceIds, s.id, e.target.checked) })}
                      >
                        {s.name}
                      </CheckItem>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </FormSection>
      <FormSection id="in-seo" title="Search engines" description="Optional. Empty uses the name and summary.">
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
        <FormSection id="in-remove" title="Remove" cols={1}>
          <div>
            <DeleteAction
              buttonLabel="Delete"
              buttonAriaLabel="Delete industry"
              title="Delete industry?"
              description="The industry page is removed from the website."
              confirmLabel="Delete"
              call={() => contentApi(`/industries/${id}`, { method: 'DELETE' })}
              after="/admin/content/industries"
            />
          </div>
        </FormSection>
      ) : null}
      <SaveBar error={a.error}>
        <a href="/admin/content/industries" className="kz-btn kz-btn--secondary">
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          {id ? 'Save' : 'Create industry'}
        </Button>
      </SaveBar>
    </form>
  );
}
