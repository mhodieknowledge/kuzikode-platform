import { describe, expect, it } from 'vitest';
import { categoryHue, coverMotif, withHeadingIds } from '../../src/ui/public/insights/lib';

describe('insights presentation helpers', () => {
  it('picks a cover motif from the category slug', () => {
    expect(coverMotif('payments')).toBe('pay');
    expect(coverMotif('email-domains')).toBe('mail');
    expect(coverMotif('websites')).toBe('web');
    expect(coverMotif('guides')).toBe('guide');
    expect(coverMotif(null)).toBe('guide');
  });

  it('gives a category a stable division hue', () => {
    const all = ['websites', 'payments', 'guides', 'email-domains'];
    expect(categoryHue('email-domains', all)).toBe('kz-div-1');
    expect(categoryHue('websites', all)).toBe('kz-div-4');
    expect(new Set(all.map((c) => categoryHue(c, all))).size).toBe(4);
    expect(categoryHue(undefined, all)).toBe('kz-div-3');
    expect(categoryHue('nope', all)).toBe('kz-div-3');
  });

  it('adds unique ids to plain h2 headings and lists them', () => {
    const { html, toc } = withHeadingIds(
      '<p>a</p><h2>Why it &amp; matters</h2><p>b</p><h2>Why it &amp; matters</h2><h2 class="x">Skip</h2><h2><strong>Next</strong> step</h2>',
    );
    expect(toc).toEqual([
      { id: 's-why-it-matters', text: 'Why it & matters' },
      { id: 's-why-it-matters-2', text: 'Why it & matters' },
      { id: 's-next-step', text: 'Next step' },
    ]);
    expect(html).toContain('<h2 id="s-why-it-matters">Why it &amp; matters</h2>');
    expect(html).toContain('<h2 class="x">Skip</h2>');
    expect(html).toContain('<h2 id="s-next-step"><strong>Next</strong> step</h2>');
  });
});
