/** FAQ, technologies and testimonials for the public site (docs/12 §C.6, §C.7, §C.11). */
import type { RequestContext } from '../../context';
import { cached } from './service';

export const FAQ_CATEGORIES = [
  { key: 'general', label: 'General' },
  { key: 'projects', label: 'Projects' },
  { key: 'pricing', label: 'Pricing & payments' },
  { key: 'support', label: 'Support' },
  { key: 'careers', label: 'Careers' },
] as const;
export type FaqCategoryKey = (typeof FAQ_CATEGORIES)[number]['key'];

export interface FaqItem {
  id: string;
  category: FaqCategoryKey;
  question: string;
  answer: string;
}

export function listAllFaqs(ctx: RequestContext): Promise<FaqItem[]> {
  return cached(ctx, 'faqs:all', async () => {
    const { results } = await ctx.db
      .prepare(
        'SELECT id, category, question, answer FROM faqs WHERE published = 1 ORDER BY sort_order, question LIMIT 500',
      )
      .all<FaqItem>();
    return results;
  });
}

export interface Technology {
  name: string;
  category: string;
  logo: string | null;
}

export function listTechnologies(ctx: RequestContext): Promise<Technology[]> {
  return cached(ctx, 'technologies', async () => {
    const { results } = await ctx.db
      .prepare(
        'SELECT name, category, logo_svg_path FROM technologies WHERE published = 1 ORDER BY sort_order, name LIMIT 60',
      )
      .all<{ name: string; category: string; logo_svg_path: string | null }>();
    return results.map((t) => ({
      name: t.name,
      category: t.category,
      // Only same-origin static paths are rendered as images.
      logo: t.logo_svg_path && /^\/[a-z0-9/_.-]+\.svg$/i.test(t.logo_svg_path) ? t.logo_svg_path : null,
    }));
  });
}

export interface PublicTestimonial {
  quote: string;
  author: string;
  role: string | null;
}

/**
 * Only real, consented testimonials (docs/12 §C.7): every row links to a client and the schema enforces
 * consent_obtained = 1 with a consent date. Unpublished rows never appear; the block hides itself when this is empty.
 */
export function listTestimonials(ctx: RequestContext): Promise<PublicTestimonial[]> {
  return cached(ctx, 'testimonials', async () => {
    const { results } = await ctx.db
      .prepare(
        `SELECT t.quote, t.author_name, t.author_role FROM testimonials t JOIN clients c ON c.id = t.client_id
         WHERE t.published = 1 AND t.consent_obtained = 1 ORDER BY t.sort_order, t.created_at LIMIT 12`,
      )
      .all<{ quote: string; author_name: string; author_role: string | null }>();
    return results.map((r) => ({ quote: r.quote, author: r.author_name, role: r.author_role }));
  });
}
