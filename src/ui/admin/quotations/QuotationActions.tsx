/**
 * Actions for one quotation (R6.2); which ones show is decided on the server page from status + permissions. The main
 * action (send, convert) is the filled plate; the rest are outlined. Forms open in sheets. Labels are the e2e contract.
 */
import { useState, type ReactNode } from 'react';
import { Button, LinkButton, TextareaField, TextField } from '../../primitives';
import { ConfirmSheet, Sheet } from '../../primitives/sheet';
import { FormAlert } from '../../auth/FormAlert';
import { CheckItem } from '../form';
import { useQuotationActions } from './useQuotations';

export interface QuotationCan {
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
}

type Dialog = null | 'send' | 'accept' | 'reject' | 'void' | 'delete';

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
  can: QuotationCan;
}) {
  const a = useQuotationActions(id);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [copied, setCopied] = useState(false);
  const [agree, setAgree] = useState(false);
  const label = number ?? 'this draft';
  const close = () => setDialog(null);
  const draft = status === 'draft';
  const formSheet = (
    key: Exclude<Dialog, null | 'delete'>,
    title: string,
    submitLabel: string,
    onSubmit: (f: FormData) => void,
    body: ReactNode,
    danger = false,
  ) => (
    <Sheet
      open={dialog === key}
      onClose={close}
      title={title}
      className="kz-adlg"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form={`q-${key}`} variant={danger ? 'danger' : 'primary'} loading={a.busy}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={`q-${key}`}
        noValidate
        className="kz-astack"
        onSubmit={(ev) => {
          ev.preventDefault();
          onSubmit(new FormData(ev.currentTarget));
        }}
      >
        {body}
        <FormAlert message={a.error} />
      </form>
    </Sheet>
  );
  return (
    <div className="kz-aacts">
      <div className="kz-ahead__acts">
        {can.send ? (
          <Button lead="send" onClick={() => setDialog('send')}>
            Send to client
          </Button>
        ) : null}
        {can.convert ? (
          <Button lead="invoices" loading={a.busy} onClick={() => void a.convert()}>
            Convert to invoice
          </Button>
        ) : null}
        {can.edit ? (
          <LinkButton variant="secondary" lead="edit" href={`/admin/quotations/${id}/edit`}>
            Edit
          </LinkButton>
        ) : null}
        {can.resend ? (
          <Button variant="secondary" lead="send" onClick={() => setDialog('send')}>
            Resend
          </Button>
        ) : null}
        {can.respond ? (
          <>
            <Button variant="secondary" lead="check" onClick={() => setDialog('accept')}>
              Mark accepted
            </Button>
            <Button variant="secondary" onClick={() => setDialog('reject')}>
              Mark rejected
            </Button>
          </>
        ) : null}
        {can.project ? (
          <Button variant="secondary" lead="projects" loading={a.busy} onClick={() => void a.project()}>
            Create project
          </Button>
        ) : null}
        {can.revise ? (
          <Button variant="secondary" loading={a.busy} onClick={() => void a.revise()}>
            Revise
          </Button>
        ) : null}
        {can.duplicate ? (
          <Button variant="secondary" lead="copy" loading={a.busy} onClick={() => void a.duplicate()}>
            Duplicate
          </Button>
        ) : null}
        <LinkButton
          variant="secondary"
          lead={draft ? 'view' : 'download'}
          href={`/api/v1/admin/documents/quotations/${id}/pdf${draft ? '?inline=1' : ''}`}
          {...(draft ? { target: '_blank', rel: 'noopener' } : { download: true })}
        >
          {draft ? 'Preview PDF' : 'Download PDF'}
        </LinkButton>
        {publicLink ? (
          <Button
            variant="secondary"
            lead={copied ? 'check' : 'copy'}
            onClick={() => {
              void navigator.clipboard?.writeText(publicLink).then(() => setCopied(true));
            }}
          >
            {copied ? 'Link copied' : 'Copy client link'}
          </Button>
        ) : null}
        {can.void ? (
          <Button variant="secondary" onClick={() => setDialog('void')}>
            Void
          </Button>
        ) : null}
        {can.delete ? (
          <Button variant="secondary" lead="delete" onClick={() => setDialog('delete')}>
            Delete draft
          </Button>
        ) : null}
      </div>
      {dialog ? null : <FormAlert message={a.error} />}

      {formSheet(
        'send',
        draft ? 'Send quotation' : `Resend ${label}`,
        draft ? 'Send quotation' : 'Resend',
        (f) => void a.send(f.get('message')),
        <>
          <p className="kz-adlg__desc">
            {draft
              ? 'Sending gives the quotation its number and emails the client a link to view, accept or decline it. After sending, changes need a new version.'
              : 'The client receives the same link again.'}
          </p>
          <TextareaField
            label="Personal message"
            hint="Optional. Shown at the top of the email."
            name="message"
            rows={3}
            maxLength={2000}
            error={a.err('message')}
          />
        </>,
      )}
      {formSheet(
        'accept',
        `Record acceptance of ${label}`,
        'Record acceptance',
        (f) => void a.accept(f.get('name'), agree),
        <>
          <p className="kz-adlg__desc">
            Use this when the client accepted by phone, email or in person. It is recorded in the audit log.
          </p>
          <TextField
            label="Accepted by (client's name)"
            name="name"
            maxLength={120}
            autoComplete="off"
            error={a.err('name')}
          />
          <CheckItem checked={agree} onChange={(e) => setAgree(e.target.checked)}>
            The client confirmed they accept this quotation
          </CheckItem>
          {a.err('agree') ? <p className="kz-error">{a.err('agree')}</p> : null}
        </>,
      )}
      {formSheet(
        'reject',
        `Record rejection of ${label}`,
        'Record rejection',
        (f) => void a.reject(f.get('reason')),
        <TextareaField
          label="Reason"
          hint="Optional."
          name="reason"
          rows={3}
          maxLength={1000}
          error={a.err('reason')}
        />,
      )}
      {formSheet(
        'void',
        `Void ${label}?`,
        'Void quotation',
        (f) => void a.voidIt(f.get('reason')),
        <>
          <p className="kz-adlg__desc">A void quotation stays on record but can no longer be accepted.</p>
          <TextareaField label="Reason" name="reason" rows={2} maxLength={500} error={a.err('reason')} />
        </>,
        true,
      )}
      <ConfirmSheet
        open={dialog === 'delete'}
        onClose={close}
        title="Delete this draft?"
        confirmLabel="Delete draft"
        danger
        onConfirm={() => a.remove()}
      >
        Drafts were never sent, so nothing is lost on the client&apos;s side. This can&apos;t be undone.
      </ConfirmSheet>
    </div>
  );
}
