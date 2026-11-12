/** Icon for React islands. Same contract as Icon.astro: decorative unless `label` is given. */
import { ICONS, ICON_SIZES, type IconName, type IconSize } from './registry';

export interface IconProps {
  name: IconName;
  size?: IconSize;
  label?: string | undefined;
  className?: string | undefined;
}

export function Icon({ name, size = 20, label, className }: IconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      width={size}
      height={size}
      strokeWidth={ICON_SIZES[size]}
      className={['kz-icon shrink-0', className].filter(Boolean).join(' ')}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    />
  );
}

export type { IconName, IconSize };
