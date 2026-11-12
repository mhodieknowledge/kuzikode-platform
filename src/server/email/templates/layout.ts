/** Branded, light-mode-safe email layout: table-based, inline styles, 600 px max, plain-text twin. */

export interface Brand {
  companyName: string;
  siteUrl: string;
  /** Optional postal address / contact line for the footer (blank values are omitted). */
  footerLine?: string;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const INK = '#141412';
const BODY = '#2C2A26';
const MUTED = '#57524A';
const LINE = '#DDD6CA';
const BRAND = '#1E7A52';
const CANVAS = '#F6F3EE';

export interface Block {
  kind: 'p' | 'button' | 'small' | 'kv' | 'h2' | 'note';
  text?: string;
  href?: string;
  rows?: [string, string][];
}

function renderBlock(b: Block): string {
  switch (b.kind) {
    case 'h2':
      return `<h2 style="margin:24px 0 8px;font-size:18px;line-height:1.3;color:${INK};font-weight:700">${escapeHtml(b.text)}</h2>`;
    case 'p':
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BODY}">${escapeHtml(b.text)}</p>`;
    case 'small':
      return `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:${MUTED}">${escapeHtml(b.text)}</p>`;
    case 'note':
      return `<p style="margin:0 0 16px;padding:12px 14px;background:${CANVAS};border:1px solid ${LINE};border-radius:6px;font-size:14px;line-height:1.5;color:${BODY}">${escapeHtml(b.text)}</p>`;
    case 'button':
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:${BRAND};border-radius:6px"><a href="${escapeHtml(b.href)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none">${escapeHtml(b.text)}</a></td></tr></table>`;
    case 'kv':
      return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;border-collapse:collapse">${(
        b.rows ?? []
      )
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${MUTED}">${escapeHtml(k)}</td><td align="right" style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${INK};font-weight:600">${escapeHtml(v)}</td></tr>`,
        )
        .join('')}</table>`;
  }
}

function renderTextBlock(b: Block): string {
  switch (b.kind) {
    case 'button':
      return `${b.text}: ${b.href}`;
    case 'kv':
      return (b.rows ?? []).map(([k, v]) => `${k}: ${v}`).join('\n');
    case 'h2':
      return `${b.text}\n${'-'.repeat(Math.min(40, (b.text ?? '').length))}`;
    default:
      return b.text ?? '';
  }
}

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

export function renderEmail(
  brand: Brand,
  opts: { subject: string; preheader: string; heading: string; blocks: Block[] },
): Rendered {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(opts.subject)}</title></head>
<body style="margin:0;padding:0;background:${CANVAS};font-family:Inter,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid ${LINE};border-radius:10px">
<tr><td style="padding:24px 32px;border-bottom:1px solid ${LINE}"><a href="${escapeHtml(brand.siteUrl)}" style="text-decoration:none;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${INK}"><span style="color:${BRAND}">&#9646;</span> kuzikode</a></td></tr>
<tr><td style="padding:28px 32px 12px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${INK};font-weight:700">${escapeHtml(opts.heading)}</h1>
${opts.blocks.map(renderBlock).join('\n')}
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid ${LINE};font-size:12px;line-height:1.5;color:${MUTED}">${escapeHtml(brand.companyName)}${brand.footerLine ? ` · ${escapeHtml(brand.footerLine)}` : ''}<br><a href="${escapeHtml(brand.siteUrl)}" style="color:${MUTED}">${escapeHtml(brand.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    opts.heading,
    '',
    ...opts.blocks
      .map(renderTextBlock)
      .filter(Boolean)
      .flatMap((t) => [t, '']),
    '—',
    brand.companyName,
    brand.siteUrl,
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  return { subject: opts.subject, html, text };
}
