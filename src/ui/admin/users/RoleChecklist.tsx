/** Roles as a checklist: each role's name is the checkbox name, its description sits under it. */
import { CheckWithHelp } from '../form';
import type { RoleOption } from './useUsers';

export function RoleChecklist({
  roles,
  value,
  onChange,
  error,
  legend = 'Roles',
  hideLegend = false,
}: {
  roles: RoleOption[];
  value: string[];
  onChange: (v: string[]) => void;
  error?: string | undefined;
  legend?: string;
  hideLegend?: boolean;
}) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className={hideLegend ? 'sr-only' : 'kz-alegend'}>{legend}</legend>
      {roles.map((r) => (
        <CheckWithHelp
          key={r.key}
          label={r.name}
          help={r.description ?? undefined}
          checked={value.includes(r.key)}
          onChange={(e) => onChange(e.target.checked ? [...value, r.key] : value.filter((k) => k !== r.key))}
        />
      ))}
      {error ? (
        <p className="kz-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
