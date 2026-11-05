/** For Astro pages that accept a plain HTML form POST: the browser's Origin must be our own (docs/07 §3). */
export function isSameOriginPost(request: Request, siteUrl: URL): boolean {
  if (request.method !== 'POST') return false;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return origin === new URL(request.url).origin || origin === siteUrl.origin;
}
