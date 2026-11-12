/** Dev gallery: React primitives (fields, choices, money, segmented, sheets, toasts, data table). Fictional data only. */
import { useState } from 'react';
import {
  Button,
  ChoiceGroup,
  CheckRow,
  ConfirmSheet,
  DataTable,
  EmptyState,
  Field,
  IconButton,
  MoneyInput,
  Segmented,
  SelectField,
  Sheet,
  StatusPill,
  TextField,
  TextareaField,
  ToastProvider,
  useToast,
  type Column,
} from '../primitives';

interface Inv {
  number: string;
  client: string;
  status: 'paid' | 'overdue' | 'issued';
  due: string;
  amount: string;
}
const INVOICES: Inv[] = [
  {
    number: 'INV-2026-00021',
    client: 'Msasa Hardware (demo)',
    status: 'overdue',
    due: '02 Nov 2026',
    amount: '$1,250.00',
  },
  { number: 'INV-2026-00022', client: 'Avondale Bakery (demo)', status: 'paid', due: '10 Nov 2026', amount: '$420.00' },
  {
    number: 'INV-2026-00023',
    client: 'Borrowdale Florists (demo)',
    status: 'issued',
    due: '30 Nov 2026',
    amount: '$75.00',
  },
];
const tone = { paid: 'ok', overdue: 'danger', issued: 'info' } as const;
const columns: Column<Inv>[] = [
  { key: 'number', header: 'Invoice', cell: (r) => <span className="font-mono">{r.number}</span>, mobile: 'title' },
  { key: 'client', header: 'Client', cell: (r) => r.client, mobile: 'meta' },
  { key: 'due', header: 'Due', cell: (r) => r.due, mobile: 'meta' },
  {
    key: 'status',
    header: 'Status',
    cell: (r) => <StatusPill tone={tone[r.status]}>{r.status}</StatusPill>,
    mobile: 'aside',
  },
  { key: 'amount', header: 'Amount', cell: (r) => r.amount, numeric: true, mobile: 'aside' },
];

function Inner() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [need, setNeed] = useState('website');
  const [extras, setExtras] = useState<string[]>(['email']);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [minor, setMinor] = useState<number | null>(125050);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [tableState, setTableState] = useState<'rows' | 'empty'>('rows');
  const emailError =
    touched && !/^\S+@\S+\.\S+$/.test(email) ? 'Enter an email address like name@example.com' : undefined;

  return (
    <div className="stack gap-16">
      <section aria-labelledby="g-fields" className="stack gap-6">
        <h2 id="g-fields" className="text-h2">
          Fields and choices
        </h2>
        <div className="stack gap-6 md:grid-cols-2">
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            error={emailError}
            hint="We reply to this address."
          />
          <SelectField label="Service" defaultValue="web">
            <option value="web">Web development</option>
            <option value="apps">Mobile & desktop apps</option>
          </SelectField>
          <Field
            label="Amount"
            hint={minor !== null ? `Stored as ${minor} minor units` : undefined}
            error={moneyError ?? undefined}
          >
            {(p) => (
              <MoneyInput
                {...p}
                currency="USD"
                valueMinor={minor}
                onChangeMinor={setMinor}
                onParseError={setMoneyError}
              />
            )}
          </Field>
          <TextareaField label="Message" optional placeholder="What should we know?" />
        </div>
        <ChoiceGroup
          legend="What do you need?"
          name="need"
          columns={3}
          value={need}
          onChange={(v) => setNeed(v as string)}
          options={[
            { value: 'website', label: 'A website', hint: 'Business site or online shop' },
            { value: 'app', label: 'An app or system', hint: 'Mobile, desktop or internal tools' },
            { value: 'ai', label: 'AI or automation', hint: 'Data, documents, workflows' },
          ]}
        />
        <ChoiceGroup
          legend="Extras"
          name="extras"
          multiple
          columns={2}
          value={extras}
          onChange={(v) => setExtras(v as string[])}
          options={[
            { value: 'email', label: 'Business email' },
            { value: 'care', label: 'Care plan' },
          ]}
        />
        <CheckRow name="consent">I agree to the processing of my details as described in the privacy policy.</CheckRow>
      </section>

      <section aria-labelledby="g-seg-react" className="stack gap-4">
        <h2 id="g-seg-react" className="text-h2">
          Segmented control (React)
        </h2>
        <Segmented
          label="Billing period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'month', label: 'Monthly' },
            { value: 'year', label: 'Yearly' },
          ]}
        />
        <p className="text-small text-ink-600">Selected: {period}</p>
      </section>

      <section aria-labelledby="g-sheets" className="stack gap-4">
        <h2 id="g-sheets" className="text-h2">
          Sheets and toasts
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setSheet(true)}>
            Open sheet
          </Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Void invoice
          </Button>
          <Button variant="secondary" onClick={() => toast.ok('Saved')}>
            Toast: ok
          </Button>
          <Button variant="secondary" onClick={() => toast.error('This could not be saved. Try again.')}>
            Toast: error
          </Button>
          <IconButton name="refresh" label="Refresh" variant="secondary" />
          <Button loading arrow>
            Saving
          </Button>
        </div>
        <Sheet
          open={sheet}
          onClose={() => setSheet(false)}
          title="Filter invoices"
          footer={
            <Button block onClick={() => setSheet(false)}>
              Apply filters
            </Button>
          }
        >
          <SelectField label="Status" defaultValue="open">
            <option value="open">Open</option>
            <option value="paid">Paid</option>
          </SelectField>
        </Sheet>
        <ConfirmSheet
          open={confirm}
          onClose={() => setConfirm(false)}
          title="Void INV-2026-00021?"
          confirmLabel="Void invoice"
          danger
          confirmText="INV-2026-00021"
          onConfirm={async () => {
            await new Promise((r) => setTimeout(r, 300));
            toast.ok('Invoice voided');
          }}
        >
          Voiding keeps the invoice on record and issues nothing to the client.
        </ConfirmSheet>
      </section>

      <section aria-labelledby="g-table" className="stack gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="g-table" className="text-h2">
            Data table
          </h2>
          <Segmented
            label="Table state"
            value={tableState}
            onChange={setTableState}
            options={[
              { value: 'rows', label: 'Rows' },
              { value: 'empty', label: 'Empty' },
            ]}
          />
        </div>
        <DataTable
          caption="Invoices"
          rows={tableState === 'rows' ? INVOICES : []}
          columns={columns}
          rowKey={(r) => r.number}
          rowHref={() => '/dev/ui'}
          empty={
            <EmptyState code="0 invoices" title="No invoices yet" action={<Button size="sm">New invoice</Button>}>
              Invoices you issue appear here.
            </EmptyState>
          }
        />
      </section>
    </div>
  );
}

export default function ReactGallery() {
  return (
    <ToastProvider>
      <Inner />
    </ToastProvider>
  );
}
