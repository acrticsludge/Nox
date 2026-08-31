# Nox â€” NEON VOID

A fast 2-player arena duel, played on one keyboard. Dash through walls, grab
power orbs, dodge lava â€” first to **5 wins** takes the void.

**Nox is a monorepo:**

| Folder | What | Deploys to |
|---|---|---|
| `frontend/` | The game, built with **Astro 7** (static output) | **Vercel** (free, auto-detected) |
| `backend/` | Zero-dependency **Node server** + `/health` + tests | **Render** (free, `rootDir: backend`) |

The game itself is unchanged from the original single file â€” it now lives as
an Astro page with its CSS/JS preserved verbatim.

## Quick start (local)

Requires Node.js 18+.

```bash
npm install            # root orchestrator (no deps)
npm --prefix frontend install
npm --prefix backend install

npm run dev            # Astro dev server (hot reload) â†’ http://localhost:4321
npm start              # game server only (WS + /health) - ws://localhost:3000
```

## Tests & checks

```bash
npm test               # builds the frontend, then runs backend tests (27)
npm run check          # astro check (typecheck the Astro project)
```

Backend tests (`backend/test/`) cover serving, the health endpoint, 404/405,
path-traversal blocking (incl. raw-path variants), and the sensitive-file
denylist â€” all against the real Astro build output.

## Deploy

### Frontend â†’ Vercel (free)

1. Push this repository to GitHub.
2. In Vercel: **Add New â†’ Project** â†’ import the repo.
3. Set **Root Directory** to `frontend` â€” Vercel auto-detects Astro.
4. Deploy. Static output = fast CDN, no spin-down.

### Backend - Render (required for online 1v1)

The backend's only production job will be hosting the multiplayer WebSocket
rooms. Until that exists, **skip this step** â€” the game runs entirely on
Vercel, and deploying the backend now would just add a second URL for the same
static page (plus a ~1 min cold start after 15 min idle). The backend still
works locally (`npm start`) as a preview server and is the tested foundation
for the next phase.

When online play lands:

1. Push this repository to GitHub.
2. In Render: **New â†’ Blueprint** â†’ select the repo.
3. `render.yaml` defines the web service (`rootDir: backend`, free plan,
   `/health` check) and builds the frontend as part of the deploy.

Free-tier caveat (Render only): the service spins down after **15 minutes
without traffic**; the first visit after idle takes ~1 minute to wake. The
Vercel-hosted frontend is unaffected.

## How to play

- **P1 (Cyan):** `W A S D` move Â· `Left Shift` dash Â· `Space` fire
- **P2 (Magenta):** `â†‘ â† â†“ â†’` move Â· `/` or `Right Shift` dash Â· `Enter` fire
- Dash = brief invincibility + speed burst. Walls block movement and bullets.
- âš¡ Overcharge = triple shot Â· â„ Frost = shield (3 HP, cracks) Â· âœ¦ Blink =
  dash reset + speed Â· âœš Heal = +1 HP
- Lava burns, slime slows, and after 45 s the **Void** starts crushing the
  arena â€” don't camp.

## Project structure

```text
frontend/            Astro game (src/pages/index.astro) â†’ dist/
backend/             Node server (server.js) + tests + package.json
render.yaml          Render blueprint (rootDir: backend)
package.json         root orchestrator (dev/build/start/test)
docs/                plans, ADRs, architecture
```

## Roadmap

- **Online 1v1 / free-for-all / teams** â€” server-authoritative play over
  WebSockets (room codes, input snapshots, state broadcast). The backend in
  `backend/` is the foundation; the frontend will connect to it via a
  configurable WebSocket URL. See `docs/architecture/nox-architecture.md`.
