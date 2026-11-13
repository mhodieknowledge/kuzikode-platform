/**
 * Media library (R6.2): upload form, then image cards with details and edit / delete. Every image needs alt text. The labels
 * (Image, Alt text, Caption, Folder, "Upload image", "Delete image: <alt>") are the e2e contract.
 */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { FormSheet } from '../form';
import { PaneBox } from '../PaneBox';
import { useMedia, type MediaItem } from './useCms';

export function MediaLibrary({ media, canManage }: { media: MediaItem[]; canManage: boolean }) {
  const a = useMedia();
  const [editing, setEditing] = useState<MediaItem | null>(null);
  return (
    <div className="kz-astack">
      {canManage ? (
        <PaneBox id="media-upload" title="Add an image">
          <form
            noValidate
            className="kz-afsec__body kz-afsec__body--2"
            onSubmit={(ev) => {
              ev.preventDefault();
              void a.upload(new FormData(ev.currentTarget));
            }}
          >
            <TextField
              label="Image"
              hint="PNG, JPEG, WebP or AVIF up to 5 MB. No SVG."
              name="file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              error={a.err('file')}
            />
            <TextField
              label="Alt text"
              hint="What the image shows, for people who can't see it."
              name="altText"
              maxLength={300}
              error={a.err('altText')}
            />
            <TextField label="Caption" name="caption" maxLength={300} error={a.err('caption')} />
            <TextField
              label="Folder"
              hint="Optional, to group images."
              name="folder"
              maxLength={60}
              error={a.err('folder')}
            />
            <div className="kz-span-2 kz-wsf__row">
              <Button type="submit" lead="upload" loading={a.busy}>
                Upload image
              </Button>
              {editing ? null : <FormAlert message={a.error} />}
            </div>
          </form>
        </PaneBox>
      ) : null}
      {media.length === 0 ? (
        <p className="kz-wsf__empty">No images yet.</p>
      ) : (
        <ul className="kz-wmedia">
          {media.map((m) => (
            <li key={m.id} className="kz-wmedia__card">
              <img
                src={`/media/${m.file_id}`}
                alt={m.alt_text}
                loading="lazy"
                {...(m.width && m.height ? { width: m.width, height: m.height } : {})}
              />
              <div className="kz-wmedia__body">
                <p className="kz-wmedia__alt">{m.alt_text}</p>
                <p className="kz-wmedia__meta">
                  {m.original_name}
                  {m.width && m.height ? ` · ${m.width}×${m.height}` : ''}
                  {m.folder ? ` · ${m.folder}` : ''}
                </p>
                {canManage ? (
                  <div className="kz-arow-acts">
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Edit image: ${m.alt_text}`}
                      onClick={() => setEditing(m)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Delete image: ${m.alt_text}`}
                      onClick={() => void a.remove(m.id)}
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
      {editing ? (
        <FormSheet
          open
          onClose={() => setEditing(null)}
          title="Edit image details"
          formId="media-edit"
          submitLabel="Save"
          busy={a.busy}
          error={a.error}
          onSubmit={(f) => void a.update(editing.id, f)}
        >
          <TextField
            label="Alt text"
            name="altText"
            defaultValue={editing.alt_text}
            maxLength={300}
            error={a.err('altText')}
          />
          <TextField
            label="Caption"
            name="caption"
            defaultValue={editing.caption ?? ''}
            maxLength={300}
            error={a.err('caption')}
          />
          <TextField
            label="Folder"
            name="folder"
            defaultValue={editing.folder ?? ''}
            maxLength={60}
            error={a.err('folder')}
          />
        </FormSheet>
      ) : null}
    </div>
  );
}
