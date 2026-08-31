# Execution Spec: Online 1v1 (`feat/online-1v1`)

**Status:** Approved for implementation planning  
**Date:** 2026-08-31  
**Architecture source:** `docs/architecture/online-1v1-netcode.md` (read it first — this spec is the execution contract distilled from it)  
**Branch:** `feat/online-1v1` (CLAUDE.md §39 — main is never touched directly)

---

## 1. Problem

NOX 1v1 is local-only (two players, one keyboard). Players cannot compete against each other from different machines.

## 2. Users

- Two guests, each on their own PC, anywhere in the world.
- No accounts, no login, no email (per product decision — guest identity only).

## 3. Goals

1. Two humans on separate machines play a full 1v1 match (first-to-5, 60s rounds) over the internet.
2. Matchmaking: private room codes + public Quick Match queue.
3. Guest sessions: UUID + nickname + HMAC session token. No account system.
4. Server-authoritative simulation (anti-cheat by construction).
5. **Offline same-PC 1v1 remains available, unchanged, forever** (hard requirement, user mandate 2026-08-31).

## 4. Non-Goals

- ❌ Removing or degrading offline 1v1 in any way — it shares the new sim core but keeps its own mode entry, input model (P1 WASD + P2 arrows), and zero-network path.
- ❌ Login/accounts/ELO/leaderboards/persistence across server restarts.
- ❌ Trials mode networking (bot mode stays 100% local; `trials-mode.js` and `bot-ai.js` untouched).
- ❌ Free-text chat, spectators, tournaments, region selection (v2+).

## 5. Functional Requirements (testable)

| ID | Requirement |
|---|---|
| FR-1 | `/play/online` page offers: Create Room, Join by Code, Quick Match, nickname input |
| FR-2 | Creator receives 5-char room code + shareable URL (`/play/online?room=XXXXX`) |
| FR-3 | Quick Match pairs the first two waiting guests (server FIFO) |
| FR-4 | Both players see each other's nickname + live ping before and during match |
| FR-5 | Server runs the sim; clients send 6-bit input masks (≤30Hz) and render 30Hz snapshots |
| FR-6 | Full round flow works online: countdown → play → round end → first-to-5 → match end |
| FR-7 | Own-player movement is client-predicted with server reconciliation; remote entities interpolated |
| FR-8 | Disconnect: 20s grace with reconnect via guestId+token; then forfeit-loss and room close |
| FR-9 | Rematch handshake with seat/color swap |
| FR-10 | Forfeit works from both the UI button and tab close (grace covers accidental close) |
| FR-11 | **Local 1v1 at `/play/1v1` plays identically to today** (shared-keyboard, zero network). Regression-gated at every checkpoint |
| FR-12 | Walls/pickups generated server-side from a broadcast seed (both clients see identical map) |

## 6. Interface Contracts

### 6.1 Module contracts (new)

```
frontend/src/game/sim/game-sim.js      (isomorphic: browser + Node)
  createMatch(seed, opts) -> match
  simTick(match, inputs[2], dt) -> match   // pure; RNG via match.rng only
  MATCH_TICK_HZ = 60; SNAPSHOT_HZ = 30

frontend/src/game/net/net-bridge.js    (client)
  connect(url, guest) -> session
  on(snapshot, fn); sendInput(mask); leave()

frontend/src/game/input.js             (client, online seat)
  attachSinglePlayerKeymap(el, 'wasd'|'arrows') -> mask provider
```

### 6.2 Wire protocol (canonical; server rejects all else)

| Dir | Type | Payload |
|---|---|---|
| C→S | `hello` | `{guestId, nick}` |
| S→C | `session` | `{token}` (HMAC, 12h) |
| C→S | `create` \| `join{code}` \| `quick` | — |
| S→C | `room` | `{code, youSeat, seats:[{nick,ping}\|null, …], seed}` |
| C→S | `ready` | — |
| S→C | `countdown` | `{t}` |
| C→S | `input` | `{seq, m}` — 6 bits: U D L R DASH SHOOT |
| S→C | `snapshot` | `{tick, p:[{x,y,hp,dash,shld,ammo,inv}×2], b, pk, score, time}` |
| S→C | `roundEnd` \| `matchEnd` | `{winner, reason, scores}` |
| C→S | `rematchReq` / S→C `rematchOk` | — |
| C→S | `forfeit` / S→C `peerLeft{graceMs}` | — |
| C↔S | `ping`/`pong` | `{t}` |

### 6.3 Server contracts

- `backend/server.js` gains: WS upgrade (Origin-checked), `RoomManager` (`Map<code, Room>`), room cap 2 seats, per-socket rate limits (60 msg/s), token issuance.
- Env: `WS_SECRET` (token signing), `PORT` (exists). Never logged, never committed.

## 7. Constraints

- Astro stays static (`output:'static'`); no serverless on Vercel (ADR 0002).
- Server hosts on Render per ADR 0001 (`render.yaml` exists; free tier, WS-capable, spins down 15 min idle).
- `game-sim.js` must run in Node ≥18 with zero DOM references (enforced by sim unit tests running in `node --test`).
- Existing `window.NOX_GAME` API and CustomEvent bridge remain the presentation-layer interface.

## 8. Offline-1v1 Preservation (FR-11) — mandatory design rules

1. `startGame()` local path re-implemented as: `createMatch(randomSeed)` → rAF loop calling `simTick(match, [p1Keys, p2Keys], dt)` → view. Same felt behavior; shared-keyboard input untouched.
2. Mode-select registry (`play.astro`) keeps the offline 1v1 card permanently; online is a **new** card/page, never a replacement.
3. Every phase checkpoint includes: manual local-1v1 regression (one full round, both players' controls, dash/pickups/shield, round→match end, rematch) + build green.
4. If any phase cannot ship without regressing local 1v1, that phase does not ship. Rollback = branch abandon; main stays playable throughout.

## 9. Security Requirements

All state server-computed (clients send booleans only) · `wss://` in prod · Origin check on upgrade · HMAC token, 12h TTL, no PII, never logged · rate limits (token issue 10/h/IP, room create 5/h/IP, msg 60/s/socket) · nickname sanitized (control chars stripped, 2–16 chars, `textContent` render only) · flood → close 1009 · queue cap 100.

## 10. Testing Requirements

- `node --test` sim unit tests: tick determinism (same seed+inputs = same state hash), collision/pickup/scoring invariants, no-DOM assertion (sim module imports only stdlib).
- Server integration tests (existing harness `backend/test/`): room lifecycle, join/quick pairing, input flood kick, disconnect grace, token expiry.
- Manual scripts: two-tab match, latency simulation (DevTools throttling), local 1v1 regression checklist.
- `npm test` (root) stays green at every checkpoint.

## 11. Rollout / Rollback

- Deploy: Render service goes live with WS; Vercel static already deploys the new page. Online mode is additive — feature is page-gated, no flag needed beyond not linking until Phase 3 passes.
- Rollback: redeploy previous Render deploy (static server) or unlink the online card; offline 1v1 unaffected in all cases.

## 12. Top-Level Acceptance Criteria

- [ ] Two browsers on different networks complete a full online match to matchEnd with correct winner and score.
- [ ] Quick Match pairs two guests; room code flow works from a share link.
- [ ] Mid-match disconnect → reconnect within 20s resumes seat; after 20s → loss awarded.
- [ ] Local 1v1 regression checklist passes (FR-11).
- [ ] `npm test` green (sim + server suites).
- [ ] Security checklist (§9) verified.
