import { formatMoney } from '../../shared/money';
import {
  businessBlock,
  clientParty,
  date,
  htmlToText,
  lineItemsTable,
  type BusinessDetails,
  type ClientDetails,
  type DocumentSettings,
  type LineItem,
} from './common';
import type { DocumentModel, TotalRow } from './document';

export interface InvoicePdfInput {
  invoice: {
    number: string | null;
    currency: string;
    issue_date: string | null;
    due_date: string | null;
    payment_terms_days: number | null;
    notes: string | null;
    terms: string | null;
    subtotal_minor: number;
    discount_minor: number;
    tax_minor: number;
    total_minor: number;
  };
  items: LineItem[];
  client: ClientDetails;
  business: BusinessDetails;
  minorDigits: number;
  settings: DocumentSettings;
  /** Public link where the client can view the invoice (and pay online when that is offered). */
  viewLink?: string | null;
  /** Source quotation number, printed as a reference. */
  quotationNumber?: string | null;
}

/**
 * The invoice as issued. Payments and credits recorded later are shown on the web page and on receipts and credit
 * notes, never by regenerating this file (issued documents are immutable).
 */
export function invoiceModel(input: InvoicePdfInput): DocumentModel {
  const inv = input.invoice;
  const money = (m: number) => formatMoney(m, inv.currency, input.minorDigits);
  const totals: TotalRow[] = [{ label: 'Subtotal', value: money(inv.subtotal_minor) }];
  if (inv.discount_minor > 0) totals.push({ label: 'Discount', value: `-${money(inv.discount_minor)}` });
  if (inv.tax_minor > 0) totals.push({ label: 'Tax', value: money(inv.tax_minor) });
  totals.push({ label: `Amount due (${inv.currency})`, value: money(inv.total_minor), strong: true });
  const ref = inv.number ? `Please quote ${inv.number} as the payment reference.` : '';
  const howToPay = [
    input.viewLink ? `View this invoice online: ${input.viewLink}` : '',
    input.settings.bankDetails ? `Bank transfer:\n${input.settings.bankDetails}` : '',
    ref,
  ]
    .filter(Boolean)
    .join('\n\n');
  return {
    kind: 'invoice',
    number: inv.number,
    meta: [
      { label: 'Issue date', value: date(inv.issue_date) },
      { label: 'Due date', value: date(inv.due_date) },
      ...(inv.payment_terms_days != null
        ? [
            {
              label: 'Terms',
              value: inv.payment_terms_days === 0 ? 'Due on receipt' : `${inv.payment_terms_days} days`,
            },
          ]
        : []),
      ...(input.quotationNumber ? [{ label: 'Quotation', value: input.quotationNumber }] : []),
    ],
    business: businessBlock(input.business),
    parties: [clientParty('Bill to', input.client)],
    table: lineItemsTable(input.items, inv.currency, input.minorDigits),
    totals,
    sections: [
      { heading: 'How to pay', body: howToPay },
      { heading: 'Notes', body: htmlToText(inv.notes) },
      { heading: 'Terms', body: htmlToText(inv.terms) },
    ],
    footer: input.settings.footerText,
  };
}
