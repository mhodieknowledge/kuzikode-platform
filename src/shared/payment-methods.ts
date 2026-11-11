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

/**
 * A Zimbabwean mobile number in the local form gateways expect (`07XXXXXXXX`), from `0771 234 567`, `+263 77 123 4567`
 * or `263771234567`. Null when it isn't one.
 */
export function normalizeZimPhone(input: string): string | null {
  const digits = input.replace(/[\s().-]/g, '').replace(/^\+/, '');
  const local = digits.startsWith('263') ? `0${digits.slice(3)}` : digits;
  return /^07\d{8}$/.test(local) ? local : null;
}

/**
 * App link that opens a wallet with an authorization code already filled in (docs/06 §3b: InnBucks
 * `com.innbucks.customer://purchase?paymentToken=<code>`). Keyed by payment METHOD, not gateway; null when the method
 * has no such link.
 */
export function walletDeepLink(methodCode: string | null | undefined, code: string): string | null {
  if (methodCode === 'innbucks' && /^[A-Za-z0-9-]{1,64}$/.test(code))
    return `com.innbucks.customer://purchase?paymentToken=${encodeURIComponent(code)}`;
  return null;
}
