import { describe, expect, it } from 'vitest';
import { publicCta } from '../../src/ui/public/lib/cta';
import { divisionShortName } from '../../src/shared/directory';

describe('public calls to action (BRIEF B.0c)', () => {
  it('turns wizard links into "Get a quote" on the contact form', () => {
    expect(publicCta({ label: 'Start a project', href: '/start-a-project' })).toEqual({
      label: 'Get a quote',
      href: '/contact',
    });
    expect(publicCta({ label: 'Start', href: '/start-a-project?service=web' })?.href).toBe('/contact');
  });

  it('leaves other links alone and tolerates a missing CTA', () => {
    const cta = { label: 'Explore services', href: '/services' };
    expect(publicCta(cta)).toBe(cta);
    expect(publicCta({ label: 'x', href: '/start-a-project-guide' }).href).toBe('/start-a-project-guide');
    expect(publicCta(undefined)).toBeNull();
  });

  it('shortens known division names and falls back to the CMS name', () => {
    expect(divisionShortName('web-development', 'Web Development & Digital Solutions')).toBe('Web development');
    expect(divisionShortName('new-division', 'New Division')).toBe('New Division');
  });
});
