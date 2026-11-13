/** Status, priority and assignee of one request: each change saves at once and reloads (R6.2 group 3). */
import { FormAlert } from '../../auth/FormAlert';
import { SelectField } from '../../primitives';
import {
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABEL,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABEL,
} from '../../../shared/support';
import { useRequestControls } from './useSupport';

export function RequestControls({
  requestId,
  status,
  priority,
  assignedTo,
  staff,
}: {
  requestId: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  staff: { id: string; name: string }[];
}) {
  const a = useRequestControls(requestId);
  return (
    <div className="kz-alog">
      <SelectField
        label="Status"
        value={status}
        disabled={a.busy}
        onChange={(e) => void a.save({ status: e.target.value })}
      >
        {SUPPORT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {SUPPORT_STATUS_LABEL[s]}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Priority"
        value={priority}
        disabled={a.busy}
        onChange={(e) => void a.save({ priority: e.target.value })}
      >
        {SUPPORT_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {SUPPORT_PRIORITY_LABEL[p]}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Assigned to"
        value={assignedTo ?? ''}
        disabled={a.busy}
        onChange={(e) => void a.save({ assignedTo: e.target.value || null })}
      >
        <option value="">Unassigned</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>
      <FormAlert message={a.error} />
    </div>
  );
}
