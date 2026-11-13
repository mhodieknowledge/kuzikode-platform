/** Create / edit an Insights article (R6.2): details, the article body (rich text), publishing and search fields. */
import { useState, type FormEvent } from 'react';
import { Field, SelectField, TextareaField, TextField } from '../../primitives';
import { Button, LinkButton } from '../../primitives/button';
import { RichText } from '../../primitives/RichText';
import { FormSection, SaveBar } from '../form';
import { contentApi, toUtcInput } from '../website/lib';
import { DeleteAction, mediaOptions, type MediaOption } from '../website/parts';
import { usePostSave, type PostValues } from './useContent';

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
  const a = usePostSave(id);
  const [v, setV] = useState(initial);
  const [tags, setTags] = useState(initial.tags.join(', '));
  const set = (patch: Partial<PostValues>) => setV((p) => ({ ...p, ...patch }));
  function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    void a.save(v, tags);
  }
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection id="po-article" title="Article" description="What readers see on /insights." cols={1}>
        <TextField
          label="Title"
          value={v.title}
          maxLength={140}
          onChange={(x) => set({ title: x.target.value })}
          error={a.err('title')}
        />
        <TextareaField
          label="Summary"
          hint="One or two sentences for lists and search results."
          rows={2}
          value={v.excerpt}
          maxLength={300}
          onChange={(x) => set({ excerpt: x.target.value })}
          error={a.err('excerpt')}
        />
        <Field label="Article" error={a.err('body')}>
          {(p) => (
            <RichText {...p} label="Article" value={v.body} minHeight={320} onChange={(html) => set({ body: html })} />
          )}
        </Field>
      </FormSection>
      <FormSection id="po-details" title="Details" description="Address, category, tags and cover.">
        <TextField
          label="Address"
          hint="Shown as /insights/your-address."
          value={v.slug}
          maxLength={80}
          onChange={(x) => set({ slug: x.target.value.trim().toLowerCase() })}
          error={a.err('slug')}
        />
        <SelectField
          label="Category"
          value={v.categoryId ?? ''}
          onChange={(x) => set({ categoryId: x.target.value || null })}
          error={a.err('categoryId')}
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Tags"
          hint="Separate with commas, up to 10."
          value={tags}
          maxLength={400}
          onChange={(x) => setTags(x.target.value)}
          error={a.err('tags')}
        />
        <TextField
          label="Author shown"
          value={v.authorDisplayName}
          maxLength={80}
          onChange={(x) => set({ authorDisplayName: x.target.value })}
          error={a.err('authorDisplayName')}
        />
        <SelectField
          label="Cover image"
          hint="From the media library."
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
      </FormSection>
      <FormSection id="po-publish" title="Publishing" description="Drafts never appear on the website.">
        <SelectField
          label="Status"
          value={v.status}
          onChange={(x) => set({ status: x.target.value as PostValues['status'] })}
          error={a.err('status')}
        >
          <option value="draft">Draft (not on the website)</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
        </SelectField>
        {v.status === 'scheduled' ? (
          <TextField
            label="Publish at (UTC)"
            type="datetime-local"
            value={toUtcInput(v.publishAt)}
            onChange={(x) => set({ publishAt: x.target.value || null })}
            error={a.err('publishAt')}
          />
        ) : null}
        {id && initial.status === 'published' ? (
          <div className="kz-span-2">
            <LinkButton variant="secondary" href={`/insights/${initial.slug}`} target="_blank" rel="noopener">
              View on the website
            </LinkButton>
          </div>
        ) : null}
        {id && initial.status === 'draft' ? (
          <div className="kz-span-2">
            <DeleteAction
              buttonLabel="Delete"
              buttonAriaLabel="Delete article"
              title="Delete article?"
              description="The draft is removed permanently. Published articles must be moved back to draft first."
              confirmLabel="Delete"
              call={() => contentApi(`/posts/${id}`, { method: 'DELETE' })}
              after="/admin/content/insights"
            />
          </div>
        ) : null}
      </FormSection>
      <FormSection id="po-seo" title="Search engines" description="Optional. Empty uses the title and summary.">
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
      <SaveBar error={a.error}>
        <a href="/admin/content/insights" className="kz-btn kz-btn--secondary">
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          {id ? 'Save' : 'Create article'}
        </Button>
      </SaveBar>
    </form>
  );
}
