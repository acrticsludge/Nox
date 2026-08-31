# Implementation Plan: Online 1v1 (`feat/online-1v1`)

**Spec:** `docs/reasonix/specs/online-1v1.md` · **Architecture:** `docs/architecture/online-1v1-netcode.md`  
**Branch:** `feat/online-1v1` · main untouched (CLAUDE.md §39)  
**Standing gate at every checkpoint:** offline same-PC 1v1 plays identically (spec FR-11) + `npm test` green.

---

## Overview

Ship server-authoritative online 1v1 (guest-only, room codes + quick match) by first extracting a pure isomorphic sim core from `game-logic.js`, then layering WS rooms, server sim, and net-feel on top. Offline 1v1 is preserved by routing it through the same sim core.

## Architecture Decisions

- Server-authoritative WebSockets on Render (ADRs 0001/0002); no WebRTC, no lockstep.
- One `game-sim.js` module runs in browser (offline 1v1) and Node (server) — single rules source, zero drift.
- Trials mode untouched — bot stays local.

---

## Task List

### Phase 0 — Sim extraction (behavior-preserving) · ~60% of effort

- [ ] **T1. Create `frontend/src/game/sim/game-sim.js`** — extract from `game-logic.js`: movement/physics, bullets, collisions, pickups, walls, round/timer/score state machine. Replace all `Math.random()` with injected `match.rng` (seeded). Zero `document`/`window` refs.
  - AC: `node --test` sim suite passes: same seed+inputs → identical state hash ×10k ticks; module imports no DOM globals.
  - Files: `sim/game-sim.js` (new), `sim/game-sim.test.js` (new)
  - Deps: none · Size: L (break into T1a movement/bullets, T1b pickups/walls, T1c round flow if needed)

- [ ] **T2. Rewire offline 1v1 onto the sim** — `startGame()` local path becomes `createMatch` → rAF `simTick(match, [p1Keys,p2Keys], dt)`; view/HUD/input code untouched. **Do not remove the old code paths until parity is proven.**
  - AC: local regression checklist passes (full round both keyboards, dash/pickups/shield/round-end/rematch); `npm run build` green.
  - Files: `game-logic.js`, `input.js` (new, shared-keymap extraction)
  - Deps: T1 · Size: L

- [ ] **T3. Extract `game-view.js`** — move `render()`, `updateHUD*`, particles, draw* out of `game-logic.js`; sim output feeds view via plain state read.
  - AC: offline 1v1 visually identical (side-by-side screenshots before/after); build green.
  - Files: `game-view.js` (new), `game-logic.js` (slims)
  - Deps: T2 · Size: M

**Checkpoint 0:** local 1v1 regression ✅ · `npm test` + `npm run build` ✅ · **STOP: human sanity-check of offline 1v1 feel before networking begins.**

### Phase 1 — WS server + rooms + guests

- [ ] **T4. WS layer + sessions** — `ws` dep; Origin-checked upgrade; `hello`→HMAC `session` token (12h, `WS_SECRET`); rate limits; flood kick 1009.
  - AC: integration tests — token issue/expire, origin reject, 61 msg/s → kick. No secrets committed.
  - Files: `backend/server.js`, `backend/package.json`, `backend/test/net.test.js`
  - Deps: none (parallel-safe with T1–T3) · Size: M

- [ ] **T5. RoomManager + matchmaking** — create/join(5-char code)/quick FIFO queue; seat assignment; seed broadcast; queue cap 100; room cap 2.
  - AC: tests — create/join/quick pair, code collision, caps enforced.
  - Files: `backend/rooms.js` (new), `backend/test/rooms.test.js`
  - Deps: T4 · Size: M

- [ ] **T6. Lobby UI** — `/play/online` page: nickname input, Create/Join/Quick, seat + ping display, share-link param handling; warm-ping `/health` on load.
  - AC: two tabs see each other in lobby with correct nicks/pings; bad code → clear error state.
  - Files: `pages/play/online.astro`, `GameShell.tsx` (online branch), `net-bridge.js`
  - Deps: T4, T5 · Size: M

**Checkpoint 1:** two tabs share a lobby ✅ · abuse tests green ✅ · offline 1v1 regression ✅

### Phase 2 — Server sim + snapshots

- [ ] **T7. Headless sim on server** — reuse `game-sim.js` in Node; 60Hz tick, 30Hz snapshot broadcast; inputs validated as 6-bit masks + monotonic seq.
  - AC: sim determinism suite runs in backend tests; snapshot ≤ 600B avg.
  - Files: `backend/match.js` (new), `backend/test/match.test.js`
  - Deps: T1, T5 · Size: M

- [ ] **T8. Client render-bridge** — `net-bridge.js` consumes snapshots into view state; walls/pickups from `seed`; ready → countdown → roundEnd → matchEnd flows online.
  - AC: **full match playable tab↔tab, first-to-5, correct winner/score.**
  - Files: `net-bridge.js`, `GameShell.tsx`, `game-view.js` (snapshot renderer)
  - Deps: T6, T7 · Size: L

**Checkpoint 2:** end-to-end match on localhost ✅ · offline 1v1 regression ✅

### Phase 3 — Net feel + robustness

- [ ] **T9. Prediction + interpolation** — own-player local prediction + server reconciliation (lerp 200ms); remote/bullets snapshot interpolation (100ms buffer).
  - AC: manual 150ms-throttled playtest feels responsive; no rubber-banding on own movement.
  - Files: `net-bridge.js`, `game-view.js` · Deps: T8 · Size: L

- [ ] **T10. Disconnect grace + rematch + forfeit** — 20s seat-hold on drop; token reconnect; rematch handshake w/ seat swap; forfeit from UI and tab-close.
  - AC: tests — grace expire → loss; reconnect resumes seat; rematch swaps colors.
  - Files: `backend/match.js`, `net-bridge.js`, overlays · Deps: T8 · Size: M

**Checkpoint 3:** spec FR-6..FR-10 demonstrated ✅

### Phase 4 — Harden + ship

- [ ] **T11. Security sweep** — spec §9 checklist on live sockets (no client-sent positions anywhere, sanitization, caps, token hygiene).
  - AC: checklist documented in `docs/audits/security/2026-08-online-1v1.md`; all items closed.
  - Deps: T10 · Size: S

- [ ] **T12. Deploy + verify** — Render deploy (`render.yaml` ready), env `WS_SECRET` set in dashboard, prod `wss://` URL wired via Vercel env; deploy verification per CLAUDE.md §40 gates (bindings/URL/routes/logs/rollback).
  - AC: two real devices on different networks complete a match; rollback path tested (previous deploy redeploys clean).
  - Files: `render.yaml` (if URL/config needed), docs · Deps: T11 · Size: S

**Checkpoint 4 (ship):** spec §12 all boxes ✅ → merge `feat/online-1v1` → main.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| T1–T3 refactor regresses offline 1v1 | High | Behavior-preserving extraction, old paths kept until parity, regression gate at every checkpoint |
| Monolith extraction balloons | Medium | Timebox per task; if T1 exceeds scope, split T1a/b/c; view extraction (T3) may defer |
| Render free cold start hurts first match | Medium | `/health` warm-ping on page load; expectation documented |
| Cross-region latency feel | Medium | T9 prediction; v2 DO migration path already documented |

## Open Questions (non-blocking, defaults chosen)

1. Nickname persistence across sessions → default: localStorage reuse (no server persistence).
2. Input keymap for online seat → default: WASD primary, arrows selectable in lobby.

## Commit Slicing

One commit per task (T1…T12), imperative messages (`feat(net): …`, `refactor(sim): …`), no unrelated changes; planning docs commit first on branch.
