/** Icon names CMS content may use (rendered by components/public/Icon.astro). */
export const CMS_ICONS = [
  'globe',
  'smartphone',
  'layers',
  'sparkles',
  'workflow',
  'cloud',
  'bar-chart',
  'line-chart',
  'gauge',
  'list-checks',
  'shield-check',
  'life-buoy',
  'wallet',
  'check',
  'arrow-right',
] as const;
export type CmsIcon = (typeof CMS_ICONS)[number];
