# Implementation Plan: Nox — Render Deployment Migration

**Status:** Implemented (awaiting Render deploy by user)
**Date:** 2026-08-28
**Branch:** `feat/render-deploy`

## Overview

Migrate the existing single-file game (`index.html`, NEON VOID — a 2-player
local arena shooter, zero dependencies) into a minimal, Render-deployable
Node.js project named **Nox**. The game itself is unchanged — this change
only wraps it in a tiny static server and deployment configuration so it can
be reached at a public URL on Render's free tier.

Scope is intentionally limited: **no multiplayer networking yet** (that is the
next phase). The server is the foundation that future WebSocket-based online
play will extend.

## Architecture Decisions

- **Zero-dependency Node.js HTTP server** (`server.js`) serves the game. No
  Express, no build step, no lockfile churn — smallest thing that works.
- **Plain JavaScript (ESM), not TypeScript.** The repository has no existing
  TypeScript tooling and a single plain-JS file; introducing a TS toolchain
  violates the "minimum necessary complexity" rule. Deviation from CLAUDE.md
  §23 is deliberate and recorded in ADR 0001.
- **`/health` endpoint** for Render health checks and basic observability.
- **Tests with built-in `node:test` + global `fetch`** — zero dependencies.
- **render.yaml blueprint** so deployment is declarative and free-tier by
  default (`plan: free`).
- **Git**: existing files (`index.html`, `CLAUDE.md`) are committed to `main`
  as the production baseline; all work happens on `feat/render-deploy` and
  never touches `main` (CLAUDE.md §39).

## Task List

### Phase 1: Foundation

- [ ] Task 1: Init git repo, commit baseline to `main`, create
      `feat/render-deploy` branch
  - Acceptance: `git log` shows baseline commit on `main`; `git branch`
    shows `feat/render-deploy` checked out; `main` untouched by later work.
- [ ] Task 2: Add `.gitignore` (node_modules, .env, graphify-out) and
      `package.json` (name `nox`, `type: module`, scripts start/test/dev,
      engines node >=18, zero dependencies)
  - Acceptance: `npm test` and `npm start` script names exist; no
    dependencies array.

### Phase 2: Server + Tests

- [ ] Task 3: Add `server.js` — static file server
  - Serves `index.html` at `/`
  - Serves other files from the project root with path-traversal protection
  - `GET /health` → 200 `{"ok":true}`
  - Listens on `process.env.PORT || 3000`; startup log line
- [ ] Task 4: Add `test/server.test.js` (`node:test` + `fetch`)
  - `GET /` → 200, `text/html`, contains game marker
  - `GET /health` → 200, JSON ok
  - `GET /nope` → 404
  - Traversal (`/../package.json`, `/%2e%2e%2f`, `..%5c`) → 4xx, never leaks
    files outside root
  - Dotfile request (`/.gitignore`) → 404
  - Acceptance: `npm test` passes (run against ephemeral port)

### Phase 3: Deployment + Docs

- [ ] Task 5: Add `render.yaml` blueprint (web service, node runtime, free
      plan, `healthCheckPath: /health`) and `README.md` (run locally, test,
      deploy to Render, controls)
  - Acceptance: render.yaml is valid YAML; README matches actual commands.
- [ ] Task 6: Add docs — ADR `docs/decisions/0001-*`, architecture overview
      `docs/architecture/*`
  - Acceptance: docs exist in canonical CLAUDE.md locations; no secrets.

### Checkpoint: Complete

- [ ] `npm test` green
- [ ] Manual check: `npm start` → curl `/`, `/health`, 404 path
- [ ] Diff reviewed (built-in review subagent)
- [ ] `main` has zero new commits (only the baseline)

## Verification Steps

```text
npm test
npm start (manual: GET /, GET /health, GET /missing, traversal attempts)
render.yaml YAML sanity check
```

## Rollout / Rollback

- Deploy: connect repo to Render (or use Blueprint from `render.yaml`).
- Rollback: Render redeploy of the previous commit; server is stateless, so
  rollback is a redeploy — no data migration involved.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Path traversal serving files outside root | High | Canonical path + prefix check; tests cover encoded/backslash variants |
| Render free tier spin-down after 15 min idle | Low (casual sessions) | Documented in README; ~1 min cold start on first visit |
| Plain JS vs CLAUDE.md TS standard | Low | Recorded as deliberate deviation in ADR 0001 |

## Open Questions

- In-game title stays "NEON VOID"; project name is "Nox". Rename in-game
  branding later if desired.
