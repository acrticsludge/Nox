# Nox — Architecture Overview

**Status:** Implemented (phase 1)
**Date:** 2026-08-28

## Current system (phase 1)

```text
Browser ──HTTP──▶ Node static server (server.js) ──fs──▶ index.html + assets
                        │
                        └─ GET /health → {"ok":true,"service":"nox"}
```

- **`index.html`** — the game: a 2-player, same-keyboard arena duel. All
  simulation and rendering live in one page (SVG, ~60 fps
  `requestAnimationFrame` loop). Game code is unchanged from the original
  single file.
- **`server.js`** — zero-dependency Node HTTP server (ESM, Node ≥18):
  - Serves the game at `/` (and other public files from the project root).
  - `GET /health` for Render health checks and observability.
  - Security posture: URL-decode then canonicalize paths; reject any path
    that escapes the root (both `/` and `\` separators), any dotfile segment,
    any file on the sensitive denylist (`server.js`, `package.json`,
    `render.yaml`, `CLAUDE.md`, `README.md`, `docs/`, `test/`, `.git/`, …),
    and any method other than GET/HEAD (405).
  - Structured request logging: `METHOD path status ms`.
- **Deployment** — `render.yaml` Blueprint: Node web service, free plan,
  `healthCheckPath: /health`.

## Design rules

- **Zero runtime dependencies** — the whole project runs on Node's standard
  library. Rationale: the game is dependency-free; keeping the server
  dependency-free removes supply-chain and version drift entirely.
- **Single-file game preserved** — the game itself is untouched; the server
  only wraps and serves it. This keeps the multiplayer migration (next phase)
  isolated to the networking layer.
- **Smallest architecture that works** — no framework, no build step, no
  database. See ADR 0001.

## Security boundaries

| Boundary | Control |
|----------|---------|
| Public files | Root-scoped; denylist for project/source files; no dotfiles |
| Path traversal | Decode + normalize + root-prefix check (tests cover encoded `/` and `\` variants) |
| Method abuse | 405 for anything but GET/HEAD |
| Malformed input | 4xx without crashing |
| Headers | `X-Content-Type-Options: nosniff`, explicit Content-Type, `Cache-Control: no-cache` |

There is no user input, auth, or stored data in this phase, so the trust
surface is the HTTP request path only.

## Roadmap: online multiplayer (next phase)

The intended evolution, per the product goal (play against college mates on
separate laptops):

```text
Client A ──inputs──▶ Room (server-authoritative sim) ──state──▶ Client A
Client B ──inputs──▶  (runs the existing update() logic)  ──state──▶ Client B
```

- Add `ws` (WebSocket) to `server.js`; rooms keyed by shareable codes.
- The server runs the authoritative game sim (the same logic already in
  `index.html`); clients send input snapshots (~20–30 Hz) and interpolate
  broadcast state (~30 Hz).
- Map generation (currently `Math.random` in the client) moves to the server
  and is broadcast once per room so all clients see the identical arena.
- Later: free-for-all/teams, client-side prediction.

## Observability

- Request log line per request (method, path, status, ms).
- `/health` endpoint used by Render's health checks.
- No secrets, tokens, or PII are logged or stored.
