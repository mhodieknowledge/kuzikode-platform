/** Website announcements (R6.2): list rows with edit and delete, and a sheet for new and edited announcements. */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { SelectField, TextareaField, TextField } from '../../primitives';
import { Button } from '../../primitives/button';
import { CheckItem, FormSheet } from '../form';
import { cmsApi, toUtcInput } from '../website/lib';
import { ManagerList } from '../website/parts';
import { useCrud } from '../website/useCrud';

export interface AnnouncementRow {
  id: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  level: 'info' | 'important';
  starts_at: string | null;
  ends_at: string | null;
  active: number;
}

const stamp = (iso: string) => iso.slice(0, 16).replace('T', ' ');

export function AnnouncementsManager({ announcements }: { announcements: AnnouncementRow[] }) {
  const a = useCrud(cmsApi, '/announcements');
  const [editing, setEditing] = useState<AnnouncementRow | 'new' | null>(null);
  const [active, setActive] = useState(true);
  const current = editing && editing !== 'new' ? editing : null;
  return (
    <div className="kz-astack">
      <div>
        <Button
          lead="add"
          onClick={() => {
            setActive(true);
            setEditing('new');
          }}
        >
          New announcement
        </Button>
      </div>
      <ManagerList label="Announcements" empty="No announcements.">
        {announcements.map((n) => (
          <li key={n.id}>
            <div className="kz-alist__main">
              <span className="kz-alist__t">{n.message}</span>
              <span className="kz-alist__m">
                {n.active ? 'Active' : 'Off'} · {n.level}
                {n.starts_at ? ` · from ${stamp(n.starts_at)} UTC` : ''}
                {n.ends_at ? ` · until ${stamp(n.ends_at)} UTC` : ''}
              </span>
            </div>
            <div className="kz-arow-acts">
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Edit announcement: ${n.message}`}
                onClick={() => {
                  setActive(n.active === 1);
                  setEditing(n);
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Delete announcement: ${n.message}`}
                onClick={() => void a.remove(n.id)}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ManagerList>
      {editing ? null : <FormAlert message={a.error} />}
      {editing ? (
        <FormSheet
          open
          onClose={() => setEditing(null)}
          title={current ? 'Edit announcement' : 'New announcement'}
          formId="cms-announcement"
          submitLabel="Save"
          busy={a.busy}
          error={a.error}
          onSubmit={(f) =>
            void a.save(current?.id, {
              message: f.get('message'),
              linkUrl: f.get('linkUrl'),
              linkLabel: f.get('linkLabel'),
              level: f.get('level'),
              startsAt: f.get('startsAt'),
              endsAt: f.get('endsAt'),
              active,
            })
          }
        >
          <TextareaField
            label="Message"
            name="message"
            rows={2}
            defaultValue={current?.message ?? ''}
            maxLength={240}
            error={a.err('message')}
          />
          <TextField
            label="Link"
            hint="Optional, e.g. /contact."
            name="linkUrl"
            defaultValue={current?.link_url ?? ''}
            maxLength={500}
            error={a.err('linkUrl')}
          />
          <TextField
            label="Link text"
            name="linkLabel"
            defaultValue={current?.link_label ?? ''}
            maxLength={40}
            error={a.err('linkLabel')}
          />
          <TextField
            label="Starts (UTC)"
            name="startsAt"
            type="datetime-local"
            defaultValue={toUtcInput(current?.starts_at ?? null)}
            error={a.err('startsAt')}
          />
          <TextField
            label="Ends (UTC)"
            name="endsAt"
            type="datetime-local"
            defaultValue={toUtcInput(current?.ends_at ?? null)}
            error={a.err('endsAt')}
          />
          <SelectField label="Style" name="level" defaultValue={current?.level ?? 'info'}>
            <option value="info">Information</option>
            <option value="important">Important</option>
          </SelectField>
          <CheckItem checked={active} onChange={(e) => setActive(e.target.checked)}>
            Active
          </CheckItem>
        </FormSheet>
      ) : null}
    </div>
  );
}
