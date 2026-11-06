/** Shared mapping helpers for the document builders: parties, line-item tables, HTML → text. */
import { formatBpAsPercent, formatMoney, formatQuantity } from '../../shared/money';
import { formatLongDate } from '../../shared/service-display';
import type { Column, Party } from './document';

export interface BusinessDetails {
  name: string;
  legalName?: string | null;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface ClientDetails {
  name: string;
  legalName?: string | null;
  number?: string | null;
  email?: string | null;
  phone?: string | null;
  taxNumber?: string | null;
  address?: string | null;
  contact?: { name: string; email: string | null } | null;
}

export interface LineItem {
  description: string;
  quantity_milli: number;
  unit_price_minor: number;
  tax_rate_bp: number;
  tax_inclusive?: number;
  is_recurring?: number;
  recurring_interval?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  line_discount_minor?: number;
  line_tax_minor: number;
  line_total_minor: number;
}

export interface DocumentSettings {
  accentColour: string | null;
  footerText: string | null;
  bankDetails: string | null;
}

export const date = (iso: string | null | undefined): string => (iso ? formatLongDate(iso) : '-');

export function businessBlock(b: BusinessDetails): { name: string; lines: string[] } {
  const lines: string[] = [];
  if (b.legalName && b.legalName !== b.name) lines.push(b.legalName);
  if (b.address) lines.push(b.address);
  const contact = [b.email, b.phone].filter(Boolean).join('  ·  ');
  if (contact) lines.push(contact);
  if (b.registrationNumber) lines.push(`Registration no. ${b.registrationNumber}`);
  if (b.taxNumber) lines.push(`Tax no. ${b.taxNumber}`);
  return { name: b.name || 'Kuzikode Technologies', lines };
}

export function clientParty(label: string, c: ClientDetails): Party {
  const lines: string[] = [];
  if (c.legalName && c.legalName !== c.name) lines.push(c.legalName);
  if (c.contact?.name) lines.push(`Attn: ${c.contact.name}`);
  if (c.address) lines.push(c.address);
  const email = c.contact?.email ?? c.email;
  if (email) lines.push(email);
  if (c.phone) lines.push(c.phone);
  if (c.taxNumber) lines.push(`Tax no. ${c.taxNumber}`);
  if (c.number) lines.push(`Client no. ${c.number}`);
  return { label, name: c.name || 'Client', lines };
}

/** Columns appear only when some line uses them (same rule as the on-screen document). */
export function lineItemsTable(items: LineItem[], currency: string, minorDigits: number) {
  const money = (m: number) => formatMoney(m, currency, minorDigits);
  const hasDiscount = items.some((i) => (i.line_discount_minor ?? 0) > 0);
  const hasTax = items.some((i) => i.line_tax_minor > 0 || i.tax_rate_bp > 0);
  const columns: Column[] = [
    { label: 'Description', width: hasDiscount && hasTax ? 38 : hasDiscount || hasTax ? 46 : 54 },
    { label: 'Qty', width: 9, align: 'right' },
    { label: 'Unit price', width: 15, align: 'right' },
    ...(hasDiscount ? [{ label: 'Discount', width: 13, align: 'right' as const }] : []),
    ...(hasTax ? [{ label: 'Tax', width: 12, align: 'right' as const }] : []),
    { label: 'Amount', width: 16, align: 'right' },
  ];
  const rows = items.map((i) => {
    let description = i.description;
    if (i.is_recurring === 1) description += `\nBilled ${i.recurring_interval === 'year' ? 'yearly' : 'monthly'}`;
    if (i.period_start && i.period_end) description += `\nPeriod: ${date(i.period_start)} to ${date(i.period_end)}`;
    return [
      description,
      formatQuantity(i.quantity_milli),
      money(i.unit_price_minor),
      ...(hasDiscount ? [i.line_discount_minor ? `-${money(i.line_discount_minor)}` : '-'] : []),
      ...(hasTax
        ? [i.tax_rate_bp ? `${formatBpAsPercent(i.tax_rate_bp)}${i.tax_inclusive ? ' incl.' : ''}` : '-']
        : []),
      money(i.line_total_minor),
    ];
  });
  return { caption: 'Items', columns, rows };
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Sanitised rich text (intro, notes) → plain text with paragraph breaks and bullets. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n• ')
    .replace(/<\/\s*(p|div|h[1-6]|ul|ol|blockquote)\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const cp = e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(cp) && cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : '';
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function humanize(value: string): string {
  const s = value.replace(/[_-]+/g, ' ').trim();
  return s ? s[0]!.toUpperCase() + s.slice(1) : s;
}
