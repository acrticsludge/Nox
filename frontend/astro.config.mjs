// @ts-check
import { defineConfig } from 'astro/config';

// Static output by default — deploys to Vercel with zero configuration
// (no adapter needed). If the game ever needs server rendering or API
// routes, add `npx astro add vercel` and switch output to 'server'.
export default defineConfig({
  output: 'static',
});
