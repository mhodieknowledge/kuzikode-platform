/**
 * Create / edit a project (R6.2 group 3): details and team as form sections over the sticky save bar. Labels (Client, Project
 * name, Create project…) are the e2e contract.
 */
import { useState, type FormEvent } from 'react';
import { Field, MoneyInput, SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL } from '../../../shared/projects';
import { CheckWithHelp, FormSection, SaveBar } from '../form';
import { useProjectSave, type ProjectFormValues, type Staff } from './useProjects';

export interface ProjectFormProps {
  id?: string;
  initial: ProjectFormValues;
  clients: { id: string; name: string; number: string; currency: string }[];
  staff: Staff[];
  currencies: { code: string; minor_digits: number }[];
}

export function ProjectForm({ id, initial, clients, staff, currencies }: ProjectFormProps) {
  const a = useProjectSave(id);
  const [clientId, setClientId] = useState(initial.clientId);
  const [status, setStatus] = useState(initial.status);
  const [leadId, setLeadId] = useState(initial.leadId ?? '');
  const [members, setMembers] = useState<string[]>(initial.memberIds);
  const [budget, setBudget] = useState<number | null>(initial.budgetMinor);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [currency, setCurrency] = useState(
    initial.currency ?? clients.find((c) => c.id === initial.clientId)?.currency ?? currencies[0]?.code ?? 'USD',
  );
  const digits = currencies.find((c) => c.code === currency)?.minor_digits ?? 2;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (budgetError) return;
    const f = new FormData(e.currentTarget);
    void a.save({
      clientId,
      name: f.get('name'),
      description: f.get('description'),
      status,
      startDate: f.get('startDate') || null,
      targetDate: f.get('targetDate') || null,
      budgetMinor: budget,
      currency: budget != null ? currency : null,
      leadId: leadId || null,
      memberIds: members.filter((m) => m !== leadId),
    });
  }
  const memberError = a.err('memberIds');
  return (
    <form onSubmit={submit} noValidate className="kz-aedit">
      <FormSection
        id="p-details"
        title="Details"
        description="What the project is, for whom, and its dates and budget."
      >
        <SelectField
          label="Client"
          required
          value={clientId}
          onChange={(ev) => setClientId(ev.target.value)}
          error={a.err('clientId')}
        >
          <option value="">Choose a client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.number})
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Status"
          value={status}
          onChange={(ev) => setStatus(ev.target.value)}
          error={a.err('status')}
        >
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS_LABEL[s]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Project name"
          required
          name="name"
          defaultValue={initial.name}
          maxLength={200}
          error={a.err('name')}
          className="kz-span-2"
        />
        <TextareaField
          label="Description"
          name="description"
          rows={3}
          defaultValue={initial.description ?? ''}
          maxLength={5000}
          error={a.err('description')}
          className="kz-span-2"
        />
        <TextField
          label="Start date"
          name="startDate"
          type="date"
          defaultValue={initial.startDate ?? ''}
          error={a.err('startDate')}
        />
        <TextField
          label="Target date"
          name="targetDate"
          type="date"
          defaultValue={initial.targetDate ?? ''}
          error={a.err('targetDate')}
        />
        <Field label="Budget" hint="Optional." error={budgetError ?? a.err('budgetMinor')}>
          {(p) => (
            <MoneyInput
              {...p}
              valueMinor={budget}
              onChangeMinor={setBudget}
              currency={currency}
              minorDigits={digits}
              onParseError={setBudgetError}
            />
          )}
        </Field>
        <SelectField
          label="Budget currency"
          value={currency}
          onChange={(ev) => setCurrency(ev.target.value)}
          error={a.err('currency')}
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </SelectField>
      </FormSection>
      <FormSection id="p-team" title="Team" description="Who leads the project and who works on it." cols={1}>
        <SelectField
          label="Project lead"
          hint="Leave empty to make yourself the lead."
          value={leadId}
          onChange={(ev) => setLeadId(ev.target.value)}
          error={a.err('leadId')}
        >
          <option value="">Me</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <fieldset className="kz-acheckgrid" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend className="kz-alegend">Members</legend>
          {staff
            .filter((s) => s.id !== leadId)
            .map((s) => (
              <CheckWithHelp
                key={s.id}
                label={s.name}
                help={s.email}
                checked={members.includes(s.id)}
                onChange={(ev) =>
                  setMembers(ev.target.checked ? [...members, s.id] : members.filter((m) => m !== s.id))
                }
              />
            ))}
        </fieldset>
        {memberError ? (
          <p className="kz-error" role="alert">
            {memberError}
          </p>
        ) : null}
      </FormSection>
      <SaveBar error={a.error}>
        <a href={id ? `/admin/projects/${id}` : '/admin/projects'} className="kz-btn kz-btn--secondary">
          <span>Cancel</span>
        </a>
        <Button type="submit" loading={a.busy}>
          {id ? 'Save project' : 'Create project'}
        </Button>
      </SaveBar>
    </form>
  );
}
