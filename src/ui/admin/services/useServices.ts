/**
 * Logic of the Services admin islands (R6.2 group 4), carried over unchanged from the pre-redesign ServicesAdmin: the division
 * and service request bodies (list rows trimmed, empty rows dropped, price only when the model is priced) and their saves.
 */
import { apiFetch } from '../../lib/api';
import { useAdminAction } from '../action';
import { effectiveSlug } from '../website/lib';

export interface DivisionFormValues {
  id?: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  benefits: { title: string; body: string }[];
  deliverables: string[];
  faq: { q: string; a: string }[];
  icon: string | null;
  status: 'active' | 'coming_soon' | 'inactive';
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface ServiceFormValues {
  id?: string;
  categoryId: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  pricingModel: 'fixed' | 'hourly' | 'starting_from' | 'custom_quote';
  priceMinor: number | null;
  currency: string | null;
  status: 'active' | 'coming_soon' | 'inactive';
  featured: boolean;
}

export const PRICING_OPTIONS = [
  { value: 'custom_quote', label: 'Custom quote' },
  { value: 'fixed', label: 'Fixed price' },
  { value: 'starting_from', label: 'Starting from' },
  { value: 'hourly', label: 'Hourly rate' },
];

export interface CatalogueDivision {
  id: string;
  name: string;
  slug: string;
  status: string;
  featured: boolean;
  services: { id: string; name: string; slug: string; status: string; featured: boolean; price: string }[];
}

export function divisionBody(
  f: FormData,
  s: {
    name: string;
    slug: string;
    slugTouched: boolean;
    description: string;
    benefits: DivisionFormValues['benefits'];
    deliverables: string[];
    faq: DivisionFormValues['faq'];
    featured: boolean;
  },
) {
  return {
    slug: effectiveSlug(s.slug, s.slugTouched, s.name),
    name: s.name,
    summary: f.get('summary'),
    description: s.description,
    benefits: s.benefits.filter((b) => b.title.trim() || b.body.trim()),
    deliverables: s.deliverables.map((d) => d.trim()).filter(Boolean),
    faq: s.faq.filter((x) => x.q.trim() || x.a.trim()),
    icon: f.get('icon') || null,
    status: f.get('status'),
    featured: s.featured,
    seoTitle: f.get('seoTitle'),
    seoDescription: f.get('seoDescription'),
  };
}

export function serviceBody(
  f: FormData,
  s: {
    categoryId: string;
    name: string;
    slug: string;
    slugTouched: boolean;
    description: string;
    pricing: ServiceFormValues['pricingModel'];
    price: number | null;
    currency: string;
    featured: boolean;
  },
) {
  const priced = s.pricing !== 'custom_quote';
  return {
    categoryId: s.categoryId,
    slug: effectiveSlug(s.slug, s.slugTouched, s.name),
    name: s.name,
    summary: f.get('summary'),
    description: s.description,
    pricingModel: s.pricing,
    priceMinor: priced ? s.price : null,
    currency: priced ? s.currency : null,
    status: f.get('status'),
    featured: s.featured,
  };
}

export function useCatalogueSave(kind: 'division' | 'service', id?: string) {
  const a = useAdminAction();
  const base = kind === 'division' ? '/api/v1/admin/catalogue/categories' : '/api/v1/admin/catalogue/services';
  const save = (body: unknown) =>
    a.run(async () => {
      if (id) await apiFetch(`${base}/${id}`, { method: 'PUT', body });
      else await apiFetch(base, { body });
      window.location.assign('/admin/services?saved=1');
    });
  const remove = () => apiFetch(`${base}/${id}`, { method: 'DELETE' });
  return { ...a, save, remove };
}
