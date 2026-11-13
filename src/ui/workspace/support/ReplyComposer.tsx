/** Reply composer under a support conversation (R5.4), modelled on the project MessageComposer. Logic in useSupport.ts. */
import { Button, TextareaField } from '../../primitives';
import { FormAlert } from '../../auth/FormAlert';
import { AttachField } from './AttachField';
import { useReply } from './useSupport';

export function ReplyComposer({ requestId, reopens }: { requestId: string; reopens: boolean }) {
  const s = useReply(requestId);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void s.submit(e.currentTarget);
      }}
      noValidate
      className="kz-compose"
      aria-label="Reply"
    >
      <FormAlert message={s.error} />
      <TextareaField
        label="Your message"
        name="body"
        rows={4}
        maxLength={10_000}
        required
        hint={reopens ? 'Sending a message reopens this request.' : undefined}
        error={s.field('body')}
      />
      <AttachField error={s.field('files')} />
      <div className="kz-compose__bar">
        <Button type="submit" lead="send" loading={s.busy}>
          Send message
        </Button>
      </div>
    </form>
  );
}
