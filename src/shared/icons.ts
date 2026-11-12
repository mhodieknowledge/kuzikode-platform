/** Icon names CMS content may use (rendered by ui/icons/Icon.astro via the registry). */
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
