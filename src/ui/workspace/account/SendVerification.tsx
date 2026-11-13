/** "Send verification email" next to an unconfirmed address (R5.4). Logic in useAccount.ts. */
import { Icon } from '../../icons/icon';
import { Button } from '../../primitives';
import { FormAlert } from '../../auth/FormAlert';
import { useSendVerification } from './useAccount';

export function SendVerification() {
  const v = useSendVerification();
  if (v.state === 'sent')
    return (
      <p role="status" className="kz-okline">
        <Icon name="status-ok" size={20} />
        <span>We have sent you a link. It expires in 24 hours.</span>
      </p>
    );
  return (
    <div className="kz-averify">
      <Button variant="secondary" size="sm" lead="email" loading={v.state === 'busy'} onClick={v.send}>
        Send verification email
      </Button>
      {v.state === 'error' ? <FormAlert message={v.error} /> : null}
    </div>
  );
}
