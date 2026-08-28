# ADR 0002: Astro frontend on Vercel, Node backend split into backend/

- **Status:** Accepted
- **Date:** 2026-08-28
- **Branch:** `feat/astro-vercel-frontend`

## Context

ADR 0001 chose a zero-dependency Node static server hosted on Render free
tier. The user then specified two changes:

1. The **frontend must be hostable on Vercel** (fast global CDN, free Hobby
   tier, no spin-down cold starts — unlike Render free web services).
2. The frontend should be built with **Astro** (matches the project's
   documented stack preference; static output with zero runtime cost).
3. The repository should have **separate `backend/` and `frontend/` folders**.

Verified facts (docs, 2026-08):

- Astro static sites deploy to Vercel with **zero configuration** — no
  adapter needed; Vercel auto-detects the Astro framework and serves the
  static build.
- Vercel's serverless functions cannot host long-lived WebSocket servers, so
  the future multiplayer backend (WebSocket) cannot live on Vercel — it stays
  on Render (or Cloudflare Workers + Durable Objects).
- Render blueprints support `rootDir`, so the backend can live in a
  subdirectory while the blueprint stays at the repo root.

## Decision

- **`frontend/`** — an Astro 7 static site. The single-file game
  (`index.html`) becomes `frontend/src/pages/index.astro` with its CSS and JS
  preserved verbatim (`<style is:global>`, `<script is:inline>`). Astro's
  build extracts/minifies the CSS (functionally identical, verified) and keeps
  the game script inline byte-for-byte. Deployed to **Vercel** (root
  directory: `frontend`).
- **`backend/`** — the Node server (zero dependencies), its tests, and its
  package files, moved out of the repo root. It now serves the Astro build
  output at `../frontend/dist` and exposes `/health`; it remains the home of
  the future WebSocket multiplayer server. Deployed to **Render** via
  `render.yaml` with `rootDir: backend`.
- **Repo root** — a thin orchestrator `package.json` (dev/build/start/test
  pass through to the sub-projects), `render.yaml`, `docs/`, `README.md`.

## Alternatives considered

1. **Astro with the Vercel adapter (`@astrojs/vercel`)** — only needed for
   on-demand rendering/SSR; the game is fully static, so no adapter is used.
   Can be added later without rework if the frontend needs API routes.
2. **Frontend-only Vercel + no backend** — rejected: the multiplayer phase
   requires a WebSocket host; the backend foundation stays.
3. **Keep the game as a plain static folder (no framework)** — rejected by
   the explicit user choice to use Astro.

## Consequences

- **Good:** frontend on Vercel (free, CDN-cached, no spin-down); backend on
  Render (free, WebSocket-capable); clean monorepo layout; the game content
  is preserved with near-zero risk (script byte-identical, CSS minified only).
- **Trade-off:** two deploy targets instead of one; local dev requires
  `npm run dev` in `frontend/` (Astro) or `npm start` at root (build + serve
  via the backend). The backend's static-serving role is now a convenience
  preview, not the production frontend host.
- **Rollback:** each deploy target redeploys independently (Vercel frontend,
  Render backend); no shared state.
