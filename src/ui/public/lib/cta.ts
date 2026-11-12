/**
 * Public calls to action (BRIEF B.0c): the start-a-project wizard is retired (the old URL 301s to /contact), so any CMS call to action that still points
 * at it is presented as "Get a quote" on the contact form. Other links pass through unchanged. Presentation only: CMS content
 * is not modified.
 */
export interface Cta {
  label: string;
  href: string;
}

const WIZARD = /^\/start-a-project(?:[/?#]|$)/;

export function publicCta(cta: Cta): Cta;
export function publicCta(cta: Cta | undefined | null): Cta | null;
export function publicCta(cta: Cta | undefined | null): Cta | null {
  if (!cta) return null;
  if (WIZARD.test(cta.href)) return { label: 'Get a quote', href: '/contact' };
  return cta;
}
