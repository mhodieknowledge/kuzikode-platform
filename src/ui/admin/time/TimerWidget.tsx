/** Start / stop timer (R6.2 group 3). `running` comes from the server so a reload keeps showing it. */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { Button } from '../../primitives/button';
import { TextField } from '../../primitives';
import { formatMinutes } from '../../../shared/schemas/time';
import { ProjectTaskFields } from './ProjectTaskFields';
import { useElapsedMinutes, useTimer, type ProjectOption } from './useTime';

export function TimerWidget({
  projects,
  running,
}: {
  projects: ProjectOption[];
  running: { projectLabel: string; description: string | null; startedAt: string } | null;
}) {
  const a = useTimer();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const minutes = useElapsedMinutes(running?.startedAt ?? null);
  if (running) {
    return (
      <div className="kz-atimer" role="group" aria-label="Running timer">
        <div>
          <p className="kz-atimer__t">
            Timer running · <span>{formatMinutes(minutes)}</span>
          </p>
          <p className="kz-atimer__m">
            {running.projectLabel}
            {running.description ? ` · ${running.description}` : ''}
          </p>
          <FormAlert message={a.error} />
        </div>
        <div className="kz-atimer__btns">
          <Button loading={a.busy} onClick={() => void a.stop()}>
            Stop and save
          </Button>
          <Button variant="secondary" onClick={() => void a.discard()}>
            Discard
          </Button>
        </div>
      </div>
    );
  }
  return (
    <form
      noValidate
      className="kz-apane"
      aria-label="Start a timer"
      onSubmit={(e) => {
        e.preventDefault();
        void a.start({ projectId, taskId, description });
      }}
    >
      <div className="kz-apane__body kz-astack">
        <div className="kz-aform4">
          <ProjectTaskFields
            projects={projects}
            projectId={projectId}
            taskId={taskId}
            onProject={setProjectId}
            onTask={setTaskId}
            err={a.err}
          />
          <TextField
            label="What are you working on?"
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
            error={a.err('description')}
          />
          <Button type="submit" loading={a.busy} disabled={!projectId} lead="time">
            Start timer
          </Button>
        </div>
        <FormAlert message={a.error} />
      </div>
    </form>
  );
}
