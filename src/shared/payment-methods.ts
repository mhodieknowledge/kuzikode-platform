/** Client-facing names for payment methods (manual and online), shared by the portal and documents. */
const LABELS: Record<string, string> = {
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  ecocash: 'EcoCash',
  onemoney: 'OneMoney',
  innbucks: 'InnBucks',
  omari: "O'mari",
  vmc: 'Visa / Mastercard',
  zimswitch: 'ZimSwitch',
  card: 'Card',
  mock: 'Test payment',
  other: 'Other',
};

export function paymentMethodLabel(code: string | null | undefined): string {
  if (!code) return 'Online payment';
  return LABELS[code] ?? code.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
