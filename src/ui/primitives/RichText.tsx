/**
 * Rich-text editor for CMS fields (R6.2): a contenteditable region with a formatting toolbar. No dependency.
 * Output is HTML; the server sanitizes it with the allow-list sanitizer on write and again on render (docs/07 §7).
 * Pasted content is inserted as plain text so foreign markup never enters the document. Sits inside a `Field`, which passes
 * id / aria-describedby / aria-invalid; `label` gives the editable region its accessible name ("Description").
 * Toolbar buttons are 44 px on touch (admin.css `.kz-rte`).
 */
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, RemoveFormatting } from 'lucide-react';
import { useEffect, useRef } from 'react';

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

/** Links the editor accepts: web, mail, phone or a site path. */
export const isAllowedLink = (url: string): boolean => /^(https?:\/\/|mailto:|tel:|\/)/i.test(url.trim());
/** An empty editor leaves a lone `<br>`; that is no content. */
export const normalizeHtml = (html: string | undefined): string => (html === '<br>' ? '' : (html ?? ''));

export function RichText({
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
  id?: string | undefined;
  minHeight?: number;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: boolean | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Set the initial HTML once; afterwards the DOM is the source of truth (re-setting would move the caret).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const emit = () => onChange(normalizeHtml(ref.current?.innerHTML));
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    // execCommand is deprecated but remains the only dependency-free editing primitive supported by every browser.
    document.execCommand(cmd, false, arg);
    emit();
  };
  const run = (action: ToolAction) => {
    if (action === 'link') {
      const url = window.prompt('Link address (https://…, mailto:… or /page)');
      if (url && isAllowedLink(url)) exec('createLink', url.trim());
    } else if (action === 'clear') {
      exec('removeFormat');
      exec('formatBlock', '<p>');
    } else exec(action[0], action[1]);
  };
  return (
    <div className="kz-rte" data-invalid={aria['aria-invalid'] ? '' : undefined}>
      <div role="toolbar" aria-label={`${label} formatting`} className="kz-rte__bar">
        {TOOLS.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            aria-label={t.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(t.action)}
            className="kz-rte__btn"
          >
            <t.icon size={18} strokeWidth={2} aria-hidden="true" />
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
        className="kz-rte__area"
      />
    </div>
  );
}
