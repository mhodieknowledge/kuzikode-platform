import { Checkbox as RCheckbox, RadioGroup as RRadio, Switch as RSwitch } from 'radix-ui';
import { Check } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from './cn';

export function Checkbox({
  label,
  checked,
  onCheckedChange,
  description,
  disabled,
  name,
}: {
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  description?: ReactNode;
  disabled?: boolean;
  name?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <RCheckbox.Root
        id={id}
        name={name}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border border-ink-400 bg-surface data-[state=checked]:border-brand-600 data-[state=checked]:bg-brand-600 disabled:opacity-50"
      >
        <RCheckbox.Indicator>
          <Check size={14} strokeWidth={3} className="text-white" aria-hidden="true" />
        </RCheckbox.Indicator>
      </RCheckbox.Root>
      <div className="flex flex-col">
        <label htmlFor={id} className="text-sm text-ink-950">
          {label}
        </label>
        {description ? <span className="text-[13px] text-ink-600">{description}</span> : null}
      </div>
    </div>
  );
}

export function Switch({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <RSwitch.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-10 shrink-0 rounded-full bg-ink-400 transition-colors data-[state=checked]:bg-brand-600 disabled:opacity-50"
      >
        <RSwitch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow-1 transition-transform data-[state=checked]:translate-x-[18px]" />
      </RSwitch.Root>
      <label htmlFor={id} className="text-sm text-ink-950">
        {label}
      </label>
    </div>
  );
}

export function RadioGroup({
  legend,
  value,
  onValueChange,
  options,
  className,
}: {
  legend: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string; description?: string }[];
  className?: string;
}) {
  const id = useId();
  return (
    <fieldset className={cn('flex flex-col gap-2', className)}>
      <legend className="mb-1 text-sm font-medium text-ink-950">{legend}</legend>
      <RRadio.Root value={value} onValueChange={onValueChange} className="flex flex-col gap-2" aria-label={legend}>
        {options.map((o) => (
          <div key={o.value} className="flex items-start gap-3">
            <RRadio.Item
              id={`${id}-${o.value}`}
              value={o.value}
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink-400 bg-surface data-[state=checked]:border-brand-600"
            >
              <RRadio.Indicator className="h-2.5 w-2.5 rounded-full bg-brand-600" />
            </RRadio.Item>
            <label htmlFor={`${id}-${o.value}`} className="flex flex-col text-sm text-ink-950">
              {o.label}
              {o.description ? <span className="text-[13px] text-ink-600">{o.description}</span> : null}
            </label>
          </div>
        ))}
      </RRadio.Root>
    </fieldset>
  );
}
