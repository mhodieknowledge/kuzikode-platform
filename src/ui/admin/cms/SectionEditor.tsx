/**
 * One page section's draft editor (R6.2): a pane with the section type, its key and state, move / show-hide controls, and the
 * fields described in shared/cms-fields. The region is named "Section <key>" (the cms e2e finds it by that name).
 */
import type { FieldDef } from '../../../shared/cms-fields';
import { FormAlert } from '../../auth/FormAlert';
import { Field, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { RichText } from '../../primitives/RichText';
import { MoveButtons } from '../website/parts';
import { useSectionEditor, type Value } from './useCms';

function FieldInput({
  def,
  value,
  onChange,
  idPrefix,
  errors,
}: {
  def: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  idPrefix: string;
  errors: Record<string, string[]>;
}) {
  const err = errors[`${idPrefix}${def.key}`]?.join(' ');
  const label = def.optional ? `${def.label} (optional)` : def.label;
  switch (def.kind) {
    case 'text':
      return (
        <TextField
          label={label}
          error={err}
          value={String(value ?? '')}
          maxLength={def.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'textarea':
      return (
        <TextareaField
          label={label}
          error={err}
          rows={3}
          value={String(value ?? '')}
          maxLength={def.max}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'html':
      return (
        <Field label={label} error={err}>
          {(p) => <RichText {...p} label={def.label} value={String(value ?? '')} onChange={onChange} minHeight={200} />}
        </Field>
      );
    case 'cta': {
      const v = (value ?? {}) as { label?: string; href?: string };
      const set = (patch: Partial<typeof v>) => {
        const next = { ...v, ...patch };
        onChange(def.optional && !next.label && !next.href ? undefined : next);
      };
      return (
        <fieldset className="kz-wsg kz-wsg--2">
          <legend>{label}</legend>
          <TextField
            label="Button text"
            error={errors[`${idPrefix}${def.key}.label`]?.join(' ')}
            value={v.label ?? ''}
            maxLength={60}
            onChange={(e) => set({ label: e.target.value })}
          />
          <TextField
            label="Link"
            hint="A page like /contact or a full https:// address."
            error={errors[`${idPrefix}${def.key}.href`]?.join(' ')}
            value={v.href ?? ''}
            maxLength={500}
            onChange={(e) => set({ href: e.target.value })}
          />
        </fieldset>
      );
    }
    case 'strings': {
      const list = (Array.isArray(value) ? value : []) as string[];
      return (
        <TextareaField
          label={`${label} (one per line)`}
          error={err}
          rows={Math.max(3, list.length + 1)}
          value={list.join('\n')}
          onChange={(e) =>
            onChange(
              e.target.value
                .split('\n')
                .map((s) => s.trimStart())
                .filter((s, i, a) => s || i < a.length - 1),
            )
          }
        />
      );
    }
    case 'items': {
      const list = (Array.isArray(value) ? value : []) as Value[];
      const setItem = (i: number, v: Value) => onChange(list.map((x, j) => (j === i ? v : x)));
      return (
        <fieldset className="kz-wsg">
          <legend>{label}</legend>
          {list.map((item, i) => (
            <div key={i} className="kz-wsg__item">
              <div className="kz-wsg__head">
                <p className="kz-wsg__t">
                  {def.label} {i + 1}
                </p>
                <Button
                  size="sm"
                  variant="quiet"
                  aria-label={`Remove ${def.label} ${i + 1}`}
                  onClick={() => onChange(list.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </div>
              <div className="kz-astack">
                {(def.item ?? []).map((f) => (
                  <FieldInput
                    key={f.key}
                    def={f}
                    value={item[f.key]}
                    onChange={(v) => setItem(i, { ...item, [f.key]: v === '' && f.optional ? undefined : v })}
                    idPrefix={`${idPrefix}${def.key}.${i}.`}
                    errors={errors}
                  />
                ))}
              </div>
            </div>
          ))}
          {list.length < (def.maxItems ?? 20) ? (
            <div>
              <Button size="sm" variant="secondary" lead="add" onClick={() => onChange([...list, {}])}>
                Add {def.label.toLowerCase().replace(/s$/, '')}
              </Button>
            </div>
          ) : null}
          {err ? <p className="kz-error">{err}</p> : null}
        </fieldset>
      );
    }
  }
}

export function SectionEditor({
  pageKey,
  sectionKey,
  typeLabel,
  fields,
  draft,
  visible,
  changed,
  count,
  index,
}: {
  pageKey: string;
  sectionKey: string;
  typeLabel: string;
  fields: FieldDef[];
  draft: Value;
  visible: boolean;
  changed: boolean;
  count: number;
  index: number;
}) {
  const s = useSectionEditor(pageKey, sectionKey, draft);
  return (
    <section className="kz-apane" aria-label={`Section ${sectionKey}`}>
      <div className="kz-apane__head">
        <h2 className="kz-apane__title">{typeLabel}</h2>
        <span className="kz-apane__meta">
          {sectionKey}
          {visible ? '' : ' · hidden'}
          {changed ? ' · unpublished changes' : ''}
        </span>
        <div className="kz-apane__acts">
          <MoveButtons
            label={sectionKey}
            index={index}
            count={count}
            onMove={(to) => void s.move(to < index ? 'up' : 'down')}
            disabled={s.busy}
          />
          <Button size="sm" variant="quiet" onClick={() => void s.setVisible(!visible)}>
            {visible ? 'Hide' : 'Show'}
          </Button>
        </div>
      </div>
      <div className="kz-apane__body">
        <form
          noValidate
          className="kz-astack"
          onSubmit={(ev) => {
            ev.preventDefault();
            void s.save();
          }}
        >
          {fields.map((f) => (
            <FieldInput
              key={f.key}
              def={f}
              value={s.value[f.key]}
              onChange={(v) => s.setValue({ ...s.value, [f.key]: v === '' && f.optional ? undefined : v })}
              idPrefix=""
              errors={s.errors}
            />
          ))}
          <FormAlert message={s.error} />
          <div className="kz-wsf__row">
            <Button type="submit" variant="secondary" loading={s.busy}>
              Save draft
            </Button>
            {s.saved ? (
              <p role="status" className="kz-wsf__ok">
                Draft saved. Preview it, then publish.
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </section>
  );
}
