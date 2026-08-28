# ADR 0001: Host Nox on Render free tier as a zero-dependency Node server

- **Status:** Accepted
- **Date:** 2026-08-28
- **Branch:** `feat/render-deploy`

## Context

Nox is a single-file HTML game (`index.html`, ~80 KB, zero dependencies,
plain JavaScript, SVG rendering). The goal is to make it reachable at a
public URL for free, with the next phase being online multiplayer between
laptops.

Constraints and facts:

- The game has no build step and no existing JS tooling in the repository.
- CLAUDE.md §23 states TypeScript everywhere, but §22 says to match the
  existing architecture and not introduce replacement technology for
  preference — the repository contains only plain-JS/HTML.
- Future multiplayer needs a persistent, low-latency connection channel
  (WebSocket) that a plain static host cannot provide.
- Verified free hosting options: Render free tier (Node web services,
  WebSockets supported, 750 hrs/month, spins down after 15 min idle) and
  Cloudflare Workers + Durable Objects (no spin-down, but a different runtime
  and toolchain).

## Decision

- Wrap the game in a **zero-dependency Node.js HTTP server** (`server.js`,
  ESM, Node ≥18) that serves the static game files, exposes `GET /health`,
  and enforces a strict public-file allowlist (traversal protection, dotfile
  denial, sensitive-file denylist, 405 for non-GET/HEAD).
- Deploy via a **`render.yaml` Blueprint** on the **free plan**, keeping the
  option to add `ws` (WebSocket) to the same server for the multiplayer phase.
- Use **plain JavaScript, not TypeScript**, for this server — a deliberate
  deviation from CLAUDE.md §23, justified by "minimum necessary complexity":
  there is no toolchain, no shared types, and the total server surface is one
  small file. This can be revisited when multiplayer introduces real shared
  contracts.
- Tests use the built-in `node:test` runner and global `fetch` — still zero
  dependencies.

## Alternatives considered

1. **Render static site / Netlify / GitHub Pages** — free and simple, but
   cannot host WebSockets; would block the multiplayer phase and force a
   second service later. Rejected.
2. **Express + ws server** — familiar but adds a dependency layer with no
   current need; the built-in `http` module suffices for static serving.
   Rejected for now (revisit when adding multiplayer).
3. **Cloudflare Workers + Durable Objects** — best always-on behavior (no
   spin-down cold start) and free tier (100k req/day, 13,000 GB-s/day), but
   a different runtime, wrangler toolchain, and deployment model. Kept as a
   documented option for later if Render's spin-down becomes a problem.

## Consequences

- **Good:** zero dependencies, zero cost, one-command local run, Blueprint
  deployment, and a server that already speaks the protocol family (HTTP) the
  multiplayer phase will extend.
- **Trade-off:** Render free tier spins the service down after 15 minutes
  without traffic; the first visit after idle takes ~1 minute to wake. Free
  instances also have an ephemeral filesystem — fine because the game holds
  no server-side state yet.
- **Rollback:** a redeploy of a previous commit; the service is stateless.
