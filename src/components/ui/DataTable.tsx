import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from 'lucide-react';
import { DropdownMenu as RMenu } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { cn } from './cn';
import { Pagination } from './Pagination';
import { EmptyState, ErrorState, Skeleton } from './States';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Server sort field; makes the header a sort button. */
  sortKey?: string;
  align?: 'left' | 'right';
  /** Money / numbers: tabular figures, right-aligned. */
  numeric?: boolean;
  hideable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  sort?: string | undefined;
  onSortChange?: (sort: string) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  empty?: { title: string; description?: string; action?: ReactNode };
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  bulkActions?: ReactNode;
  onRowClick?: (row: T) => void;
}

/** Server-driven table: sortable headers, column visibility, selection, sticky header, loading/empty/error states. */
export function DataTable<T>(p: DataTableProps<T>) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const cols = p.columns.filter((c) => !hidden.has(c.key));
  const selected = p.selected ?? new Set<string>();
  const allOnPage = p.rows.length > 0 && p.rows.every((r) => selected.has(p.rowKey(r)));
  const toggleAll = () => {
    const next = new Set(selected);
    for (const r of p.rows) {
      if (allOnPage) next.delete(p.rowKey(r));
      else next.add(p.rowKey(r));
    }
    p.onSelectedChange?.(next);
  };
  const sortState = (c: Column<T>) =>
    !c.sortKey ? null : p.sort === c.sortKey ? 'ascending' : p.sort === `-${c.sortKey}` ? 'descending' : 'none';
  const hideable = p.columns.filter((c) => c.hideable);

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      {(hideable.length > 0 || (p.selectable && selected.size > 0)) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
          <div className="text-[13px] text-ink-600">
            {p.selectable && selected.size > 0 ? (
              <span className="flex items-center gap-3">
                {selected.size} selected {p.bulkActions}
              </span>
            ) : null}
          </div>
          {hideable.length > 0 ? (
            <RMenu.Root>
              <RMenu.Trigger
                className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-[13px] text-ink-600 hover:bg-ink-950/5"
                aria-label="Choose columns"
              >
                <Columns3 size={16} aria-hidden="true" /> Columns
              </RMenu.Trigger>
              <RMenu.Portal>
                <RMenu.Content
                  align="end"
                  className="z-50 min-w-44 rounded-sm border border-line bg-surface p-1 shadow-2"
                >
                  {hideable.map((c) => (
                    <RMenu.CheckboxItem
                      key={c.key}
                      checked={!hidden.has(c.key)}
                      onCheckedChange={(v) =>
                        setHidden((h) => {
                          const n = new Set(h);
                          if (v) n.delete(c.key);
                          else n.add(c.key);
                          return n;
                        })
                      }
                      onSelect={(e) => e.preventDefault()}
                      className="flex cursor-default items-center gap-2 rounded-[4px] px-3 py-2 text-sm text-ink-800 outline-none data-[highlighted]:bg-canvas"
                    >
                      <span aria-hidden="true" className="w-4">
                        {!hidden.has(c.key) ? '✓' : ''}
                      </span>
                      {c.header}
                    </RMenu.CheckboxItem>
                  ))}
                </RMenu.Content>
              </RMenu.Portal>
            </RMenu.Root>
          ) : null}
        </div>
      )}
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{p.caption}</caption>
          <thead className="sticky top-0 z-10 bg-canvas">
            <tr>
              {p.selectable ? (
                <th scope="col" className="w-10 border-b border-line px-4 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allOnPage}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-brand-600"
                  />
                </th>
              ) : null}
              {cols.map((c) => {
                const s = sortState(c);
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={s && s !== 'none' ? s : undefined}
                    className={cn(
                      'border-b border-line px-4 py-2.5 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-ink-600 uppercase',
                      (c.align === 'right' || c.numeric) && 'text-right',
                      c.className,
                    )}
                  >
                    {c.sortKey && p.onSortChange ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 uppercase hover:text-ink-950"
                        onClick={() => p.onSortChange!(p.sort === c.sortKey ? `-${c.sortKey}` : c.sortKey!)}
                      >
                        {c.header}
                        {s === 'ascending' ? (
                          <ArrowUp size={14} aria-hidden="true" />
                        ) : s === 'descending' ? (
                          <ArrowDown size={14} aria-hidden="true" />
                        ) : (
                          <ArrowUpDown size={14} aria-hidden="true" className="opacity-50" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody aria-busy={p.loading || undefined}>
            {p.loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={`sk${i}`}>
                    {p.selectable ? <td className="border-b border-line px-4 py-3" /> : null}
                    {cols.map((c) => (
                      <td key={c.key} className="border-b border-line px-4 py-3">
                        <Skeleton className="h-4 w-full max-w-40" />
                      </td>
                    ))}
                  </tr>
                ))
              : p.rows.map((r) => {
                  const k = p.rowKey(r);
                  return (
                    <tr
                      key={k}
                      className={cn(
                        'transition-colors hover:bg-canvas',
                        selected.has(k) && 'bg-brand-50',
                        p.onRowClick && 'cursor-pointer',
                      )}
                      onClick={p.onRowClick ? () => p.onRowClick!(r) : undefined}
                    >
                      {p.selectable ? (
                        <td className="border-b border-line px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select row ${k}`}
                            checked={selected.has(k)}
                            onChange={() => {
                              const n = new Set(selected);
                              if (n.has(k)) n.delete(k);
                              else n.add(k);
                              p.onSelectedChange?.(n);
                            }}
                            className="h-4 w-4 accent-brand-600"
                          />
                        </td>
                      ) : null}
                      {cols.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            'border-b border-line px-4 py-3 text-ink-800',
                            (c.align === 'right' || c.numeric) && 'text-right',
                            c.numeric && 'tnum',
                            c.className,
                          )}
                        >
                          {c.cell(r)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!p.loading && p.error ? <ErrorState {...(p.onRetry ? { onRetry: p.onRetry } : {})} /> : null}
        {!p.loading && !p.error && p.rows.length === 0 ? (
          <EmptyState
            title={p.empty?.title ?? 'Nothing here yet'}
            {...(p.empty?.description ? { description: p.empty.description } : {})}
            {...(p.empty?.action ? { action: p.empty.action } : {})}
          />
        ) : null}
      </div>
      {p.total !== undefined && p.page && p.pageSize && p.onPageChange && p.total > 0 ? (
        <div className="border-t border-line px-4 py-2">
          <Pagination page={p.page} pageSize={p.pageSize} total={p.total} onPageChange={p.onPageChange} />
        </div>
      ) : null}
    </div>
  );
}
