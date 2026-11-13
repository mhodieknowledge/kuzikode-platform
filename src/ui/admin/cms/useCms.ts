/**
 * Logic of the website CMS islands (R6.2 group 4), carried over unchanged from the pre-redesign CmsAdmin: section drafts
 * (save, move, show / hide), page publish / discard, page details, case studies, and the media library. Endpoints, request
 * bodies and the reload-after-write behaviour are identical.
 */
import { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { reload, useAdminAction } from '../action';
import { cmsApi } from '../website/lib';

export type Value = Record<string, unknown>;

/** Draft content without keys the editor cleared (optional fields become absent, not empty). */
export const cleanContent = (v: Value): Value =>
  Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined));

export function useSectionEditor(pageKey: string, sectionKey: string, draft: Value) {
  const a = useAdminAction();
  const [value, setValue] = useState<Value>(draft);
  const [saved, setSaved] = useState(false);
  const base = `/pages/${pageKey}/sections/${sectionKey}`;
  const move = (direction: 'up' | 'down') =>
    a.run(async () => {
      await cmsApi(`${base}/move`, { body: { direction } });
      reload();
    });
  const setVisible = (visible: boolean) =>
    a.run(async () => {
      await cmsApi(`${base}/visibility`, { body: { visible } });
      reload();
    });
  const save = () => {
    setSaved(false);
    return a.run(async () => {
      await cmsApi(base, { method: 'PUT', body: { content: cleanContent(value) } });
      setSaved(true);
    });
  };
  return { ...a, value, setValue, saved, move, setVisible, save };
}

export function usePublish(pageKey: string) {
  const a = useAdminAction();
  const post = (action: 'publish' | 'discard') =>
    a.run(async () => {
      await cmsApi(`/pages/${pageKey}/${action}`, { body: {} });
      reload();
    });
  return { ...a, publish: () => post('publish'), discard: () => post('discard') };
}

export function usePageMeta(pageKey: string) {
  const a = useAdminAction();
  const [saved, setSaved] = useState(false);
  const save = (f: FormData) => {
    setSaved(false);
    return a.run(async () => {
      await cmsApi(`/pages/${pageKey}`, {
        method: 'PUT',
        body: {
          title: f.get('title'),
          seoTitle: f.get('seoTitle'),
          seoDescription: f.get('seoDescription'),
          ogImageId: f.get('ogImageId') || null,
        },
      });
      setSaved(true);
    });
  };
  return { ...a, saved, save };
}

export interface PortfolioValues {
  slug: string;
  name: string;
  clientName: string | null;
  showClientName: boolean;
  category: string;
  summary: string;
  description: string | null;
  challenge: string | null;
  solution: string | null;
  technologies: string[];
  completionDate: string | null;
  externalUrl: string | null;
  coverMediaId: string | null;
  galleryMediaIds: string[];
  featured: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
}

export function usePortfolio(id?: string, status?: string) {
  const a = useAdminAction();
  const save = (body: PortfolioValues) =>
    a.run(async () => {
      const res = await cmsApi(id ? `/portfolio/${id}` : '/portfolio', { method: id ? 'PUT' : 'POST', body });
      window.location.assign(`/admin/cms/portfolio/${id ?? res.data.id}`);
    });
  const toggleStatus = () =>
    a.run(async () => {
      await cmsApi(`/portfolio/${id}/status`, { body: { status: status === 'published' ? 'draft' : 'published' } });
      reload();
    });
  const remove = async () => {
    await cmsApi(`/portfolio/${id}`, { method: 'DELETE' });
  };
  return { ...a, save, toggleStatus, remove };
}

export interface MediaItem {
  id: string;
  file_id: string;
  alt_text: string;
  caption: string | null;
  folder: string | null;
  width: number | null;
  height: number | null;
  original_name: string;
}

export function useMedia() {
  const a = useAdminAction();
  const upload = (form: FormData) =>
    a.run(async () => {
      await apiFetch('/api/v1/admin/cms/media', { method: 'POST', body: form });
      reload();
    });
  const update = (id: string, f: FormData) =>
    a.run(async () => {
      await cmsApi(`/media/${id}`, {
        method: 'PUT',
        body: { altText: f.get('altText'), caption: f.get('caption'), folder: f.get('folder') },
      });
      reload();
    });
  const remove = (id: string) =>
    a.run(async () => {
      await cmsApi(`/media/${id}`, { method: 'DELETE' });
      reload();
    });
  return { ...a, upload, update, remove };
}
