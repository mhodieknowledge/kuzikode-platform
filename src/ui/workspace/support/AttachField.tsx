/**
 * Attachments plate for support messages (R5.4): a native multi-file input covering the whole plate (tap opens the picker,
 * drag-and-drop works on desktop), then the chosen files as mono lines. The server checks types and sizes.
 */
import { useState, type ChangeEvent } from 'react';
import { Icon } from '../../icons/icon';
import { Field } from '../../primitives';
import { FILE_HINT } from './useSupport';

const size = (b: number) =>
  b < 1048576 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`;

export function AttachField({ error }: { error?: string | undefined }) {
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    setFiles(Array.from(e.currentTarget.files ?? []));
    setOver(false);
  };
  return (
    <Field label="Attachments" optional hint={FILE_HINT} error={error}>
      {(p) => (
        <div className="kz-attach">
          <div className="kz-attach__plate" data-over={over ? '' : undefined}>
            <input
              {...p}
              type="file"
              name="files"
              multiple
              className="kz-attach__input"
              onChange={pick}
              onDragEnter={() => setOver(true)}
              onDragLeave={() => setOver(false)}
            />
            <Icon name="upload" size={20} />
            <span className="kz-attach__t">
              {files.length ? `${files.length} file${files.length === 1 ? '' : 's'} chosen` : 'Choose files'}
              <span className="kz-attach__or"> or drop them here</span>
            </span>
          </div>
          {files.length ? (
            <ul className="kz-attach__list">
              {files.map((f) => (
                <li key={`${f.name}-${f.size}`}>
                  <span className="kz-attach__name">{f.name}</span>
                  <span className="kz-attach__size">{size(f.size)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </Field>
  );
}
