/**
 * Add / edit a managed service in the register (R6.2): the service and internal notes as form sections over the sticky save
 * bar. Labels are the e2e contract (Name, Provider / registrar, Renewal date, Where the credentials are kept, Add to register).
 */
import { useState, type FormEvent } from 'react';
import { SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { ConfirmSheet } from '../../primitives/sheet';
import { CheckItem, FormSection, SaveBar } from '../form';
import { ASSET_STATUS_OPTIONS, ASSET_TYPE_OPTIONS, useAssetSave, type AssetFormValues } from './useSubscriptions';

export type { AssetFormValues };

export function AssetForm({
  initial,
  clients,
  subscriptions,
}: {
  initial: AssetFormValues;
  clients: { id: string; name: string }[];
  subscriptions: { id: string; clientId: string; description: string }[];
}) {
  const a = useAssetSave(initial.id);
  const editing = !!initial.id;
  const [v, setV] = useState(initial);
  const [remove, setRemove] = useState(false);
  const set = <K extends keyof AssetFormValues>(k: K, val: AssetFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void a.save(v);
  }
  const opt = (k: 'provider' | 'costNote' | 'credentialsNote') => ({
    value: v[k] ?? '',
    onChange: (ev: { target: { value: string } }) => set(k, ev.target.value || null),
  });
  const subs = subscriptions.filter((s) => s.clientId === v.clientId);
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection id="a-what" title="Service" description="What we look after, for whom, and when it renews.">
        <SelectField
          label="Client"
          value={v.clientId}
          onChange={(ev) => setV((p) => ({ ...p, clientId: ev.target.value, subscriptionId: null }))}
          error={a.err('clientId')}
        >
          <option value="">Choose a client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Type"
          value={v.type}
          onChange={(ev) => set('type', ev.target.value as AssetFormValues['type'])}
          error={a.err('type')}
        >
          {ASSET_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Name"
          hint="e.g. baobab.co.zw"
          value={v.name}
          onChange={(ev) => set('name', ev.target.value)}
          maxLength={200}
          error={a.err('name')}
        />
        <TextField label="Provider / registrar" {...opt('provider')} maxLength={120} error={a.err('provider')} />
        <TextField
          label="Renewal date"
          type="date"
          value={v.renewalDate ?? ''}
          onChange={(ev) => set('renewalDate', ev.target.value || null)}
          error={a.err('renewalDate')}
        />
        <SelectField
          label="Status"
          value={v.status}
          onChange={(ev) => set('status', ev.target.value as AssetFormValues['status'])}
          error={a.err('status')}
        >
          {ASSET_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Billed through subscription"
          value={v.subscriptionId ?? ''}
          onChange={(ev) => set('subscriptionId', ev.target.value || null)}
          error={a.err('subscriptionId')}
          className="kz-span-2"
        >
          <option value="">None</option>
          {subs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.description}
            </option>
          ))}
        </SelectField>
        <CheckItem checked={v.autoRenew} onChange={(e) => set('autoRenew', e.target.checked)} className="kz-span-2">
          Renews automatically
        </CheckItem>
        <CheckItem
          checked={v.billableToClient}
          onChange={(e) => set('billableToClient', e.target.checked)}
          className="kz-span-2"
        >
          Billable to the client (they get renewal reminders too)
        </CheckItem>
      </FormSection>
      <FormSection id="a-internal" title="Internal notes" description="Never shown to the client." cols={1}>
        <TextareaField label="Cost note" rows={2} {...opt('costNote')} maxLength={500} error={a.err('costNote')} />
        <TextField
          label="Where the credentials are kept"
          hint='Never type a password here. Write where it is kept, e.g. "in the owner’s password manager".'
          {...opt('credentialsNote')}
          maxLength={300}
          error={a.err('credentialsNote')}
        />
      </FormSection>
      <SaveBar error={a.error}>
        {editing ? (
          <Button variant="secondary" lead="delete" onClick={() => setRemove(true)}>
            Delete
          </Button>
        ) : null}
        <a href="/admin/assets" className="kz-btn kz-btn--secondary">
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          {editing ? 'Save' : 'Add to register'}
        </Button>
      </SaveBar>
      <ConfirmSheet
        open={remove}
        onClose={() => setRemove(false)}
        title={`Delete ${initial.name}?`}
        confirmLabel="Delete"
        danger
        onConfirm={() => a.remove()}
      >
        It leaves the register and gets no more reminders. Mark it cancelled or transferred instead to keep its history.
      </ConfirmSheet>
    </form>
  );
}
