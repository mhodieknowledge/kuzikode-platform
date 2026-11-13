/** Staff notification preferences (R6.2 group 3): one pane per group, in-app and email switches per event; one Save at the bottom. */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { Button } from '../../primitives/button';
import { CheckItem } from '../form';
import { PaneBox } from '../PaneBox';
import { settingsApi, useSave } from './useSettings';

export interface Pref {
  type: string;
  label: string;
  group: string;
  inApp: boolean;
  email: boolean;
}

export function NotificationPrefsForm({ prefs }: { prefs: Pref[] }) {
  const [state, setState] = useState(prefs);
  const s = useSave();
  const groups = [...new Set(state.map((p) => p.group))];
  const set = (type: string, k: 'inApp' | 'email', v: boolean) =>
    setState((list) => list.map((p) => (p.type === type ? { ...p, [k]: v } : p)));
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void s.run(async () => {
          await settingsApi('/notification-preferences', {
            method: 'PUT',
            body: { prefs: state.map(({ type, inApp, email }) => ({ type, inApp, email })) },
          });
        });
      }}
      className="kz-astack"
    >
      {groups.map((g, i) => (
        <PaneBox key={g} id={`pref-${i}`} title={g} flush>
          <ul className="kz-aprefs">
            {state
              .filter((p) => p.group === g)
              .map((p) => (
                <li key={p.type}>
                  <span className="kz-aprefs__l">{p.label}</span>
                  <span className="kz-aprefs__c">
                    <CheckItem checked={p.inApp} onChange={(e) => set(p.type, 'inApp', e.target.checked)}>
                      In app<span className="sr-only"> for {p.label}</span>
                    </CheckItem>
                    <CheckItem checked={p.email} onChange={(e) => set(p.type, 'email', e.target.checked)}>
                      Email<span className="sr-only"> for {p.label}</span>
                    </CheckItem>
                  </span>
                </li>
              ))}
          </ul>
        </PaneBox>
      ))}
      <p className="kz-hint">Security notices (new sign-in, password changes) are always emailed.</p>
      <div className="kz-aacts-row">
        <Button type="submit" loading={s.busy}>
          Save preferences
        </Button>
        {s.saved ? (
          <p role="status" className="kz-astatus">
            {s.saved}
          </p>
        ) : null}
        <FormAlert message={s.error} />
      </div>
    </form>
  );
}
