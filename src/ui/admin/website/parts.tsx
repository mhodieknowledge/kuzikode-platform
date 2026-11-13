/**
 * Small building blocks shared by the Website admin modules (R6.2 group 4): the web-address field, repeating rows with
 * move / remove buttons, the reorderable list (drag by the handle or use the move buttons), a delete action behind a
 * confirmation sheet and the "Saved." line. Labels and accessible names are the e2e contract (Move … up, Remove benefit 1…).
 */
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { Children, useState, type DragEvent, type ReactNode } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { apiFetch } from '../../lib/api';
import { IconButton, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { ConfirmSheet } from '../../primitives/sheet';
import { cx } from '../../primitives/cx';
import { useAdminAction } from '../action';
import { moveItem, slugify } from './lib';

export function SlugField({
  name,
  slug,
  setSlug,
  touched,
  setTouched,
  prefix,
  error,
}: {
  name: string;
  slug: string;
  setSlug: (s: string) => void;
  touched: boolean;
  setTouched: (b: boolean) => void;
  prefix: string;
  error: string | undefined;
}) {
  return (
    <TextField
      label="Web address"
      hint={`${prefix}${slug || slugify(name) || '…'}`}
      error={error}
      value={touched ? slug : slug || slugify(name)}
      onChange={(e) => {
        setTouched(true);
        setSlug(e.target.value.toLowerCase());
      }}
      maxLength={80}
      autoComplete="off"
    />
  );
}

/** Small arrow buttons (44 px on touch) for moving a row. */
export function MoveButtons({
  label,
  index,
  count,
  onMove,
  disabled = false,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (to: number) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <button
        type="button"
        className="kz-btn kz-btn--quiet kz-btn--icon kz-btn--sm"
        aria-label={`Move ${label} up`}
        title={`Move ${label} up`}
        disabled={disabled || index === 0}
        onClick={() => onMove(index - 1)}
      >
        <ArrowUp size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="kz-btn kz-btn--quiet kz-btn--icon kz-btn--sm"
        aria-label={`Move ${label} down`}
        title={`Move ${label} down`}
        disabled={disabled || index === count - 1}
        onClick={() => onMove(index + 1)}
      >
        <ArrowDown size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </>
  );
}

/**
 * One repeating row of a list editor (benefit, feature, question…): its fields on the left, move and remove on the right
 * (under the fields on phones). `noun` forms the accessible names: "Remove benefit 2", "Move feature 1 down".
 */
export function RepeatRow({
  noun,
  index,
  count,
  onRemove,
  onMove,
  children,
  aside,
}: {
  noun: string;
  index: number;
  count: number;
  onRemove: () => void;
  onMove?: (to: number) => void;
  children: ReactNode;
  /** Extra controls on the action row (e.g. a "Required" check). */
  aside?: ReactNode;
}) {
  const label = `${noun} ${index + 1}`;
  return (
    <li className="kz-wsr">
      <div className="kz-wsr__fields">{children}</div>
      <div className="kz-wsr__acts">
        {aside}
        <span className="kz-wsr__btns">
          {onMove ? <MoveButtons label={label} index={index} count={count} onMove={onMove} /> : null}
          <IconButton name="delete" size="sm" label={`Remove ${label}`} onClick={onRemove} className="kz-wsr__rm" />
        </span>
      </div>
    </li>
  );
}

export function AddRow({
  label,
  onAdd,
  disabled = false,
  note,
}: {
  label: string;
  onAdd: () => void;
  disabled?: boolean;
  note?: ReactNode;
}) {
  return (
    <div className="kz-wsr__add">
      <Button variant="secondary" size="sm" lead="add" onClick={onAdd} disabled={disabled}>
        {label}
      </Button>
      {note ? <span className="kz-hint">{note}</span> : null}
    </div>
  );
}

interface SortItem {
  id: string;
  name: string;
}

/**
 * A reorderable list. Each change is saved at once; on failure the previous order is restored and the message shown.
 * Keyboard and screen-reader users move rows with the buttons; mouse users can drag by the handle.
 */
export function Sortable<T extends SortItem>({
  items: initial,
  saveUrl,
  saveBody,
  label,
  render,
}: {
  items: T[];
  saveUrl: string;
  /** Extra fields sent with the new order (e.g. which pricing tab). */
  saveBody?: Record<string, unknown>;
  label: string;
  render: (item: T) => ReactNode;
}) {
  const [items, setItems] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const a = useAdminAction();
  const move = (from: number, to: number) => {
    const next = moveItem(items, from, to);
    if (!next) return;
    const moved = items[from] as T;
    const prev = items;
    setItems(next);
    void a.run(async () => {
      try {
        await apiFetch(saveUrl, { body: { ...saveBody, ids: next.map((i) => i.id) } });
        setStatus(`${moved.name} moved to position ${next.indexOf(moved) + 1} of ${next.length}.`);
      } catch (err) {
        setItems(prev);
        throw err;
      }
    });
  };
  const onDrop = (e: DragEvent, target: string) => {
    e.preventDefault();
    if (!dragging || dragging === target) return;
    move(
      items.findIndex((i) => i.id === dragging),
      items.findIndex((i) => i.id === target),
    );
    setDragging(null);
  };
  return (
    <div>
      {a.error ? (
        <div className="kz-apad">
          <FormAlert message={a.error} />
        </div>
      ) : null}
      <p className="sr-only" role="status">
        {status}
      </p>
      <ul aria-label={label} className="kz-alist kz-wss">
        {items.map((item, i) => (
          <li
            key={item.id}
            onDragOver={(e) => dragging && e.preventDefault()}
            onDrop={(e) => onDrop(e, item.id)}
            className={cx(dragging === item.id && 'is-drag')}
          >
            <span
              draggable
              onDragStart={(e) => {
                setDragging(item.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.id);
              }}
              onDragEnd={() => setDragging(null)}
              className="kz-wss__grip"
              aria-hidden="true"
              title="Drag to reorder"
            >
              <GripVertical size={18} />
            </span>
            <div className="kz-wss__main">{render(item)}</div>
            <div className="kz-arow-acts">
              <MoveButtons
                label={item.name}
                index={i}
                count={items.length}
                onMove={(to) => move(i, to)}
                disabled={a.busy}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A delete button that asks first. `buttonLabel` is the visible and accessible name; the sheet's confirm button reads
 * `confirmLabel`. After the call it goes to `after`, or reloads the page when none is given.
 */
export function DeleteAction({
  call,
  title,
  description,
  buttonLabel,
  buttonAriaLabel,
  confirmLabel,
  after,
  size = 'md',
  variant = 'quiet',
}: {
  call: () => Promise<unknown>;
  title: string;
  description: ReactNode;
  buttonLabel: string;
  buttonAriaLabel?: string;
  confirmLabel: string;
  after?: string;
  size?: 'sm' | 'md';
  variant?: 'quiet' | 'secondary';
}) {
  const [open, setOpen] = useState(false);
  const a = useAdminAction();
  return (
    <>
      <Button
        variant={variant}
        size={size}
        lead="delete"
        {...(buttonAriaLabel ? { 'aria-label': buttonAriaLabel } : {})}
        onClick={() => setOpen(true)}
      >
        {buttonLabel}
      </Button>
      {a.error ? <FormAlert message={a.error} /> : null}
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        confirmLabel={confirmLabel}
        danger
        onConfirm={() =>
          a.run(async () => {
            await call();
            if (after) window.location.assign(after);
            else window.location.reload();
          })
        }
      >
        {description}
      </ConfirmSheet>
    </>
  );
}

/** Option list for a media select (`media` rows carry id + alt text). */
export interface MediaOption {
  id: string;
  file_id: string;
  alt_text: string;
}
export const mediaOptions = (media: MediaOption[]) => media.map((m) => ({ value: m.id, label: m.alt_text }));

/** A bordered list of manager rows (`<li>`s), or the empty line. The region is named `label`. */
export function ManagerList({
  label,
  title,
  empty,
  children,
}: {
  label: string;
  /** A visible pane title (the region keeps `label` as its name). */
  title?: string;
  empty: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="kz-apane" aria-label={label}>
      {title ? (
        <div className="kz-apane__head">
          <h2 className="kz-apane__title">{title}</h2>
        </div>
      ) : null}
      {Children.count(children) === 0 ? (
        <div className="kz-apane__body">
          <p className="kz-anone">{empty}</p>
        </div>
      ) : (
        <ul className="kz-alist">{children}</ul>
      )}
    </section>
  );
}
