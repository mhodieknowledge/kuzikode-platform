/**
 * Presentation helpers for Insights (R4.7). Pure functions: no data access.
 */

export type CoverMotif = 'pay' | 'web' | 'mail' | 'guide';

/** The cover drawing that fits a category (by slug keywords); `guide` when nothing matches. */
export function coverMotif(categorySlug: string | null | undefined): CoverMotif {
  const s = (categorySlug ?? '').toLowerCase();
  if (/pay|ecocash|checkout|money/.test(s)) return 'pay';
  if (/mail|domain/.test(s)) return 'mail';
  if (/web|site|app|software/.test(s)) return 'web';
  return 'guide';
}

/**
 * A stable accent (one of the six division hues, `kz-div-1`…`kz-div-6`) for a category, so a category keeps the same colour on
 * the index, the article and its cover: the category's position in the alphabetical list of category slugs (cycled after six).
 * Posts without a category (or an unknown one) use the neutral umber hue.
 */
export function categoryHue(categorySlug: string | null | undefined, allSlugs: readonly string[]): string {
  const i = categorySlug ? [...allSlugs].sort().indexOf(categorySlug) : -1;
  return i < 0 ? 'kz-div-3' : `kz-div-${(i % 6) + 1}`;
}

export interface TocEntry {
  id: string;
  text: string;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section';

/**
 * Adds ids to the attribute-less `<h2>` elements of sanitized article HTML and returns the "On this page" entries. Headings that
 * already carry attributes are left alone (and not listed). Ids are unique within the article and prefixed to avoid clashing
 * with page ids.
 */
export function withHeadingIds(html: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  const used = new Set<string>();
  const out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner: string) => {
    const text = decode(inner.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
    if (!text) return `<h2>${inner}</h2>`;
    const base = `s-${slugify(text)}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    toc.push({ id, text });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: out, toc };
}
