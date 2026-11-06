import { formatMoney } from '../../shared/money';
import { formatLongDate } from '../../shared/service-display';
import {
  businessBlock,
  clientParty,
  humanize,
  type BusinessDetails,
  type ClientDetails,
  type DocumentSettings,
} from './common';
import type { DocumentModel, TotalRow } from './document';

export interface ReceiptPdfInput {
  payment: {
    receipt_number: string;
    amount_minor: number;
    currency: string;
    received_at: string;
    method: string;
    reference: string | null;
    provider_reference: string | null;
  };
  allocations: { invoiceNumber: string; amountMinor: number }[];
  client: ClientDetails;
  business: BusinessDetails;
  minorDigits: number;
  settings: DocumentSettings;
  /** True for a payment made through a provider account in test mode (docs/06 §6): always watermarked. */
  testPayment?: boolean;
}

const METHOD_LABEL: Record<string, string> = {
  ecocash: 'EcoCash',
  onemoney: 'OneMoney',
  innbucks: 'InnBucks',
  omari: "O'mari",
  card: 'Card',
  visa_mastercard: 'Visa / Mastercard',
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  zimswitch: 'ZimSwitch',
};

export function receiptModel(input: ReceiptPdfInput): DocumentModel {
  const p = input.payment;
  const money = (m: number) => formatMoney(m, p.currency, input.minorDigits);
  const allocated = input.allocations.reduce((s, a) => s + a.amountMinor, 0);
  const unallocated = p.amount_minor - allocated;
  const totals: TotalRow[] = [];
  if (input.allocations.length) totals.push({ label: 'Applied to invoices', value: money(allocated) });
  if (unallocated > 0) totals.push({ label: 'Held as account credit', value: money(unallocated) });
  totals.push({ label: `Amount received (${p.currency})`, value: money(p.amount_minor), strong: true });
  const reference = p.reference ?? p.provider_reference;
  return {
    kind: 'receipt',
    number: p.receipt_number,
    headline: 'Thank you for your payment.',
    meta: [
      { label: 'Date received', value: formatLongDate(p.received_at) },
      { label: 'Method', value: METHOD_LABEL[p.method] ?? humanize(p.method) },
      ...(reference ? [{ label: 'Reference', value: reference }] : []),
    ],
    business: businessBlock(input.business),
    parties: [clientParty('Received from', input.client)],
    table: input.allocations.length
      ? {
          caption: 'Applied to',
          columns: [
            { label: 'Invoice', width: 70 },
            { label: 'Amount applied', width: 30, align: 'right' },
          ],
          rows: input.allocations.map((a) => [a.invoiceNumber, money(a.amountMinor)]),
        }
      : null,
    totals,
    sections: [
      ...(unallocated > 0
        ? [
            {
              heading: 'Account credit',
              body: `${money(unallocated)} is held as credit on your account and will be applied to a future invoice.`,
            },
          ]
        : []),
      ...(input.testPayment
        ? [{ heading: 'Test payment', body: 'This payment was made in test mode. No real money was transferred.' }]
        : []),
    ],
    footer: input.settings.footerText,
  };
}
