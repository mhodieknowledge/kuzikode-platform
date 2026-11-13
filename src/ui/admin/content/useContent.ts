/**
 * Logic of the Content admin islands (R6.2 group 4), carried over unchanged from the pre-redesign ContentAdmin: article,
 * industry, FAQ, testimonial, technology and category writes. Endpoints and request bodies are identical.
 */
import { useAdminAction } from '../action';
import { contentApi, splitCsv } from '../website/lib';

export interface PostValues {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverMediaId: string | null;
  categoryId: string | null;
  tags: string[];
  authorDisplayName: string;
  status: 'draft' | 'scheduled' | 'published';
  publishAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

/** The body sent for an article: publish time only when scheduled, tags from the comma text. */
export const postBody = (v: PostValues, tags: string) => ({
  ...v,
  publishAt: v.status === 'scheduled' ? v.publishAt : null,
  tags: splitCsv(tags),
});

export function usePostSave(id?: string) {
  const a = useAdminAction();
  const save = (v: PostValues, tags: string) =>
    a.run(async () => {
      const res = await contentApi(id ? `/posts/${id}` : '/posts', {
        method: id ? 'PUT' : 'POST',
        body: postBody(v, tags),
      });
      window.location.assign(`/admin/content/insights/${id ?? res.data.id}?saved=1`);
    });
  return { ...a, save };
}

export interface IndustryValues {
  slug: string;
  name: string;
  summary: string;
  challenges: { title: string; body: string }[];
  body: string | null;
  icon: string | null;
  status: 'draft' | 'published';
  sortOrder: number;
  serviceIds: string[];
  seoTitle: string | null;
  seoDescription: string | null;
}

export function useIndustrySave(id?: string) {
  const a = useAdminAction();
  const save = (v: IndustryValues) =>
    a.run(async () => {
      const res = await contentApi(id ? `/industries/${id}` : '/industries', { method: id ? 'PUT' : 'POST', body: v });
      window.location.assign(`/admin/content/industries/${id ?? res.data.id}?saved=1`);
    });
  return { ...a, save };
}

export const FAQ_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'projects', label: 'Projects' },
  { value: 'pricing', label: 'Pricing & payments' },
  { value: 'support', label: 'Support' },
  { value: 'careers', label: 'Careers' },
];

/** Sort order from a number input; blanks and junk become 0. */
export const sortOrderOf = (v: FormDataEntryValue | null): number => Number(v) || 0;
