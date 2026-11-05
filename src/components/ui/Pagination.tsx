import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from './Button';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-[13px] text-ink-600">
      <span className="tnum">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <IconButton label="Previous page" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft size={16} aria-hidden="true" />
        </IconButton>
        <span className="tnum px-2" aria-current="page">
          Page {page} of {pages}
        </span>
        <IconButton label="Next page" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight size={16} aria-hidden="true" />
        </IconButton>
      </div>
    </nav>
  );
}
