import type { APIRoute } from 'astro';
import { fileResponse, getFile } from '../../server/modules/files';

/** Public media (published CMS images only): `public, max-age=86400` (docs/03 §6). Everything else is 404. */
export const GET: APIRoute = async ({ params, locals }) => {
  const f = await getFile(locals.ctx, params.id ?? '');
  if (!f || f.visibility !== 'public' || f.owner_type !== 'media' || !f.mime_type.startsWith('image/')) {
    return new Response('Not found', { status: 404 });
  }
  return fileResponse(locals.ctx, f);
};
