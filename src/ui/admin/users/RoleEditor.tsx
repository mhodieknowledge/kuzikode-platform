/** Create or edit a custom role (Super Administrator only): a sheet with name, key, description and the permission picker (R6.2 group 3). */
import { useState } from 'react';
import { Button } from '../../primitives/button';
import { TextareaField, TextField } from '../../primitives';
import { ConfirmSheet } from '../../primitives/sheet';
import { CheckWithHelp, FormSheet } from '../form';
import { useRoleSave, type PermissionGroup, type RoleValues } from './useUsers';

export function RoleEditor({ groups, role }: { groups: PermissionGroup[]; role?: RoleValues }) {
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState<string[]>(role?.permissions ?? ['dashboard.view']);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const a = useRoleSave(role);
  const permError = a.err('permissions');
  return (
    <>
      <div className="kz-arow-acts">
        <Button
          variant="secondary"
          size={role ? 'sm' : 'md'}
          lead={role ? undefined : 'add'}
          onClick={() => setOpen(true)}
        >
          {role ? 'Edit' : 'New custom role'}
          {role ? <span className="sr-only"> {role.name}</span> : null}
        </Button>
        {role ? (
          <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(true)} disabled={role.members > 0}>
            Delete<span className="sr-only"> {role.name}</span>
          </Button>
        ) : null}
      </div>
      {open ? (
        <FormSheet
          open
          onClose={() => setOpen(false)}
          title={role ? `Edit ${role.name}` : 'New custom role'}
          formId={`role-${role?.id ?? 'new'}`}
          submitLabel={role ? 'Save role' : 'Create role'}
          busy={a.busy}
          error={a.error}
          onSubmit={(f) => void a.save(f, perms)}
        >
          <TextField
            label="Role name"
            name="name"
            defaultValue={role?.name ?? ''}
            maxLength={60}
            error={a.err('name')}
          />
          {role ? null : (
            <TextField
              label="Key"
              hint="e.g. office_manager. Cannot be changed later."
              name="key"
              maxLength={40}
              error={a.err('key')}
            />
          )}
          <TextareaField
            label="Description"
            optional
            name="description"
            rows={2}
            defaultValue={role?.description ?? ''}
            maxLength={300}
            error={a.err('description')}
          />
          <div className="kz-aperm">
            {groups.map((g) => (
              <fieldset key={g.module}>
                <legend>{g.module}</legend>
                {g.items
                  .filter((p) => !p.reserved)
                  .map((p) => (
                    <CheckWithHelp
                      key={p.key}
                      label={p.description}
                      help={p.key}
                      helpMono
                      checked={perms.includes(p.key)}
                      disabled={p.key === 'dashboard.view'}
                      onChange={(e) =>
                        setPerms(e.target.checked ? [...perms, p.key] : perms.filter((k) => k !== p.key))
                      }
                    />
                  ))}
              </fieldset>
            ))}
            {permError ? (
              <p className="kz-error" role="alert">
                {permError}
              </p>
            ) : null}
          </div>
        </FormSheet>
      ) : null}
      {role ? (
        <ConfirmSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={`Delete ${role.name}?`}
          confirmLabel="Delete role"
          danger
          onConfirm={a.remove}
        >
          Nobody holds this role. Deleting it cannot be undone.
        </ConfirmSheet>
      ) : null}
    </>
  );
}
