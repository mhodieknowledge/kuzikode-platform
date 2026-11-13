import { useId, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../../icons/icon';
import { cx } from '../../primitives';

interface Props {
  label: ReactNode;
  accept: string;
  maxBytes: number;
  hint: ReactNode;
  optional?: boolean;
  /** Error from the server (or the form) for this file. */
  error?: string | undefined;
  onFile: (file: File | null) => void;
}

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toFixed(1)} MB`);

/**
 * Document drop plate (careers application, R4.7). The native file input covers the whole plate, so a tap anywhere opens the
 * picker and drag-and-drop works on desktop; the plate shows the chosen file's name and size with a "Remove" control. The
 * extension and size are checked here for fast feedback; the server checks the real file type.
 */
export function FileField({ label, accept, maxBytes, hint, optional, error, onFile }: Props) {
  const auto = useId();
  const id = `ff${auto.replace(/:/g, '')}`;
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const exts = accept.split(',').map((s) => s.trim().toLowerCase());
  const shown = local ?? error;

  const take = (f: File | undefined) => {
    if (!f) return;
    const ext = `.${f.name.split('.').pop()?.toLowerCase() ?? ''}`;
    if (!exts.includes(ext)) {
      setLocal('Choose a PDF or Word (.docx) file.');
      return;
    }
    if (f.size > maxBytes) {
      setLocal(`Files must be ${Math.round(maxBytes / 1048576)} MB or smaller.`);
      return;
    }
    setLocal(null);
    setFile(f);
    onFile(f);
  };
  const clear = () => {
    if (input.current) input.current.value = '';
    setFile(null);
    setLocal(null);
    onFile(null);
    input.current?.focus();
  };

  return (
    <div className="kz-field">
      <label className="kz-label" htmlFor={id}>
        {label}
        {optional ? <span className="kz-label__opt"> (optional)</span> : null}
      </label>
      <div className={cx('kz-file', over && 'is-over', file && 'has-file', shown && 'is-invalid')}>
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept}
          className="kz-file__input"
          aria-describedby={`${id}-hint${shown ? ` ${id}-error` : ''}`}
          aria-invalid={shown ? true : undefined}
          onChange={(e) => take(e.target.files?.[0])}
          onDragEnter={() => setOver(true)}
          onDragLeave={() => setOver(false)}
          onDrop={() => setOver(false)}
        />
        <span className="kz-file__mark" aria-hidden="true">
          <Icon name={file ? 'check' : 'upload'} size={20} />
        </span>
        {file ? (
          <span className="kz-file__text">
            <span className="kz-file__name">{file.name}</span>
            <span className="kz-file__meta">{size(file.size)}</span>
          </span>
        ) : (
          <span className="kz-file__text" aria-hidden="true">
            <span className="kz-file__name">Choose a file</span>
            <span className="kz-file__meta kz-file__drag">or drop it here</span>
          </span>
        )}
        {file ? (
          <button type="button" className="kz-file__remove" onClick={clear}>
            Remove<span className="sr-only"> {file.name}</span>
          </button>
        ) : null}
      </div>
      <p className="kz-hint" id={`${id}-hint`}>
        {hint}
      </p>
      {shown ? (
        <p className="kz-error" id={`${id}-error`}>
          <Icon name="status-danger" size={16} className="mt-0.5" />
          {shown}
        </p>
      ) : null}
    </div>
  );
}
