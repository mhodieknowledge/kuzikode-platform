/** Void an expense (R6.2): it stays on record but leaves totals and reports. */
import { useState } from 'react';
import { TextareaField } from '../../primitives';
import { Button } from '../../primitives/button';
import { FormSheet } from '../form';
import { useVoidExpense } from './useExpenses';

export function VoidExpense({ id }: { id: string }) {
  const a = useVoidExpense(id);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Void
      </Button>
      <FormSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Void this expense?"
        formId="exp-void"
        submitLabel="Void expense"
        danger
        busy={a.busy}
        error={a.error}
        onSubmit={(f) => void a.voidIt(f.get('reason'))}
      >
        <p className="kz-adlg__desc">Void expenses stay on record but are left out of totals and reports.</p>
        <TextareaField label="Reason" name="reason" rows={2} maxLength={500} error={a.err('reason')} />
      </FormSheet>
    </>
  );
}
