/** Development-only: one email template rendered with its sample data (`?variant=`, `?format=text`). See index.astro. */
import type { APIRoute } from 'astro';
import { brandFor } from '../../../server/email';
import { isTemplate, renderTemplate } from '../../../server/email/templates';
import { EMAIL_SAMPLES, EMAIL_VARIANTS } from '../../../server/email/templates/samples';

export const GET: APIRoute = async ({ locals, params, url }) => {
  const { ctx } = locals;
  const name = params.name ?? '';
  if (ctx.config.appEnv !== 'development' || !isTemplate(name)) return new Response('Not found', { status: 404 });
  const variant = url.searchParams.get('variant');
  const data = variant
    ? EMAIL_VARIANTS.find((v) => v.name === name && v.variant === variant)?.data
    : EMAIL_SAMPLES[name];
  if (!data) return new Response('Not found', { status: 404 });
  const r = renderTemplate(name, await brandFor(ctx), data);
  return url.searchParams.get('format') === 'text'
    ? new Response(`Subject: ${r.subject}\n\n${r.text}`, { headers: { 'content-type': 'text/plain; charset=utf-8' } })
    : new Response(r.html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
};
