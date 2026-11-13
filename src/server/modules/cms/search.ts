/**
 * Site search (docs/12 §C.15) over services, packages, industries, insights, FAQ and portfolio.
 * The public catalogue is small and already cached per content_version, so we search the cached lists in memory
 * instead of maintaining an FTS index (DECISIONS.md). Query length and term count are capped.
 */
import type { RequestContext } from '../../context';
import { listAllFaqs } from './content';
import { listIndustries } from './industries';
import { listPosts } from './insights';
import { getPricingCatalogue } from './packages';
import { getServiceCatalogue, listPortfolio } from './service';

export type SearchKind = 'service' | 'package' | 'industry' | 'insight' | 'faq' | 'work' | 'page';
export const SEARCH_KIND_LABEL: Record<SearchKind, string> = {
  service: 'Service',
  package: 'Package',
  industry: 'Industry',
  insight: 'Insight',
  faq: 'FAQ',
  work: 'Our work',
  page: 'Page',
};

export interface SearchResult {
  kind: SearchKind;
  title: string;
  summary: string;
  href: string;
}

interface Doc extends SearchResult {
  body: string;
}

export const MAX_QUERY_LENGTH = 100;
const MAX_TERMS = 8;
const MAX_RESULTS = 40;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9@.+#]+/g, ' ')
    .trim();

export function searchTerms(q: string): string[] {
  return [...new Set(norm(q.slice(0, MAX_QUERY_LENGTH)).split(' '))].filter((t) => t.length >= 2).slice(0, MAX_TERMS);
}

const STATIC_PAGES: Doc[] = [
  {
    kind: 'page',
    title: 'How we work',
    summary: 'Our process, engagement models and quality practices.',
    href: '/how-we-work',
    body: 'process discover design build launch support retainer time materials fixed price quality security',
  },
  {
    kind: 'page',
    title: 'Pricing',
    summary: 'Website packages, add-ons and published prices for every service.',
    href: '/pricing',
    body: 'prices packages plans cost quote vat',
  },
  {
    kind: 'page',
    title: 'Contact',
    summary: 'Send us a message or request a quotation.',
    href: '/contact',
    body: 'email phone whatsapp message enquiry quote quotation brief',
  },
  {
    kind: 'page',
    title: 'About',
    summary: 'Who we are and what we value.',
    href: '/about',
    body: 'company mission vision values team',
  },
];

async function documents(ctx: RequestContext): Promise<Doc[]> {
  const [catalogue, pricing, industries, posts, faqs, work] = await Promise.all([
    getServiceCatalogue(ctx),
    getPricingCatalogue(ctx),
    listIndustries(ctx),
    listPosts(ctx),
    listAllFaqs(ctx),
    listPortfolio(ctx),
  ]);
  return [
    ...catalogue.flatMap((c): Doc[] => [
      {
        kind: 'service',
        title: c.name,
        summary: c.summary,
        href: `/services/${c.slug}`,
        body: c.services.map((s) => s.name).join(' '),
      },
      ...c.services.map((s) => ({
        kind: 'service' as const,
        title: s.name,
        summary: s.summary,
        href: `/services/${c.slug}`,
        body: c.name,
      })),
    ]),
    ...pricing.packages.map((p) => ({
      kind: 'package' as const,
      title: p.name,
      summary: p.tagline ?? '',
      href: `/pricing#${p.tab}`,
      body: p.features.map((f) => `${f.label} ${f.text ?? ''}`).join(' '),
    })),
    ...industries.map((i) => ({
      kind: 'industry' as const,
      title: i.name,
      summary: i.summary,
      href: `/industries/${i.slug}`,
      body: `${i.body} ${i.challenges.map((c) => `${c.title} ${c.body}`).join(' ')}`,
    })),
    ...posts.map((p) => ({
      kind: 'insight' as const,
      title: p.title,
      summary: p.excerpt,
      href: `/insights/${p.slug}`,
      body: `${p.category?.name ?? ''} ${p.tags.map((t) => t.name).join(' ')}`,
    })),
    ...faqs.map((f) => ({
      kind: 'faq' as const,
      title: f.question,
      summary: f.answer,
      href: `/faq#${f.id}`,
      body: '',
    })),
    ...work.map((w) => ({
      kind: 'work' as const,
      title: w.name,
      summary: w.summary,
      href: `/work/${w.slug}`,
      body: w.category,
    })),
    ...STATIC_PAGES,
  ];
}

/** Every term must match; title matches rank first. Duplicate hrefs collapse to the best match. */
export async function searchSite(ctx: RequestContext, q: string): Promise<SearchResult[]> {
  const terms = searchTerms(q);
  if (terms.length === 0) return [];
  const scored: { doc: Doc; score: number; i: number }[] = [];
  (await documents(ctx)).forEach((doc, i) => {
    const title = norm(doc.title);
    const rest = `${norm(doc.summary)} ${norm(doc.body)}`;
    let score = 0;
    for (const t of terms) {
      if (title.includes(t)) score += title.split(' ').includes(t) ? 10 : 6;
      else if (rest.includes(t)) score += 1;
      else return;
    }
    scored.push({ doc, score, i });
  });
  const seen = new Set<string>();
  return scored
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .filter(({ doc }) =>
      doc.kind === 'service' || doc.kind === 'page' ? !seen.has(doc.href) && seen.add(doc.href) : true,
    )
    .slice(0, MAX_RESULTS)
    .map(({ doc }) => ({ kind: doc.kind, title: doc.title, summary: doc.summary, href: doc.href }));
}
