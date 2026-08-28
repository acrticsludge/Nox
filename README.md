# Nox — NEON VOID

A fast 2-player arena duel, played on one keyboard. Dash through walls, grab
power orbs, dodge lava — first to **5 wins** takes the void.

This repository wraps the single-file game (`index.html`, zero dependencies)
in a tiny Node.js server so it can run locally or deploy to Render's free
tier and be reached at a public URL.

## Quick start (local)

Requires Node.js 18+.

```bash
npm start
# open http://localhost:3000
```

`npm run dev` starts the server with auto-restart on file changes.

## Tests

```bash
npm test
```

Runs the `node:test` suite (`test/server.test.js`) against the server on an
ephemeral port — covers serving, the health endpoint, 404/405 handling,
path-traversal blocking, and the sensitive-file denylist.

## Deploy to Render (free)

1. Push this repository to GitHub.
2. In the Render dashboard: **New → Blueprint**, select the repo.
3. Render reads `render.yaml` (web service, free plan, `healthCheckPath: /health`)
   and deploys automatically.

Free-tier caveat: Render spins the service down after **15 minutes without
traffic**; the first visit after idle takes ~1 minute to wake up.

## How to play

- **P1 (Cyan):** `W A S D` move · `Left Shift` dash · `Space` fire
- **P2 (Magenta):** `↑ ← ↓ →` move · `/` or `Right Shift` dash · `Enter` fire
- Dash = brief invincibility + speed burst. Walls block movement and bullets.
- ⚡ Overcharge = triple shot · ❄ Frost = shield (3 HP, cracks) · ✦ Blink =
  dash reset + speed · ✚ Heal = +1 HP
- Lava burns, slime slows, and after 45 s the **Void** starts crushing the
  arena — don't camp.

## Project structure

```text
index.html   the game (unchanged single file)
server.js    zero-dependency static server + /health
test/        node:test suite
render.yaml  Render blueprint (free plan)
docs/        plans, ADRs, architecture
```

## Roadmap

- **Online 1v1 / free-for-all / teams** — server-authoritative play over
  WebSockets (room codes, input snapshots, state broadcast). The current
  server is the foundation for this.
