# Link and OG Audit - 2026-08-29

Scope: link graph, canonical, robots, sitemap, Open Graph, favicon

## Before

- No canonical links. No OG tags. No twitter cards. No robots.txt. No sitemap. No favicon. No manifest. No JSON-LD.
- Pages had only `title` plus `description`. Sharing on X or Discord showed no card. Crawlers had no sitemap. No way to distinguish live routes from lab.
- OG background concept was generic. No actual gamebox snapshot.

## After

- `frontend/src/config/site.ts` centralizes `SITE.url`, `SITE_LINKS`, `NAV_LINKS`. Env aware. Single change updates all URLs.
- `frontend/src/components/SEO.astro` emits all tags in one place. Verified no em dashes in output.
- All 5 routes updated:
  - `/` - `VideoGame` JSON-LD, canonical `/`, OG 1200x630
  - `/play` - `BreadcrumbList`, canonical `/play`
  - `/play/1v1` - `VideoGame`, canonical `/play/1v1`
  - `/docs` - `BreadcrumbList article`, canonical `/docs`
  - `/mockup` - `noindex nofollow`, canonical `/mockup`, filtered from sitemap
- `frontend/public/robots.txt` allows all, disallows mockup plus api, points to both sitemap files.
- `@astrojs/sitemap` integration added. Build now emits `dist/sitemap-index.xml` plus `dist/sitemap-0.xml` with 4 URLs. Verified via `grep` on build output.
- `frontend/public/og.png 1200x630 83KB` generated from real arena SVG via `frontend/scripts/generate-og.mjs` plus `sharp`. Source `og.svg 14KB` kept. Both copied to `dist`.
- `frontend/public/favicon.svg`, `favicon.ico 32`, `favicon-32.png`, `apple-touch-icon.png 180`, `site.webmanifest` added. `SEO.astro` links all.
- `frontend/astro.config.mjs` now has `site` plus `sitemap` filter plus `customPages`.
- `frontend/package.json` prebuild runs `node scripts/generate-og.mjs` plus adds `sharp` and `@astrojs/sitemap`.
- Docs added: `docs/architecture/link-and-og.md`, `docs/features/og-image-spec.md`, this audit.

## Checks run

- `npm run build` with prebuild - og generated, sitemap index and 0 written, robots copied, no 404 on og.png favicon or manifest.
- `grep og:image dist/index.html` shows absolute `https://nox-void.vercel.app/og.png` plus width height.
- `grep canonical dist/` shows per page correct canonical.
- `cat dist/robots.txt` shows allow plus disallow mockup plus two sitemap lines.
- `cat dist/sitemap-index.xml` lists `sitemap-0.xml`, and `dist/sitemap-0.xml` lists 4 urls without mockup.
- OG image inspected at 1200x630, title `NOX // NEON VOID` with gradient, arena background visible with walls, players, orbs, grid.

## Remaining risks

- Site domain is fallback `https://nox-void.vercel.app`. If Vercel project uses a different subdomain or custom domain, set `PUBLIC_SITE_URL` env in Vercel to override. Without that, og:url and canonical will point to the fallback but still validate.
- Sharp version pinned to `0.34` - verify on Vercel Linux that binary installs. Fallback copies SVG to png path if sharp fails, so deploy never breaks but OG will be SVG bytes in a png file. Prefer keeping sharp installed.
- Social caches - after first deploy, force recrawl with `https://cards-dev.twitter.com/validator` and Discord `?v=1` query to bust cache.

## Not verified

- Live crawl on production after deploy. Run Lighthouse SEO audit and check OG with `https://www.opengraph.xyz/`.
