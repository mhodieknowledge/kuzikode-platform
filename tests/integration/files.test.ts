import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/server/context';
import { signedFilePath } from '../../src/server/modules/files';
import { api, login, ORIGIN } from '../helpers/api';
import { createClient, createPortalUser, createStaff } from '../helpers/factories';
import { exe, pdf, png, svg } from '../helpers/file-fixtures';

async function upload(
  s: { cookie: string; csrf: string },
  bytes: Uint8Array<ArrayBuffer>,
  name: string,
  fields: Record<string, string>,
) {
  const form = new FormData();
  form.set('file', new File([bytes], name));
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  const res = await exports.default.fetch(`${ORIGIN}/api/v1/admin/files`, {
    method: 'POST',
    headers: { cookie: s.cookie, 'x-csrf-token': s.csrf, origin: ORIGIN },
    body: form,
  });
  return { status: res.status, body: (await res.json()) as any };
}

describe('file uploads and downloads', () => {
  it('stores a valid image under a random key and rejects spoofed types and SVG', async () => {
    const u = await createStaff(['admin']);
    const s = await login('admin', u.email, u.password);
    const ok = await upload(s, png(800, 600), 'logo.png', { purpose: 'image', ownerType: 'media' });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ mime: 'image/png', width: 800, height: 600 });
    const row = await env.DB.prepare('SELECT r2_key, sha256 FROM files WHERE id = ?')
      .bind(ok.body.data.id)
      .first<{ r2_key: string }>();
    expect(row!.r2_key).not.toContain('logo');
    expect(await env.FILES.head(row!.r2_key)).not.toBeNull();

    expect(
      (await upload(s, exe(), 'invoice.pdf', { purpose: 'document', ownerType: 'client', ownerId: 'cli_x' })).status,
    ).toBe(422);
    const svgRes = await upload(s, svg(), 'logo.svg', { purpose: 'image', ownerType: 'media' });
    expect(svgRes.status).toBe(422);
    expect(svgRes.body.error.fields.file[0]).toMatch(/SVG/);
    expect((await upload(s, svg(), 'logo.png', { purpose: 'image', ownerType: 'media' })).status).toBe(422);
  });

  it('serves files only to authorised callers; everyone else gets 404', async () => {
    const admin = await createStaff(['admin']);
    const content = await createStaff(['content_manager']);
    const a = await createClient('A');
    const b = await createClient('B');
    const userA = await createPortalUser([a.id]);
    const userB = await createPortalUser([b.id]);
    const s = await login('admin', admin.email, admin.password);
    const up = await upload(s, pdf(), 'brief.pdf', { purpose: 'document', ownerType: 'client', ownerId: a.id });
    const id = up.body.data.id as string;

    const asAdmin = await exports.default.fetch(`${ORIGIN}/api/v1/admin/files/${id}`, {
      headers: { cookie: s.cookie },
    });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.headers.get('content-disposition')).toMatch(/^attachment; filename="brief.pdf"/);
    expect(asAdmin.headers.get('x-content-type-options')).toBe('nosniff');
    expect(asAdmin.headers.get('cache-control')).toBe('private, no-store');
    expect(new TextDecoder().decode(await asAdmin.arrayBuffer())).toMatch(/^%PDF/);

    const sc = await login('admin', content.email, content.password);
    expect((await api(`/api/v1/admin/files/${id}`, { cookie: sc.cookie })).status).toBe(404);
    const pa = await login('portal', userA.email, userA.password);
    const pb = await login('portal', userB.email, userB.password);
    expect(
      (await exports.default.fetch(`${ORIGIN}/api/v1/portal/files/${id}`, { headers: { cookie: pa.cookie } })).status,
    ).toBe(200);
    expect((await api(`/api/v1/portal/files/${id}`, { cookie: pb.cookie })).status).toBe(404);
    expect((await api(`/api/v1/admin/files/${id}`, { cookie: pa.cookie })).status).toBe(401);
    expect((await api(`/api/v1/portal/files/${id}`)).status).toBe(401);
    expect((await api(`/api/v1/admin/files/fil_doesnotexist`, { cookie: s.cookie })).status).toBe(404);
  });

  it('signed links work briefly and reject tampering', async () => {
    const admin = await createStaff(['admin']);
    const s = await login('admin', admin.email, admin.password);
    const id = (await upload(s, pdf(), 'q.pdf', { purpose: 'document', ownerType: 'system' })).body.data.id as string;
    const ctx = createContext({ env });
    const path = await signedFilePath(ctx, id, 60);
    expect((await exports.default.fetch(`${ORIGIN}${path}`)).status).toBe(200);
    expect((await api(path.replace(/sig=[^&]+/, 'sig=forged'))).status).toBe(404);
    expect((await api(path.replace(/exp=\d+/, (m) => `exp=${Number(m.slice(4)) + 30}`))).status).toBe(404);
    const past = createContext({ env, now: () => new Date(Date.now() - 3600_000) });
    expect((await api(await signedFilePath(past, id, 60))).status).toBe(404);
  });
});
