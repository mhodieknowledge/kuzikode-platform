import { describe, expect, it } from 'vitest';
import {
  effectiveSlug,
  firstListError,
  fromHarareInput,
  lines,
  listErrors,
  moveItem,
  patchAt,
  slugify,
  splitCsv,
  toHarareInput,
  toggleId,
  toUtcInput,
} from '../../src/ui/admin/website/lib';
import { isAllowedLink, normalizeHtml } from '../../src/ui/primitives/RichText';
import { divisionBody, serviceBody } from '../../src/ui/admin/services/useServices';
import { packageBody, type PackageFormValues } from '../../src/ui/admin/packages/usePackages';
import { postingActionLabel, postingBody, postingOptions } from '../../src/ui/admin/careers/useCareers';
import { postBody, type PostValues } from '../../src/ui/admin/content/useContent';

describe('slugs', () => {
  it('lower-cases, strips accents and joins with hyphens', () => {
    expect(slugify('Web & Apps: Café Désign!')).toBe('web-and-apps-cafe-design');
    expect(slugify('  --Hello   World--  ')).toBe('hello-world');
    expect(slugify('x'.repeat(120))).toHaveLength(80);
  });
  it('keeps what was typed once touched, derives it before', () => {
    expect(effectiveSlug('mine', true, 'Other Name')).toBe('mine');
    expect(effectiveSlug('', true, 'Other Name')).toBe('');
    expect(effectiveSlug('', false, 'Other Name')).toBe('other-name');
    expect(effectiveSlug('typed', false, 'Other Name')).toBe('typed');
  });
});

describe('text list fields', () => {
  it('splits lines and commas, trimming and dropping blanks', () => {
    expect(lines(' a \n\n b\n')).toEqual(['a', 'b']);
    expect(splitCsv(' x, ,y ,, z')).toEqual(['x', 'y', 'z']);
    expect(splitCsv('')).toEqual([]);
  });
});

describe('date inputs', () => {
  it('shows UTC timestamps without seconds', () => {
    expect(toUtcInput('2026-03-04T10:20:30.000Z')).toBe('2026-03-04T10:20');
    expect(toUtcInput(null)).toBe('');
  });
  it('converts Harare time (UTC+2) both ways', () => {
    expect(toHarareInput('2026-03-04T10:00:00.000Z')).toBe('2026-03-04T12:00');
    expect(fromHarareInput('2026-03-04T12:00')).toBe('2026-03-04T10:00:00.000Z');
    expect(fromHarareInput('')).toBeNull();
    expect(toHarareInput(null)).toBe('');
  });
});

describe('reordering and selection', () => {
  it('moves one item and refuses no-ops', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toBeNull();
    expect(moveItem(['a', 'b', 'c'], 2, 3)).toBeNull();
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toBeNull();
  });
  it('patches one row and toggles ids without duplicates', () => {
    expect(patchAt([{ a: 1 }, { a: 2 }], 1, { a: 9 })).toEqual([{ a: 1 }, { a: 9 }]);
    expect(toggleId(['x'], 'y', true)).toEqual(['x', 'y']);
    expect(toggleId(['x', 'y'], 'y', true)).toEqual(['x', 'y']);
    expect(toggleId(['x', 'y'], 'x', false)).toEqual(['y']);
  });
});

describe('form errors', () => {
  const errors = { benefits: ['Too many.'], 'benefits.0.title': ['Enter a title.'], name: ['Enter a name.'] };
  it('collects the key and its nested entries', () => {
    expect(listErrors(errors, 'benefits')).toEqual(['Too many.', 'Enter a title.']);
    expect(firstListError(errors, 'benefits')).toBe('Too many.');
    expect(firstListError(errors, 'faq')).toBeUndefined();
  });
});

describe('rich text helpers', () => {
  it('accepts web, mail, phone and site links only', () => {
    for (const ok of ['https://a.test', 'http://a.test', 'mailto:a@b.co', 'tel:+263', '/contact', ' /x ']) {
      expect(isAllowedLink(ok)).toBe(true);
    }
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://a', 'contact']) {
      expect(isAllowedLink(bad)).toBe(false);
    }
  });
  it('treats a lone <br> as empty', () => {
    expect(normalizeHtml('<br>')).toBe('');
    expect(normalizeHtml('<p>Hi</p>')).toBe('<p>Hi</p>');
    expect(normalizeHtml(undefined)).toBe('');
  });
});

describe('request bodies are unchanged by the redesign', () => {
  it('division: trims list rows, drops empty ones, derives the slug', () => {
    const f = new FormData();
    f.set('summary', 'S');
    f.set('status', 'active');
    f.set('icon', '');
    f.set('seoTitle', '');
    f.set('seoDescription', '');
    const b = divisionBody(f, {
      name: 'Web & Apps',
      slug: '',
      slugTouched: false,
      description: '<p>d</p>',
      benefits: [
        { title: ' ', body: '' },
        { title: 'T', body: 'B' },
      ],
      deliverables: [' one ', '', 'two'],
      faq: [
        { q: '', a: '' },
        { q: 'Q', a: 'A' },
      ],
      featured: true,
    });
    expect(b).toMatchObject({
      slug: 'web-and-apps',
      icon: null,
      benefits: [{ title: 'T', body: 'B' }],
      deliverables: ['one', 'two'],
      faq: [{ q: 'Q', a: 'A' }],
      featured: true,
    });
  });
  it('service: no price for a custom quote', () => {
    const f = new FormData();
    f.set('summary', 'S');
    f.set('status', 'active');
    const base = {
      categoryId: 'c1',
      name: 'Dash',
      slug: '',
      slugTouched: false,
      description: '',
      price: 15000,
      currency: 'USD',
      featured: false,
    };
    expect(serviceBody(f, { ...base, pricing: 'custom_quote' })).toMatchObject({ priceMinor: null, currency: null });
    expect(serviceBody(f, { ...base, pricing: 'fixed' })).toMatchObject({
      priceMinor: 15000,
      currency: 'USD',
      slug: 'dash',
    });
  });
  it('package: annual price only for monthly recurring, text only for value features', () => {
    const v: PackageFormValues = {
      id: 'pkg_1',
      serviceId: 's',
      slug: '',
      name: 'Starter Plan',
      tagline: null,
      billingType: 'recurring',
      interval: 'month',
      priceType: 'fixed',
      priceMinor: 5000,
      currency: null,
      priceUnit: null,
      altPriceZwgMinor: null,
      annualPriceMinor: 50000,
      minQuantity: 1,
      deliveryTime: null,
      revisionRounds: null,
      supportPeriod: null,
      mostPopular: false,
      tab: 'care',
      status: 'active',
      costNote: null,
      priceReviewRequired: true,
      features: [
        { label: 'Pages', value: 'text', text: '5', tooltip: null, key: null },
        { label: 'SSL', value: 'included', text: 'stale', tooltip: null, key: null },
      ],
    };
    const b = packageBody(v, false, 'USD');
    expect(b).not.toHaveProperty('id');
    expect(b).not.toHaveProperty('priceReviewRequired');
    expect(b).toMatchObject({ slug: 'starter-plan', currency: 'USD', interval: 'month', annualPriceMinor: 50000 });
    expect(b.features.map((x) => x.text)).toEqual(['5', null]);
    expect(packageBody({ ...v, interval: 'year' }, true, 'USD')).toMatchObject({ slug: '', annualPriceMinor: null });
    expect(packageBody({ ...v, billingType: 'one_off', priceType: 'custom_quote' }, true, 'USD')).toMatchObject({
      currency: null,
      interval: null,
      annualPriceMinor: null,
    });
  });
  it('posting: salary only when set, lists from lines, select options trimmed', () => {
    const v = {
      slug: '',
      title: 'Dev Ops',
      department: 'Eng',
      location: 'Harare',
      employmentType: 'full_time' as const,
      workplace: 'hybrid' as const,
      salaryMinMinor: null,
      salaryMaxMinor: null,
      salaryCurrency: null,
      salaryPeriod: null,
      showSalary: false,
      summary: 's',
      description: '',
      responsibilities: [],
      requirements: [],
      niceToHaves: [],
      offer: [],
      howToApply: null,
      questions: [
        { id: 'q1', label: 'Pick', type: 'select' as const, required: true, options: ['a', '', 'b'] },
        { id: 'q2', label: 'Why', type: 'long_text' as const, required: false, options: ['x'] },
      ],
      opensAt: null,
      closesAt: null,
    };
    const text = { responsibilities: 'a\n\nb', requirements: '', niceToHaves: ' c ', offer: '' };
    const none = postingBody(v, text, false, 'USD');
    expect(none).toMatchObject({
      slug: 'dev-ops',
      salaryCurrency: null,
      salaryPeriod: null,
      responsibilities: ['a', 'b'],
      niceToHaves: ['c'],
    });
    expect(none.questions[0]?.options).toEqual(['a', 'b']);
    expect(none.questions[1]?.options).toBeUndefined();
    expect(postingBody({ ...v, salaryMinMinor: 100 }, text, true, 'ZWG')).toMatchObject({
      slug: '',
      salaryCurrency: 'ZWG',
      salaryPeriod: 'month',
    });
  });
  it('article: publish time only when scheduled, tags from comma text', () => {
    const v: PostValues = {
      slug: 's',
      title: 't',
      excerpt: 'e',
      body: 'b',
      coverMediaId: null,
      categoryId: null,
      tags: [],
      authorDisplayName: 'a',
      status: 'draft',
      publishAt: '2026-01-01T00:00',
      seoTitle: null,
      seoDescription: null,
    };
    expect(postBody(v, ' x, y ,')).toMatchObject({ publishAt: null, tags: ['x', 'y'] });
    expect(postBody({ ...v, status: 'scheduled' }, '')).toMatchObject({ publishAt: '2026-01-01T00:00', tags: [] });
  });
});

describe('posting status actions', () => {
  it('offers the right buttons for each state', () => {
    expect(postingOptions('draft')).toEqual(['open', 'archived']);
    expect(postingOptions('open')).toEqual(['closed']);
    expect(postingOptions('closed')).toEqual(['open', 'archived']);
    expect(postingOptions('archived')).toEqual(['draft']);
    expect(postingActionLabel('closed').open).toBe('Reopen');
    expect(postingActionLabel('draft').open).toBe('Open for applications');
  });
});
