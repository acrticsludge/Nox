// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// Static output by default — deploys to Vercel with zero configuration
// (no adapter needed). The Astryx landing page is a React island
// (src/components/Landing.tsx) hydrated on the client; the game page
// (/play) stays framework-free vanilla JS.
export default defineConfig({
  output: 'static',
  integrations: [react(), mdx()],
});
