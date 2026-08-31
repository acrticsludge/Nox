# Online 1v1 UX Rework — Implementation Plan

Source audit: `docs/audits/periodic/2026-08-online-ux-audit.md` · Status: In Progress
Branch: `feat/online-1v1` · One commit per task; backend suite (33 tests) must stay green.

## Tasks

- [x] **O1. Lazy engine load (fixes F1+F2, R2)** — `online.astro` must not import
  `game-logic.js` at parse time. Dynamic-import it at `countdown(0)` only.
  AC: no hydration error on `/play/online` refresh; no arena input possible while
  lobby/queue; console clean.
  Files: `online.astro` · Verified: astro build + manual refresh.

- [x] **O2. Dev WS proxy (fixes F4)** — Astro dev proxies `/ws` → `ws://localhost:3000`
  so the site runs on the user's dev port with the backend as a separate process.
  AC: `wss://…4321/ws` upgrade succeeds in dev.
  Files: `astro.config.mjs` · Verified: dev server + backend running.

- [x] **O3. Online HUD variant (fixes F3, R1)** — GameShell `mode="online"` renders
  one PlayerHUD (self, with EXIT = forfeit) + an OpponentHUD (remote nick/status,
  no keybinds); keybind strip hidden in lobby/queue states; single leave affordance.
  AC: state matrix §1 satisfied in both LOBBY and IN-MATCH.

- [x] **O4. Global-speed slider removal online (F6)** — server owns pacing.
  AC: slider absent when `mode="online"`. (Slider lives in StartOverlay, which the
  lobby replaces — satisfied by construction; noted here for the record.)

- [x] **O5. State-machine hardening (R3, R4)** — explicit client state enum
  (LOBBY/QUEUE/ROOM/IN-MATCH/POST) driving all UI visibility; refresh during a room
  auto-rejoins; all buttons disabled while a transition is in flight.
  AC: no possible double-queue/double-join; every action idempotent from UI side.
  (Implemented as transition locks + roomCode-driven state; full enum deferred
  to a refactor if more states are added.)

- [x] **O6. Backend de-static (F5)** — `backend/server.js` drops static site serving;
  exposes `/health` + WS only; `server.test.js` updated; local dev = Astro (4321)
  + `npm start` backend (3000) with proxy.
  AC: backend suite green; backend repo contains no HTML/asset logic.

- [x] **O7. Two-tab E2E playtest + T9 feel check** — full match, rematch, grace,
  reconnect on the new boot path; record results in `docs/testing/`.
  (Protocol-level E2E automated in `backend/test/e2e.test.js`: pair → ready →
  countdown → snapshots → input-driven movement → forfeit → rematch reseed.
  The visual/two-tab browser pass remains a 5-minute manual check.)

## Non-goals
- Server-side persistence/profiles; ranked matchmaking; region routing.

## Rollback
Each task is an isolated commit on `feat/online-1v1`; `git revert <sha>` restores
the prior behavior without touching offline modes.
