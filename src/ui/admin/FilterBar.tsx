/**
 * List filter bar (R6.2, PANEL_DESIGN_SPEC §1): a plain GET form, so filters are URLs and work before hydration.
 * ≥ 768 px: search + selects + checks in one row with a "Filter" button. Phones: the search field stays in the bar beside a
 * "Filters" button (with the number of active filters); the other fields move into a bottom sheet with an "Apply" bar. The
 * fields are rendered once (inline or in the sheet, never both), so labels stay unique; the sheet lives inside the form.
 * Empty values are left out of the URL on submit.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../icons/icon';
import { Sheet } from '../primitives/sheet';

export type FilterField =
  | { kind: 'search'; name: string; label: string; value: string; placeholder?: string; maxLength?: number }
  | {
      kind: 'select';
      name: string;
      label: string;
      value: string;
      options: { value: string; label: string }[];
    }
  | { kind: 'check'; name: string; label: string; checked: boolean; value?: string }
  | { kind: 'date'; name: string; label: string; value: string };

/** Filters set away from their default (the first option of a select; a ticked check; a filled date). Search is not counted. */
export function activeFilters(fields: FilterField[]): number {
  return fields.filter((f) =>
    f.kind === 'select'
      ? f.value !== (f.options[0]?.value ?? '')
      : f.kind === 'check'
        ? f.checked
        : f.kind === 'date'
          ? f.value !== ''
          : false,
  ).length;
}

const PHONE = '(max-width: 767px)';

/**
 * Leave empty fields ("Any", an empty search) out of the URL: the list queries are strict, and `kind=` would otherwise make
 * the whole query fall back to its defaults. Re-enabled on the next tick (the form data is already built by then).
 */
function dropEmpty(e: FormEvent<HTMLFormElement>) {
  const off: (HTMLInputElement | HTMLSelectElement)[] = [];
  for (const el of Array.from(e.currentTarget.elements)) {
    if (
      (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) &&
      el.name &&
      el.value === '' &&
      !el.disabled
    ) {
      el.disabled = true;
      off.push(el);
    }
  }
  setTimeout(() => off.forEach((el) => (el.disabled = false)), 0);
}

export function FilterBar({
  label,
  fields,
  hidden = {},
  submitLabel = 'Filter',
  clearHref,
}: {
  /** Accessible name of the form, e.g. "Filter leads". */
  label: string;
  fields: FilterField[];
  hidden?: Record<string, string>;
  submitLabel?: string;
  /** Where "Clear" in the phone sheet goes (the list without filters). */
  clearHref?: string;
}) {
  const [phone, setPhone] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const mq = matchMedia(PHONE);
    const sync = () => setPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const search = fields.filter((f) => f.kind === 'search');
  const more = fields.filter((f) => f.kind !== 'search');
  const count = activeFilters(fields);
  const fid = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const renderMore = () =>
    more.map((f) =>
      f.kind === 'select' ? (
        <div className="kz-field kz-afilter__field" key={f.name}>
          <label className="kz-label" htmlFor={`${fid}-${f.name}`}>
            {f.label}
          </label>
          <select id={`${fid}-${f.name}`} name={f.name} defaultValue={f.value} className="kz-input">
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ) : f.kind === 'date' ? (
        <div className="kz-field kz-afilter__field" key={f.name}>
          <label className="kz-label" htmlFor={`${fid}-${f.name}`}>
            {f.label}
          </label>
          <input id={`${fid}-${f.name}`} name={f.name} type="date" defaultValue={f.value} className="kz-input" />
        </div>
      ) : f.kind === 'check' ? (
        <label className="kz-afilter__check" key={f.name}>
          <input type="checkbox" name={f.name} value={f.value ?? '1'} defaultChecked={f.checked} />
          {f.label}
        </label>
      ) : null,
    );
  return (
    <form method="get" className="kz-afilter" aria-label={label} role="search" onSubmit={dropEmpty}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {search.map((f) =>
        f.kind === 'search' ? (
          <div className="kz-field kz-afilter__search" key={f.name}>
            <label className="kz-label" htmlFor={`${fid}-${f.name}`}>
              {f.label}
            </label>
            <input
              id={`${fid}-${f.name}`}
              name={f.name}
              type="search"
              enterKeyHint="search"
              defaultValue={f.value}
              maxLength={f.maxLength ?? 80}
              placeholder={f.placeholder}
              className="kz-input"
            />
          </div>
        ) : null,
      )}
      {phone ? null : renderMore()}
      {phone ? null : (
        <button type="submit" className="kz-btn kz-btn--secondary kz-afilter__go">
          <span>{submitLabel}</span>
        </button>
      )}
      {more.length ? (
        <button
          type="button"
          className="kz-btn kz-btn--secondary kz-afilter__open"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
        >
          <Icon name="filter" size={20} />
          <span>Filters</span>
          {count ? (
            <span className="kz-afilter__count" aria-label={`${count} active`}>
              {count}
            </span>
          ) : null}
        </button>
      ) : null}
      {phone && more.length ? (
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          title="Filters"
          side="bottom"
          className="kz-adlg"
          footer={
            <>
              {clearHref ? (
                <a href={clearHref} className="kz-btn kz-btn--secondary kz-adlg__clear">
                  <span>Clear</span>
                </a>
              ) : null}
              <button type="submit" className="kz-btn kz-btn--primary">
                <span>Apply</span>
              </button>
            </>
          }
        >
          <div className="kz-afilter__sheetbody">{renderMore()}</div>
        </Sheet>
      ) : null}
    </form>
  );
}
