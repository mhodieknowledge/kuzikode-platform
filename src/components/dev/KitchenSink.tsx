import { Bell, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  DataTable,
  DateInput,
  Dialog,
  Drawer,
  DropdownMenu,
  EmptyState,
  ErrorState,
  Field,
  FileUpload,
  FilterBar,
  IconButton,
  Input,
  KpiTile,
  MoneyInput,
  PageHeader,
  RadioGroup,
  SearchInput,
  Select,
  Skeleton,
  Spinner,
  StatusBadge,
  Switch,
  Tabs,
  Textarea,
  Timeline,
  ToastProvider,
  Tooltip,
  useToast,
  type Column,
} from '../ui';
import { formatMoney } from '../../shared/money';

interface Row {
  id: string;
  number: string;
  client: string;
  status: string;
  total: number;
}
const ROWS: Row[] = [
  { id: '1', number: 'INV-2026-00021', client: 'Example Trading (Pvt) Ltd', status: 'issued', total: 78000 },
  { id: '2', number: 'INV-2026-00019', client: 'Sample Health Clinic', status: 'partially_paid', total: 54000 },
  { id: '3', number: 'INV-2026-00017', client: 'Demo Logistics Ltd', status: 'overdue', total: 38000 },
  { id: '4', number: 'INV-2026-00015', client: 'Example Retail Co', status: 'paid', total: 120000 },
  { id: '5', number: 'INV-2026-00012', client: 'Demo Foods (Pvt) Ltd', status: 'void', total: 65000 },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10" aria-labelledby={`s-${title}`}>
      <h2 id={`s-${title}`} className="mb-4 text-lg font-bold tracking-display">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Inner() {
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(false);
  const [radio, setRadio] = useState('fixed');
  const [tab, setTab] = useState('overview');
  const [amount, setAmount] = useState<number | null>(111750);
  const [moneyErr, setMoneyErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('-number');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tableState, setTableState] = useState<'data' | 'loading' | 'empty' | 'error'>('data');

  const columns: Column<Row>[] = [
    {
      key: 'number',
      header: 'Number',
      sortKey: 'number',
      cell: (r) => <span className="font-mono text-[13px]">{r.number}</span>,
    },
    { key: 'client', header: 'Client', sortKey: 'client', cell: (r) => r.client, hideable: true },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <StatusBadge entity="invoice" status={r.status} />,
      hideable: true,
    },
    { key: 'total', header: 'Total', sortKey: 'total', numeric: true, cell: (r) => formatMoney(r.total, 'USD') },
  ];
  const rows = ROWS.filter((r) => !q || `${r.number} ${r.client}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="UI kit"
        description="Every shared component in its states. Development only."
        breadcrumbs={[{ label: 'Dev', href: '/dev/ui' }, { label: 'UI kit' }]}
        badge={<Badge tone="warning">Development</Badge>}
        actions={
          <>
            <Button variant="secondary" onClick={() => toast.info('Information toast')}>
              Info toast
            </Button>
            <Button onClick={() => toast.success('Invoice issued')}>Success toast</Button>
          </>
        }
      />

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon={<Trash2 size={16} aria-hidden="true" />}>
            Delete
          </Button>
          <Button size="sm" icon={<Plus size={14} aria-hidden="true" />}>
            Small
          </Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <IconButton label="Notifications">
            <Bell size={18} aria-hidden="true" />
          </IconButton>
          <Tooltip content="Explains what this does">
            <Button variant="secondary">Tooltip</Button>
          </Tooltip>
          <DropdownMenu
            trigger={<Button variant="secondary">Actions</Button>}
            items={[
              { label: 'Duplicate', onSelect: () => toast.info('Duplicated') },
              { label: 'Download PDF', onSelect: () => toast.info('Downloading') },
              { label: 'Void invoice', danger: true, onSelect: () => setConfirm(true) },
            ]}
          />
          <Spinner />
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Client name" required hint="As it should appear on documents.">
            <Input placeholder="Example Trading (Pvt) Ltd" />
          </Field>
          <Field label="Email" error="Enter a valid email address.">
            <Input type="email" defaultValue="not-an-email" />
          </Field>
          <Field label="Currency">
            <Select
              options={[
                { value: 'USD', label: 'USD · US Dollar' },
                { value: 'ZWG', label: 'ZWG · Zimbabwe Gold' },
              ]}
              defaultValue="USD"
            />
          </Field>
          <Field label="Due date">
            <DateInput defaultValue="2026-11-19" />
          </Field>
          <Field
            label="Amount"
            error={moneyErr ?? undefined}
            hint={amount !== null ? `Stored as ${amount} minor units` : undefined}
          >
            <MoneyInput currency="USD" valueMinor={amount} onChangeMinor={setAmount} onParseError={setMoneyErr} />
          </Field>
          <Field label="Search clients">
            <Input type="search" placeholder="Name or number" />
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <Textarea placeholder="Visible to the client on the invoice" />
          </Field>
          <div className="flex flex-col gap-4">
            <Checkbox
              label="Send the invoice by email"
              description="The client receives a link and a PDF."
              checked={checked}
              onCheckedChange={setChecked}
            />
            <Switch label="Show prices on the website" checked={on} onCheckedChange={setOn} />
          </div>
          <RadioGroup
            legend="Pricing model"
            value={radio}
            onValueChange={setRadio}
            options={[
              { value: 'fixed', label: 'Fixed price' },
              { value: 'hourly', label: 'Hourly' },
              { value: 'custom_quote', label: 'Custom quote', description: 'Price is set in each quotation.' },
            ]}
          />
          <FileUpload
            label="Receipt"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            maxBytes={10 * 1024 * 1024}
            onFile={(f) => toast.success(`Selected ${f.name}`)}
            progress={null}
          />
        </div>
      </Section>

      <Section title="Badges and status">
        <div className="flex flex-wrap gap-2">
          {['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void'].map((s) => (
            <StatusBadge key={s} entity="invoice" status={s} />
          ))}
          <Badge tone="brand">In Development</Badge>
          <Badge tone="warning">TEST PAYMENT</Badge>
        </div>
      </Section>

      <Section title="Cards and KPIs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile label="Revenue this month" value={formatMoney(425000, 'USD')} sub="USD, received" />
          <KpiTile label="Outstanding" value={formatMoney(312000, 'USD')} sub="USD, unpaid" />
          <KpiTile label="Overdue" value="2" sub={`${formatMoney(68000, 'USD')} overdue`} tone="danger" />
          <KpiTile label="Active projects" value="3" sub="In delivery" />
        </div>
        <Card className="mt-4">
          <CardHeader
            title="Recent activity"
            description="Audit feed"
            actions={
              <Button size="sm" variant="ghost">
                View all
              </Button>
            }
          />
          <div className="p-5">
            <Timeline
              items={[
                { id: 'a', title: 'Invoice INV-2026-00021 issued', meta: 'Today, 09:42', tone: 'info' },
                {
                  id: 'b',
                  title: 'Payment RCT-2026-00014 received',
                  meta: 'Today, 08:15',
                  tone: 'success',
                  body: 'EcoCash · $850.00',
                },
                {
                  id: 'c',
                  title: 'Payment attempt failed',
                  meta: 'Yesterday',
                  tone: 'danger',
                  body: 'Insufficient balance',
                },
              ]}
            />
          </div>
        </Card>
      </Section>

      <Section title="Data table">
        <FilterBar
          actions={
            <Select
              aria-label="Table state"
              value={tableState}
              onChange={(e) => setTableState(e.target.value as typeof tableState)}
              options={[
                { value: 'data', label: 'With data' },
                { value: 'loading', label: 'Loading' },
                { value: 'empty', label: 'Empty' },
                { value: 'error', label: 'Error' },
              ]}
            />
          }
        >
          <SearchInput value={q} onChange={setQ} placeholder="Search invoices" label="Search invoices" />
        </FilterBar>
        <DataTable
          caption="Invoices"
          columns={columns}
          rows={tableState === 'data' ? rows : []}
          rowKey={(r) => r.id}
          loading={tableState === 'loading'}
          error={tableState === 'error'}
          onRetry={() => setTableState('data')}
          sort={sort}
          onSortChange={setSort}
          page={page}
          pageSize={25}
          total={tableState === 'data' ? rows.length : 0}
          onPageChange={setPage}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          bulkActions={
            <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          }
          empty={{
            title: 'No invoices yet',
            description: 'Create your first invoice to bill a client.',
            action: <Button size="sm">New invoice</Button>,
          }}
        />
      </Section>

      <Section title="Tabs, dialogs and states">
        <Tabs
          label="Client sections"
          value={tab}
          onValueChange={setTab}
          tabs={[
            {
              value: 'overview',
              label: 'Overview',
              content: <p className="text-sm text-ink-800">Overview content.</p>,
            },
            {
              value: 'invoices',
              label: 'Invoices',
              content: <EmptyState title="No invoices" description="Invoices for this client appear here." />,
            },
            { value: 'activity', label: 'Activity', content: <ErrorState onRetry={() => toast.info('Retrying')} /> },
          ]}
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDialog(true)}>
            Open dialog
          </Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>
            Open drawer
          </Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Void invoice
          </Button>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="mt-6">
          <Breadcrumbs items={[{ label: 'Invoices', href: '/dev/ui' }, { label: 'INV-2026-00021' }]} />
        </div>
        <Dialog
          open={dialog}
          onOpenChange={setDialog}
          title="Record a payment"
          description="Bank transfer, cash or another manual method."
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialog(false)}>Record payment</Button>
            </>
          }
        >
          <Field label="Reference">
            <Input />
          </Field>
        </Dialog>
        <Drawer
          open={drawer}
          onOpenChange={setDrawer}
          title="Filters"
          footer={<Button onClick={() => setDrawer(false)}>Apply</Button>}
        >
          <Field label="Status">
            <Select options={[{ value: 'all', label: 'All statuses' }]} />
          </Field>
        </Drawer>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Void INV-2026-00021?"
          description="Voiding cannot be undone. The invoice stays on record with its number."
          confirmLabel="Void invoice"
          destructive
          confirmText="INV-2026-00021"
          onConfirm={() => toast.success('Invoice voided')}
        />
      </Section>
    </div>
  );
}

export default function KitchenSink() {
  return (
    <ToastProvider>
      <Inner />
    </ToastProvider>
  );
}
