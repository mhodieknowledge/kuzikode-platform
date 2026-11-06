/** Settings islands (P4.3). Forms are generated from the shared registry; the server validates everything again. */
import { useState, type FormEvent } from 'react';
import type { SettingField } from '../../shared/settings';
import { ApiError, apiFetch, Button, Checkbox, Field, FileUpload, Input, Select, Switch, Textarea } from '../ui';

function useSave() {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setErrors({});
    setError(null);
    setSaved(null);
    try {
      const msg = await fn();
      setSaved(msg || 'Saved.');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(err.status === 422 ? 'Please check the highlighted fields.' : err.message);
      } else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return { errors, error, saved, busy, run };
}

function Feedback({ error, saved }: { error: string | null; saved: string | null }) {
  if (error)
    return (
      <p role="alert" className="text-sm font-medium text-danger-600">
        {error}
      </p>
    );
  if (saved)
    return (
      <p role="status" className="text-sm font-medium text-success-700">
        {saved}
      </p>
    );
  return null;
}

/** One settings section rendered from its field definitions. */
export function SettingsSectionForm({
  sectionId,
  fields,
  values,
  canEdit,
}: {
  sectionId: string;
  fields: SettingField[];
  values: Record<string, unknown>;
  canEdit: boolean;
}) {
  const [bools, setBools] = useState<Record<string, boolean>>(
    Object.fromEntries(fields.filter((f) => f.type === 'bool').map((f) => [f.key, values[f.key] === true])),
  );
  const s = useSave();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === 'bool') body[field.key] = bools[field.key] ?? false;
      else if (field.type === 'int') body[field.key] = Number(f.get(field.key));
      else body[field.key] = String(f.get(field.key) ?? '');
    }
    await s.run(async () => {
      const res = await apiFetch<{ data: { changed: string[] } }>(`/api/v1/admin/settings/sections/${sectionId}`, {
        method: 'PUT',
        body,
      });
      return res.data.changed.length ? 'Saved.' : 'No changes to save.';
    });
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const v = values[f.key];
          const err = s.errors[f.key];
          if (f.type === 'bool')
            return (
              <div key={f.key} className="sm:col-span-2">
                <Switch
                  label={f.label}
                  checked={bools[f.key] ?? false}
                  onCheckedChange={(on) => setBools((b) => ({ ...b, [f.key]: on }))}
                  disabled={!canEdit}
                />
                {f.help ? <p className="mt-1 pl-[52px] text-[13px] text-ink-600">{f.help}</p> : null}
              </div>
            );
          if (f.type === 'textarea')
            return (
              <Field key={f.key} label={f.label} hint={f.help} error={err} className="sm:col-span-2">
                <Textarea name={f.key} rows={3} defaultValue={typeof v === 'string' ? v : ''} maxLength={f.max} />
              </Field>
            );
          return (
            <Field key={f.key} label={f.label} hint={f.help} error={err}>
              <Input
                name={f.key}
                type={f.type === 'int' ? 'number' : f.type === 'color' ? 'color' : f.type}
                defaultValue={v === null || v === undefined ? '' : String(v)}
                maxLength={f.max}
                {...(f.type === 'int' ? { min: f.min, max: f.max, inputMode: 'numeric' as const } : {})}
                className={f.type === 'color' ? 'h-10 w-24 p-1' : undefined}
              />
            </Field>
          );
        })}
      </fieldset>
      {canEdit ? (
        <div className="flex items-center gap-3">
          <Button type="submit" loading={s.busy}>
            Save
          </Button>
          <Feedback error={s.error} saved={s.saved} />
        </div>
      ) : null}
    </form>
  );
}

export function LogoUploader({ current, canEdit }: { current: string | null; canEdit: boolean }) {
  const [fileId, setFileId] = useState(current);
  const [progress, setProgress] = useState<number | null>(null);
  const s = useSave();
  async function upload(file: File) {
    const body = new FormData();
    body.set('file', file);
    body.set('purpose', 'image');
    body.set('ownerType', 'system');
    await s.run(async () => {
      setProgress(50);
      const up = await apiFetch<{ data: { id: string } }>('/api/v1/admin/files', { body });
      await apiFetch('/api/v1/admin/settings/logo', { method: 'PUT', body: { fileId: up.data.id } });
      setFileId(up.data.id);
      setProgress(null);
      return 'Logo updated.';
    });
    setProgress(null);
  }
  return (
    <div className="flex flex-col gap-3">
      {fileId ? (
        <img
          src={`/api/v1/admin/files/${fileId}`}
          alt="Current document logo"
          className="h-16 w-auto self-start rounded-sm border border-line bg-white p-2"
        />
      ) : (
        <p className="text-sm text-ink-600">No logo uploaded. Documents use the Kuzikode wordmark.</p>
      )}
      {canEdit ? (
        <>
          <FileUpload
            label="Upload a logo"
            accept=".png,.jpg,.jpeg,.webp"
            maxBytes={2 * 1024 * 1024}
            hint="PNG, JPEG or WebP, up to 2 MB. A wide logo on a transparent background works best."
            onFile={upload}
            progress={progress}
          />
          {fileId ? (
            <Button
              variant="ghost"
              className="self-start"
              onClick={() =>
                void s.run(async () => {
                  await apiFetch('/api/v1/admin/settings/logo', { method: 'PUT', body: { fileId: null } });
                  setFileId(null);
                  return 'Logo removed.';
                })
              }
            >
              Remove logo
            </Button>
          ) : null}
        </>
      ) : null}
      <Feedback error={s.errors['fileId']?.join(' ') ?? s.error} saved={s.saved} />
    </div>
  );
}

export function NumberingRowForm({
  kind,
  label,
  format,
  nextValue,
  example,
  canEdit,
}: {
  kind: string;
  label: string;
  format: string;
  nextValue: number;
  example: string;
  canEdit: boolean;
}) {
  const s = useSave();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await s.run(async () => {
      await apiFetch(`/api/v1/admin/settings/numbering/${kind}`, {
        method: 'PUT',
        body: { format: f.get('format'), nextValue: Number(f.get('nextValue')) },
      });
      window.location.reload();
    });
  }
  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid items-end gap-3 border-t border-line py-4 sm:grid-cols-[160px_1fr_140px_auto]"
    >
      <div>
        <p className="font-semibold text-ink-950">{label}</p>
        <p className="font-mono text-[12px] text-ink-600">Next: {example}</p>
      </div>
      <Field label={`${label} format`} hideLabel={false} error={s.errors['format']}>
        <Input name="format" defaultValue={format} maxLength={40} disabled={!canEdit} className="font-mono" />
      </Field>
      <Field label="Next number" error={s.errors['nextValue']}>
        <Input
          name="nextValue"
          type="number"
          min={nextValue}
          defaultValue={nextValue}
          disabled={!canEdit}
          inputMode="numeric"
        />
      </Field>
      {canEdit ? (
        <Button type="submit" variant="secondary" loading={s.busy}>
          Save<span className="sr-only"> {label} numbering</span>
        </Button>
      ) : (
        <span />
      )}
      {s.error ? (
        <div className="sm:col-span-4">
          <Feedback error={s.error} saved={null} />
        </div>
      ) : null}
    </form>
  );
}

export function CurrencyToggle({
  code,
  active,
  isDefault,
  canEdit,
}: {
  code: string;
  active: boolean;
  isDefault: boolean;
  canEdit: boolean;
}) {
  const s = useSave();
  const save = (body: { active: boolean; isDefault: boolean }) =>
    void s.run(async () => {
      await apiFetch(`/api/v1/admin/settings/currencies/${code}`, { method: 'PUT', body });
      window.location.reload();
    });
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Switch
        label={`${code} active`}
        checked={active}
        disabled={!canEdit || isDefault}
        onCheckedChange={(on) => save({ active: on, isDefault })}
      />
      {isDefault ? (
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-semibold text-brand-600">Default</span>
      ) : canEdit && active ? (
        <Button size="sm" variant="ghost" onClick={() => save({ active: true, isDefault: true })}>
          Make default<span className="sr-only"> currency {code}</span>
        </Button>
      ) : null}
      <Feedback error={s.error} saved={null} />
    </div>
  );
}

export function TaxRateRow({
  id,
  name,
  active,
  isDefault,
  canEdit,
}: {
  id: string;
  name: string;
  active: boolean;
  isDefault: boolean;
  canEdit: boolean;
}) {
  const s = useSave();
  const save = (body: { name: string; active: boolean; isDefault: boolean }) =>
    void s.run(async () => {
      await apiFetch(`/api/v1/admin/settings/tax-rates/${id}`, { method: 'PUT', body });
      window.location.reload();
    });
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Switch
        label={`${name} active`}
        checked={active}
        disabled={!canEdit || isDefault}
        onCheckedChange={(on) => save({ name, active: on, isDefault: false })}
      />
      {isDefault ? (
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-semibold text-brand-600">Default</span>
      ) : canEdit && active ? (
        <Button size="sm" variant="ghost" onClick={() => save({ name, active: true, isDefault: true })}>
          Make default<span className="sr-only"> tax rate {name}</span>
        </Button>
      ) : null}
      <Feedback error={s.error} saved={null} />
    </div>
  );
}

export function NewTaxRateForm() {
  const s = useSave();
  const [inclusive, setInclusive] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pct = Number(String(f.get('rate') ?? '').replace(',', '.'));
    await s.run(async () => {
      await apiFetch('/api/v1/admin/settings/tax-rates', {
        body: { name: f.get('name'), rateBp: Number.isFinite(pct) ? Math.round(pct * 100) : -1, inclusive },
      });
      window.location.reload();
    });
  }
  return (
    <form onSubmit={submit} noValidate className="grid items-end gap-3 sm:grid-cols-[1fr_140px_auto]">
      <Field label="New tax rate name" error={s.errors['name']}>
        <Input name="name" maxLength={60} placeholder="e.g. VAT 15.5%" />
      </Field>
      <Field label="Rate (%)" error={s.errors['rateBp']}>
        <Input name="rate" inputMode="decimal" maxLength={6} />
      </Field>
      <Button type="submit" variant="secondary" loading={s.busy}>
        Add tax rate
      </Button>
      <div className="sm:col-span-3">
        <Checkbox label="Prices already include this tax" checked={inclusive} onCheckedChange={setInclusive} />
        <p className="mt-1 text-[13px] text-ink-600">
          New rates start inactive. The percentage can't be changed later: add a new rate instead.
        </p>
        <Feedback error={s.error} saved={null} />
      </div>
    </form>
  );
}

export function PaymentAccountForm({
  id,
  label,
  enabled,
  mode,
  secretsConfigured,
}: {
  id: string;
  label: string;
  enabled: boolean;
  mode: 'test' | 'live';
  secretsConfigured: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const s = useSave();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await s.run(async () => {
      await apiFetch(`/api/v1/admin/settings/payment-accounts/${id}`, {
        method: 'PUT',
        body: { label: f.get('label'), enabled: on, mode: f.get('mode') },
      });
    });
  }
  return (
    <form onSubmit={submit} noValidate className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_160px_auto]">
      <Field label="Display name" error={s.errors['label']}>
        <Input name="label" defaultValue={label} maxLength={60} />
      </Field>
      <Field label="Mode" error={s.errors['mode']}>
        <Select
          name="mode"
          defaultValue={mode}
          options={[
            { value: 'test', label: 'Test' },
            { value: 'live', label: 'Live', disabled: !secretsConfigured },
          ]}
        />
      </Field>
      <Button type="submit" variant="secondary" loading={s.busy}>
        Save<span className="sr-only"> {label}</span>
      </Button>
      <div className="sm:col-span-3 flex flex-wrap items-center gap-4">
        <Switch label="Enabled" checked={on} onCheckedChange={setOn} />
        <Feedback error={s.error} saved={s.saved} />
      </div>
    </form>
  );
}

export function TestEmailButton() {
  const s = useSave();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        loading={s.busy}
        onClick={() =>
          void s.run(async () => {
            const res = await apiFetch<{ data: { to: string } }>('/api/v1/admin/settings/email/test', {
              method: 'POST',
              body: {},
            });
            return `Test email queued to ${res.data.to}.`;
          })
        }
      >
        Send a test email to me
      </Button>
      <Feedback error={s.error} saved={s.saved} />
    </div>
  );
}

export function NotificationPrefsForm({
  prefs,
}: {
  prefs: { type: string; label: string; group: string; inApp: boolean; email: boolean }[];
}) {
  const [state, setState] = useState(prefs);
  const s = useSave();
  const groups = [...new Set(state.map((p) => p.group))];
  const set = (type: string, k: 'inApp' | 'email', v: boolean) =>
    setState((list) => list.map((p) => (p.type === type ? { ...p, [k]: v } : p)));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void s.run(async () => {
          await apiFetch('/api/v1/admin/settings/notification-preferences', {
            method: 'PUT',
            body: { prefs: state.map(({ type, inApp, email }) => ({ type, inApp, email })) },
          });
        });
      }}
      className="flex flex-col gap-6"
    >
      {groups.map((g) => (
        <fieldset key={g} className="rounded-lg border border-line bg-surface p-5">
          <legend className="px-1 text-sm font-semibold text-ink-950">{g}</legend>
          <div className="flex flex-col divide-y divide-line">
            {state
              .filter((p) => p.group === g)
              .map((p) => (
                <div key={p.type} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="text-sm text-ink-950">{p.label}</span>
                  <span className="flex gap-6">
                    <Checkbox
                      label={
                        <span>
                          In app<span className="sr-only"> for {p.label}</span>
                        </span>
                      }
                      checked={p.inApp}
                      onCheckedChange={(v) => set(p.type, 'inApp', v)}
                    />
                    <Checkbox
                      label={
                        <span>
                          Email<span className="sr-only"> for {p.label}</span>
                        </span>
                      }
                      checked={p.email}
                      onCheckedChange={(v) => set(p.type, 'email', v)}
                    />
                  </span>
                </div>
              ))}
          </div>
        </fieldset>
      ))}
      <p className="text-[13px] text-ink-600">Security notices (new sign-in, password changes) are always emailed.</p>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={s.busy}>
          Save preferences
        </Button>
        <Feedback error={s.error} saved={s.saved} />
      </div>
    </form>
  );
}
