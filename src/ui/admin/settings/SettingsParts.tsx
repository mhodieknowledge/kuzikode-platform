/**
 * Small settings islands (R6.2 group 3): numbering row, currency and tax-rate toggles, new tax rate, payment account, test
 * email. Labels the e2e specs read ("Invoices format", "New tax rate name", "Rate (%)", "Add tax rate", "Send a test email to
 * me", "<code> active") stay as before.
 */
import { useState, type FormEvent } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { Button } from '../../primitives/button';
import { SelectField, StatusPill, TextField } from '../../primitives';
import { CheckItem } from '../form';
import { percentToBp, reloadPage, settingsApi, useSave } from './useSettings';

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
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void s.run(async () => {
      await settingsApi(`/numbering/${kind}`, {
        method: 'PUT',
        body: { format: f.get('format'), nextValue: Number(f.get('nextValue')) },
      });
      reloadPage();
    });
  }
  return (
    <form onSubmit={submit} noValidate className="kz-anum">
      <div>
        <p className="kz-anum__k">{label}</p>
        <p className="kz-anum__e">Next: {example}</p>
      </div>
      <TextField
        label={`${label} format`}
        name="format"
        defaultValue={format}
        maxLength={40}
        disabled={!canEdit}
        error={s.err('format')}
        className="kz-anum__f"
      />
      <TextField
        label="Next number"
        name="nextValue"
        type="number"
        min={nextValue}
        defaultValue={nextValue}
        disabled={!canEdit}
        inputMode="numeric"
        error={s.err('nextValue')}
      />
      {canEdit ? (
        <Button type="submit" variant="secondary" loading={s.busy}>
          Save<span className="sr-only"> {label} numbering</span>
        </Button>
      ) : (
        <span />
      )}
      {s.error ? <FormAlert message={s.error} /> : null}
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
      await settingsApi(`/currencies/${code}`, { method: 'PUT', body });
      reloadPage();
    });
  return (
    <div className="kz-aacts-row">
      <CheckItem
        checked={active}
        disabled={!canEdit || isDefault}
        onChange={(e) => save({ active: e.target.checked, isDefault })}
      >
        {`${code} active`}
      </CheckItem>
      {isDefault ? (
        <StatusPill tone="lit" plain>
          Default
        </StatusPill>
      ) : canEdit && active ? (
        <Button size="sm" variant="secondary" onClick={() => save({ active: true, isDefault: true })}>
          Make default<span className="sr-only"> currency {code}</span>
        </Button>
      ) : null}
      <FormAlert message={s.error} />
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
      await settingsApi(`/tax-rates/${id}`, { method: 'PUT', body });
      reloadPage();
    });
  return (
    <div className="kz-aacts-row">
      <CheckItem
        checked={active}
        disabled={!canEdit || isDefault}
        onChange={(e) => save({ name, active: e.target.checked, isDefault: false })}
      >
        {`${name} active`}
      </CheckItem>
      {isDefault ? (
        <StatusPill tone="lit" plain>
          Default
        </StatusPill>
      ) : canEdit && active ? (
        <Button size="sm" variant="secondary" onClick={() => save({ name, active: true, isDefault: true })}>
          Make default<span className="sr-only"> tax rate {name}</span>
        </Button>
      ) : null}
      <FormAlert message={s.error} />
    </div>
  );
}

export function NewTaxRateForm() {
  const s = useSave();
  const [inclusive, setInclusive] = useState(false);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void s.run(async () => {
      await settingsApi('/tax-rates', {
        body: { name: f.get('name'), rateBp: percentToBp(String(f.get('rate') ?? '')), inclusive },
      });
      reloadPage();
    });
  }
  return (
    <form onSubmit={submit} noValidate className="kz-alog">
      <div className="kz-alog__row">
        <TextField
          label="New tax rate name"
          name="name"
          maxLength={60}
          placeholder="e.g. VAT 15.5%"
          error={s.err('name')}
        />
        <TextField label="Rate (%)" name="rate" inputMode="decimal" maxLength={6} error={s.err('rateBp')} />
      </div>
      <CheckItem checked={inclusive} onChange={(e) => setInclusive(e.target.checked)}>
        Prices already include this tax
      </CheckItem>
      <p className="kz-hint">
        New rates start inactive. The percentage can&apos;t be changed later: add a new rate instead.
      </p>
      <FormAlert message={s.error} />
      <div className="kz-alog__go">
        <Button type="submit" variant="secondary" lead="add" loading={s.busy}>
          Add tax rate
        </Button>
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
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void s.run(async () => {
      await settingsApi(`/payment-accounts/${id}`, {
        method: 'PUT',
        body: { label: f.get('label'), enabled: on, mode: f.get('mode') },
      });
    });
  }
  return (
    <form onSubmit={submit} noValidate className="kz-alog">
      <div className="kz-alog__row">
        <TextField label="Display name" name="label" defaultValue={label} maxLength={60} error={s.err('label')} />
        <SelectField label="Mode" name="mode" defaultValue={mode} error={s.err('mode')}>
          <option value="test">Test</option>
          <option value="live" disabled={!secretsConfigured}>
            Live
          </option>
        </SelectField>
      </div>
      <CheckItem checked={on} onChange={(e) => setOn(e.target.checked)}>
        Enabled
      </CheckItem>
      <div className="kz-aacts-row">
        <Button type="submit" variant="secondary" loading={s.busy}>
          Save<span className="sr-only"> {label}</span>
        </Button>
        {s.saved ? (
          <p role="status" className="kz-astatus">
            {s.saved}
          </p>
        ) : null}
        <FormAlert message={s.error} />
      </div>
    </form>
  );
}

export function TestEmailButton() {
  const s = useSave();
  return (
    <div className="kz-aacts-row">
      <Button
        variant="secondary"
        lead="send"
        loading={s.busy}
        onClick={() =>
          void s.run(async () => {
            const res = await settingsApi<{ data: { to: string } }>('/email/test', { method: 'POST', body: {} });
            return `Test email queued to ${res.data.to}.`;
          })
        }
      >
        Send a test email to me
      </Button>
      {s.saved ? (
        <p role="status" className="kz-astatus">
          {s.saved}
        </p>
      ) : null}
      <FormAlert message={s.error} />
    </div>
  );
}
