import { Icon } from '../icons/icon';

/** Form-level error line (auth and workspace forms): danger icon + message, announced as an alert. */
export function FormAlert({ message }: { message: string | null | undefined }) {
  return message ? (
    <p role="alert" className="kz-alert">
      <Icon name="status-danger" size={20} />
      <span>{message}</span>
    </p>
  ) : null;
}
