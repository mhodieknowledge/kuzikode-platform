import { formatMoney } from '../../shared/money';
import { formatLongDate } from '../../shared/service-display';
import {
  businessBlock,
  clientParty,
  lineItemsTable,
  type BusinessDetails,
  type ClientDetails,
  type DocumentSettings,
  type LineItem,
} from './common';
import type { DocumentModel } from './document';

export interface CreditNotePdfInput {
  creditNote: {
    number: string;
    currency: string;
    reason: string;
    subtotal_minor: number;
    tax_minor: number;
    total_minor: number;
    applied_to: 'invoice' | 'client_credit' | 'refund';
    issued_at: string;
  };
  invoiceNumber: string;
  items: LineItem[];
  client: ClientDetails;
  business: BusinessDetails;
  minorDigits: number;
  settings: DocumentSettings;
}

const APPLIED: Record<CreditNotePdfInput['creditNote']['applied_to'], string> = {
  invoice: 'Deducted from the balance of invoice',
  client_credit: 'Held as credit on your account (from invoice',
  refund: 'Refunded to you (against invoice',
};

export function creditNoteModel(input: CreditNotePdfInput): DocumentModel {
  const cn = input.creditNote;
  const money = (m: number) => formatMoney(m, cn.currency, input.minorDigits);
  const applied =
    cn.applied_to === 'invoice'
      ? `${APPLIED.invoice} ${input.invoiceNumber}.`
      : `${APPLIED[cn.applied_to]} ${input.invoiceNumber}).`;
  return {
    kind: 'credit_note',
    number: cn.number,
    meta: [
      { label: 'Date', value: formatLongDate(cn.issued_at) },
      { label: 'Invoice', value: input.invoiceNumber },
    ],
    business: businessBlock(input.business),
    parties: [clientParty('Issued to', input.client)],
    table: lineItemsTable(input.items, cn.currency, input.minorDigits),
    totals: [
      { label: 'Subtotal', value: money(cn.subtotal_minor) },
      ...(cn.tax_minor > 0 ? [{ label: 'Tax', value: money(cn.tax_minor) }] : []),
      { label: `Total credit (${cn.currency})`, value: money(cn.total_minor), strong: true },
    ],
    sections: [
      { heading: 'Reason', body: cn.reason },
      { heading: 'How this credit is applied', body: applied },
    ],
    footer: input.settings.footerText,
  };
}
