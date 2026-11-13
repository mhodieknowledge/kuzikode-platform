/** Page details and search fields of a CMS page (R6.2): title, search title and description, share image. */
import { FormAlert } from '../../auth/FormAlert';
import { SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { PaneBox } from '../PaneBox';
import { mediaOptions, type MediaOption } from '../website/parts';
import { usePageMeta } from './useCms';

export function PageMetaForm({
  pageKey,
  initial,
  media,
}: {
  pageKey: string;
  initial: { title: string; seoTitle: string | null; seoDescription: string | null; ogImageId: string | null };
  media: MediaOption[];
}) {
  const a = usePageMeta(pageKey);
  return (
    <PaneBox id="meta-h" title="Page details and search">
      <form
        noValidate
        className="kz-astack"
        onSubmit={(ev) => {
          ev.preventDefault();
          void a.save(new FormData(ev.currentTarget));
        }}
      >
        <TextField
          label="Page title"
          name="title"
          defaultValue={initial.title}
          maxLength={120}
          error={a.err('title')}
        />
        <TextField
          label="Search title"
          hint="Up to 70 characters. Empty uses the page title."
          name="seoTitle"
          defaultValue={initial.seoTitle ?? ''}
          maxLength={70}
          error={a.err('seoTitle')}
        />
        <TextareaField
          label="Search description"
          hint="Up to 170 characters."
          name="seoDescription"
          rows={3}
          defaultValue={initial.seoDescription ?? ''}
          maxLength={170}
          error={a.err('seoDescription')}
        />
        <SelectField
          label="Share image"
          hint="Shown when the page is shared."
          name="ogImageId"
          defaultValue={initial.ogImageId ?? ''}
          error={a.err('ogImageId')}
        >
          <option value="">Default</option>
          {mediaOptions(media).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        <FormAlert message={a.error} />
        <div className="kz-wsf__row">
          <Button type="submit" variant="secondary" loading={a.busy}>
            Save details
          </Button>
          {a.saved ? (
            <p role="status" className="kz-wsf__ok">
              Saved and live.
            </p>
          ) : null}
        </div>
      </form>
    </PaneBox>
  );
}
