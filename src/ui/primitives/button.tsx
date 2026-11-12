import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons/icon';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'solid' | 'quiet' | 'danger';
interface Common {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  /** Trailing arrow: only when the action leads to a new page (DESIGN_DIRECTION §7). */
  arrow?: boolean;
  icon?: IconName;
  lead?: IconName;
  block?: boolean;
  loading?: boolean;
  children?: ReactNode;
}
const classes = ({ variant = 'primary', size = 'md', block }: Common, iconOnly: boolean, extra?: string) =>
  cx(
    'kz-btn',
    `kz-btn--${variant}`,
    size !== 'md' && `kz-btn--${size}`,
    block && 'kz-btn--block',
    iconOnly && 'kz-btn--icon',
    extra,
  );

function Inner({ arrow, icon, lead, size, loading, children }: Common) {
  const trailing = icon ?? (arrow ? 'arrow-right' : undefined);
  return (
    <>
      {lead ? <Icon name={lead} size={size === 'sm' ? 16 : 20} /> : null}
      <span>{children}</span>
      {loading ? (
        <span className="kz-spinner" aria-hidden="true" />
      ) : trailing ? (
        <span className="kz-btn__trail">
          <Icon name={trailing} size={size === 'sm' ? 16 : 20} />
        </span>
      ) : null}
    </>
  );
}

export type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement>;

/** Plate button of the Route world. `loading` keeps the label and swaps the trailing icon for a spinner. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, arrow, icon, lead, block, loading, className, children, type = 'button', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classes({ variant, size, block }, false, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Inner arrow={arrow} icon={icon} lead={lead} size={size} loading={loading}>
        {children}
      </Inner>
    </button>
  );
});

export type LinkButtonProps = Common & AnchorHTMLAttributes<HTMLAnchorElement>;

export function LinkButton({ variant, size, arrow, icon, lead, block, className, children, ...rest }: LinkButtonProps) {
  return (
    <a className={classes({ variant, size, block }, false, className)} {...rest}>
      <Inner arrow={arrow} icon={icon} lead={lead} size={size}>
        {children}
      </Inner>
    </a>
  );
}

/** Icon-only button; `label` is its accessible name (and tooltip). */
export function IconButton({
  name,
  label,
  variant = 'quiet',
  size,
  className,
  ...rest
}: {
  name: IconName;
  label: string;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={classes({ variant, size }, true, className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={name} />
    </button>
  );
}
