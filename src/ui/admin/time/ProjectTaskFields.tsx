/** Project + task selects shared by the timer and the entry sheet. Changing the project clears the task. */
import { SelectField } from '../../primitives';
import type { ProjectOption } from './useTime';

export function ProjectTaskFields({
  projects,
  projectId,
  taskId,
  onProject,
  onTask,
  err,
}: {
  projects: ProjectOption[];
  projectId: string;
  taskId: string | null;
  onProject: (id: string) => void;
  onTask: (id: string | null) => void;
  err: (key: string) => string | undefined;
}) {
  const tasks = projects.find((p) => p.id === projectId)?.tasks ?? [];
  return (
    <>
      <SelectField
        label="Project"
        value={projectId}
        onChange={(e) => {
          onProject(e.target.value);
          onTask(null);
        }}
        error={err('projectId')}
      >
        <option value="">Choose a project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Task"
        optional
        value={taskId ?? ''}
        onChange={(e) => onTask(e.target.value || null)}
        error={err('taskId')}
      >
        <option value="">No task</option>
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </SelectField>
    </>
  );
}
