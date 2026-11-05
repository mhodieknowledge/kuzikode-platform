import { AlertTriangle, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { cn } from './cn';

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div
        className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600"
        aria-hidden="true"
      >
        {icon ?? <Inbox size={20} />}
      </div>
      <h3 className="font-sans text-base font-semibold text-ink-950">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-600">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'This could not be loaded',
  description = 'Check your connection and try again.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <div
        className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-50 text-danger-600"
        aria-hidden="true"
      >
        <AlertTriangle size={20} />
      </div>
      <h3 className="font-sans text-base font-semibold text-ink-950">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-600">{description}</p>
      {onRetry ? (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-sm bg-ink-950/[0.06]', className)} />;
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-600">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href && i < items.length - 1 ? (
              <a className="hover:text-ink-950 hover:underline" href={item.href}>
                {item.label}
              </a>
            ) : (
              <span
                aria-current={i === items.length - 1 ? 'page' : undefined}
                className={i === items.length - 1 ? 'text-ink-950' : ''}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  badge,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  badge?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-display text-ink-950">{title}</h1>
            {badge}
          </div>
          {description ? <p className="mt-1 text-sm text-ink-600">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export interface TimelineItem {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  body?: ReactNode;
  tone?: 'neutral' | 'success' | 'danger' | 'info';
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative ml-2 border-l border-line">
      {items.map((it) => (
        <li key={it.id} className="mb-5 ml-5 last:mb-0">
          <span
            aria-hidden="true"
            className={cn(
              'absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface',
              it.tone === 'success'
                ? 'bg-success-600'
                : it.tone === 'danger'
                  ? 'bg-danger-600'
                  : it.tone === 'info'
                    ? 'bg-info-600'
                    : 'bg-ink-400',
            )}
          />
          <div className="text-sm font-medium text-ink-950">{it.title}</div>
          {it.meta ? <div className="text-[13px] text-ink-600">{it.meta}</div> : null}
          {it.body ? <div className="mt-1 text-sm text-ink-800">{it.body}</div> : null}
        </li>
      ))}
    </ol>
  );
}
