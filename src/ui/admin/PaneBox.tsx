/** React twin of Pane.astro for islands that own a whole pane (R6.2): header row (title, mono meta, actions) over a body. */
import type { ReactNode } from 'react';
import { cx } from '../primitives/cx';

export function PaneBox({
  id,
  title,
  meta,
  actions,
  flush = false,
  className,
  children,
}: {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cx('kz-apane', className)} aria-labelledby={id}>
      <div className="kz-apane__head">
        <h2 className="kz-apane__title" id={id}>
          {title}
        </h2>
        {meta !== undefined && meta !== null ? <span className="kz-apane__meta">{meta}</span> : null}
        {actions ? <div className="kz-apane__acts">{actions}</div> : null}
      </div>
      <div className={cx('kz-apane__body', flush && 'is-flush')}>{children}</div>
    </section>
  );
}
