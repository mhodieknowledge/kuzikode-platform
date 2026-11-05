import type { RequestContext } from '../../context';
import { cached, getServiceCatalogue, listPortfolio } from './service';

export interface SitemapEntry {
  path: string;
  lastmod?: string | undefined;
}

/** Extra sitemap sources registered by later modules (insights, industries, careers). */
export const SITEMAP_SOURCES: ((ctx: RequestContext) => Promise<SitemapEntry[]>)[] = [];

const STATIC = [
  '/',
  '/about',
  '/services',
  '/work',
  '/products',
  '/contact',
  '/legal/privacy',
  '/legal/terms',
  '/legal/service-terms',
  '/legal/cookies',
  '/legal/accessibility',
];

export function sitemapEntries(ctx: RequestContext): Promise<SitemapEntry[]> {
  return cached(ctx, 'sitemap', async () => {
    const [catalogue, portfolio, ...extra] = await Promise.all([
      getServiceCatalogue(ctx),
      listPortfolio(ctx),
      ...SITEMAP_SOURCES.map((f) => f(ctx)),
    ]);
    return [
      ...STATIC.map((path) => ({ path })),
      ...catalogue.map((c) => ({ path: `/services/${c.slug}` })),
      ...portfolio.map((p) => ({ path: `/work/${p.slug}`, lastmod: p.completionDate ?? undefined })),
      ...extra.flat(),
    ];
  });
}

export function renderSitemap(ctx: RequestContext, entries: SitemapEntry[]): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const urls = entries
    .map(
      (e) =>
        `  <url><loc>${esc(new URL(e.path, ctx.config.siteUrl).toString())}</loc>${e.lastmod ? `<lastmod>${esc(e.lastmod.slice(0, 10))}</lastmod>` : ''}</url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderRobots(ctx: RequestContext): string {
  const lines = ['User-agent: *'];
  if (ctx.config.appEnv !== 'production') {
    lines.push('Disallow: /');
  } else {
    for (const p of ['/admin', '/portal', '/api', '/q/', '/i/', '/pay', '/dev']) lines.push(`Disallow: ${p}`);
    lines.push('Allow: /');
  }
  lines.push('', `Sitemap: ${new URL('/sitemap.xml', ctx.config.siteUrl).toString()}`);
  return `${lines.join('\n')}\n`;
}
