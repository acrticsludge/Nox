// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Canonical base - keep in sync with src/config/site.ts
const SITE = process.env.PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://nox-void.vercel.app')

export default defineConfig({
  site: SITE,
  output: 'static',
  vite: {
    server: {
      proxy: {
        // Online 1v1: dev-server WS proxy -> backend game server (npm start in backend/, port 3000)
        '/ws': {
          target: process.env.PUBLIC_WS_URL || 'ws://localhost:3000',
          ws: true,
        },
      },
    },
  },
  integrations: [
    react(),
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/mockup'),
    }),
  ],
});
