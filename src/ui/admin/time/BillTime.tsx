/** Choose unbilled entries and put them on a new draft invoice (R6.2 group 3). Cell text is the e2e contract. */
import { useState } from 'react';
import { FormAlert } from '../../auth/FormAlert';
import { Button } from '../../primitives/button';
import { formatMinutes } from '../../../shared/schemas/time';
import { workLabel } from './labels';
import { useBillTime, type UnbilledEntry } from './useTime';

export function BillTime({ projectId, entries }: { projectId: string; entries: UnbilledEntry[] }) {
  const a = useBillTime(projectId);
  const [chosen, setChosen] = useState<string[]>(entries.map((e) => e.id));
  const minutes = entries.filter((e) => chosen.includes(e.id)).reduce((n, e) => n + e.minutes, 0);
  return (
    <div className="kz-astack">
      <section className="kz-apane" aria-label="Unbilled entries">
        <div className="kz-apane__body is-flush">
          <div className="kz-dt kz-dt--react">
            <div className="kz-dt__scroll">
              <table className="kz-dt__t">
                <caption className="sr-only">Unbilled time entries</caption>
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">Include</span>
                    </th>
                    <th scope="col">Date</th>
                    <th scope="col">Person</th>
                    <th scope="col">Work</th>
                    <th scope="col" className="is-num">
                      Time
                    </th>
                    <th scope="col" className="is-num">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="kz-dt__td" data-m="acts">
                        <label className="kz-acheck">
                          <input
                            type="checkbox"
                            checked={chosen.includes(e.id)}
                            onChange={(ev) =>
                              setChosen(ev.target.checked ? [...chosen, e.id] : chosen.filter((x) => x !== e.id))
                            }
                          />
                          <span className="sr-only">{`Include ${e.entry_date} ${e.user_name}`}</span>
                          <span className="kz-dt__ph" aria-hidden="true">
                            Include in the invoice
                          </span>
                        </label>
                      </td>
                      <td className="kz-dt__td kz-dt__nw" data-m="meta">
                        <span className="kz-amono">{e.entry_date}</span>
                        <span className="kz-dt__ph"> · {e.user_name}</span>
                      </td>
                      <td className="kz-dt__td">{e.user_name}</td>
                      <td className="kz-dt__td" data-m="main">
                        {workLabel(e)}
                      </td>
                      <td className="kz-dt__td is-num">{formatMinutes(e.minutes)}</td>
                      <td className="kz-dt__td is-num" data-m="amount">
                        {e.amountLabel}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
      <FormAlert message={a.error ?? (a.errors['entryIds'] ? a.errors['entryIds'].join(' ') : null)} />
      <div className="kz-aacts-row">
        <Button loading={a.busy} disabled={chosen.length === 0} onClick={() => void a.bill(chosen)}>
          Create draft invoice
        </Button>
        <span className="kz-amono">
          {chosen.length} entries · {formatMinutes(minutes)}
        </span>
      </div>
    </div>
  );
}
