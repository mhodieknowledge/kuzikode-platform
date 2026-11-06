/** Quotation islands (P4.7): the editor and the actions on a quotation. The server validates and authorises all. */
import { useState, type FormEvent } from 'react';
import type { DiscountType } from '../../shared/pricing';
import { formatMoney, minorToDecimalString } from '../../shared/money';
import {
  apiFetch,
  Button,
  Checkbox,
  ConfirmDialog,
  DateInput,
  Dialog,
  Field,
  Input,
  RichTextEditor,
  Select,
  Textarea,
} from '../ui';
import {
  LineItemEditor,
  newLine,
  toApiDiscount,
  toApiLines,
  type CatalogueOption,
  type EditorLine,
  type TaxOption,
} from './LineItemEditor';
import { Alert, useAction } from './actions';

interface PickerPackage {
  id: string;
  name: string;
  serviceName: string;
  priceMinor: number;
  currency: string;
  altPriceZwgMinor: number | null;
  billingType: 'one_off' | 'recurring';
  interval: 'month' | 'year' | null;
  minQuantity: number;
  addons: { id: string; name: string; priceMinor: number; currency: string; unit: string }[];
}
interface ApiLine {
  serviceId: string | null;
  packageId: string | null;
  description: string;
  quantity: string;
  unitPriceMinor: number;
  isRecurring: boolean;
  recurringInterval: 'month' | 'year' | null;
}

/**
 * "Add package": inserts a package (with what's included in the description) and chosen add-ons as ordinary lines.
 * Prices come from the server at this moment and are copied, so later catalogue changes never alter this quotation.
 */
function AddPackageDialog({ currency, onAdd }: { currency: string; onAdd: (lines: EditorLine[]) => void }) {
  const a = useAction();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<PickerPackage[] | null>(null);
  const [pkgId, setPkgId] = useState('');
  const [addons, setAddons] = useState<Record<string, number>>({});
  const pkg = list?.find((p) => p.id === pkgId);
  const load = () =>
    a.run(async () => {
      if (list) return;
      const res = await apiFetch<{ data: PickerPackage[] }>('/api/v1/admin/packages/picker');
      setList(res.data);
    });
  const price = (p: PickerPackage) =>
    p.currency === currency
      ? formatMoney(p.priceMinor, p.currency)
      : currency === 'ZWG' && p.altPriceZwgMinor != null
        ? formatMoney(p.altPriceZwgMinor, 'ZWG')
        : `${formatMoney(p.priceMinor, p.currency)} (no ${currency} price)`;
  const add = () =>
    a.run(async () => {
      if (!pkg) return;
      const res = await apiFetch<{ data: ApiLine[] }>(`/api/v1/admin/packages/${pkg.id}/quote-lines`, {
        body: { currency, addons: Object.entries(addons).map(([id, quantity]) => ({ id, quantity })) },
      });
      onAdd(
        res.data.map((l) =>
          newLine({
            serviceId: l.serviceId,
            packageId: l.packageId,
            description: l.description,
            quantity: l.quantity,
            unitPriceMinor: l.unitPriceMinor,
            isRecurring: l.isRecurring,
            recurringInterval: l.recurringInterval,
          }),
        ),
      );
      setOpen(false);
      setPkgId('');
      setAddons({});
    });
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        Add package
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Add a package"
        description={`Adds the package and any add-ons as lines in ${currency}, priced as of now.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button loading={a.busy} disabled={!pkg} onClick={() => void add()}>
              Add to quotation
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Alert message={a.error} />
          {list === null ? (
            <p className="text-sm text-ink-600">Loading packages…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-ink-600">
              There are no active priced packages. Add them under Website → Packages.
            </p>
          ) : (
            <Field label="Package" required error={a.errors['packageId'] ?? a.errors['currency']}>
              <Select
                value={pkgId}
                onChange={(e) => {
                  setPkgId(e.target.value);
                  setAddons({});
                }}
                placeholder="Choose a package"
                options={list.map((p) => ({ value: p.id, label: `${p.serviceName} · ${p.name} · ${price(p)}` }))}
              />
            </Field>
          )}
          {pkg && pkg.addons.length > 0 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold text-ink-950">Add-ons</legend>
              {a.errors['addons'] ? (
                <p className="text-[13px] text-danger-700">{a.errors['addons'].join(' ')}</p>
              ) : null}
              {pkg.addons.map((x) => {
                const on = addons[x.id] !== undefined;
                return (
                  <div key={x.id} className="flex flex-wrap items-center justify-between gap-3">
                    <Checkbox
                      label={`${x.name} · ${formatMoney(x.priceMinor, x.currency)}${x.unit === 'each' ? '' : ` per ${x.unit}`}`}
                      checked={on}
                      onCheckedChange={(c) =>
                        setAddons((m) => {
                          const next = { ...m };
                          if (c) next[x.id] = 1;
                          else delete next[x.id];
                          return next;
                        })
                      }
                    />
                    {on ? (
                      <div className="flex items-center gap-2 text-[13px] text-ink-800">
                        <span aria-hidden="true">Quantity</span>
                        <Input
                          aria-label={`Quantity of ${x.name}`}
                          type="number"
                          min={1}
                          className="w-20"
                          value={addons[x.id]}
                          onChange={(e) =>
                            setAddons((m) => ({ ...m, [x.id]: Math.max(1, Math.floor(Number(e.target.value)) || 1) }))
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </fieldset>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

export interface QuotationEditorProps {
  id?: string;
  initial: {
    clientId: string;
    contactId: string | null;
    leadId: string | null;
    enquiryId: string | null;
    title: string;
    introHtml: string;
    currency: string;
    validUntil: string | null;
    paymentTerms: string | null;
    notes: string | null;
    terms: string | null;
    discountType: DiscountType;
    discountValue: number;
    lines: EditorLine[];
  };
  clients: { id: string; name: string; number: string; currency: string }[];
  contacts: { id: string; client_id: string; name: string; email: string | null }[];
  currencies: { code: string; minor_digits: number }[];
  taxRates: TaxOption[];
  catalogue: CatalogueOption[];
}

export function QuotationEditor({
  id,
  initial,
  clients,
  contacts,
  currencies,
  taxRates,
  catalogue,
}: QuotationEditorProps) {
  const a = useAction();
  const [clientId, setClientId] = useState(initial.clientId);
  const [contactId, setContactId] = useState(initial.contactId ?? '');
  const [currency, setCurrency] = useState(initial.currency);
  const [intro, setIntro] = useState(initial.introHtml);
  const [lines, setLines] = useState<EditorLine[]>(initial.lines.length ? initial.lines : [newLine()]);
  const [docDiscount, setDocDiscount] = useState({
    type: initial.discountType,
    percent:
      initial.discountType === 'percent' ? minorToDecimalString(initial.discountValue, 2).replace(/\.?0+$/, '') : '',
    amountMinor: initial.discountType === 'amount' ? initial.discountValue : null,
  });
  const minorDigits = currencies.find((c) => c.code === currency)?.minor_digits ?? 2;
  const clientContacts = contacts.filter((c) => c.client_id === clientId);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      clientId,
      contactId: contactId || null,
      leadId: initial.leadId,
      enquiryId: initial.enquiryId,
      title: f.get('title'),
      introHtml: intro,
      currency,
      validUntil: f.get('validUntil') || null,
      paymentTerms: f.get('paymentTerms'),
      notes: f.get('notes'),
      terms: f.get('terms'),
      ...toApiDiscount(docDiscount),
      items: toApiLines(lines),
    };
    await a.run(async () => {
      if (id) {
        await apiFetch(`/api/v1/admin/quotations/${id}`, { method: 'PUT', body });
        window.location.assign(`/admin/quotations/${id}`);
      } else {
        const res = await apiFetch<{ data: { id: string } }>('/api/v1/admin/quotations', { body });
        window.location.assign(`/admin/quotations/${res.data.id}`);
      }
    });
  }
  const e = a.errors;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <Alert message={a.error} />
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="q-details">
        <h2 id="q-details" className="font-sans text-base font-semibold">
          Details
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Client" required error={e['clientId']}>
            <Select
              value={clientId}
              onChange={(ev) => {
                setClientId(ev.target.value);
                setContactId('');
                const c = clients.find((x) => x.id === ev.target.value);
                if (c && !lines.some((l) => l.unitPriceMinor)) setCurrency(c.currency);
              }}
              placeholder="Choose a client"
              options={clients.map((c) => ({ value: c.id, label: `${c.name} (${c.number})` }))}
            />
          </Field>
          <Field label="Send to" hint="Defaults to the client's main contact." error={e['contactId']}>
            <Select
              value={contactId}
              onChange={(ev) => setContactId(ev.target.value)}
              options={[
                { value: '', label: 'Main contact' },
                ...clientContacts.map((c) => ({ value: c.id, label: `${c.name}${c.email ? ` (${c.email})` : ''}` })),
              ]}
            />
          </Field>
          <Field label="Title" required error={e['title']} className="sm:col-span-2">
            <Input name="title" defaultValue={initial.title} maxLength={200} placeholder="e.g. New company website" />
          </Field>
          <Field label="Currency" required error={e['currency']}>
            <Select
              value={currency}
              onChange={(ev) => setCurrency(ev.target.value)}
              options={currencies.map((c) => ({ value: c.code, label: c.code }))}
            />
          </Field>
          <Field label="Valid until" hint="Leave empty to use the default validity when sent." error={e['validUntil']}>
            <DateInput name="validUntil" defaultValue={initial.validUntil ?? ''} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Introduction" hint="Optional. Use it for a proposal-style quotation." error={e['introHtml']}>
            <RichTextEditor label="Introduction" value={intro} onChange={setIntro} minHeight={120} />
          </Field>
        </div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="q-lines">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="q-lines" className="font-sans text-base font-semibold">
            Lines
          </h2>
          <AddPackageDialog
            currency={currency}
            onAdd={(added) =>
              setLines((cur) => [
                ...cur.filter((l) => l.description.trim() !== '' || l.unitPriceMinor !== null),
                ...added,
              ])
            }
          />
        </div>
        <LineItemEditor
          lines={lines}
          onChange={setLines}
          currency={currency}
          minorDigits={minorDigits}
          taxRates={taxRates}
          catalogue={catalogue}
          docDiscount={docDiscount}
          onDocDiscount={setDocDiscount}
          errors={e}
        />
      </section>
      <section className="rounded-lg border border-line bg-surface p-6" aria-labelledby="q-terms">
        <h2 id="q-terms" className="font-sans text-base font-semibold">
          Terms and notes
        </h2>
        <div className="mt-4 grid gap-4">
          <Field label="Payment terms" hint="e.g. 50% deposit, balance on completion." error={e['paymentTerms']}>
            <Input name="paymentTerms" defaultValue={initial.paymentTerms ?? ''} maxLength={500} />
          </Field>
          <Field label="Notes to the client" error={e['notes']}>
            <Textarea name="notes" rows={3} defaultValue={initial.notes ?? ''} maxLength={5000} />
          </Field>
          <Field label="Terms and conditions" error={e['terms']}>
            <Textarea name="terms" rows={4} defaultValue={initial.terms ?? ''} maxLength={5000} />
          </Field>
        </div>
      </section>
      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={a.busy}>
          {id ? 'Save draft' : 'Create draft'}
        </Button>
        <a
          href={id ? `/admin/quotations/${id}` : '/admin/quotations'}
          className="inline-flex h-12 items-center px-4 text-[15px] font-semibold text-ink-800"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

/** Actions for one quotation; which buttons show is decided on the server page from status + permissions. */
export function QuotationActions({
  id,
  number,
  status,
  publicLink,
  can,
}: {
  id: string;
  number: string | null;
  status: string;
  publicLink: string | null;
  can: {
    edit: boolean;
    send: boolean;
    resend: boolean;
    revise: boolean;
    duplicate: boolean;
    respond: boolean;
    void: boolean;
    convert: boolean;
    delete: boolean;
    project: boolean;
  };
}) {
  const a = useAction();
  const [dialog, setDialog] = useState<null | 'send' | 'accept' | 'reject' | 'void' | 'delete'>(null);
  const [copied, setCopied] = useState(false);
  const [agree, setAgree] = useState(false);
  const label = number ?? 'this draft';
  const post = (path: string, body: Record<string, unknown>, then: (data: { id: string }) => void) =>
    a.run(async () => {
      const res = await apiFetch<{ data: { id: string } }>(`/api/v1/admin/quotations/${id}${path}`, { body });
      then(res.data);
    });
  const reload = () => window.location.reload();
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {can.edit ? (
          <a
            href={`/admin/quotations/${id}/edit`}
            className="inline-flex h-10 items-center rounded-sm border border-line bg-surface px-4 text-sm font-semibold text-ink-950 hover:border-ink-400"
          >
            Edit
          </a>
        ) : null}
        {can.send ? <Button onClick={() => setDialog('send')}>Send to client</Button> : null}
        {can.resend ? (
          <Button variant="secondary" onClick={() => setDialog('send')}>
            Resend
          </Button>
        ) : null}
        {can.respond ? (
          <>
            <Button variant="secondary" onClick={() => setDialog('accept')}>
              Mark accepted
            </Button>
            <Button variant="secondary" onClick={() => setDialog('reject')}>
              Mark rejected
            </Button>
          </>
        ) : null}
        {can.convert ? (
          <Button loading={a.busy} onClick={() => post('/convert', {}, () => reload())}>
            Convert to invoice
          </Button>
        ) : null}
        {can.project ? (
          <Button
            variant="secondary"
            loading={a.busy}
            onClick={() =>
              a.run(async () => {
                const res = await apiFetch<{ data: { projectId: string } }>(
                  `/api/v1/admin/projects/from-quotation/${id}`,
                  { body: {} },
                );
                window.location.assign(`/admin/projects/${res.data.projectId}`);
              })
            }
          >
            Create project
          </Button>
        ) : null}
        {can.revise ? (
          <Button
            variant="secondary"
            loading={a.busy}
            onClick={() => post('/revise', {}, (d) => window.location.assign(`/admin/quotations/${d.id}/edit`))}
          >
            Revise
          </Button>
        ) : null}
        {can.duplicate ? (
          <Button
            variant="ghost"
            loading={a.busy}
            onClick={() => post('/duplicate', {}, (d) => window.location.assign(`/admin/quotations/${d.id}/edit`))}
          >
            Duplicate
          </Button>
        ) : null}
        <a
          href={`/api/v1/admin/documents/quotations/${id}/pdf${status === 'draft' ? '?inline=1' : ''}`}
          {...(status === 'draft' ? { target: '_blank', rel: 'noopener' } : { download: true })}
          className="inline-flex h-10 items-center rounded-sm border border-line bg-surface px-4 text-sm font-semibold text-ink-950 hover:border-ink-400"
        >
          {status === 'draft' ? 'Preview PDF' : 'Download PDF'}
        </a>
        {publicLink ? (
          <Button
            variant="ghost"
            onClick={() => {
              void navigator.clipboard?.writeText(publicLink).then(() => setCopied(true));
            }}
          >
            {copied ? 'Link copied' : 'Copy client link'}
          </Button>
        ) : null}
        {can.void ? (
          <Button variant="ghost" onClick={() => setDialog('void')}>
            Void
          </Button>
        ) : null}
        {can.delete ? (
          <Button variant="ghost" onClick={() => setDialog('delete')}>
            Delete draft
          </Button>
        ) : null}
      </div>
      <Alert message={a.error} />

      <Dialog
        open={dialog === 'send'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={status === 'draft' ? 'Send quotation' : `Resend ${label}`}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void post('/send', { message: f.get('message') }, () => reload());
          }}
        >
          <p className="text-sm text-ink-800">
            {status === 'draft'
              ? 'Sending gives the quotation its number and emails the client a link to view, accept or decline it. After sending, changes need a new version.'
              : 'The client receives the same link again.'}
          </p>
          <Field label="Personal message" hint="Optional. Shown at the top of the email." error={a.errors['message']}>
            <Textarea name="message" rows={3} maxLength={2000} />
          </Field>
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              {status === 'draft' ? 'Send quotation' : 'Resend'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === 'accept'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Record acceptance of ${label}`}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void post('/response', { decision: 'accept', name: f.get('name'), agree }, () => reload());
          }}
        >
          <p className="text-sm text-ink-800">
            Use this when the client accepted by phone, email or in person. It is recorded in the audit log.
          </p>
          <Field label="Accepted by (client's name)" required error={a.errors['name']}>
            <Input name="name" maxLength={120} autoComplete="off" />
          </Field>
          <Checkbox
            label="The client confirmed they accept this quotation"
            checked={agree}
            onCheckedChange={setAgree}
          />
          {a.errors['agree'] ? <p className="text-[13px] text-danger-600">{a.errors['agree'][0]}</p> : null}
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              Record acceptance
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === 'reject'}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Record rejection of ${label}`}
      >
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void post('/response', { decision: 'reject', reason: f.get('reason') }, () => reload());
          }}
        >
          <Field label="Reason" hint="Optional." error={a.errors['reason']}>
            <Textarea name="reason" rows={3} maxLength={1000} />
          </Field>
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={a.busy}>
              Record rejection
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={dialog === 'void'} onOpenChange={(o) => !o && setDialog(null)} title={`Void ${label}?`}>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            void post('/void', { reason: f.get('reason') }, () => reload());
          }}
        >
          <p className="text-sm text-ink-800">A void quotation stays on record but can no longer be accepted.</p>
          <Field label="Reason" required error={a.errors['reason']}>
            <Textarea name="reason" rows={2} maxLength={500} />
          </Field>
          <Alert message={a.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={a.busy}>
              Void quotation
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Delete this draft?"
        description="Drafts were never sent, so nothing is lost on the client's side. This can't be undone."
        confirmLabel="Delete draft"
        destructive
        onConfirm={() =>
          a.run(async () => {
            await apiFetch(`/api/v1/admin/quotations/${id}`, { method: 'DELETE' });
            window.location.assign('/admin/quotations');
          })
        }
      />
    </div>
  );
}
