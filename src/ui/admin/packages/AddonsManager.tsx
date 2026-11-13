/** Add-ons (R6.2): list rows with the price mono and right-aligned, a sheet for new and edited add-ons, and delete behind a confirmation. */
import { formatMoney } from '../../../shared/money';
import { FormAlert } from '../../auth/FormAlert';
import { Field, SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { MoneyInput } from '../../primitives/money';
import { ConfirmSheet } from '../../primitives/sheet';
import { useState } from 'react';
import { CheckItem, FormSheet } from '../form';
import { PaneBox } from '../PaneBox';
import { blankAddon, unitLabel, UNITS, useAddons, type AddonDraft, type AddonView } from './usePackages';

export function AddonsManager({
  addons,
  packages,
  currencies,
}: {
  addons: AddonView[];
  packages: { id: string; name: string }[];
  currencies: string[];
}) {
  const a = useAddons();
  const [remove, setRemove] = useState<AddonView | null>(null);
  const { draft } = a;
  return (
    <PaneBox
      id="addons-title"
      title="Add-ons"
      meta="offered with every package, or with one only"
      actions={
        <Button variant="secondary" size="sm" lead="add" onClick={() => a.setDraft(blankAddon(currencies[0] ?? 'USD'))}>
          New add-on
        </Button>
      }
      flush={addons.length > 0}
    >
      {draft ? null : <FormAlert message={a.error} />}
      {addons.length === 0 ? (
        <p className="kz-anone">No add-ons yet.</p>
      ) : (
        <ul className="kz-alist">
          {addons.map((x) => (
            <li key={x.id}>
              <div className="kz-alist__main">
                <span className="kz-alist__t">{x.name}</span>
                <span className="kz-alist__m">
                  {x.packageName ?? 'Every package'} · {x.active ? 'Offered' : 'Not offered'}
                </span>
              </div>
              <span className="kz-alist__r">
                {formatMoney(x.priceMinor, x.currency)}
                <span className="kz-wsr__unit">
                  {x.unit === 'each' ? '' : ` ${unitLabel(x.unit).toLowerCase()}`}
                  {x.billingType === 'recurring' ? ' · recurring' : ''}
                </span>
              </span>
              <div className="kz-arow-acts">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const { packageName: _n, ...rest } = x;
                    a.setDraft(rest);
                  }}
                >
                  Edit<span className="sr-only"> {x.name}</span>
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setRemove(x)}>
                  Delete<span className="sr-only"> {x.name}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {draft ? (
        <FormSheet
          open
          onClose={() => a.setDraft(null)}
          title={draft.id ? 'Edit add-on' : 'New add-on'}
          formId="pk-addon"
          submitLabel="Save add-on"
          busy={a.busy}
          error={a.error}
          onSubmit={() => void a.save()}
        >
          <TextField
            label="Name"
            value={draft.name}
            onChange={(e) => a.set('name', e.target.value)}
            maxLength={120}
            error={a.err('name')}
          />
          <TextareaField
            label="Description"
            rows={2}
            value={draft.description ?? ''}
            onChange={(e) => a.set('description', e.target.value || null)}
            maxLength={300}
            error={a.err('description')}
          />
          <SelectField
            label="Offered with"
            value={draft.packageId ?? ''}
            onChange={(e) => a.set('packageId', e.target.value || null)}
            error={a.err('packageId')}
          >
            <option value="">Every package</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Currency"
            value={draft.currency}
            onChange={(e) => a.set('currency', e.target.value)}
            error={a.err('currency')}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>
          <Field label="Price" error={a.priceError ?? a.err('priceMinor')}>
            {(p) => (
              <MoneyInput
                {...p}
                valueMinor={draft.priceMinor}
                onChangeMinor={(m) => a.set('priceMinor', m ?? 0)}
                currency={draft.currency}
                onParseError={a.setPriceError}
              />
            )}
          </Field>
          <SelectField
            label="Unit"
            value={draft.unit}
            onChange={(e) => a.set('unit', e.target.value)}
            error={a.err('unit')}
          >
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Billing"
            value={draft.billingType}
            onChange={(e) => a.set('billingType', e.target.value as AddonDraft['billingType'])}
            error={a.err('billingType')}
          >
            <option value="one_off">One-off</option>
            <option value="recurring">Recurring</option>
          </SelectField>
          <CheckItem checked={draft.active} onChange={(e) => a.set('active', e.target.checked)}>
            Offered
          </CheckItem>
        </FormSheet>
      ) : null}
      <ConfirmSheet
        open={remove !== null}
        onClose={() => setRemove(null)}
        title={`Delete ${remove?.name ?? 'add-on'}?`}
        confirmLabel="Delete add-on"
        danger
        onConfirm={() => (remove ? a.remove(remove.id) : undefined)}
      >
        Quotations that already include it keep their lines.
      </ConfirmSheet>
    </PaneBox>
  );
}
