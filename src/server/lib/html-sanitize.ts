/**
 * Allow-list HTML sanitizer for CMS rich text (docs/07 §7). Runs on Workers (ultrahtml parser, no DOM).
 * Applied on write AND on render. Unknown elements are unwrapped (text kept); dangerous ones are dropped with
 * their content; only listed attributes survive; links must be http(s), mailto, tel or site-relative.
 */
import { COMMENT_NODE, DOCTYPE_NODE, ELEMENT_NODE, parse, TEXT_NODE } from 'ultrahtml';

const ALLOWED = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
  'code',
  'pre',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'figure',
  'figcaption',
  'img',
]);
const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'template',
  'noscript',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'link',
  'meta',
  'base',
  'frame',
  'frameset',
  'title',
  'head',
]);
const VOID = new Set(['br', 'hr', 'img']);
const ATTRS: Record<string, string[]> = {
  a: ['href', 'title'],
  img: ['src', 'alt', 'width', 'height'],
  th: ['scope', 'colspan', 'rowspan'],
  td: ['colspan', 'rowspan'],
  ol: ['start'],
};

interface HNode {
  type: number;
  name?: string;
  value?: string;
  attributes?: Record<string, string>;
  children?: HNode[];
}

const escapeAttr = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (v: string) =>
  v
    .replace(/&(?![a-zA-Z][a-zA-Z0-9]{1,31};|#\d{1,7};|#x[0-9a-fA-F]{1,6};)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Decodes entities and strips control/whitespace characters so `java&#x09;script:` can't slip through. */
function normalizeUrl(raw: string): string {
  const decoded = raw
    .replace(/&#x([0-9a-f]+);?/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;|&newline;/gi, '');
  // eslint-disable-next-line no-control-regex
  return decoded.replace(/[\u0000- \u007f-\u009f]/g, '');
}

export function safeUrl(raw: string, kind: 'href' | 'src'): string | null {
  const u = normalizeUrl(raw);
  if (!u) return null;
  if (u.startsWith('/') && !u.startsWith('//')) return raw.trim();
  if (u.startsWith('#')) return raw.trim();
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u)?.[1]?.toLowerCase();
  if (!scheme) return kind === 'href' && !u.includes(':') ? raw.trim() : null;
  const allowed = kind === 'href' ? ['http', 'https', 'mailto', 'tel'] : ['https'];
  return allowed.includes(scheme) ? raw.trim() : null;
}

function renderNode(node: HNode): string {
  if (node.type === TEXT_NODE) return escapeText(node.value ?? '');
  if (node.type === COMMENT_NODE || node.type === DOCTYPE_NODE) return '';
  const children = () => (node.children ?? []).map(renderNode).join('');
  if (node.type !== ELEMENT_NODE) return children();
  const name = (node.name ?? '').toLowerCase();
  if (DROP_WITH_CONTENT.has(name)) return '';
  if (!ALLOWED.has(name)) return children();
  const attrs: string[] = [];
  for (const [key, value] of Object.entries(node.attributes ?? {})) {
    const k = key.toLowerCase();
    if (!(ATTRS[name] ?? []).includes(k)) continue;
    let v = String(value);
    if (k === 'href' || k === 'src') {
      const safe = safeUrl(v, k);
      if (safe === null) continue;
      v = safe;
    }
    if (['width', 'height', 'colspan', 'rowspan', 'start'].includes(k) && !/^\d{1,4}$/.test(v)) continue;
    if (k === 'scope' && !['col', 'row', 'colgroup', 'rowgroup'].includes(v)) continue;
    attrs.push(`${k}="${escapeAttr(v)}"`);
  }
  if (name === 'a' && attrs.some((a) => /^href="https?:/i.test(a))) attrs.push('rel="noopener noreferrer nofollow"');
  if (name === 'img') {
    if (!attrs.some((a) => a.startsWith('src='))) return '';
    if (!attrs.some((a) => a.startsWith('alt='))) attrs.push('alt=""');
    attrs.push('loading="lazy"');
  }
  const open = `<${name}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
  return VOID.has(name) ? open : `${open}${children()}</${name}>`;
}

export function sanitizeHtml(html: string | null | undefined, maxLength = 200_000): string {
  if (!html) return '';
  const doc = parse(html.slice(0, maxLength)) as HNode;
  return (doc.children ?? []).map(renderNode).join('').trim();
}

/** Plain text from HTML (for excerpts, meta descriptions, reading time). */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  const BLOCK = new Set(['p', 'li', 'h2', 'h3', 'h4', 'br', 'blockquote', 'td', 'th', 'pre']);
  const walk = (n: HNode): string => {
    if (n.type === TEXT_NODE) return n.value ?? '';
    const name = (n.name ?? '').toLowerCase();
    if (DROP_WITH_CONTENT.has(name)) return '';
    const inner = (n.children ?? []).map(walk).join('');
    return BLOCK.has(name) ? ` ${inner} ` : inner;
  };
  return walk(parse(html) as HNode)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
