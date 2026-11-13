/** Two-step verification controls when it is on (R5.4): new backup codes, or turn it off; both ask for password + code. */
import { Button, TextField } from '../../primitives';
import { FormAlert } from '../../auth/FormAlert';
import { BackupCodes } from '../../auth/AuthForms';
import { useMfaManage } from './useAccount';

export function MfaManage() {
  const m = useMfaManage();
  return (
    <div className="kz-amfa">
      {m.codes ? (
        <div role="status" className="kz-amfa__codes">
          <p className="kz-amfa__codes-t">New backup codes. Your old codes no longer work.</p>
          <BackupCodes codes={m.codes} />
        </div>
      ) : null}
      {m.mode ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void m.submit(new FormData(e.currentTarget));
          }}
          noValidate
          className="kz-aform"
          aria-label={m.mode === 'disable' ? 'Turn off two-factor authentication' : 'Create new backup codes'}
        >
          <FormAlert message={m.error} />
          <div className="kz-aform__pair">
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              maxLength={128}
              required
              error={m.field('password')}
            />
            <TextField
              label="Authentication code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={20}
              required
              error={m.field('code')}
            />
          </div>
          <div className="kz-aform__bar">
            <Button type="submit" size="sm" variant={m.mode === 'disable' ? 'danger' : 'secondary'} loading={m.busy}>
              {m.mode === 'disable' ? 'Turn off two-factor authentication' : 'Create new backup codes'}
            </Button>
            <Button type="button" size="sm" variant="quiet" onClick={() => m.open(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="kz-aform__bar">
          <Button variant="secondary" size="sm" lead="refresh" onClick={() => m.open('codes')}>
            New backup codes
          </Button>
          <Button variant="quiet" size="sm" onClick={() => m.open('disable')}>
            Turn off
          </Button>
        </div>
      )}
    </div>
  );
}
