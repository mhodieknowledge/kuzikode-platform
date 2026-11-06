/** Staff users & roles islands (P4.2). The server re-checks every permission; these only shape the UI. */
import { useState, type FormEvent } from 'react';
import { ApiError, apiFetch, Button, Checkbox, ConfirmDialog, Dialog, Field, Input, Textarea } from '../ui';

export interface RoleOption {
  key: string;
  name: string;
  description: string | null;
}

const reload = () => window.location.reload();

function useAction() {
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await fn();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        setError(err.message);
      } else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return { errors, error, busy, run };
}

function RoleChecklist({
  roles,
  value,
  onChange,
  error,
  hideLegend = false,
}: {
  roles: RoleOption[];
  value: string[];
  onChange: (v: string[]) => void;
  error?: string[] | undefined;
  hideLegend?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={hideLegend ? 'sr-only' : 'mb-1 text-sm font-medium text-ink-950'}>Roles</legend>
      {roles.map((r) => (
        <Checkbox
          key={r.key}
          label={r.name}
          description={r.description ?? undefined}
          checked={value.includes(r.key)}
          onCheckedChange={(on) => onChange(on ? [...value, r.key] : value.filter((k) => k !== r.key))}
        />
      ))}
      {error ? <p className="text-[13px] font-medium text-danger-600">{error.join(' ')}</p> : null}
    </fieldset>
  );
}

export function InviteStaffButton({ roles }: { roles: RoleOption[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const a = useAction();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await a.run(async () => {
      const res = await apiFetch<{ data: { userId: string } }>('/api/v1/admin/users', {
        body: { name: f.get('name'), email: f.get('email'), roles: selected },
      });
      window.location.assign(`/admin/users/${res.data.userId}`);
    });
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>Invite staff member</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Invite a staff member"
        description="They will get an email with a link to set their password. The link works once and expires in 7 days."
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {a.error ? (
            <p role="alert" className="text-sm font-medium text-danger-600">
              {a.error}
            </p>
          ) : null}
          <Field label="Full name" required error={a.errors['name']}>
            <Input name="name" maxLength={120} autoComplete="off" />
          </Field>
          <Field label="Work email" required error={a.errors['email']}>
            <Input name="email" type="email" maxLength={254} autoComplete="off" />
          </Field>
          <RoleChecklist roles={roles} value={selected} onChange={setSelected} error={a.errors['roles']} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              Send invitation
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** Detail-page actions for one staff member. */
export function StaffActions({
  userId,
  name,
  status,
  roles,
  allRoles,
  mfaEnabled,
  isSelf,
}: {
  userId: string;
  name: string;
  status: 'invited' | 'active' | 'disabled';
  roles: string[];
  allRoles: RoleOption[];
  mfaEnabled: boolean;
  isSelf: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(roles);
  const [confirm, setConfirm] = useState<'disable' | 'mfa' | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const a = useAction();
  const base = `/api/v1/admin/users/${encodeURIComponent(userId)}`;
  const changed = [...selected].sort().join() !== [...roles].sort().join();

  return (
    <div className="flex flex-col gap-6">
      {a.error ? (
        <p
          role="alert"
          className="rounded-sm border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700"
        >
          {a.error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="rounded-sm bg-success-50 px-4 py-3 text-sm text-success-700">
          {saved}
        </p>
      ) : null}
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="name-title">
        <h2 id="name-title" className="font-sans text-base font-semibold">
          Name
        </h2>
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = String(new FormData(e.currentTarget).get('name') ?? '');
            void a.run(async () => {
              await apiFetch(base, { method: 'PATCH', body: { name: value } });
              setSaved('Name saved.');
            });
          }}
        >
          <Field label="Full name" hideLabel error={a.errors['name']} className="min-w-64 flex-1">
            <Input name="name" defaultValue={name} maxLength={120} />
          </Field>
          <Button type="submit" variant="secondary" loading={a.busy}>
            Save name
          </Button>
        </form>
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="roles-title">
        <h2 id="roles-title" className="font-sans text-base font-semibold">
          Roles
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          Changing roles signs this person out so the new permissions apply straight away.
        </p>
        <div className="mt-4">
          <RoleChecklist
            roles={allRoles}
            value={selected}
            onChange={setSelected}
            error={a.errors['roles']}
            hideLegend
          />
        </div>
        <Button
          className="mt-4"
          disabled={!changed}
          loading={a.busy}
          onClick={() =>
            void a.run(async () => {
              await apiFetch(`${base}/roles`, { method: 'PUT', body: { roles: selected } });
              reload();
            })
          }
        >
          Save roles
        </Button>
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="access-title">
        <h2 id="access-title" className="font-sans text-base font-semibold">
          Access
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {status === 'invited' ? (
            <Button
              variant="secondary"
              loading={a.busy}
              onClick={() =>
                void a.run(async () => {
                  await apiFetch(`${base}/invitation`, { method: 'POST', body: {} });
                  setSaved('A new invitation email is on its way. Earlier links no longer work.');
                })
              }
            >
              Resend invitation
            </Button>
          ) : null}
          {mfaEnabled && !isSelf ? (
            <Button variant="secondary" onClick={() => setConfirm('mfa')}>
              Reset two-factor authentication
            </Button>
          ) : null}
          {status === 'disabled' ? (
            <Button
              loading={a.busy}
              onClick={() =>
                void a.run(async () => {
                  await apiFetch(`${base}/enable`, { method: 'POST', body: {} });
                  reload();
                })
              }
            >
              Enable account
            </Button>
          ) : !isSelf ? (
            <Button variant="danger" onClick={() => setConfirm('disable')}>
              Disable account
            </Button>
          ) : null}
        </div>
      </section>
      <ConfirmDialog
        open={confirm === 'disable'}
        onOpenChange={(o) => setConfirm(o ? 'disable' : null)}
        title={`Disable ${name}?`}
        description="They are signed out everywhere and cannot sign in until the account is enabled again. Their history is kept."
        confirmLabel="Disable account"
        destructive
        onConfirm={() =>
          a.run(async () => {
            await apiFetch(`${base}/disable`, { method: 'POST', body: {} });
            reload();
          })
        }
      />
      <ConfirmDialog
        open={confirm === 'mfa'}
        onOpenChange={(o) => setConfirm(o ? 'mfa' : null)}
        title="Reset two-factor authentication?"
        description="Their authenticator and backup codes stop working and their sessions end. They set it up again at their next sign-in."
        confirmLabel="Reset two-factor"
        destructive
        onConfirm={() =>
          a.run(async () => {
            await apiFetch(`${base}/mfa/reset`, { method: 'POST', body: {} });
            reload();
          })
        }
      />
    </div>
  );
}

export interface PermissionGroup {
  module: string;
  items: { key: string; description: string; reserved: boolean }[];
}

/** Create or edit a custom role (Super Administrator only). */
export function RoleEditor({
  groups,
  role,
}: {
  groups: PermissionGroup[];
  role?: { id: string; key: string; name: string; description: string | null; permissions: string[]; members: number };
}) {
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState<string[]>(role?.permissions ?? ['dashboard.view']);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const a = useAction();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await a.run(async () => {
      const body = { name: f.get('name'), description: f.get('description') || undefined, permissions: perms };
      if (role) await apiFetch(`/api/v1/admin/roles/${role.id}`, { method: 'PUT', body });
      else await apiFetch('/api/v1/admin/roles', { body: { ...body, key: f.get('key') } });
      reload();
    });
  }
  return (
    <>
      <div className="flex gap-2">
        <Button variant={role ? 'secondary' : 'primary'} size={role ? 'sm' : 'md'} onClick={() => setOpen(true)}>
          {role ? 'Edit' : 'New custom role'}
          {role ? <span className="sr-only"> {role.name}</span> : null}
        </Button>
        {role ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} disabled={role.members > 0}>
            Delete<span className="sr-only"> {role.name}</span>
          </Button>
        ) : null}
      </div>
      <Dialog open={open} onOpenChange={setOpen} title={role ? `Edit ${role.name}` : 'New custom role'} size="lg">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          {a.error ? (
            <p role="alert" className="text-sm font-medium text-danger-600">
              {a.error}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role name" required error={a.errors['name']}>
              <Input name="name" defaultValue={role?.name ?? ''} maxLength={60} />
            </Field>
            {role ? null : (
              <Field label="Key" required hint="e.g. office_manager. Cannot be changed later." error={a.errors['key']}>
                <Input name="key" maxLength={40} />
              </Field>
            )}
          </div>
          <Field label="Description" hint="Optional" error={a.errors['description']}>
            <Textarea name="description" rows={2} defaultValue={role?.description ?? ''} maxLength={300} />
          </Field>
          <div className="max-h-[50vh] overflow-y-auto rounded-md border border-line p-4">
            {groups.map((g) => (
              <fieldset key={g.module} className="mb-4">
                <legend className="mb-2 text-[12px] font-semibold tracking-wide text-ink-600 uppercase">
                  {g.module}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.items
                    .filter((p) => !p.reserved)
                    .map((p) => (
                      <Checkbox
                        key={p.key}
                        label={p.description}
                        description={p.key}
                        checked={perms.includes(p.key)}
                        disabled={p.key === 'dashboard.view'}
                        onCheckedChange={(on) => setPerms(on ? [...perms, p.key] : perms.filter((k) => k !== p.key))}
                      />
                    ))}
                </div>
              </fieldset>
            ))}
            {a.errors['permissions'] ? (
              <p className="text-[13px] font-medium text-danger-600">{a.errors['permissions'].join(' ')}</p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              {role ? 'Save role' : 'Create role'}
            </Button>
          </div>
        </form>
      </Dialog>
      {role ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete ${role.name}?`}
          description="Nobody holds this role. Deleting it cannot be undone."
          confirmLabel="Delete role"
          destructive
          onConfirm={() =>
            a.run(async () => {
              await apiFetch(`/api/v1/admin/roles/${role.id}`, { method: 'DELETE' });
              reload();
            })
          }
        />
      ) : null}
    </>
  );
}
