# Implementation Plan: NOX Mode Parity and Session Unification

**Spec:** `docs/reasonix/specs/mode-parity-unification.md`  
**Audit:** `docs/audits/2026-08-cross-mode-parity-audit.md`  
**Execution rule:** Do these tasks in order. Keep Same-PC 1v1 playable after every task. One commit per task; do not mix refactoring with a behavioral change.

## Dependency map

```text
Shared mode types + lifecycle boundary
  ├─ Input ownership / online lazy boot
  ├─ Declarative online HUD and overlays
  └─ Authenticated reconnect + server state machine
       ├─ idempotent ready / countdown
       └─ rematch lifecycle
            └─ cross-mode visual + a11y QA
```

## Phase 0 — Establish the regression net

### Task 0.1: Document the baseline and make typecheck actionable

**Description:** Introduce the canonical mode type and update component prop types so online is deliberately supported. Fix the existing `GameOverOverlay` prop mismatch and unrelated type errors only when necessary to make `astro check` green; do not redesign UI here.

**Acceptance criteria:**

- [ ] No component accepts a private, incompatible mode union.
- [ ] `GameStage`, `CenterHUD`, and `HowToPlayModal` have an explicit online policy.
- [ ] `npm.cmd run check` passes with zero errors.

**Verification:** `npm.cmd run check`; `npm.cmd test`.

**Likely files:** `GameShell.tsx`, `GameStage.tsx`, HUD/overlay props, shared type file, any current type-error source.

**Dependencies:** None.  
**Scope:** Medium.

### Task 0.2: Add a three-mode manual regression matrix

**Description:** Add a reusable test document with exact expected UI state, controls, start/end behavior, and screenshots for local 1v1, Trials, and online.

**Acceptance criteria:**

- [ ] Matrix covers menu/lobby, countdown, active play, exit/pause/disconnect, end, rematch, keyboard-only, 360px, and 768px.
- [ ] It distinguishes automated versus manual evidence.

**Verification:** Human can run it without reading source code.

**Likely files:** `docs/testing/mode-parity-matrix.md`.

**Dependencies:** Task 0.1.  
**Scope:** Small.

## Phase 1 — Stop mode interference

### Task 1.1: Add a disposable session boundary

**Description:** Define a small lifecycle/session interface and use it to own listeners, timers, and game-loop startup. Keep the legacy engine behind the local and Trials adapters initially.

**Acceptance criteria:**

- [ ] Entering/leaving a route/session does not leak input listeners or timers.
- [ ] Every active mode can clear input state through one explicit operation.
- [ ] No mode transition invokes another mode’s start function.

**Verification:** focused unit tests where practical; local 1v1 full round; Trials start/pause/exit/resume; `npm.cmd test`; `npm.cmd run check`.

**Likely files:** new `frontend/src/game/session/*`, `game-logic.js`, `GameShell.tsx`.

**Dependencies:** Task 0.1.  
**Scope:** Large — split into separate commits for interface and adoption if it exceeds five files.

### Task 1.2: Make online boot genuinely lazy and isolate input

**Description:** Remove GameShell’s unconditional engine import for online. Start the rendering/simulation bridge only after pairing/countdown. Replace global online and legacy key handling with mode-owned listeners that respect editing controls and clear on blur/visibility changes.

**Acceptance criteria:**

- [ ] Online lobby/queue has no engine loop and arrows work in nickname/code fields and page navigation.
- [ ] Online sends no inputs before `PLAYING`.
- [ ] Tab switch, reconnect, leave, and match end clear all input bits.

**Verification:** browser console/network inspection; keyboard manual test; two-tab online test; `npm.cmd test`; `npm.cmd run check`.

**Likely files:** `GameShell.tsx`, `online.astro`, `game-logic.js`, net/input module.

**Dependencies:** Task 1.1.  
**Scope:** Medium.

### Checkpoint A

- [ ] Local 1v1 and Trials complete one start-to-end run without behavior regression.
- [ ] Online lobby does not import/start local gameplay.
- [ ] Tests and typecheck are green.

## Phase 2 — Repair online authority and lifecycle

### Task 2.1: Implement authenticated reserved-seat reconnect

**Description:** Bind a short-lived signed reconnect credential to guest, room, and seat. Reserve a disconnected seat during grace and reclaim it only after server verification. Store only active-room reconnect state in the client.

**Acceptance criteria:**

- [ ] Correct player reconnects to original seat/color within 20 seconds.
- [ ] A different guest cannot join the reserved seat.
- [ ] Invalid/expired/mismatched credentials are rejected without disturbing the active room.

**Verification:** backend integration tests for all three cases; two-browser disconnect/reconnect manual test; `npm.cmd test`.

**Likely files:** `backend/net.js`, `backend/rooms.js`, `backend/match.js`, backend tests, `net-bridge.js`, `online.astro`.

**Dependencies:** Checkpoint A.  
**Scope:** Large — split client/server commits while retaining a compatible protocol.

### Task 2.2: Make readiness and countdown one-shot

**Description:** Give each room/match a clear waiting/ready/countdown state and per-seat ready set. Repeated ready packets must be harmless.

**Acceptance criteria:**

- [ ] Two players produce exactly one `3,2,1,GO` sequence.
- [ ] Repeated ready packets cannot reset/restart a countdown.
- [ ] A reconnect during countdown follows a documented, tested policy.

**Verification:** backend integration test counts countdown messages; two-browser visual check; `npm.cmd test`.

**Likely files:** `backend/match.js`, `backend/rooms.js`, backend tests, `online.astro`.

**Dependencies:** Task 2.1.  
**Scope:** Medium.

### Task 2.3: Implement real online rematch

**Description:** Replace the transient end message with a post-match state. Keep the room available until both players decide; on mutual rematch, produce a new seed and one countdown.

**Acceptance criteria:**

- [ ] Both players can see rematch/leave after a normal win, forfeit, or resolved disconnect.
- [ ] Mutual rematch creates exactly one fresh match using a new seed.
- [ ] One player declining/timeout safely returns both to lobby and cleans up the room.

**Verification:** server integration test; two-browser full match/rematch; `npm.cmd test`; `npm.cmd run check`.

**Likely files:** `backend/server.js`, `backend/rooms.js`, `backend/match.js`, backend tests, `online.astro`, `GameShell.tsx`.

**Dependencies:** Task 2.2.  
**Scope:** Large — split room lifecycle and UI into separately verifiable commits.

### Checkpoint B

- [ ] Forged reconnect is rejected; original player resumes their exact seat.
- [ ] Online match starts once, ends once, and rematches once.
- [ ] Local 1v1 remains unaffected.

## Phase 3 — Make presentation intentionally mode-aware

### Task 3.1: Build declarative online HUD and status UI

**Description:** Replace imperative mutation of React cards with an online-specific HUD model: own/remote identity, colors, ping, connection state, and a self-owned exit affordance.

**Acceptance criteria:**

- [ ] Cyan and pink seats both see their own name and EXIT on their own card.
- [ ] Opponent state and ping are visible during play.
- [ ] Lobby, reconnect, and waiting states use clear text plus color.

**Verification:** screenshots from both seats; keyboard-only walkthrough; typecheck/build.

**Likely files:** game HUD components, `GameShell.tsx`, `online.astro`, `net-bridge.js`, CSS.

**Dependencies:** Checkpoint B.  
**Scope:** Medium.

### Task 3.2: Normalize overlays, help, and accessibility behavior

**Description:** Give every modal/lobby managed focus and correct semantics; provide an online help path; make mode-specific pause/exit policies explicit.

**Acceptance criteria:**

- [ ] Focus enters each opened overlay, cycles inside it, and returns to the trigger.
- [ ] Escape behavior is intentional for each overlay and cannot accidentally forfeit.
- [ ] Pairing, reconnect, countdown, and result events announce once through the live region.
- [ ] Reduced-motion mode removes non-essential animation.

**Verification:** keyboard-only and screen-reader smoke test; responsive screenshots; `npm.cmd run check`.

**Likely files:** overlays, `GameShell.tsx`, global CSS, online lobby.

**Dependencies:** Task 3.1.  
**Scope:** Medium.

### Task 3.3: Quarantine duplicate/dead mode implementations

**Description:** Identify which `core/*.ts`, `trials-mode.js`, and legacy helpers are actually used. Move only proven shared logic behind the canonical adapter; document every deferred deletion.

**Acceptance criteria:**

- [ ] One owner is documented for each game rule and mode behavior.
- [ ] No behavior-changing deletion occurs without a focused regression test.
- [ ] No new feature is added to duplicated legacy and new paths.

**Verification:** import/reference audit; tests; updated architecture doc.

**Likely files:** game modules, tests, `docs/architecture/`.

**Dependencies:** Task 3.2.  
**Scope:** Large — tackle one module family per commit.

## Final quality gate

- [ ] `npm.cmd test` passes.
- [ ] `npm.cmd run check` passes with zero errors.
- [ ] Full manual matrix passes in one local browser and two independent online browsers.
- [ ] Desktop, 768px, and 360px screenshots have been reviewed for all three modes.
- [ ] No console errors/warnings attributable to the gameplay routes.
- [ ] A human approves removal of any now-unused legacy code before deletion.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Refactor breaks the proven local 1v1 loop | High | Keep local adapter behavior unchanged; run local regression at every checkpoint. |
| Reconnect protocol changes deployed-client behavior | High | Version/add fields compatibly; server accepts old client only where safe; test expiry and invalid token paths. |
| Direct DOM and React fight for the same nodes during migration | High | Assign ownership per component and migrate one region at a time. |
| Large `game-logic.js` hides side effects | High | Add session cleanup tests before moving behavior; avoid bulk rewrites. |
| UI polish masks lifecycle bugs | Medium | Complete Checkpoint B before cosmetic work. |
