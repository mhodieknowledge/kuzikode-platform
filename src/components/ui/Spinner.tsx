import { cn } from './cn';

export function Spinner({
  size = 20,
  label = 'Loading',
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <span role={label ? 'status' : undefined} className={cn('inline-flex items-center', className)}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="animate-spin">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
