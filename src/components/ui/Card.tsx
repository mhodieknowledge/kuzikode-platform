import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-md border border-line bg-surface', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  actions,
  description,
}: {
  title: ReactNode;
  actions?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="font-sans text-base font-semibold text-ink-950">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-ink-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'danger' | 'success';
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-[13px] text-ink-600">{label}</span>
      <span
        className={cn(
          'tnum font-display text-[26px] leading-tight font-bold tracking-display text-ink-950',
          tone === 'danger' && 'text-danger-600',
          tone === 'success' && 'text-success-600',
        )}
      >
        {value}
      </span>
      {sub ? (
        <span className={cn('text-[13px] text-ink-600', tone === 'danger' && 'text-danger-600')}>{sub}</span>
      ) : null}
    </Card>
  );
}
