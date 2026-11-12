import type { ReactNode } from 'react';
import { cx } from './cx';

export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'lit';

/** Dot + label status pill. */
export function StatusPill({
  tone = 'neutral',
  plain,
  children,
  className,
}: {
  tone?: Tone;
  plain?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx('kz-pill', tone !== 'neutral' && `kz-pill--${tone}`, plain && 'kz-pill--plain', className)}>
      {children}
    </span>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-[var(--kz-fg-3)]">
      <span className="kz-spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Quiet empty state: mono status line, title, sentence, optional action. */
export function EmptyState({
  code,
  title,
  children,
  action,
  className,
}: {
  code?: string;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('kz-empty', className)}>
      {code ? <p className="kz-empty__code">{code}</p> : null}
      <p className="kz-empty__title">{title}</p>
      {children ? <div className="text-[var(--kz-fg-2)]">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** List row: the phone form of a table row. */
export function ListRow({
  href,
  title,
  meta,
  aside,
  className,
  onClick,
}: {
  href?: string;
  title: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="kz-row__main">
        <span className="kz-row__title">{title}</span>
        {meta ? <span className="kz-row__meta">{meta}</span> : null}
      </span>
      {aside ? <span className="kz-row__aside">{aside}</span> : null}
    </>
  );
  if (href)
    return (
      <a className={cx('kz-row', className)} href={href}>
        {body}
      </a>
    );
  if (onClick)
    return (
      <button type="button" className={cx('kz-row w-full text-left', className)} onClick={onClick}>
        {body}
      </button>
    );
  return <div className={cx('kz-row', className)}>{body}</div>;
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  numeric?: boolean;
  /** Shown on phones in the list row? `title` | `meta` | `aside` | false (hidden on phones). */
  mobile?: 'title' | 'meta' | 'aside' | false;
}

/**
 * Data table on ≥ 768 px; on phones each row becomes a list row built from the columns' `mobile` roles. Nothing is lost:
 * columns hidden in the row are on the detail page the row links to.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowHref,
  caption,
  empty,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  caption: string;
  empty?: ReactNode;
}) {
  if (rows.length === 0) return <>{empty ?? null}</>;
  const pick = (role: 'title' | 'meta' | 'aside', row: T) =>
    columns.filter((c) => c.mobile === role).map((c) => <span key={c.key}>{c.cell(row)}</span>);
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="kz-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={c.numeric ? 'text-right' : undefined}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c, i) => (
                  <td key={c.key} className={c.numeric ? 'num' : undefined}>
                    {i === 0 && rowHref ? (
                      <a className="font-semibold text-[var(--kz-fg)] hover:underline" href={rowHref(r)}>
                        {c.cell(r)}
                      </a>
                    ) : (
                      c.cell(r)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden" aria-label={caption}>
        {rows.map((r) => (
          <li key={rowKey(r)}>
            <ListRow
              href={rowHref?.(r)}
              title={pick('title', r)}
              meta={<span className="inline-flex flex-wrap gap-x-2">{pick('meta', r)}</span>}
              aside={pick('aside', r)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
