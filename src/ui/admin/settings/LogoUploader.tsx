/** Document logo: current image, choose-a-file upload (PNG / JPEG / WebP, 2 MB) and remove (R6.2 group 3). */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { apiFetch } from '../../lib/api';
import { Button } from '../../primitives/button';
import { TextField } from '../../primitives';
import { settingsApi, useSave } from './useSettings';

const MAX_BYTES = 2 * 1024 * 1024;
const EXTS = ['.png', '.jpg', '.jpeg', '.webp'];

/** Client-side pre-check; the server validates everything again. Returns a message, or null when the file is acceptable. */
export function logoProblem(file: { name: string; size: number }): string | null {
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  if (!EXTS.includes(ext)) return `Choose a ${EXTS.join(', ')} file.`;
  if (file.size > MAX_BYTES) return 'Files must be 2 MB or smaller.';
  return null;
}

export function LogoUploader({ current, canEdit }: { current: string | null; canEdit: boolean }) {
  const [fileId, setFileId] = useState(current);
  const [local, setLocal] = useState<string | null>(null);
  const s = useSave();
  function upload(file: File) {
    const problem = logoProblem(file);
    if (problem) return setLocal(problem);
    setLocal(null);
    const body = new FormData();
    body.set('file', file);
    body.set('purpose', 'image');
    body.set('ownerType', 'system');
    void s.run(async () => {
      const up = await apiFetch<{ data: { id: string } }>('/api/v1/admin/files', { body });
      await settingsApi('/logo', { method: 'PUT', body: { fileId: up.data.id } });
      setFileId(up.data.id);
      return 'Logo updated.';
    });
  }
  return (
    <div className="kz-alog">
      {fileId ? (
        <img
          src={`/api/v1/admin/files/${fileId}`}
          alt="Current document logo"
          style={{
            height: 64,
            width: 'auto',
            alignSelf: 'start',
            padding: 8,
            background: '#fff',
            borderRadius: 6,
            boxShadow: '0 0 0 1px var(--bone-200)',
          }}
        />
      ) : (
        <p className="kz-hint">No logo uploaded. Documents use the Kuzikode wordmark.</p>
      )}
      {canEdit ? (
        <>
          <TextField
            label="Upload a logo"
            type="file"
            accept={EXTS.join(',')}
            hint="PNG, JPEG or WebP, up to 2 MB. A wide logo on a transparent background works best."
            error={local ?? undefined}
            disabled={s.busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = '';
            }}
          />
          {fileId ? (
            <div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  void s.run(async () => {
                    await settingsApi('/logo', { method: 'PUT', body: { fileId: null } });
                    setFileId(null);
                    return 'Logo removed.';
                  })
                }
              >
                Remove logo
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
      <FormAlert message={s.err('fileId') ?? s.error} />
      {s.saved ? (
        <p role="status" className="kz-astatus">
          {s.saved}
        </p>
      ) : null}
    </div>
  );
}
