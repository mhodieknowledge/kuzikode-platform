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
  security: { checkOrigin: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
