# Implementation Plan: Void Trials // Solo Mode

## Overview

Add a complete solo survival mode with AI bot, 2x arena, void shrink mechanic, scoring, and full localStorage persistence. Builds on existing 1v1 foundation — reuses rendering, particles, hazards, powerups, input system.

## Architecture Decisions

1. **Bot AI in separate module** (`bot-ai.js`) — keeps `game-logic.js` clean, allows hot-reload of behavior weights
2. **Trials mode flag in game state** — `gameMode: 'trials' | '1v1'` controls spawn positions, win conditions, void timing, scoring
3. **Single GameShell variant** — `TrialsGameShell` extends base with solo HUD, pause overlay, exit confirmation
4. **2x arena via viewBox scaling** — SVG `viewBox="0 0 1920 1120"` with same 960x560 logical coords internally, render at 2x scale
5. **State serialization** — `JSON.stringify` full game state object every 2s, `localStorage.setItem('nv_trials_state', ...)`

## Task List

### Phase 1: Foundation — Core Types & Arena Scaling

- [ ] **Task 1: Extend game-logic.js with Trials mode constants and state**
  - Acceptance: `gameMode` variable, `TRIALS_*` constants (ARENA_W=1920, ARENA_H=1120, TRIAL_DURATION=600, VOID_START=450, VOID_SHRINK_DURATION=30), bot object in players array
  - Verify: `npm --prefix frontend run build` succeeds, no TypeScript errors
  - Files: `frontend/src/game/game-logic.js`

- [ ] **Task 2: Implement 2x arena generation (walls, hazards, pickups scaled)**
  - Acceptance: `generateTrialsWalls()` produces 2x wall count/size, `generateTrialsHazards()` 2x hazards, pickup spawn positions cover 2x area, all respect 34px gap
  - Verify: Console log wall/hazard counts, visual inspection in browser
  - Files: `frontend/src/game/game-logic.js`

- [ ] **Task 3: Add void shrink logic (rectangular, exponential damage)**
  - Acceptance: At t=450s, `voidRect` starts at 2x bounds, shrinks linearly to 1x center over 30s. Damage per tick: `base * Math.pow(2, (distanceFromEdge / shrinkZone))`. Visual: amber rectangular border with pulse
  - Verify: Browser devtools - void appears at 7:30, shrinks, damages player outside
  - Files: `frontend/src/game/game-logic.js`

### Phase 2: Bot AI — Behavior Tree

- [ ] **Task 4: Create bot-ai.js with behavior tree**
  - Acceptance: `BotAI` class with `update(bot, state, dt)` returning `{mx, my, shoot, dash, targetAngle}`. Behaviors: seekPickup, engagePlayer, evadeHazard, patrol, retreat. Weighted selection with HP bias.
  - Verify: Unit test behavior selection with mocked state
  - Files: `frontend/src/game/bot-ai.js` (NEW)

- [ ] **Task 5: Integrate bot into simulation loop**
  - Acceptance: In `update(dt)`, if `gameMode === 'trials'`, call `botAI.update(bot, state, dt)` and apply returned inputs to bot player object. Bot uses same movement/shoot/dash code paths as human.
  - Verify: Bot moves, shoots, dashes, picks up orbs in browser
  - Files: `frontend/src/game/game-logic.js`, `frontend/src/game/bot-ai.js`

- [ ] **Task 6: Bot predictive aim + reaction delay**
  - Acceptance: Bot aims at predicted player position: `targetPos = playerPos + playerVel * (bulletTravelTime + reactionDelay)`. Reaction delay 80-120ms (randomized per shot). 5% base miss chance.
  - Verify: Bot hits moving player ~60-70% at mid range, misses at long range
  - Files: `frontend/src/game/bot-ai.js`

- [ ] **Task 7: Bot powerup usage (all types)**
  - Acceptance: Bot picks up overcharge→triple shot, shield→activates, blink→extra dash, heal→heals, ammo pickups→switches bullet type. Prioritizes shield when HP ≤ 4, overcharge when HP > 8.
  - Verify: Bot collects orbs, changes bullet type, shield activates visually
  - Files: `frontend/src/game/bot-ai.js`, `frontend/src/game/game-logic.js`

- [ ] **Task 8: Bot hazard avoidance (lava/slime)**
  - Acceptance: Bot detects lava active/warning within 80px, slime within 60px. Pathfinds around (simple steering: add avoidance vector to movement). Does NOT avoid void (by design).
  - Verify: Bot walks around active lava, slows in slime but doesn't panic
  - Files: `frontend/src/game/bot-ai.js`

### Phase 3: Scoring & Persistence

- [ ] **Task 9: Implement point system**
  - Acceptance: `points` variable. +1/sec (per frame), +25/bullet hit bot, +75/pickup collected. -30/lava tick, -15/slime tick. After t=450: gains ×2, losses ×3. Display in HUD.
  - Verify: Console log points per event, HUD updates
  - Files: `frontend/src/game/game-logic.js`

- [ ] **Task 10: Full state serialization to localStorage**
  - Acceptance: `saveTrialsState()` serializes: `gameMode, timeLeft, players[2], bot, bullets, pickups, hazards, walls, particles, points, gameState, voidRect, round, scores`. Called every 120 frames (2s). `loadTrialsState()` restores all.
  - Verify: Refresh mid-game → "Resume Trial" appears, state identical
  - Files: `frontend/src/game/game-logic.js`

- [ ] **Task 11: High score persistence**
  - Acceptance: On win/lose/forfeit, `localStorage.setItem('nv_trials_highscore', Math.max(current, points))`. Display on Trials start screen.
  - Verify: Multiple runs, high score persists
  - Files: `frontend/src/game/game-logic.js`

### Phase 4: UI — Trials Shell, HUD, Overlays

- [ ] **Task 12: Create TrialsGameShell.tsx (solo variant)**
  - Acceptance: Single player HUD (WASD + SHIFT + SPACE), points display large, timer with void warning at 7:30, bot HP bar, powerup chips, ammo chip, pause button (P/ESC), exit button with confirmation
  - Verify: Renders without errors, all controls wired
  - Files: `frontend/src/components/trials/TrialsGameShell.tsx` (NEW)

- [ ] **Task 13: Create PauseOverlay.tsx**
  - Acceptance: Full-screen overlay on P/ESC, shows "PAUSED // P TO RESUME", current points, time, bot HP. Click or P/ESC resumes. Game loop pauses (no update).
  - Verify: Pause/resume works, timer stops, bot stops
  - Files: `frontend/src/components/trials/PauseOverlay.tsx` (NEW)

- [ ] **Task 14: Create ExitOverlay.tsx (forfeit confirmation)**
  - Acceptance: On Exit click, overlay: "FORFEIT TRIAL? // PROGRESS LOST // HIGH SCORE SAVED". Confirm → `gameState='menu'`, save high score, clear trial state. Cancel → resume.
  - Verify: Exit flow works, high score saved, state cleared
  - Files: `frontend/src/components/trials/ExitOverlay.tsx` (NEW)

- [ ] **Task 15: Update /play mode card for Trials**
  - Acceptance: `play.astro` modes array: Trials entry `live: true`, amber accent, badge "LIVE // 1P • 10:00 • VOID CRUSH", scary cyber styling (pulsing amber border, warning icons, "WASD ONLY" tag, "HARD" label pulsing)
  - Verify: Card looks terrifying, clickable, navigates to `/play/trials`
  - Files: `frontend/src/pages/play.astro`

- [ ] **Task 16: Create /play/trials.astro entry page**
  - Acceptance: Astro page loads `TrialsGameShell client:load`, SEO with VideoGame structured data, title "NOX // VOID TRIALS - Solo survival", canonical `/play/trials`
  - Verify: Page loads, GameShell mounts, no console errors
  - Files: `frontend/src/pages/play/trials.astro` (NEW)

### Phase 5: Polish & Docs

- [ ] **Task 17: Global speed slider for Trials (reuse 1v1 component)**
  - Acceptance: Start overlay includes `GlobalSpeedControl` (2.5x-5.5x), persists to `localStorage.nv_speedGlobal`, applies to both player and bot
  - Verify: Speed changes affect bot movement/shoot rate
  - Files: `frontend/src/components/GameShell.tsx` (reuse), `frontend/src/pages/play/trials.astro`

- [ ] **Task 18: Update /docs manual with Trials section**
  - Acceptance: New section in `docs/index.mdx`: "05 VOID TRIALS" with WASD controls, void shrink explanation, scoring table, bot behavior overview, pause/exit. Plain English, no pixel values.
  - Verify: `/docs` renders correctly, no em dashes
  - Files: `frontend/src/pages/docs/index.mdx`

- [ ] **Task 19: Add Trials demo components to docs (optional)**
  - Acceptance: `DocTrialsBotDemo.tsx` (shows bot pathfinding), `DocVoidShrinkDemo.tsx` (accelerated void shrink)
  - Verify: Demos render in docs page
  - Files: `frontend/src/components/docs/DocTrialsBotDemo.tsx`, `frontend/src/components/docs/DocVoidShrinkDemo.tsx` (NEW)

- [ ] **Task 20: Future ideas doc**
  - Acceptance: `docs/features/void-trials-future.md` with all out-of-scope items fleshed out
  - Verify: File exists, readable
  - Files: `docs/features/void-trials-future.md` (NEW)

## Checkpoints

### Checkpoint: Foundation (after Tasks 1-3)

- [ ] 2x arena generates correctly
- [ ] Void shrink triggers at 7:30, visual + damage working
- [ ] Build passes

### Checkpoint: Bot AI (after Tasks 4-8)

- [ ] Bot moves, shoots, dashes, picks up powerups
- [ ] Bot avoids lava/slime
- [ ] Bot aims predictively with human-like delay
- [ ] Build passes

### Checkpoint: Core Loop (after Tasks 9-11)

- [ ] Points accrue and penalize correctly
- [ ] 2x/3x multipliers after 7:30
- [ ] Full state save/load works across refresh
- [ ] High score persists
- [ ] Build passes

### Checkpoint: UI Complete (after Tasks 12-16)

- [ ] Trials mode selectable from `/play`
- [ ] HUD shows all info
- [ ] Pause/Exit work
- [ ] Win/lose conditions trigger correctly
- [ ] Build passes

### Checkpoint: Polish (after Tasks 17-20)

- [ ] Speed slider works
- [ ] Docs updated
- [ ] Future ideas doc created
- [ ] Build passes, ready to ship

## Risks and Mitigations

| Risk                       | Impact | Mitigation                                                              |
| -------------------------- | ------ | ----------------------------------------------------------------------- |
| Bot AI too easy/hard       | High   | Tunable weights in`bot-ai.js`, expose difficulty multiplier in pre-game |
| 2x arena performance       | Medium | SVG scales well; limit particle count, pool objects                     |
| localStorage quota         | Low    | State ~50KB, well under 5MB limit                                       |
| Void shrink visual clarity | Medium | High contrast amber border, screen shake, audio cue (future)            |
| Bot gets stuck on walls    | Medium | Reuse existing`pushOutOfWalls`, add unstuck timer                       |

## Parallelization Opportunities

- Tasks 4-8 (Bot AI) can be developed in parallel with Tasks 1-3 (Arena) once interfaces defined
- Tasks 12-14 (UI overlays) can be built alongside Task 10 (persistence)
- Tasks 18-20 (Docs) can be done anytime after Phase 1

## Open Questions

- None — all resolved in interview
