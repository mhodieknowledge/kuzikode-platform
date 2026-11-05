// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  site: process.env.PUBLIC_SITE_URL ?? 'http://localhost:8787',
  adapter: cloudflare({
    imageService: 'passthrough',
    sessionKVBindingName: 'CACHE',
  }),
  integrations: [react()],
  // CSRF/Origin checks are done by our own middleware (docs/07 §3). Hash-based CSP for Astro's scripts:
  security: {
    checkOrigin: false,
    csp: {
      scriptDirective: { resources: ["'self'", 'https://challenges.cloudflare.com'] },
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
