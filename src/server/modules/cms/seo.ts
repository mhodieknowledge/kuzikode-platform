import type { RequestContext } from '../../context';
import { getSettings, settingText } from './service';

const abs = (ctx: RequestContext, path: string) => new URL(path, ctx.config.siteUrl).toString();

export async function organizationLd(ctx: RequestContext): Promise<Record<string, unknown>> {
  const s = await getSettings(ctx);
  const sameAs = [
    'social.linkedin',
    'social.facebook',
    'social.x',
    'social.instagram',
    'social.github',
    'social.youtube',
  ]
    .map((k) => settingText(s, k))
    .filter((v): v is string => !!v && v.startsWith('https://'));
  const email = settingText(s, 'contact.email');
  const phone = settingText(s, 'contact.phone');
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': abs(ctx, '/#organization'),
    name: settingText(s, 'company.name') ?? 'Kuzikode Technologies',
    url: abs(ctx, '/'),
    logo: abs(ctx, '/icon-512.png'),
    slogan: settingText(s, 'company.tagline'),
    areaServed: ['Zimbabwe', 'Africa'],
    address: { '@type': 'PostalAddress', addressCountry: 'ZW' },
    ...(email ? { email } : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteLd(ctx: RequestContext): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': abs(ctx, '/#website'),
    name: 'Kuzikode Technologies',
    url: abs(ctx, '/'),
    publisher: { '@id': abs(ctx, '/#organization') },
  };
}

export function breadcrumbLd(ctx: RequestContext, items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(ctx, it.path),
    })),
  };
}

export function serviceLd(
  ctx: RequestContext,
  c: { name: string; summary: string; slug: string; services: { name: string; summary: string }[] },
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: c.name,
    description: c.summary,
    url: abs(ctx, `/services/${c.slug}`),
    provider: { '@id': abs(ctx, '/#organization') },
    areaServed: ['Zimbabwe', 'Africa'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: c.name,
      itemListElement: c.services.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.name, description: s.summary },
      })),
    },
  };
}

export function caseStudyLd(
  ctx: RequestContext,
  p: { name: string; summary: string; slug: string; completionDate: string | null },
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: p.name,
    description: p.summary,
    url: abs(ctx, `/work/${p.slug}`),
    creator: { '@id': abs(ctx, '/#organization') },
    ...(p.completionDate ? { dateCreated: p.completionDate } : {}),
  };
}

/** FAQPage structured data for a visible list of questions (answers are plain text). */
export function faqLd(items: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}
