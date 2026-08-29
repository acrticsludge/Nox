# Link and OG Architecture - NOX // NEON VOID

Status: Implemented
Date: 2026-08-29
Scope: frontend link graph, canonical URLs, robots, sitemap, Open Graph

## Principle

Every public URL must be crawlable from one hop off home, have one canonical, one OG image and be listed in sitemap. Internal links are visible text, not JS only. No em dashes in link copy or meta.

## Canonical base

`SITE.url` in `frontend/src/config/site.ts` is the single source. Astro `site` in `frontend/astro.config.mjs` mirrors it. Both read `PUBLIC_SITE_URL` then `VERCEL_URL` then fallback `https://nox-void.vercel.app`. All SEO emits use this base. Change domain in one place, sitemap and og:url update everywhere.

## Link graph

```
    / (home)
    |-- /play (mode select)
    |    `-- /play/1v1 (live arena, client island)
    |-- /docs (manual, MDX)
    `-- /mockup (lab, noindex, excluded from sitemap)
```

Header links: `NOX` to `/`, `PLAY` to `/play`, `DOCS` to `/docs`. Footer links repeat. Landing cards link to `/play/1v1` and `/docs`. Docs footer links to `/play`, `/play/1v1`, `/mockup`. No orphan pages.

## Robots and sitemap

- `frontend/public/robots.txt` allows all, disallows `/mockup` and `/api/`, points to both `sitemap-index.xml` and `sitemap.xml` for compatibility with Astro 7 sitemap output. Copy of robots is served from `dist/robots.txt` unchanged.
- `@astrojs/sitemap` integration generates `sitemap-index.xml` at build. Config filters out any URL containing `/mockup` and lists canonical pages explicitly: `/`, `/play`, `/play/1v1`, `/docs`. `lastmod` is build time. `robots.txt` and `sitemap` stay in sync via `SITE`.

## Open Graph

OG image is not a generic gradient. It is the real arena SVG rendered to PNG, so the share card looks exactly like the game.

- Source SVG built by `frontend/scripts/generate-og.mjs` from true game tokens: `--nox-bg #07090b`, lime `#c9ff2f`, cyan `#58d8ff`, pink `#ff5ca8`, amber `#ffb23e`, grid `40x40 #213035`, walls `#0f172a` with `wallGrad`, arena `960x560` with 4 walls, slime, lava vent, 3 ammo pickups plus overcharge orb, 4 bullets with trails, 2 razor darts `M 18 0 L -12 -11 L -8 0 L -12 11 Z` with cockpit rings, shield rings, void corner brackets.
- Title overlay inside same SVG: eyebrow `TWO PLAYERS. ONE VOID.` in lime, big `NOX` with lime to cyan to pink gradient, `NEON VOID` below, meta `SAME KEYBOARD • FIRST TO 5 • 60S ROUNDS`, bottom bar with diamond `NOX // NEON VOID`, center `BUILT WITH SVG • NO CANVAS • 60FPS`, right coords. Top hairline lime. All mono `Courier New`.
- Output size `1200x630` for `summary_large_image`. File `frontend/public/og.png` plus `og.svg` source. Generated before every build via `prebuild` hook and via `sharp` resize. If `sharp` missing, fallback copies SVG so `/og.png` never 404s. Verified PNG is `83KB`.
- Every page emits via `frontend/src/components/SEO.astro`: `og:title`, `og:description`, `og:url`, `og:type`, `og:locale`, `og:image` absolute `https://nox-void.vercel.app/og.png` plus `og:image:width 1200`, `og:image:height 630`, `og:image:alt`, `twitter:card summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`, `canonical` link, `theme-color #07090b`, `color-scheme dark`, favicon links, manifest, plus JSON-LD `VideoGame` or `BreadcrumbList` where relevant.
- Pages: `/` VideoGame, `/play` BreadcrumbList, `/play/1v1` VideoGame, `/docs` BreadcrumbList article, `/mockup` noindex.

## SEO component

`frontend/src/components/SEO.astro` takes `title`, `description`, `canonical` (relative or absolute), `image`, `imageAlt`, `type`, `noindex`, `structuredData`. It builds `canonicalUrl` as `SITE.url + pathname` if not provided. All tags emitted in one place. No page duplicates logic.

## Favicons and manifest

- `frontend/public/favicon.svg` is a cyber diamond: outer `16x16` rotated square stroke lime, inner `7x7` fill lime on `#07090b` with `#1b2427` border. Pure SVG.
- `frontend/public/apple-touch-icon.png 180x180` generated from same SVG via `sharp` in `frontend/scripts/make-icons.mjs`.
- `frontend/public/favicon-32.png` and `favicon.ico` same source `32x32`.
- `frontend/public/site.webmanifest` lists name `NOX // NEON VOID`, background and theme `#07090b`, display standalone, icons for apple touch and og.

## Verification

Build produces `dist/sitemap-index.xml`, `dist/sitemap-0.xml`, `dist/robots.txt`, `dist/og.png`, `dist/favicon.svg`, `dist/apple-touch-icon.png`, `dist/site.webmanifest` plus per page `index.html` with correct meta. Manual check: view source on each route, inspect `og:image` is absolute, `canonical` matches location, `robots` allows index except mockup.

## Change rule

When adding a route, add it to `SITE_LINKS` in `site.ts`, add SEO to the page, update sitemap `customPages` if needed, and if it is public add a visible link from `/` or `/play`. Do not invent colors outside `docs/design/DESIGN.md`.
