/**
 * Form descriptions for each CMS section type (shared/schemas/cms.ts holds the validation). The admin section editor
 * renders these generically, so adding a section type means one schema and one entry here.
 */
import type { SectionType } from './schemas/cms';

export type FieldKind = 'text' | 'textarea' | 'cta' | 'items' | 'strings' | 'html';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  max?: number;
  optional?: boolean;
  /** For `items`: the fields of each item. */
  item?: FieldDef[];
  maxItems?: number;
}

const title: FieldDef = { key: 'title', label: 'Title', kind: 'text', max: 120 };
const intro: FieldDef = { key: 'intro', label: 'Introduction', kind: 'textarea', max: 400, optional: true };

export const SECTION_FIELDS: Record<SectionType, FieldDef[]> = {
  hero: [
    { key: 'eyebrow', label: 'Eyebrow', kind: 'text', max: 80, optional: true },
    title,
    { key: 'body', label: 'Text', kind: 'textarea', max: 400 },
    { key: 'primaryCta', label: 'Main button', kind: 'cta' },
    { key: 'secondaryCta', label: 'Second button', kind: 'cta', optional: true },
  ],
  services_grid: [title, intro],
  features: [
    title,
    intro,
    {
      key: 'items',
      label: 'Features',
      kind: 'items',
      maxItems: 8,
      item: [
        { key: 'icon', label: 'Icon name', kind: 'text', max: 40, optional: true },
        { key: 'title', label: 'Title', kind: 'text', max: 80 },
        { key: 'body', label: 'Text', kind: 'textarea', max: 300 },
      ],
    },
  ],
  work_grid: [title, intro],
  process: [
    title,
    {
      key: 'steps',
      label: 'Steps',
      kind: 'items',
      maxItems: 8,
      item: [
        { key: 'title', label: 'Title', kind: 'text', max: 60 },
        { key: 'body', label: 'Text', kind: 'textarea', max: 240 },
      ],
    },
    { key: 'link', label: 'Link', kind: 'cta', optional: true },
  ],
  values: [
    title,
    {
      key: 'items',
      label: 'Values',
      kind: 'items',
      maxItems: 10,
      item: [
        { key: 'title', label: 'Title', kind: 'text', max: 60 },
        { key: 'body', label: 'Text', kind: 'textarea', max: 400 },
      ],
    },
    { key: 'link', label: 'Link', kind: 'cta', optional: true },
  ],
  products_grid: [title, intro],
  cta: [
    title,
    { key: 'body', label: 'Text', kind: 'textarea', max: 400, optional: true },
    { key: 'primaryCta', label: 'Main button', kind: 'cta' },
    { key: 'secondaryCta', label: 'Second button', kind: 'cta', optional: true },
  ],
  rich_text: [
    { key: 'title', label: 'Title', kind: 'text', max: 120, optional: true },
    { key: 'html', label: 'Content', kind: 'html', max: 100_000 },
  ],
  statement: [title, { key: 'body', label: 'Text', kind: 'textarea', max: 600 }],
  list: [title, { key: 'items', label: 'Items', kind: 'strings', max: 300, maxItems: 20 }],
};

export const SECTION_TYPE_LABEL: Record<SectionType, string> = {
  hero: 'Hero',
  services_grid: 'Services grid',
  features: 'Features',
  work_grid: 'Work grid',
  process: 'Process',
  values: 'Values',
  products_grid: 'Products grid',
  cta: 'Call to action',
  rich_text: 'Rich text',
  statement: 'Statement',
  list: 'List',
};

/** Public path of a CMS page key, for previews and "view live" links. */
export function pagePath(key: string): string {
  if (key === 'home') return '/';
  if (key.startsWith('legal-')) return `/legal/${key.slice(6)}`;
  return `/${key}`;
}
