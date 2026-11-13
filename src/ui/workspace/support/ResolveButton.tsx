/** "Mark as resolved" at the foot of an open support conversation (R5.4). */
import { Button } from '../../primitives';
import { FormAlert } from '../../auth/FormAlert';
import { useResolve } from './useSupport';

export function ResolveButton({ requestId }: { requestId: string }) {
  const s = useResolve(requestId);
  return (
    <div className="kz-sresolve__act">
      <FormAlert message={s.error ?? s.errors['status']?.[0] ?? null} />
      <Button variant="secondary" size="sm" lead="check" loading={s.busy} onClick={() => void s.resolve()}>
        Mark as resolved
      </Button>
    </div>
  );
}
