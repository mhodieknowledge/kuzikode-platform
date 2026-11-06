import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, RemoveFormatting } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cn } from './cn';

type ToolAction = [cmd: string, arg?: string] | 'link' | 'clear';
const TOOLS: { title: string; icon: typeof Bold; action: ToolAction }[] = [
  { title: 'Bold', icon: Bold, action: ['bold'] },
  { title: 'Italic', icon: Italic, action: ['italic'] },
  { title: 'Heading', icon: Heading2, action: ['formatBlock', '<h2>'] },
  { title: 'Subheading', icon: Heading3, action: ['formatBlock', '<h3>'] },
  { title: 'Bulleted list', icon: List, action: ['insertUnorderedList'] },
  { title: 'Numbered list', icon: ListOrdered, action: ['insertOrderedList'] },
  { title: 'Link', icon: Link2, action: 'link' },
  { title: 'Clear formatting', icon: RemoveFormatting, action: 'clear' },
];

/**
 * Minimal rich-text editor for CMS fields (no dependency): a contenteditable region with a formatting toolbar.
 * Output is HTML; the server sanitizes it with the allow-list sanitizer on write and again on render (docs/07 §7).
 * Pasted content is inserted as plain text so foreign markup never enters the document. Used inside <Field>, which
 * passes id / aria-describedby / aria-invalid; `label` gives the editable region its accessible name.
 */
export function RichTextEditor({
  value,
  onChange,
  label,
  id,
  minHeight = 160,
  ...aria
}: {
  value: string;
  onChange: (html: string) => void;
  label: string;
  id?: string;
  minHeight?: number;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Set the initial HTML once; afterwards the DOM is the source of truth (re-setting would move the caret).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const emit = () => onChange(ref.current?.innerHTML === '<br>' ? '' : (ref.current?.innerHTML ?? ''));
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    // execCommand is deprecated but remains the only dependency-free editing primitive supported by every browser.
    document.execCommand(cmd, false, arg);
    emit();
  };
  const run = (action: ToolAction) => {
    if (action === 'link') {
      const url = window.prompt('Link address (https://…, mailto:… or /page)');
      if (url && /^(https?:\/\/|mailto:|tel:|\/)/i.test(url.trim())) exec('createLink', url.trim());
    } else if (action === 'clear') {
      exec('removeFormat');
      exec('formatBlock', '<p>');
    } else exec(action[0], action[1]);
  };
  return (
    <div className="rounded-sm border border-line bg-surface focus-within:border-brand-500">
      <div
        role="toolbar"
        aria-label={`${label} formatting`}
        className="flex flex-wrap gap-0.5 border-b border-line p-1"
      >
        {TOOLS.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            aria-label={t.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(t.action)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-ink-800 hover:bg-ink-950/5 focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <t.icon size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        id={id}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        {...aria}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
          emit();
        }}
        style={{ minHeight }}
        className={cn(
          'max-w-none px-3 py-2 text-sm leading-6 text-ink-950 outline-none',
          '[&_a]:text-brand-600 [&_a]:underline [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:font-semibold',
          '[&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
        )}
      />
    </div>
  );
}
