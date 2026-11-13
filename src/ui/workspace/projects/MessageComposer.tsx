/** "Write to the team" composer under a project's thread (R5.2). Logic lives in useProjectMessage. */
import type { FormEvent } from 'react';
import { Button, TextareaField } from '../../primitives';
import { useProjectMessage } from './useProjectMessage';

export function MessageComposer({ projectId }: { projectId: string }) {
  const { send, busy, error, fieldError } = useProjectMessage(projectId);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void send(String(new FormData(e.currentTarget).get('body') ?? ''));
  }
  return (
    <form onSubmit={submit} noValidate className="kz-compose">
      {error ? (
        <p role="alert" className="kz-error">
          {error}
        </p>
      ) : null}
      <TextareaField
        label="Message to the Kuzikode team"
        name="body"
        rows={3}
        maxLength={5000}
        required
        error={fieldError}
      />
      <div className="kz-compose__bar">
        <Button type="submit" lead="send" loading={busy}>
          Send message
        </Button>
      </div>
    </form>
  );
}
