# Specification: Bot AI Refactor — Void Trials

**Status:** Proposed  
**Version:** 1.0  
**Date:** 2026-08-31  
**Author:** Reasonix Agent  
**Related:** `docs/audits/bot-ai-analysis.md`, `docs/reasonix/plans/bot-ai-refactor.md`

---

## 1. Problem Statement

The current Void Trials bot AI (`frontend/src/game/bot-ai.js`) has critical architectural flaws:

1. **Behavior instability** — Weighted random selector re-evaluates every 10-30 frames (166-500ms) with no hysteresis, causing jittery flip-flopping
2. **Weight mutation bug** — Condition checks mutate shared weight object non-deterministically; priority depends on evaluation order
3. **No wall awareness** — Movement vectors ignore walls; relies on post-move `pushOutOfWalls()` causing sticking and jitter
4. **Stale predictive aim** — Uses `player.lastVx/lastVy` only updated on input; misses dashing players
5. **Global coupling** — `getPlayerPos()` reads `window.NOX_GAME` directly, breaking isomorphic simulation (`game-sim.js`)
6. **Zero void awareness** — Core trials mechanic (void shrink at 7:30); bot wanders into void, dies, doesn't force player
7. **Passive powerup usage** — Only picks up powerups via `seekPickup`; never strategically activates shield/overcharge/blink
8. **Magic numbers** — 20+ hardcoded thresholds with no config, tuning, or difficulty scaling

---

## 2. Goals

| Goal | Success Metric |
|------|----------------|
| Stable behavior selection | ≤ 2 behavior switches/second (was 6-10) |
| Deterministic priority | Identical state → identical behavior choice |
| Wall-aware navigation | Zero `pushOutOfWalls` corrections in 30s trial |
| Accurate predictive aim | ≥ 50% hit rate vs dashing player at mid-range |
| Simulation parity | Bot runs in `game-sim.js` without `window` |
| Void survival | 100% survival to 8:00 across 10 trial runs |
| Strategic powerups | Shield activates at HP≤4 under fire; overcharge at engage<400px |
| Configurable tuning | All thresholds in `BOT_CONFIG`; difficulty multiplier works |

---

## 3. Non-Goals

- Full behavior state machine with enter/exit hooks (deferred)
- Player modeling / adaptation / learning (deferred)
- Team/coop support (out of scope)
- ML-based AI (out of scope)

---

## 4. Users & Context

**Primary User:** Player in Void Trials solo mode  
**Secondary:** Developer tuning bot difficulty; QA verifying behavior  
**Context:** 2x arena (1920×1120), 10-min trial, void shrink at 7:30, hazards (lava/slime), powerups, scoring

---

## 5. Functional Requirements

### 5.1 Behavior Selector (Priority-Based + Hysteresis)

**FR-01:** Replace weighted random with priority scoring system  
- Each behavior has independent `scoreX(bot, state)` pure function
- Returns behavior with highest score
- Hysteresis: if current behavior in top 2 and `behaviorCommitment > 0`, keep it
- Commitment timer: 60-120 frames (1-2s) reset on behavior change

**FR-02:** Critical threat early-exit (bypasses commitment)
- HP < 25% → retreat/avoidVoid priority
- Hazard contact < 40px → evadeHazard priority  
- Outside safeRadius → avoidVoid priority (score 1000)

**FR-03:** Behaviors: `seekPickup`, `engagePlayer`, `evadeHazard`, `avoidVoid`, `patrol`, `retreat`

### 5.2 Void Awareness

**FR-04:** New `avoidVoid` behavior
- Score = 1000 when `distanceToSafeZone > 0`
- Score = 0 when inside safe zone
- Steering: move toward nearest safe zone edge
- Dash if `distanceToSafeZone < 100` and dash available

### 5.3 Wall-Aware Movement

**FR-05:** `getSafeMovementVector(bot, desired, walls, lookahead=36)`
- Sample 3 points ahead (12px, 24px, 36px) along desired vector
- If collision predicted: try perpendicular slide vectors (±90°)
- If both blocked: return zero vector (stuck)
- Integrates with existing `wallsCollide()` geometry

### 5.4 Predictive Aiming

**FR-06:** Live velocity tracking
- `state.player.vx`, `state.player.vy` updated every frame in game-logic
- Detect dash: `state.player.dash > 0` → apply 2.35× speed multiplier
- Detect slime: `state.player.inSlime` → apply 0.55× slow
- Prediction: `targetPos = playerPos + playerVel × (travelTime + reactionDelay)`

**FR-07:** Burst aim consistency
- `aimError` set once per overcharge burst (3 shots)
- Not re-rolled per shot

### 5.5 Strategic Powerup Activation

**FR-08:** Shield activation
- Auto-activate when: `hp ≤ 4` AND `inv ≤ 0` AND (hazard contact OR bullet incoming)

**FR-09:** Overcharge activation
- Activate when: `behavior === 'engagePlayer'` AND `dist < 400` AND `overcharge === 0`

**FR-10:** Blink (extra dash) usage
- Dodge: hazard contact < 60px OR bullet incoming → use extra dash perpendicular
- Close: `engagePlayer` AND `dist > 350` AND `extraDash > 0` → dash toward player

### 5.6 Configuration & Difficulty

**FR-11:** `BOT_CONFIG` object with all thresholds
```javascript
const BOT_CONFIG = {
  // Behavior timing
  BEHAVIOR_COMMITMENT_MIN: 60,
  BEHAVIOR_COMMITMENT_MAX: 120,
  BEHAVIOR_RESELECT_INTERVAL: 10, // frames (when commitment expires)
  
  // Threat thresholds
  CRITICAL_HP_RATIO: 0.25,
  HAZARD_EVADE_RANGE: 100,
  HAZARD_DASH_RANGE: 60,
  VOID_AVOID_RANGE: 100,
  
  // Engagement ranges
  ENGAGE_RANGE: 800,
  ENGAGE_STRAFE_MIN: 200,
  ENGAGE_STRAFE_MAX: 500,
  ENGAGE_BACKOFF_RANGE: 200,
  ENGAGE_DASH_RANGE: 350,
  ENGAGE_DASH_PROBABILITY: 0.1,
  
  // Pickup ranges
  PICKUP_SEEK_RANGE: 300,
  PICKUP_PRIORITY_BOOST: 0.5,
  
  // Retreat
  RETREAT_DASH_RANGE: 300,
  RETREAT_DASH_PROBABILITY: 0.05,
  
  // Patrol
  PATROL_WAYPOINT_REACH: 50,
  PATROL_TIMER_MIN: 60,
  PATROL_TIMER_MAX: 180,
  
  // Aiming
  BASE_REACTION_DELAY_MIN: 80,
  BASE_REACTION_DELAY_MAX: 120,
  BASE_AIM_ERROR: 0.15,
  BULLET_SPEED: 7.2,
  
  // Difficulty multipliers
  DIFFICULTY: {
    easy:   { reactionDelay: 1.5, aimError: 2.0, commitment: 1.5, engageWeight: 0.7 },
    normal: { reactionDelay: 1.0, aimError: 1.0, commitment: 1.0, engageWeight: 1.0 },
    hard:   { reactionDelay: 0.7, aimError: 0.7, commitment: 0.7, engageWeight: 1.3 },
  },
  
  // Powerup thresholds
  SHIELD_ACTIVATE_HP: 4,
  OVERCHARGE_ENGAGE_RANGE: 400,
  BLINK_DODGE_RANGE: 60,
  BLINK_CLOSE_RANGE: 350,
};
```

---

## 6. Interface Contracts

### 6.1 Bot State (Input/Output)

```javascript
/**
 * @typedef {Object} BotState
 * @property {number} x - World X position
 * @property {number} y - World Y position
 * @property {number} vx - Velocity X
 * @property {number} vy - Velocity Y
 * @property {number} angle - Facing angle (radians)
 * @property {number} hp - Current HP
 * @property {number} maxHp - Max HP (12)
 * @property {number} dash - Dash frames remaining
 * @property {number} dashCd - Dash cooldown frames
 * @property {number} inv - Invincibility frames
 * @property {number} shootCd - Shoot cooldown frames
 * @property {number} overcharge - Overcharge frames remaining
 * @property {boolean} shield - Has shield
 * @property {number} shieldHp - Shield HP
 * @property {number} shieldMax - Shield max HP (5)
 * @property {number} speedBoost - Speed boost frames
 * @property {number} extraDash - Extra dashes available
 * @property {number} baseSpeed - Base movement speed
 * @property {number} squish - Visual squish frames
 * @property {boolean} inSlime - Currently in slime
 * @property {number} lavaCd - Lava damage cooldown
 * @property {number} voidCd - Void damage cooldown
 * @property {number} slimeCd - Slime slow cooldown
 * @property {string} ammoType - Current ammo type
 * @property {number} ammo - Ammo count
 * @property {boolean} alive - Is alive
 * @property {boolean} isBot - Always true
 * 
 * // AI State
 * @property {string} behavior - Current behavior
 * @property {number} behaviorCommitment - Frames remaining committed
 * @property {number} targetX - Patrol target X
 * @property {number} targetY - Patrol target Y
 * @property {number} reactionDelay - Current reaction delay (ms)
 * @property {number} lastShotTime - Timestamp of last shot
 * @property {number} aimError - Current aim error (radians)
 */
```

### 6.2 Game State (Input)

```javascript
/**
 * @typedef {Object} GameState
 * @property {Object} player - Player state for targeting
 * @property {number} player.x
 * @property {number} player.y
 * @property {number} player.vx - Updated every frame
 * @property {number} player.vy - Updated every frame
 * @property {number} player.dash - Dash frames remaining
 * @property {number} player.inv - Invincibility frames
 * @property {boolean} player.alive
 * @property {Array<Object>} pickups - Active pickups
 * @property {Array<Object>} hazards - Active hazards
 * @property {Array<Object>} walls - Wall geometry
 * @property {Object|null} voidRect - Void rectangle {x,y,w,h} or null
 * @property {number} safeRadius - Safe zone radius (1v1) or 999
 * @property {string} gameMode - 'trials' | '1v1'
 * @property {Function} wallsCollide - (x,y,r) => boolean
 */
```

### 6.3 Bot AI Output

```javascript
/**
 * @typedef {Object} BotAIOutput
 * @property {number} mx - Movement X (-1 to 1)
 * @property {number} my - Movement Y (-1 to 1)
 * @property {boolean} shoot - Should shoot this frame
 * @property {boolean} dash - Should dash this frame
 * @property {number} targetAngle - Desired aim angle
 * @property {boolean} [activateShield] - Activate shield this frame
 * @property {boolean} [activateOvercharge] - Activate overcharge this frame
 * @property {boolean} [useBlinkDash] - Use blink extra dash this frame
 */
```

### 6.4 Main Entry Point

```javascript
/**
 * Updates bot AI for one frame
 * @param {BotState} bot - Mutable bot state
 * @param {GameState} state - Read-only game state
 * @param {number} dt - Delta time in frames (default 1)
 * @returns {BotAIOutput} Movement and action commands
 */
export function updateBotAI(bot, state, dt = 1) { ... }
```

---

## 7. Architecture Decisions

| ADR | Decision | Rationale |
|-----|----------|-----------|
| ADR-001 | Priority scoring + hysteresis over weighted random | Deterministic, stable, allows emergency overrides |
| ADR-002 | Explicit `GameState` parameter | Simulation parity, testability, decoupling |
| ADR-003 | Raycast lookahead (3 samples) for wall avoidance | Prevents sticking, enables tactical movement |
| ADR-004 | `avoidVoid` as first-class behavior | Void is core trials mechanic |
| ADR-005 | `BOT_CONFIG` for all thresholds | Tuning, difficulty scaling, maintainability |

---

## 8. Data Flow

```
updateTrials(dt) in game-logic.js
    │
    ├─► Assemble GameState from live objects
    │     (player, pickups, hazards, walls, voidRect, safeRadius, wallsCollide)
    │
    ├─► Call updateBotAI(bot, gameState, dt)
    │     │
    │     ├─► Decrement cooldowns (dashCd, inv, shootCd, overcharge, etc.)
    │     │
    │     ├─► if behaviorCommitment <= 0:
    │     │       behavior = selectBehavior(bot, gameState)
    │     │       behaviorCommitment = random(BEHAVIOR_COMMITMENT_MIN, MAX)
    │     │     else:
    │     │       behaviorCommitment--
    │     │
    │     ├─► output = executeBehavior(bot, behavior, gameState)
    │     │
    │     ├─► safeVector = getSafeMovementVector(bot, output, gameState.walls)
    │     │     output.mx = safeVector.x; output.my = safeVector.y
    │     │
    │     ├─► Handle powerup activations (shield, overcharge, blink)
    │     │
    │     └─► Return output
    │
    └─► Apply output to bot physics (movement, shoot, dash, powerups)
```

---

## 9. Acceptance Criteria (Testable)

| ID | Criterion | Test Type |
|----|-----------|-----------|
| AC-01 | Behavior switches ≤ 120 in 60s trial | E2E |
| AC-02 | Identical state → identical behavior | Unit |
| AC-03 | Zero `pushOutOfWalls` in 30s navigation | Integration |
| AC-04 | ≥ 50% hit rate vs dashing target at 300px | Integration |
| AC-05 | `updateBotAI` runs in Node without `window` | Unit |
| AC-06 | 10/10 trials survive to 8:00 | E2E |
| AC-07 | Shield activates at HP≤4 under fire | Unit |
| AC-08 | Zero magic numbers in behavior logic | Static analysis |
| AC-09 | Easy/Normal/Hard produce measurable diff | E2E |

---

## 10. Dependencies

- `frontend/src/game/game-logic.js` — Must update player velocity every frame; assemble GameState
- `frontend/src/game/sim/game-sim.js` — Optional: wire bot for simulation testing
- Existing: `wallsCollide`, `distance`, `hazardAt`, `pushOutOfWalls` (reused)

---

## 11. Rollout & Rollback

**Feature Flag:** `window.USE_NEW_BOT_AI = true` (default false during development)
- If regression: flip flag to false → uses legacy `bot-ai.legacy.js`
- Full rollback: revert commits, restore original `bot-ai.js`

**Phased Rollout:**
1. Dev/local only (flag on)
2. Staging (flag on, QA verification)
3. Production (flag on, monitor)
4. Remove flag + legacy file

---

## 12. Security Considerations

- No user input processed by bot AI
- No secrets, auth, or external calls
- Input validation: `GameState` assembled from trusted internal objects only
- No logging of sensitive data

---

## 13. Performance Budget

- `updateBotAI`: < 0.1ms/frame (target)
- Raycast lookahead: 3 `wallsCollide` calls/frame
- Priority scoring: 6 pure function calls/frame
- Memory: No new allocations in hot path (reuse objects)

---

## 14. Observability

- Debug logging (dev only): behavior switches, powerup activations, threat overrides
- Metrics: behavior distribution, survival time, hit rate, wall corrections
- Exposed via `window.NOX_GAME.botDebug` for dev console inspection

---

## 15. Migration Notes

- Bot object in `game-logic.js` gains `behaviorCommitment` field (initialized to 0)
- `game-logic.js` must update `players[0].vx/vy` every frame (not just on input)
- `bot-ai.js` exports `updateBotAI`, `selectBehavior`, `executeBehavior`, `getSafeMovementVector`
- Legacy file kept as `bot-ai.legacy.js` during transition