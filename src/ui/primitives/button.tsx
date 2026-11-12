import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons/icon';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'solid' | 'quiet' | 'danger';
interface Common {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  knob?: boolean;
  icon?: IconName;
  lead?: IconName;
  block?: boolean;
  loading?: boolean;
  children?: ReactNode;
}
const classes = ({ variant = 'primary', size = 'md', knob, block }: Common, iconOnly: boolean, extra?: string) =>
  cx(
    'kz-btn',
    `kz-btn--${variant}`,
    size !== 'md' && `kz-btn--${size}`,
    knob && 'kz-btn--knob',
    block && 'kz-btn--block',
    iconOnly && 'kz-btn--icon',
    extra,
  );

function Inner({ knob, icon, lead, size, loading, children }: Common) {
  const trailing = icon ?? (knob ? 'arrow-right' : undefined);
  return (
    <>
      {lead ? <Icon name={lead} /> : null}
      <span>{children}</span>
      {loading ? (
        <span className={knob ? 'kz-btn__knob' : undefined}>
          <span className="kz-spinner" aria-hidden="true" />
        </span>
      ) : trailing && knob ? (
        <span className="kz-btn__knob">
          <Icon name={trailing} size={size === 'sm' ? 16 : 20} />
        </span>
      ) : trailing ? (
        <Icon name={trailing} />
      ) : null}
    </>
  );
}

export type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement>;

/** Button of the Directory world. `loading` keeps the label and swaps the trailing icon for a spinner. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, knob, icon, lead, block, loading, className, children, type = 'button', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classes({ variant, size, knob, block }, false, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Inner knob={knob} icon={icon} lead={lead} size={size} loading={loading}>
        {children}
      </Inner>
    </button>
  );
});

export type LinkButtonProps = Common & AnchorHTMLAttributes<HTMLAnchorElement>;

export function LinkButton({ variant, size, knob, icon, lead, block, className, children, ...rest }: LinkButtonProps) {
  return (
    <a className={classes({ variant, size, knob, block }, false, className)} {...rest}>
      <Inner knob={knob} icon={icon} lead={lead} size={size}>
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
