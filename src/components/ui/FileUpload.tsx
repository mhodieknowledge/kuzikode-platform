import { UploadCloud } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { cn } from './cn';

export interface FileUploadProps {
  label: string;
  accept: string;
  maxBytes: number;
  hint?: string;
  onFile: (file: File) => void | Promise<void>;
  /** 0–100 while uploading. */
  progress?: number | null;
  disabled?: boolean;
}

/** Drag-and-drop or click-to-choose file picker with type/size feedback. The server re-validates everything. */
export function FileUpload({ label, accept, maxBytes, hint, onFile, progress, disabled }: FileUploadProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const exts = accept.split(',').map((s) => s.trim().toLowerCase());
  const take = (file: File | undefined) => {
    if (!file) return;
    const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
    if (!exts.includes(ext)) return setError(`Choose a ${exts.join(', ')} file.`);
    if (file.size > maxBytes) return setError(`Files must be ${Math.round(maxBytes / 1048576)} MB or smaller.`);
    setError(null);
    setName(file.name);
    void onFile(file);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-950">
        {label}
      </label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) take(e.dataTransfer.files[0]);
        }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-6 text-center transition-colors',
          over ? 'border-brand-500 bg-brand-50' : 'border-ink-400 bg-surface',
          disabled && 'opacity-60',
        )}
      >
        <UploadCloud size={22} aria-hidden="true" className="text-ink-600" />
        <p className="text-sm text-ink-800">
          Drag a file here or{' '}
          <button
            type="button"
            className="font-semibold text-brand-600 underline-offset-2 hover:underline"
            onClick={() => input.current?.click()}
            disabled={disabled}
          >
            choose one
          </button>
        </p>
        <p className="text-[13px] text-ink-600">
          {hint ?? `${exts.join(', ')} up to ${Math.round(maxBytes / 1048576)} MB`}
        </p>
        {name ? <p className="text-[13px] font-medium text-ink-950">{name}</p> : null}
        {typeof progress === 'number' ? (
          <div
            className="h-1.5 w-full max-w-60 overflow-hidden rounded-full bg-ink-950/10"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
          >
            <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
        <input
          id={id}
          ref={input}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => take(e.target.files?.[0])}
          aria-describedby={error ? `${id}-err` : undefined}
        />
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-[13px] font-medium text-danger-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
