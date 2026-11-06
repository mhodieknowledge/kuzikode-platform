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

export interface QuotationPdfInput {
  quotation: {
    number: string | null;
    title: string;
    intro_html: string | null;
    currency: string;
    issue_date: string | null;
    valid_until: string | null;
    payment_terms: string | null;
    notes: string | null;
    terms: string | null;
    version: number;
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
}

export function quotationModel(input: QuotationPdfInput): DocumentModel {
  const q = input.quotation;
  const money = (m: number) => formatMoney(m, q.currency, input.minorDigits);
  const totals: TotalRow[] = [{ label: 'Subtotal', value: money(q.subtotal_minor) }];
  if (q.discount_minor > 0) totals.push({ label: 'Discount', value: `-${money(q.discount_minor)}` });
  if (q.tax_minor > 0) totals.push({ label: 'Tax', value: money(q.tax_minor) });
  totals.push({ label: `Total (${q.currency})`, value: money(q.total_minor), strong: true });
  const recurring = input.items.some((i) => i.is_recurring === 1);
  return {
    kind: 'quotation',
    number: q.number,
    headline: q.title,
    meta: [
      { label: 'Date', value: date(q.issue_date) },
      { label: 'Valid until', value: q.valid_until ? date(q.valid_until) : 'Set when sent' },
      ...(q.version > 1 ? [{ label: 'Version', value: String(q.version) }] : []),
    ],
    business: businessBlock(input.business),
    parties: [clientParty('Prepared for', input.client)],
    intro: htmlToText(q.intro_html),
    table: lineItemsTable(input.items, q.currency, input.minorDigits),
    totals,
    sections: [
      ...(recurring
        ? [
            {
              heading: 'Recurring charges',
              body: 'Lines marked as billed monthly or yearly are invoiced again each period after acceptance.',
            },
          ]
        : []),
      { heading: 'Payment terms', body: q.payment_terms ?? '' },
      { heading: 'Notes', body: htmlToText(q.notes) },
      { heading: 'Terms', body: htmlToText(q.terms) },
      {
        heading: 'Accepting this quotation',
        body: 'Reply to the email this quotation came with, or use the link in it to accept or decline online.',
      },
    ],
    footer: input.settings.footerText,
  };
}
