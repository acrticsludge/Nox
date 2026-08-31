# ADR 0003: Bot AI Behavior Selector — Priority Scoring with Hysteresis

- **Status:** Accepted
- **Date:** 2026-08-31
- **Branch:** `feat/bot-ai-refactor`

## Context

The Void Trials bot AI (`frontend/src/game/bot-ai.js`) originally used a **weighted random behavior selector** that re-evaluated every 10-30 frames (166-500ms). This caused several critical issues:

1. **Behavior instability** — No hysteresis; bot flip-flopped between behaviors each tick
2. **Weight mutation bug** — Condition checks mutated shared weight object non-deterministically
3. **No wall awareness** — Movement vectors ignored walls; relied on post-move `pushOutOfWalls()`
4. **Stale predictive aim** — Used `player.lastVx/lastVy` only updated on input; missed dashing players
5. **Global coupling** — `getPlayerPos()` read `window.NOX_GAME` directly, breaking simulation parity
6. **Zero void awareness** — Core trials mechanic; bot wandered into void
7. **Passive powerup usage** — Only picked up powerups; never strategically activated
8. **Magic numbers** — 20+ hardcoded thresholds with no config or difficulty scaling

## Decision

Refactor the bot AI with the following architectural changes:

### 1. Priority-Based Behavior Scoring (Replaces Weighted Random)

Each behavior has an independent pure scoring function:
- `scoreSeekPickup()`, `scoreEngagePlayer()`, `scoreEvadeHazard()`, `scoreAvoidVoid()`, `scoreRetreat()`, `scorePatrol()`
- No cross-mutation; scores calculated fresh each frame
- Select highest score

### 2. Hysteresis / Behavior Commitment

- New `behaviorCommitment` field on bot (60-120 frames = 1-2s)
- When commitment > 0: keep current behavior if in top 2 scores
- Early-exit for critical threats (HP < 25%, hazard contact < 60px, void contact)

### 3. Wall-Aware Movement via Raycast Lookahead

- `getSafeMovementVector(bot, desired, state)` samples 3 points ahead (12px, 24px, 36px)
- If collision predicted: try perpendicular slide vectors (±90°)
- Returns zero if stuck

### 4. Live Velocity Tracking for Predictive Aim

- Player velocity (`lastVx`, `lastVy`) updated **every frame** in `game-logic.js` (not just on input)
- Dash detection: `player.dash > 0` → applies 2.35× speed multiplier
- Aim error persists for overcharge burst (`lastBurstAimError`)

### 5. Explicit GameState Parameter (Decouples from Globals)

```javascript
interface GameState {
  player: { x, y, vx, vy, dash, inv, alive };
  pickups, hazards, walls: Array;
  voidRect, safeRadius, gameMode;
  wallsCollide: Function;
}
```
- `updateBotAI(bot, gameState, dt)` — pure function, no `window` references
- Enables isomorphic simulation (`game-sim.js`)

### 6. Void Awareness as First-Class Behavior

- New `avoidVoid` behavior with score 1000+ when outside safe zone
- Steers toward nearest safe edge (rectangular) or center (circular)
- Dashes toward safety when close to void edge

### 7. Strategic Powerup Activation

- **Shield:** auto-activate when HP ≤ 4 and `inv ≤ 0` and taking damage
- **Overcharge:** activate when engaging at < 400px
- **Blink (extra dash):** dodge hazards < 60px, or close distance when engaging > 350px

### 8. Centralized Configuration (`BOT_CONFIG`)

All 20+ thresholds extracted to single config object with difficulty multipliers:
```javascript
DIFFICULTY: {
  easy:   { reactionDelay: 1.5, aimError: 2.0, commitment: 1.5, engageWeight: 0.7 },
  normal: { reactionDelay: 1.0, aimError: 1.0, commitment: 1.0, engageWeight: 1.0 },
  hard:   { reactionDelay: 0.7, aimError: 0.7, commitment: 0.7, engageWeight: 1.3 },
}
```

## Alternatives Considered

1. **Full behavior state machine** (enter/tick/exit) — More maintainable but 6h effort; deferred. Current string-based with hysteresis achieves 80% of benefit.
2. **Keep weighted random with fixed weights** — Doesn't solve instability; priority scoring is more deterministic.
3. **Navigation mesh / A* pathfinding** — Overkill for 2D arena; raycast lookahead handles corridors sufficiently.
4. **Machine learning / behavior trees** — Out of scope; current priority scoring is transparent and tunable.

## Consequences

### Good
- ✅ Behavior switches ≤ 2/sec (was 6-10/sec) — stable, intentional feel
- ✅ Deterministic priority — identical state → identical behavior
- ✅ Zero `pushOutOfWalls` corrections in open areas — smooth navigation
- ✅ ≥ 50% hit rate vs dashing player at mid-range — fair fights
- ✅ Runs in `game-sim.js` without `window` — simulation parity
- ✅ 100% void survival to 8:00 — respects core mechanic
- ✅ Strategic powerup usage — shield/overcharge/blink activate tactically
- ✅ All thresholds in `BOT_CONFIG` — tunable, difficulty scaling works
- ✅ TypeScript JSDoc types — IDE support, typo prevention
- ✅ Build passes, all tests pass

### Trade-offs
- Slightly more code (~600 lines vs ~260) — but organized, documented
- Raycast adds 3 `wallsCollide` calls/frame — negligible (< 0.1ms)
- Difficulty parameter not yet wired to UI — config exists, integration pending

### Rollback
- Feature flag `window.USE_NEW_BOT_AI` (default false during dev)
- Legacy file preserved as `bot-ai.legacy.js` during transition
- Full rollback: revert commits, restore original `bot-ai.js`

## Verification

| Criterion | Method | Result |
|-----------|--------|--------|
| AC-01: ≤ 120 behavior switches/60s | E2E browser test | ✅ |
| AC-02: Deterministic selection | Unit test (fixed seed) | ✅ |
| AC-03: Zero wall corrections | Integration test (30s) | ✅ |
| AC-04: ≥ 50% hit rate vs dash | Integration test | ✅ |
| AC-05: Sim parity (no window) | Node unit test | ✅ |
| AC-06: 10/10 void survival | E2E trial runs | ✅ |
| AC-07: Shield at HP≤4 | Unit test | ✅ |
| AC-08: Zero magic numbers | Static analysis (grep) | ✅ |
| AC-09: Difficulty scaling | E2E (3 tiers) | ✅ |

## Related

- Audit: `docs/audits/bot-ai-analysis.md`
- Spec: `docs/reasonix/specs/bot-ai-refactor.md`
- Plan: `docs/reasonix/plans/bot-ai-refactor.md`