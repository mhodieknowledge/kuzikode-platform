/** Published industries (docs/12 §C.3) with their linked services and the packages offered for those services. */
import type { RequestContext } from '../../context';
import { sanitizeHtml } from '../../lib/html-sanitize';
import { getPricingCatalogue, type PublicPackage } from './packages';
import { cached, getServiceCatalogue } from './service';

export interface PublicIndustry {
  slug: string;
  name: string;
  summary: string;
  icon: string | null;
  challenges: { title: string; body: string }[];
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  serviceIds: string[];
}

interface IndustryRow {
  id: string;
  slug: string;
  name: string;
  summary: string;
  icon: string | null;
  challenges: string;
  body: string | null;
  seo_title: string | null;
  seo_description: string | null;
  service_ids: string | null;
}

const parseChallenges = (v: string): PublicIndustry['challenges'] => {
  try {
    const arr = JSON.parse(v) as unknown;
    return Array.isArray(arr)
      ? arr.filter(
          (c): c is { title: string; body: string } =>
            typeof c === 'object' && c !== null && typeof c.title === 'string' && typeof c.body === 'string',
        )
      : [];
  } catch {
    return [];
  }
};

export function listIndustries(ctx: RequestContext): Promise<PublicIndustry[]> {
  return cached(ctx, 'industries', async () => {
    const { results } = await ctx.db
      .prepare(
        `SELECT i.id, i.slug, i.name, i.summary, i.icon, i.challenges, i.body, i.seo_title, i.seo_description,
           (SELECT json_group_array(service_id) FROM industry_services WHERE industry_id = i.id) AS service_ids
         FROM industries i WHERE i.status = 'published' ORDER BY i.sort_order, i.name LIMIT 100`,
      )
      .all<IndustryRow>();
    return results.map((r) => ({
      slug: r.slug,
      name: r.name,
      summary: r.summary,
      icon: r.icon,
      challenges: parseChallenges(r.challenges),
      body: sanitizeHtml(r.body ?? ''),
      seoTitle: r.seo_title,
      seoDescription: r.seo_description,
      serviceIds: r.service_ids ? (JSON.parse(r.service_ids) as string[]) : [],
    }));
  });
}

export interface IndustryDetail extends PublicIndustry {
  services: { slug: string; name: string; summary: string; categorySlug: string; categoryName: string }[];
  packages: PublicPackage[];
}

/** One industry with only visible, active services; packages come from those services. */
export async function getIndustry(ctx: RequestContext, slug: string): Promise<IndustryDetail | null> {
  const industry = (await listIndustries(ctx)).find((i) => i.slug === slug);
  if (!industry) return null;
  const [catalogue, pricing] = await Promise.all([getServiceCatalogue(ctx), getPricingCatalogue(ctx)]);
  const services = catalogue
    .filter((c) => c.status === 'active')
    .flatMap((c) =>
      c.services
        .filter((s) => s.status === 'active' && industry.serviceIds.includes(s.id))
        .map((s) => ({ slug: s.slug, name: s.name, summary: s.summary, categorySlug: c.slug, categoryName: c.name })),
    );
  const keys = new Set(services.map((s) => `${s.categorySlug}/${s.slug}`));
  const packages = pricing.packages.filter(
    (p) => p.status === 'active' && keys.has(`${p.categorySlug}/${p.serviceSlug}`),
  );
  return { ...industry, services, packages };
}
