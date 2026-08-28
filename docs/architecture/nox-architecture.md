# Nox — Architecture Overview

**Status:** Implemented (phase 2 — Astro frontend on Vercel, monorepo split)
**Date:** 2026-08-28

## System shape

```text
                    INTERNET
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
   Vercel (static)            Render (Node backend)
   frontend/                  backend/
   Astro 7 → dist             zero-dep HTTP server
        │                         │
        └─ index.astro ──┐   ┌────┴────┐
                         │   │         │
                     game page   /health   (future: WebSocket rooms)
```

## Frontend — `frontend/` (Astro, deployed on Vercel)

- **`src/pages/index.astro`** — the game (NEON VOID). Migrated from the
  original single-file `index.html` with its CSS and JS preserved:
  - `<style is:global>` — exact game CSS (Astro extracts + minifies it into
    `dist/_astro/index.*.css` at build; functionally identical).
  - `<script is:inline>` — exact game JS, emitted inline byte-for-byte.
- **Build:** `npm run build` (in `frontend/`) → static `frontend/dist`.
- **Deploy:** Vercel auto-detects Astro (root directory: `frontend`), zero
  configuration, free Hobby tier, no spin-down.
- The game is fully client-side — no SSR, no adapter needed. The Astro
  project is the growth point for future pages (e.g., an online lobby).

## Backend — `backend/` (Node, deployed on Render)

- **`server.js`** — zero-dependency Node HTTP server (ESM, Node ≥18):
  - Serves the built game from `../frontend/dist` (local preview /
    fallback hosting; warns if the build is missing).
  - `GET /health` for Render health checks.
  - Security posture: root-scoped paths (decode → normalize → prefix check),
    dotfile + `..` segment denial, sensitive-file denylist, 405 for
    non-GET/HEAD, fail-safe 500 with no internals leaked.
  - Structured request logging: `METHOD path status ms`.
- **`test/`** — `node:test` suite (12 tests) covering serving, health,
  404/405, traversal (incl. raw-path variants), denylist, dotfiles.
- **Deploy:** deferred until the online multiplayer phase. `render.yaml`
  (Blueprints) is ready (`rootDir: backend`, free plan,
  `healthCheckPath: /health`) but nothing is deployed to Render yet — the
  game runs entirely on Vercel today. The backend's first production job will
  be the multiplayer WebSocket server.

## Repo layout

```text
Nox/
├── frontend/          Astro game (Vercel)
├── backend/           Node server + tests (Render)
├── render.yaml        Render blueprint (rootDir: backend)
├── package.json       thin root orchestrator (dev/build/start/test)
├── docs/              plans, ADRs, architecture
└── README.md
```

## Design rules

- **Monorepo with clear separation** — `frontend/` and `backend/` are
  independent npm projects; the root package.json only orchestrates.
- **Zero-dependency backend** — the whole server runs on Node's standard
  library (ADR 0001).
- **Game code preserved** — the migration kept the game logic untouched
  (script byte-identical; CSS minified only by Astro).
- **Static frontend, WebSocket-ready backend** — Vercel serves the page; the
  real-time layer, when added, lives on Render.

## Security boundaries

| Boundary | Control |
|----------|---------|
| Public files (backend) | Root-scoped to `frontend/dist`; denylist for project/source files; no dotfiles |
| Path traversal | Decode + normalize + root-prefix check (tests cover encoded `/` and `\` variants) |
| Method abuse | 405 for anything but GET/HEAD |
| Malformed input | 4xx without crashing |
| Headers | `X-Content-Type-Options: nosniff`, explicit Content-Type, `Cache-Control: no-cache` |

Vercel serves only the static build output, so the frontend exposes no
server surface. The backend trust surface is the HTTP request path.

## Roadmap: online multiplayer (next phase)

```text
Client A ──inputs──▶ Room (server-authoritative sim) ──state──▶ Client A
Client B ──inputs──▶  (backend/ + ws)                   ──state──▶ Client B
```

- Add `ws` to `backend/server.js`; rooms keyed by shareable codes.
- The server runs the authoritative game sim (the same logic already in the
  page); clients send input snapshots (~20–30 Hz) and interpolate broadcast
  state (~30 Hz).
- Map generation (currently `Math.random` in the client) moves to the server
  and is broadcast once per room.
- Later: free-for-all/teams, client-side prediction.
- The frontend page will connect to the backend WebSocket URL (configurable
  via a Vercel environment variable).

## Observability

- Backend request log line per request (method, path, status, ms).
- `/health` endpoint used by Render's health checks.
- No secrets, tokens, or PII are logged or stored.
