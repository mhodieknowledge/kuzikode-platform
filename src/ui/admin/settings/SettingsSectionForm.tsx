/**
 * One settings section rendered from its field definitions (R6.2 group 3): a form section (title and description beside the
 * fields from 1024 px) with its own Save and "Saved." status. The section is a region named by its title, and the status is
 * `role="status"` with exactly "Saved." (e2e contract).
 */
import { useState, type FormEvent } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { Button } from '../../primitives/button';
import { TextareaField, TextField } from '../../primitives';
import type { SettingField } from '../../../shared/settings';
import { CheckItem, FormSection } from '../form';
import { sectionBody, settingsApi, useSave } from './useSettings';

export function SettingsSectionForm({
  sectionId,
  title,
  description,
  fields,
  values,
  canEdit,
}: {
  sectionId: string;
  title: string;
  description: string;
  fields: SettingField[];
  values: Record<string, unknown>;
  canEdit: boolean;
}) {
  const [bools, setBools] = useState<Record<string, boolean>>(
    Object.fromEntries(fields.filter((f) => f.type === 'bool').map((f) => [f.key, values[f.key] === true])),
  );
  const s = useSave();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = sectionBody(fields, new FormData(e.currentTarget), bools);
    void s.run(async () => {
      const res = await settingsApi<{ data: { changed: string[] } }>(`/sections/${sectionId}`, {
        method: 'PUT',
        body,
      });
      return res.data.changed.length ? 'Saved.' : 'No changes to save.';
    });
  }
  return (
    <form onSubmit={submit} noValidate>
      <FormSection id={`sec-${sectionId}`} title={title} description={description}>
        {fields.map((f) => {
          const v = values[f.key];
          const err = s.err(f.key);
          if (f.type === 'bool')
            return (
              <div key={f.key} className="kz-asw kz-span-2">
                <CheckItem
                  checked={bools[f.key] ?? false}
                  disabled={!canEdit}
                  onChange={(e) => setBools((b) => ({ ...b, [f.key]: e.target.checked }))}
                >
                  {f.label}
                </CheckItem>
                {f.help ? <p className="kz-asw__h">{f.help}</p> : null}
              </div>
            );
          if (f.type === 'textarea')
            return (
              <TextareaField
                key={f.key}
                label={f.label}
                hint={f.help}
                error={err}
                name={f.key}
                rows={3}
                defaultValue={typeof v === 'string' ? v : ''}
                maxLength={f.max}
                disabled={!canEdit}
                className="kz-span-2"
              />
            );
          return (
            <TextField
              key={f.key}
              label={f.label}
              hint={f.help}
              error={err}
              name={f.key}
              type={f.type === 'int' ? 'number' : f.type}
              defaultValue={v === null || v === undefined ? '' : String(v)}
              maxLength={f.max}
              disabled={!canEdit}
              {...(f.type === 'int' ? { min: f.min, max: f.max, inputMode: 'numeric' as const } : {})}
            />
          );
        })}
        {canEdit ? (
          <div className="kz-span-2 kz-aacts-row">
            <Button type="submit" loading={s.busy}>
              Save
            </Button>
            {s.saved ? (
              <p role="status" className="kz-astatus">
                {s.saved}
              </p>
            ) : null}
            <FormAlert message={s.error} />
          </div>
        ) : null}
      </FormSection>
    </form>
  );
}
