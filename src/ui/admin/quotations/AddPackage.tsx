/**
 * "Add package" (R6.2): a sheet listing active priced packages; the package (with what's included in the description) and
 * any chosen add-ons are inserted as ordinary lines. Prices come from the server at this moment and are copied, so later
 * catalogue changes never alter this quotation.
 */
import { useState } from 'react';
import { formatMoney } from '../../../shared/money';
import { Button, SelectField } from '../../primitives';
import { Sheet } from '../../primitives/sheet';
import { FormAlert } from '../../auth/FormAlert';
import { CheckItem } from '../form';
import type { EditorLine } from '../documents/lines';
import { pickerPrice, usePackagePicker } from './useQuotations';

export function AddPackage({ currency, onAdd }: { currency: string; onAdd: (lines: EditorLine[]) => void }) {
  const a = usePackagePicker(currency);
  const [open, setOpen] = useState(false);
  const [pkgId, setPkgId] = useState('');
  const [addons, setAddons] = useState<Record<string, number>>({});
  const pkg = a.list?.find((p) => p.id === pkgId);
  const close = () => setOpen(false);
  const add = () => {
    if (!pkg) return;
    void a.linesFor(pkg, addons, (lines) => {
      onAdd(lines);
      setOpen(false);
      setPkgId('');
      setAddons({});
    });
  };
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        lead="packages"
        onClick={() => {
          setOpen(true);
          void a.load();
        }}
      >
        Add package
      </Button>
      <Sheet
        open={open}
        onClose={close}
        title="Add a package"
        className="kz-adlg"
        describedBy="addpkg-desc"
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button loading={a.busy} disabled={!pkg} onClick={add}>
              Add to quotation
            </Button>
          </>
        }
      >
        <p id="addpkg-desc" className="kz-adlg__desc">
          Adds the package and any add-ons as lines in {currency}, priced as of now.
        </p>
        <FormAlert message={a.error} />
        {a.list === null ? (
          <p className="kz-anone">Loading packages…</p>
        ) : a.list.length === 0 ? (
          <p className="kz-anone">There are no active priced packages. Add them under Website → Packages.</p>
        ) : (
          <SelectField
            label="Package"
            value={pkgId}
            onChange={(e) => {
              setPkgId(e.target.value);
              setAddons({});
            }}
            error={a.err('packageId') ?? a.err('currency')}
          >
            <option value="" disabled>
              Choose a package
            </option>
            {a.list.map((p) => (
              <option key={p.id} value={p.id}>
                {`${p.serviceName} · ${p.name} · ${pickerPrice(p, currency, formatMoney)}`}
              </option>
            ))}
          </SelectField>
        )}
        {pkg && pkg.addons.length > 0 ? (
          <fieldset className="kz-field">
            <legend className="kz-label">Add-ons</legend>
            {a.errors['addons'] ? <p className="kz-error">{a.errors['addons'].join(' ')}</p> : null}
            {pkg.addons.map((x) => {
              const on = addons[x.id] !== undefined;
              return (
                <div key={x.id} className="kz-addon">
                  <CheckItem
                    checked={on}
                    onChange={(e) =>
                      setAddons((m) => {
                        const next = { ...m };
                        if (e.target.checked) next[x.id] = 1;
                        else delete next[x.id];
                        return next;
                      })
                    }
                  >
                    {`${x.name} · ${formatMoney(x.priceMinor, x.currency)}${x.unit === 'each' ? '' : ` per ${x.unit}`}`}
                  </CheckItem>
                  {on ? (
                    <input
                      aria-label={`Quantity of ${x.name}`}
                      type="number"
                      min={1}
                      className="kz-input kz-input--num kz-addon__q"
                      value={addons[x.id]}
                      onChange={(e) =>
                        setAddons((m) => ({ ...m, [x.id]: Math.max(1, Math.floor(Number(e.target.value)) || 1) }))
                      }
                    />
                  ) : null}
                </div>
              );
            })}
          </fieldset>
        ) : null}
      </Sheet>
    </>
  );
}
