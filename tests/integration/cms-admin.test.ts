import { env, exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import {
  contentVersion,
  currentAnnouncement,
  getPage,
  getPortfolioGallery,
  listPortfolio,
  resetCmsCache,
} from '../../src/server/modules/cms';
import { ORIGIN, api, login } from '../helpers/api';
import { createStaff } from '../helpers/factories';
import { png } from '../helpers/file-fixtures';
import { seedBase } from '../helpers/seed';

async function staff(roles: string[]) {
  const u = await createStaff(roles);
  return login('admin', u.email, u.password);
}
type S = Awaited<ReturnType<typeof staff>>;
const C = (s: S, path: string, body?: unknown, method?: string) =>
  api(`/api/v1/admin/cms${path}`, { cookie: s.cookie, csrf: s.csrf, body, ...(method ? { method } : {}) });
const publicCtx = () => {
  resetCmsCache();
  return createContext({ env });
};
const previewCtx = () => Object.assign(createContext({ env }), { preview: true });

async function uploadImage(s: S, alt: string) {
  const form = new FormData();
  form.set('file', new File([png(40, 30)], 'team.png', { type: 'image/png' }));
  form.set('altText', alt);
  const res = await exports.default.fetch(`${ORIGIN}/api/v1/admin/cms/media`, {
    method: 'POST',
    headers: { cookie: s.cookie, 'x-csrf-token': s.csrf, origin: ORIGIN },
    body: form,
  });
  return { status: res.status, body: (await res.json()) as any };
}

describe('CMS editors (P4.15)', () => {
  beforeEach(() => seedBase());

  it('keeps section drafts out of the public site until the page is published', async () => {
    const s = await staff(['content_manager']);
    const page = (await C(s, '/pages/about')).body.data;
    const section = page.sections.find(
      (x: any) => x.type === 'statement' || x.type === 'rich_text' || x.type === 'hero',
    );
    expect(section).toBeTruthy();
    const published = (await getPage(publicCtx(), 'about'))!.sections.find((x) => x.key === section.key)!;

    const draft = { ...section.draft, title: 'Draft title only staff can see' };
    if (section.type === 'rich_text') draft.html = '<p>Hello</p><script>alert(1)</script>';
    expect((await C(s, `/pages/about/sections/${section.key}`, { content: draft }, 'PUT')).status).toBe(200);
    expect((await C(s, `/pages/about/sections/${section.key}`, { content: { nonsense: true } }, 'PUT')).status).toBe(
      422,
    );

    const before = await contentVersion(publicCtx());
    expect((await getPage(publicCtx(), 'about'))!.sections.find((x) => x.key === section.key)).toEqual(published);
    const preview = (await getPage(previewCtx(), 'about'))!.sections.find((x) => x.key === section.key)!;
    expect((preview.content as any).title).toBe('Draft title only staff can see');
    expect((await C(s, '/pages')).body.data.find((p: any) => p.key === 'about').has_changes).toBe(1);

    expect((await C(s, '/pages/about/publish', {})).status).toBe(200);
    expect(await contentVersion(publicCtx())).toBe(before + 1);
    const live = (await getPage(publicCtx(), 'about'))!.sections.find((x) => x.key === section.key)!;
    expect((live.content as any).title).toBe('Draft title only staff can see');
    if (section.type === 'rich_text') expect(JSON.stringify(live.content)).not.toContain('<script');
    expect((await C(s, '/pages')).body.data.find((p: any) => p.key === 'about').has_changes).toBe(0);

    // Discard returns drafts to the live content; hide/move bump the version.
    await C(s, `/pages/about/sections/${section.key}`, { content: { ...draft, title: 'Throwaway' } }, 'PUT');
    await C(s, '/pages/about/discard', {});
    expect((await C(s, '/pages/about')).body.data.sections.find((x: any) => x.key === section.key).draft.title).toBe(
      'Draft title only staff can see',
    );
    const v2 = await contentVersion(publicCtx());
    expect((await C(s, `/pages/about/sections/${section.key}/visibility`, { visible: false })).status).toBe(200);
    expect(await contentVersion(publicCtx())).toBe(v2 + 1);
    expect((await getPage(publicCtx(), 'about'))!.sections.some((x) => x.key === section.key)).toBe(false);
    await C(s, `/pages/about/sections/${section.key}/visibility`, { visible: true });
    expect((await C(s, `/pages/about/sections/${section.key}/move`, { direction: 'down' })).status).toBe(200);
    expect((await C(s, '/pages/no-such-page')).status).toBe(404);
  });

  it('runs the media library with required alt text and protects images in use', async () => {
    const s = await staff(['content_manager']);
    expect((await uploadImage(s, '')).status).toBe(422);
    const up = await uploadImage(s, 'Workshop table with laptops');
    expect(up.status, JSON.stringify(up.body)).toBe(201);
    const media = (await C(s, '/media')).body.data.find((m: any) => m.id === up.body.data.id);
    expect(media).toMatchObject({ alt_text: 'Workshop table with laptops', width: 40, height: 30 });
    const pub = await exports.default.fetch(`${ORIGIN}/media/${up.body.data.fileId}`);
    expect([200, 404]).toContain(pub.status); // served by the Astro route in e2e; the worker stub has no pages
    expect((await C(s, `/media/${up.body.data.id}`, { altText: '  ' }, 'PUT')).status).toBe(422);

    const bakery = `bakery-site-${Date.now()}`;
    const pf = await C(s, '/portfolio', {
      slug: bakery,
      name: 'Bakery website',
      category: 'Websites',
      summary: 'A fast menu website for a local bakery.',
      coverMediaId: up.body.data.id,
      galleryMediaIds: [up.body.data.id],
    });
    expect(pf.status, JSON.stringify(pf.body)).toBe(201);
    // The case study page shows its gallery (draft: only in preview, never publicly).
    const gallery = await getPortfolioGallery(previewCtx(), bakery);
    expect(gallery).toEqual([
      { src: `/media/${up.body.data.fileId}`, alt: 'Workshop table with laptops', width: 40, height: 30 },
    ]);
    expect(await getPortfolioGallery(publicCtx(), bakery)).toEqual([]);
    expect((await C(s, `/media/${up.body.data.id}`, undefined, 'DELETE')).status).toBe(409);
  });

  it('publishes case studies, products and announcements only when told to', async () => {
    const s = await staff(['admin']);
    const slug = `clinic-booking-${Date.now()}`;
    const body = {
      slug,
      name: 'Clinic booking',
      category: 'Web apps',
      summary: 'Online booking for a clinic, with reminders.',
    };
    const pf = await C(s, '/portfolio', body);
    expect((await C(s, '/portfolio', { ...body, name: 'Copy' })).status).toBe(422); // slug taken
    expect((await listPortfolio(publicCtx())).some((p) => p.slug === slug)).toBe(false);
    expect((await listPortfolio(previewCtx())).some((p) => p.slug === slug)).toBe(true);
    expect((await C(s, `/portfolio/${pf.body.data.id}/status`, { status: 'published' })).status).toBe(200);
    expect((await listPortfolio(publicCtx())).some((p) => p.slug === slug)).toBe(true);
    expect((await C(s, `/portfolio/${pf.body.data.id}`, undefined, 'DELETE')).status).toBe(409);
    await C(s, `/portfolio/${pf.body.data.id}/status`, { status: 'draft' });
    expect((await C(s, `/portfolio/${pf.body.data.id}`, undefined, 'DELETE')).status).toBe(200);

    const prod = await C(s, '/products', {
      slug: `planner-${Date.now()}`,
      name: 'Planner',
      description: 'A simple planner we are building.',
      status: 'in_development',
      published: false,
    });
    expect(prod.status).toBe(201);
    expect(
      (
        await C(
          s,
          `/products/${prod.body.data.id}`,
          { slug: 'x', name: 'Planner', description: 'Short', status: 'beta' },
          'PUT',
        )
      ).status,
    ).toBe(422);

    expect((await C(s, '/announcements', { message: 'Closed on Friday', linkUrl: '/contact' })).status).toBe(422);
    const ann = await C(s, '/announcements', {
      message: 'Office closed on Friday for a public holiday.',
      level: 'important',
      startsAt: '2020-01-01T00:00',
      endsAt: '2099-01-01T00:00',
    });
    expect(ann.status, JSON.stringify(ann.body)).toBe(201);
    expect((await currentAnnouncement(publicCtx()))?.message).toBe('Office closed on Friday for a public holiday.');
    expect((await C(s, `/announcements/${ann.body.data.id}`, undefined, 'DELETE')).status).toBe(200);
    expect((await currentAnnouncement(publicCtx()))?.message).not.toBe('Office closed on Friday for a public holiday.');
  });

  it('refuses staff without website permissions', async () => {
    const support = await staff(['support_staff']);
    expect((await C(support, '/pages')).status).toBe(403);
    expect((await C(support, '/pages/about/publish', {})).status).toBe(403);
    expect((await uploadImage(support, 'x y z')).status).toBe(403);
  });
});
