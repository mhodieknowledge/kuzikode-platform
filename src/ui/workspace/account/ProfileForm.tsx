/** "Your details" form on the workspace account page (R5.4). Logic in useAccount.ts. */
import { Icon } from '../../icons/icon';
import { Button, TextField } from '../../primitives';
import { FormAlert } from '../../auth/FormAlert';
import { useProfile } from './useAccount';

export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const p = useProfile();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void p.save(new FormData(e.currentTarget));
      }}
      noValidate
      className="kz-aform"
    >
      {p.message?.ok ? (
        <p role="status" className="kz-okline">
          <Icon name="status-ok" size={20} />
          <span>{p.message.text}</span>
        </p>
      ) : (
        <FormAlert message={p.message?.text} />
      )}
      <div className="kz-aform__pair">
        <TextField
          label="Name"
          name="name"
          autoComplete="name"
          defaultValue={name}
          maxLength={120}
          required
          error={p.field('name')}
        />
        <TextField
          label="Phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={phone}
          maxLength={40}
          optional
          hint="Include the country code, e.g. +263 77 123 4567."
          error={p.field('phone')}
        />
      </div>
      <div className="kz-aform__bar">
        <Button type="submit" loading={p.busy}>
          Save details
        </Button>
      </div>
    </form>
  );
}
