# Implementation Plan: Bot AI Refactor — Void Trials

## Overview

Refactor the Void Trials bot AI (`bot-ai.js`) to fix critical issues identified in `docs/audits/bot-ai-analysis.md`: behavior instability, weight mutation bug, no wall avoidance, stale predictive aim, global coupling, zero void awareness, passive powerup usage, and magic numbers. This is a **medium-risk** change (spans multiple files, architectural refactor) requiring the full pipeline: define → architect → plan → implement → verify → harden → review → ship.

## Classification

| Dimension | Assessment |
|-----------|------------|
| Risk Level | Medium (feature spanning multiple files, API changes) |
| Work Type | Brownfield refactor / bugfix |
| Blast Radius | `bot-ai.js`, `game-logic.js`, `game-sim.js`, test files |
| Dependencies | None external; internal game state contracts |

---

## Stage 1: DEFINE — Requirements & Acceptance Criteria

### Problem Statement

The current bot AI uses a weighted random behavior selector that re-evaluates every 10-30 frames with no hysteresis, causing jittery flip-flopping between behaviors. Weight modifications persist non-deterministically across condition checks. Bot has no wall awareness (relies on post-move push-out), uses stale player velocity for predictive aim, is coupled to `window.NOX_GAME` global (breaking simulation parity), has zero awareness of the void shrink mechanic (core trials pressure), never strategically activates powerups, and contains 20+ hardcoded magic numbers with no difficulty scaling.

### Goals

1. **Stable behavior** — Bot commits to behaviors for 1-2 seconds with early-exit only for critical threats
2. **Deterministic priority** — Replace weighted random with priority-based scoring
3. **Wall-aware movement** — Raycast lookahead prevents sticking; enables corridor navigation
4. **Accurate predictive aim** — Track live player velocity + dash state; anticipate movement
5. **Simulation parity** — Decouple from globals; pass state explicitly for isomorphic `game-sim.js` support
6. **Void awareness** — New `avoidVoid` behavior; positions to force player into void
7. **Strategic powerups** — Activate shield/overcharge/blink tactically based on situation
8. **Configurable tuning** — All thresholds in `BOT_CONFIG`; difficulty multiplier support

### Non-Goals

- Full behavior state machine with enter/exit hooks (deferred to future)
- Player modeling / adaptation (deferred)
- Team/coop support (out of scope)
- Learning/ML-based AI (out of scope)

### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-01 | Bot selects behavior ≤ 2× per second (was 6-10×) | Log behavior switches in 60s trial; count ≤ 120 |
| AC-02 | Weight scoring is deterministic for same inputs | Unit test: identical state → identical behavior choice |
| AC-03 | Bot navigates corridors without sticking | Visual test: 30s in generated arena; zero `pushOutOfWalls` corrections |
| AC-04 | Bot hits dashing player ≥ 50% at mid-range | Integration test: 100 shots vs dashing target; measure hit rate |
| AC-05 | Bot runs in `game-sim.js` without `window` | Unit test: `createMatch` + `simTick` with bot inputs |
| AC-06 | Bot survives void shrink to 8:00 consistently | 10 trial runs; 100% survival to 8:00 |
| AC-07 | Bot activates shield when HP ≤ 4 and taking damage | Log powerup activations; verify timing |
| AC-08 | All magic numbers extracted to `BOT_CONFIG` | Grep: zero raw numbers in behavior logic (except config) |
| AC-09 | Difficulty multiplier scales reaction delay, aim error, weights | Test: easy/normal/hard produce measurably different performance |

---

## Stage 2: ARCHITECT — Technical Design

### Architecture Decisions

#### ADR-001: Priority-Based Behavior Selector (Replaces Weighted Random)

**Decision:** Replace `selectBehavior()` weighted random with priority scoring + hysteresis.

**Rationale:** Weighted random with mutating weights is non-deterministic and causes jitter. Priority scoring with commitment timer provides stable, predictable behavior while allowing emergency overrides.

**Trade-offs:** Slightly more code; loses "organic" randomness (mitigated by small random tiebreaker).

#### ADR-002: Explicit State Parameter (Decouples from Globals)

**Decision:** `updateBotAI(bot, state, dt)` receives full `state` object with `{ player, pickups, hazards, walls, voidRect, safeRadius, gameMode }`.

**Rationale:** Enables simulation parity; removes `window.NOX_GAME` dependency; makes function pure and testable.

**Trade-offs:** Caller must assemble state object (minimal overhead).

#### ADR-003: Wall-Aware Movement via Raycast Lookahead

**Decision:** Add `getSafeMovementVector(bot, desired, walls, lookahead)` in `bot-ai.js`; called before applying movement.

**Rationale:** Prevents sticking; enables tactical positioning; reuses existing `wallsCollide` geometry.

**Trade-offs:** Extra collision checks per frame (3-5 raycasts); negligible at 60 FPS.

#### ADR-004: Void Awareness as First-Class Behavior

**Decision:** Add `avoidVoid` behavior with highest priority when `bot` outside `safeRadius`.

**Rationale:** Void is the core trials mechanic; bot must respect it to be competent.

**Trade-offs:** New behavior adds complexity; mitigated by simple steering logic.

#### ADR-005: Config Object for All Thresholds

**Decision:** Extract all magic numbers to `BOT_CONFIG` constant at top of `bot-ai.js`.

**Rationale:** Enables tuning, difficulty scaling, and future config-driven variants.

**Trade-offs:** Slight indirection; worth it for maintainability.

### Interface Contracts

```typescript
// bot-ai.ts (new types file or JSDoc)
interface BotState {
  // Core
  x: number; y: number;
  vx: number; vy: number;
  angle: number;
  hp: number; maxHp: number;
  dash: number; dashCd: number; inv: number; shootCd: number;
  overcharge: number;
  shield: boolean; shieldHp: number; shieldMax: number;
  speedBoost: number; extraDash: number; baseSpeed: number;
  squish: number; inSlime: boolean;
  lavaCd: number; voidCd: number; slimeCd: number;
  ammoType: string; ammo: number;
  alive: boolean; isBot: boolean;

  // AI State
  behavior: BehaviorType;
  behaviorCommitment: number;    // frames remaining committed
  targetX: number; targetY: number;
  reactionDelay: number; lastShotTime: number;
  aimError: number;
}

interface GameState {
  player: { x: number; y: number; vx: number; vy: number; dash: number; inv: number; alive: boolean };
  pickups: Pickup[];
  hazards: Hazard[];
  walls: Wall[];
  voidRect: Rect | null;
  safeRadius: number;
  gameMode: 'trials' | '1v1';
  wallsCollide: (x, y, r) => boolean;  // function ref for raycast
}

interface BotAIOutput {
  mx: number; my: number;
  shoot: boolean; dash: boolean;
  targetAngle: number;
  // Powerup activations
  activateShield?: boolean;
  activateOvercharge?: boolean;
  useBlinkDash?: boolean;
}

type BehaviorType = 'seekPickup' | 'engagePlayer' | 'evadeHazard' | 'avoidVoid' | 'patrol' | 'retreat';
```

### Data Flow

```
updateBotAI(bot, state, dt)
    ↓
1. Decrement cooldowns (dashCd, inv, shootCd, overcharge, etc.)
    ↓
2. if behaviorCommitment <= 0:
       behavior = selectBehavior(bot, state)  // priority scoring
       behaviorCommitment = COMMITMENT_FRAMES (60-120)
    else:
       behaviorCommitment--
    ↓
3. output = executeBehavior(bot, behavior, state)
    ↓
4. Apply wall-aware movement:
       safeVector = getSafeMovementVector(bot, output, state.walls)
       output.mx = safeVector.x; output.my = safeVector.y
    ↓
5. Handle powerup activations (shield, overcharge, blink)
    ↓
6. Return output → caller applies to bot physics
```

---

## Stage 3: PLAN — Task Breakdown

### Phase 1: Foundation — Config & Types (P0)

#### Task 1: Create `BOT_CONFIG` with all thresholds
- **Objective:** Extract 20+ magic numbers to single config object
- **Files:** `frontend/src/game/bot-ai.js`
- **Acceptance:** Zero raw numbers in behavior logic; all reference `BOT_CONFIG.xxx`
- **Verification:** `grep -n "[0-9]\{2,\}" bot-ai.js` returns only config block
- **Rollback:** Revert config object; inline values

#### Task 2: Define TypeScript types for bot state & game state (JSDoc)
- **Objective:** Document interfaces for IDE support and clarity
- **Files:** `frontend/src/game/bot-ai.js` (top of file)
- **Acceptance:** All functions have `@param`/`@returns` JSDoc
- **Verification:** VS Code IntelliSense works on bot functions

#### Task 3: Add `behaviorCommitment` field to bot object initialization
- **Objective:** Track behavior commitment frames in `game-logic.js` bot init
- **Files:** `frontend/src/game/game-logic.js` (bot init in `startTrials()` and `hardResetInternalState()`)
- **Acceptance:** `bot.behaviorCommitment = 0` initialized
- **Verification:** Console log bot object on init

---

### Phase 2: Core Behavior Selector Refactor (P0)

#### Task 4: Implement `selectBehavior()` with priority scoring
- **Objective:** Replace weighted random with deterministic priority scoring
- **Files:** `frontend/src/game/bot-ai.js`
- **Acceptance:** 
  - Returns behavior with highest score
  - Hysteresis: keeps current behavior if in top 2 and `behaviorCommitment > 0`
  - Early-exit for critical threats (HP < 25%, hazard contact < 40px, void contact)
- **Verification:** Unit test with mocked state; snapshot scores for fixed inputs

#### Task 5: Add `avoidVoid` behavior scoring
- **Objective:** Highest priority when bot outside `safeRadius`
- **Files:** `frontend/src/game/bot-ai.js`
- **Acceptance:** Score → 1000 when `distToSafeZone > 0`; 0 when inside
- **Verification:** Unit test: bot at void edge → `avoidVoid` selected

#### Task 6: Refactor `selectBehavior` weight mutations to independent scoring
- **Objective:** Each behavior score calculated independently, no cross-mutation
- **Files:** `frontend/src/game/bot-ai.js`
- **Acceptance:** No `Math.max(weights.x, ...)` chaining; each `scoreX()` pure function
- **Verification:** Code review; unit tests for each scorer

---

### Phase 3: Movement & Targeting (P0)

#### Task 7: Implement `getSafeMovementVector()` with raycast lookahead
- **Objective:** Wall-aware movement; prevents sticking; enables corridor nav
- **Files:** `frontend/src/game/bot-ai.js`
- **Acceptance:** 
  - Samples 3 points ahead along desired vector (12px, 24px, 36px)
  - Returns perpendicular slide vector if collision predicted
  - Returns zero if stuck
- **Verification:** Visual test in browser; log `pushOutOfWalls` calls (should be 0)

#### Task 8: Fix predictive aim — use live player velocity + dash state
- **Objective:** Track `player.vx`, `player.vy` every frame; detect dash (`player.dash > 0`)
- **Files:** 
  - `frontend/src/game/game-logic.js` — ensure `lastVx`/`lastVy` updated every frame for player
  - `frontend/src/game/bot-ai.js` — use `state.player.vx/vy` and `state.player.dash`
- **Acceptance:** Prediction accounts for dash boost (2.35× speed) and slime slow (0.55×)
- **Verification:** Integration test: bot vs scripted dash pattern; measure hit rate

#### Task 9: Persist `aimError` for burst duration (overcharge spread)
- **Objective:** `aimError` set once per burst, not per shot
- **Files:** `frontend/src/game/bot-ai.js`
- **Acceptance:** When `overcharge > 0` and shooting, reuse `aimError` for 3-shot spread
- **Verification:** Visual: overcharge spread is tight cone, not wild

---

### Phase 4: Strategic Powerup Usage (P1)

#### Task 10: Add powerup activation logic in `updateBotAI()`
- **Objective:** Bot actively uses shield/overcharge/blink, not just picks up
- **Files:** `frontend/src/game/bot-ai.js`
- **Acceptance:**
  - Shield: auto-activate when `hp ≤ 4` AND `inv ≤ 0` AND taking damage (hazard/bullet contact)
  - Overcharge: activate when `engagePlayer` AND `dist < 400` AND `overcharge === 0`
  - Blink: use extra dash for dodging (hazard/bullet) or closing (engage > 350px)
- **Verification:** Log activations; visual confirmation in browser

---

### Phase 5: Simulation Parity & Decoupling (P1)

#### Task 11: Decouple `getPlayerPos()` — pass player via state
- **Objective:** Remove `window.NOX_GAME` dependency
- **Files:** 
  - `frontend/src/game/bot-ai.js` — `getPlayerPos()` deleted; use `state.player`
  - `frontend/src/game/game-logic.js` — assemble `state` object in `updateTrials()`
- **Acceptance:** `bot-ai.js` has zero `window` references
- **Verification:** `grep -n "window\." bot-ai.js` returns empty

#### Task 12: Export `updateBotAI` for `game-sim.js` consumption
- **Objective:** Enable bot in isomorphic simulation
- **Files:** 
  - `frontend/src/game/bot-ai.js` — `export { updateBotAI, selectBehavior, ... }`
  - `frontend/src/game/sim/game-sim.js` — import and wire bot tick (optional, for testing)
- **Acceptance:** `game-sim.js` can call `updateBotAI(bot, state, dt)` without DOM
- **Verification:** Node test: `node -e "import {createMatch} from './sim/game-sim.js'; ..."`

---

### Phase 6: Difficulty Scaling (P2)

#### Task 13: Add `difficulty` parameter to `BOT_CONFIG` and behavior
- **Objective:** Easy/Normal/Hard tiers via single multiplier
- **Files:** `frontend/src/game/bot-ai.js`, `frontend/src/game/game-logic.js` (pass difficulty)
- **Acceptance:** 
  - `BOT_CONFIG.difficulty = { easy: 0.7, normal: 1.0, hard: 1.3 }`
  - Scales: `reactionDelay`, `aimError`, `behaviorCommitment`, `engageWeight`
- **Verification:** 3 trial runs per difficulty; measure bot K/D, survival time

---

### Phase 7: Testing & Verification (P0-P1)

#### Task 14: Unit tests for behavior selector
- **File:** `frontend/src/game/bot-ai.test.js` (NEW)
- **Cases:**
  - Identical state → identical behavior (determinism)
  - HP < 25% → retreat/avoidVoid priority
  - Hazard < 40px → evadeHazard priority
  - Void contact → avoidVoid priority
  - Pickup nearby → seekPickup priority
  - Hysteresis: commitment timer prevents flip-flop

#### Task 15: Integration test — bot in simulation
- **File:** `frontend/src/game/sim/game-sim.test.js` (extend existing)
- **Cases:**
  - `createMatch` with bot; `simTick` with bot inputs; no errors
  - Deterministic replay: same seed + inputs = same state

#### Task 16: Browser E2E test — 10 trial survival
- **File:** `frontend/test/bot-trials-e2e.test.js` (NEW, Playwright)
- **Cases:**
  - 10 runs: bot survives to 8:00 (void conquered)
  - Behavior switch count < 120 per run
  - Zero `pushOutOfWalls` corrections
  - Powerup activations logged

---

### Phase 8: Documentation & Cleanup (P2)

#### Task 17: Update `docs/audits/bot-ai-analysis.md` with fix status
- **Objective:** Mark resolved items; document remaining known limitations
- **Files:** `docs/audits/bot-ai-analysis.md`
- **Acceptance:** Each critical/major issue has ✅/❌ status

#### Task 18: Add ADR for behavior selector architecture
- **File:** `docs/decisions/0004-bot-ai-behavior-selector.md` (NEW)
- **Content:** Context, decision, trade-offs, alternatives considered

---

## Dependencies & Ordering

```
Phase 1 (1-3) ──┬──→ Phase 2 (4-6) ──┬──→ Phase 3 (7-9)
                │                    │
                └──→ Phase 4 (10)    │
                                     ↓
Phase 5 (11-12) ←────────────────────┘
    ↓
Phase 6 (13)
    ↓
Phase 7 (14-16) ──→ Phase 8 (17-18)
```

**Parallelizable:**
- Tasks 1-3 (config, types, commitment field) — independent
- Task 10 (powerups) can start after Task 4 (selector)
- Task 13 (difficulty) can start after Task 1 (config)

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Behavior regression (bot becomes worse) | High | Keep old `bot-ai.js` as `bot-ai.legacy.js` for A/B comparison; feature flag `useNewBotAI` |
| Simulation parity breaks 1v1 | Medium | Run existing `game-sim.test.js` suite after each change |
| Performance regression (raycasts) | Low | Profile: raycasts < 0.1ms/frame; limit to 3 samples |
| Tuning difficulty | Medium | Expose `BOT_CONFIG` to dev console for live tuning |
| Void avoidance too aggressive | Medium | Tune `avoidVoid` score curve; add hysteresis |

---

## Checkpoints

### Checkpoint 1: Foundation (after Tasks 1-3)
- [ ] `BOT_CONFIG` complete, all magic numbers extracted
- [ ] TypeScript types documented
- [ ] `behaviorCommitment` initialized in bot object
- [ ] Build passes (`npm run build`)

### Checkpoint 2: Core Selector (after Tasks 4-6)
- [ ] Priority scoring implemented
- [ ] `avoidVoid` behavior scoring works
- [ ] No weight mutation; independent scorers
- [ ] Unit tests pass
- [ ] Build passes

### Checkpoint 3: Movement & Targeting (after Tasks 7-9)
- [ ] Raycast lookahead prevents wall sticking
- [ ] Predictive aim uses live velocity + dash
- [ ] Overcharge burst has consistent aim error
- [ ] Browser test: 30s no-stuck navigation
- [ ] Build passes

### Checkpoint 4: Powerups & Decoupling (after Tasks 10-12)
- [ ] Shield/overcharge/blink activate strategically
- [ ] Zero `window` references in `bot-ai.js`
- [ ] Simulation test passes
- [ ] Build passes

### Checkpoint 5: Difficulty & Tests (after Tasks 13-16)
- [ ] Easy/Normal/Hard produce measurable differences
- [ ] Unit + integration + E2E tests pass
- [ ] 10/10 trial survival to 8:00
- [ ] Build passes

### Checkpoint 6: Production Ready (after Tasks 17-18)
- [ ] Audit doc updated
- [ ] ADR created
- [ ] Lint/typecheck pass
- [ ] Ready to ship

---

## Rollback Plan

If any checkpoint fails critically:
1. Revert to `bot-ai.legacy.js` via feature flag `useNewBotAI = false`
2. Investigate root cause per `systematic-debugging`
3. Fix and re-verify before re-enabling

---

## Skills Activated

Per CLAUDE.md conditional routing:
- `planning-and-task-breakdown` — this plan
- `spec-driven-development` — interface contracts defined
- `source-driven-development` — isomorphic simulation patterns from `game-sim.js`
- `test-driven-development` — Tasks 14-16
- `incremental-implementation` — phased checkpoints
- `code-review-and-quality` — Stage 7
- `code-simplification` — Stage 7
- `security-and-hardening` — input validation in state assembly
- `performance-optimization` — raycast profiling
- `debugging-and-error-recovery` — if regressions
- `browser-testing-with-devtools` — E2E verification
- `documentation-and-adrs` — Task 18
- `git-workflow-and-versioning` — atomic commits per task
- `shipping-and-launch` — final verification

---

## Files to Modify/Create

| File | Change Type |
|------|-------------|
| `frontend/src/game/bot-ai.js` | Major refactor |
| `frontend/src/game/game-logic.js` | Moderate (state assembly, bot init, difficulty pass-through) |
| `frontend/src/game/sim/game-sim.js` | Minor (optional bot tick for testing) |
| `frontend/src/game/bot-ai.test.js` | NEW — unit tests |
| `frontend/src/game/sim/game-sim.test.js` | Extend — integration tests |
| `frontend/test/bot-trials-e2e.test.js` | NEW — E2E tests |
| `docs/audits/bot-ai-analysis.md` | Update |
| `docs/decisions/0004-bot-ai-behavior-selector.md` | NEW — ADR |

---

## Next Steps

1. **User confirmation** on plan scope and priority ordering
2. **Begin Phase 1** — Create `BOT_CONFIG` and types (Task 1-3)
3. **Commit atomic changes** per task with verification at each checkpoint