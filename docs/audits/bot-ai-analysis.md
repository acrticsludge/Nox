# Bot AI Analysis — Void Trials Gamemode

**Date:** 2026-08-31  
**Files Analyzed:** `frontend/src/game/bot-ai.js`, `frontend/src/game/game-logic.js`, `frontend/src/game/sim/game-sim.js`  
**Engine:** Custom JS game loop (60 FPS fixed timestep)

---

## Executive Summary

The bot AI in Void Trials uses a **weighted random behavior selector** with 5 behaviors (seekPickup, engagePlayer, evadeHazard, patrol, retreat). While functional, the architecture has significant issues that affect gameplay quality, maintainability, and extensibility. The bot feels "twitchy" and inconsistent due to frequent behavior switching, lacks strategic depth, and has several technical debt items.

**Overall Rating:** 🟡 **Needs Refactor** — Core architecture works but needs systematic improvements for production quality.

---

## Critical Issues (Must Fix)

### 1. Behavior Selection Instability (Lines 45-103, `bot-ai.js`)

**Problem:** Behaviors are re-selected every **10-30 frames** (166-500ms) with no hysteresis or commitment. The weighted random selection can flip-flop between behaviors each tick.

```javascript
// Lines 252-256: Re-selects behavior every 10-30 frames
if(!bot.behaviorTimer || bot.behaviorTimer <= 0) {
  bot.behavior = selectBehavior(bot, state);
  bot.behaviorTimer = 10 + Math.floor(Math.random() * 20); // 10-30 frames
}
```

**Impact:**
- Bot jitters between "engage" and "retreat" at mid-range
- Pickup seeking interrupted by momentary hazard proximity
- No behavioral momentum — feels robotic, not intentional

**Fix:** Implement a **commitment system** — minimum behavior duration (e.g., 60-120 frames) with early-exit only for critical threats (HP < 25%, hazard contact).

---

### 2. Weight Mutation Bug (Lines 51-93, `bot-ai.js`)

**Problem:** `weights` object is spread from `BOT_BEHAVIORS` but modifications **persist across frames** because the spread creates a new object each call, but the weight modifications use `Math.max` against the *already-modified* values from previous conditions.

```javascript
// Line 51: Fresh object each call — OK
const weights = { ...BOT_BEHAVIORS };

// Lines 54-57: Modifies weights.seekPickup, weights.retreat
// Lines 64-71: Further modifies based on hpRatio
// Lines 75-79: Further modifies based on hazard
// Lines 83-85: Further modifies based on pickup
// Lines 88-93: Further modifies based on player
```

**Impact:** Weight stacking order matters. A hazard at 99px sets `evadeHazard=0.5`, then player at 799px sets `engagePlayer=0.4`, but if player check ran first, different result. **Non-deterministic priority.**

**Fix:** Use a **priority-based scoring system** instead of additive weights. Calculate scores for each behavior independently, then pick highest.

---

### 3. No Wall Avoidance in Movement (Lines 110-217, `bot-ai.js`)

**Problem:** `executeBehavior` returns raw movement vectors (`mx, my`) **without checking walls**. The bot relies entirely on `pushOutOfWalls` in `game-logic.js` (line 426-459) to resolve collisions *after* movement.

```javascript
// Line 117: Direct vector to pickup — ignores walls between
mx = dx / dist; my = dy / dist;

// Line 137: Direct predictive aim vector — ignores walls
mx = Math.cos(strafeAngle) * 0.7;
```

**Impact:**
- Bot gets stuck on walls frequently
- "Push out" resolution creates jittery movement
- Cannot navigate corridors or use cover strategically
- Patrol waypoints (line 189-190) often place bot inside walls

**Fix:** Add **raycast/lookahead** in `executeBehavior` — sample 2-3 points ahead along movement vector, adjust if wall collision predicted.

---

### 4. Predictive Aim Uses Stale Velocity (Lines 126-141, `bot-ai.js`)

**Problem:** Prediction uses `player.lastVx || 0` / `player.lastVy || 0` which are only updated in `game-logic.js` when player *actually moves*. If player stands still then dashes, prediction is wrong.

```javascript
const travelTime = distance(bot.x, bot.y, player.x, player.y) / bulletSpeed;
const predX = player.x + (player.lastVx || 0) * travelTime;
const predY = player.y + (player.lastVy || 0) * travelTime;
```

**Impact:** Bot misses dashing players consistently. No dash anticipation.

**Fix:** Track player velocity *every frame* in game state, not just on input. Add dash state detection (player.inv > 0 && player.dash > 0).

---

### 5. Tight Coupling to Global `window.NOX_GAME` (Line 38-42, `bot-ai.js`)

**Problem:** `getPlayerPos()` directly accesses global game state.

```javascript
function getPlayerPos() {
  if(typeof window !== 'undefined' && window.NOX_GAME && window.NOX_GAME.players) {
    const p = window.NOX_GAME.players[0];
    ...
  }
}
```

**Impact:**
- Cannot run bot AI in simulation (`game-sim.js`) for testing/parity
- Breaks isomorphic simulation architecture
- Hard to unit test

**Fix:** Pass player state explicitly via `state` parameter (already has `pickups`, `hazards` — add `player`).

---

## Major Issues (Should Fix)

### 6. No Void Awareness (Entire `bot-ai.js`)

**Problem:** Bot has **zero awareness** of the void shrink mechanic (starts at 7:30, shrinks over 30s). In trials mode, the void is the primary win condition pressure.

**Impact:** Bot wanders into void, dies to void damage, doesn't position to force player into void.

**Fix:** Add `voidRect` and `safeRadius` to state. New behavior: `avoidVoid` (high priority when outside safe zone).

---

### 7. Powerup Usage is Passive Only (Lines 220-228, `bot-ai.js`)

**Problem:** Bot only *picks up* powerups via `seekPickup`. Never *strategically activates* shield/overcharge/blink.

```javascript
// Line 226: Only 1% chance per frame to "use" overcharge — but no activation logic
if(behavior === 'engagePlayer' && bot.overcharge === 0 && Math.random() < 0.01) {
  // Will pick up overcharge if available via seekPickup
}
```

**Impact:** Bot with shield takes damage instead of blocking. Bot with overcharge doesn't press advantage.

**Fix:** Add activation logic in `updateBotAI`:
- Shield: auto-activate when HP ≤ 4 and taking damage
- Overcharge: activate when engaging at < 400px
- Blink: use extra dash for dodging/closing

---

### 8. Magic Numbers Everywhere (Throughout `bot-ai.js`)

**Problem:** Hardcoded thresholds with no constants:

| Value | Location | Meaning |
|-------|----------|---------|
| 100 | L75 | Hazard evade range |
| 300 | L83 | Pickup seek range |
| 800 | L90 | Player engage range |
| 200/350/500 | L144/L149/L152 | Engage strafe/dash/backoff distances |
| 60 | L180 | Hazard dash distance |
| 300/400 | L208/L212 | Retreat dash distances |
| 50 | L188 | Patrol waypoint reach distance |
| 80-120ms | L123/L164 | Reaction delay |

**Impact:** Tuning requires code changes. No difficulty scaling. Hard to balance.

**Fix:** Extract all thresholds to `BOT_CONFIG` object at top of file.

---

### 9. Patrol Waypoints Ignore Game Boundaries (Lines 189-190, `bot-ai.js`)

```javascript
bot.targetX = 100 + Math.random() * (1920 - 200); // TRIALS_W hardcoded!
bot.targetY = 100 + Math.random() * (1120 - 200); // TRIALS_H hardcoded!
```

**Impact:** Hardcoded to trials map size. Breaks if map size changes or in 1v1 mode.

**Fix:** Use `gameMode` aware bounds from state.

---

### 10. Distance Calculations Use `Math.hypot` (Sqrt) for Comparisons

**Problem:** `findNearestPickup`, `findNearestHazard`, `distance` all use `Math.hypot` (sqrt) for *every comparison*.

```javascript
// Line 20: sqrt for every pickup
const d = distance(bot.x, bot.y, pu.x, pu.y);

// Line 30: sqrt for every hazard
const d = distance(bot.x, bot.y, hx, hy);
```

**Impact:** Unnecessary sqrt operations (10-20 per frame). Negligible in JS but bad pattern.

**Fix:** Use squared distance for comparisons, sqrt only when actual distance needed.

---

## Moderate Issues (Nice to Fix)

### 11. No Behavior State Machine

**Current:** String-based behavior names (`'patrol'`, `'engagePlayer'`, etc.) with no enter/exit logic.

**Better:** Proper state machine with `enter()`, `tick(dt)`, `exit()` — allows:
- Smooth transitions (e.g., finish dash before retreating)
- Behavior-specific initialization (pick patrol waypoint on enter)
- Cleanup (clear targetAngle on exit)

### 12. No Player Modeling / Adaptation

**Current:** Purely reactive. No memory of:
- Player preferred range
- Player dash patterns
- Player ammo type
- Recent damage taken

**Better:** Simple memory — track `player.lastDashTime`, `player.preferredRange`, `player.aggressionLevel`. Adjust weights based on patterns.

### 13. Dash Usage is Random, Not Tactical

**Current:** 
- Engage: 10% chance at 350-500px (line 149)
- Evade: Always if < 60px (line 180)
- Retreat: 5% chance at < 400px (line 212)

**Issues:** 
- No dash to *dodge incoming bullets*
- No dash to *close distance for cannon/shotgun*
- No dash *prediction* (player dash cooldown tracking)

### 14. No Friendly Fire / Teammate Awareness

**Current:** Only 1v1 + bot. But architecture doesn't support team modes.

**Future-proof:** Add `team` property, avoid shooting teammates, coordinate with allies.

---

## Minor Issues (Code Quality)

### 15. Duplicate `distance` Function

Defined in both `bot-ai.js` (line 12-15) and `game-logic.js` (line 303-306).

### 16. No TypeScript Types for Bot State

Bot object has 30+ properties with no type definition. Easy to typo (`bot.overcharge` vs `bot.overCharge`).

### 17. `bot.behaviorTimer` Dual Purpose

Used for both:
- Behavior re-selection interval (line 254)
- Patrol waypoint duration (line 191)

Confusing. Separate into `behaviorReselectTimer` and `patrolTimer`.

### 18. Aim Error Reset Per Shot (Line 139)

```javascript
bot.aimError = (Math.random() - 0.5) * 0.15;
```

Resets every shot — makes burst fire (overcharge spread) wildly inaccurate. Should persist for burst duration.

### 19. No Difficulty Scaling

Bot always same skill. No `difficulty` parameter for:
- Reaction delay (80-120ms → 150-300ms for easy)
- Aim error (0.15 → 0.3 for easy)
- Behavior weights (more patrol, less engage for easy)
- HP/damage multipliers

---

## Architecture Recommendations

### Recommended Refactor Structure

```
bot-ai/
├── bot-config.ts          # All tunable constants
├── bot-types.ts           # TypeScript interfaces
├── behaviors/
│   ├── base-behavior.ts   # Abstract base with enter/tick/exit
│   ├── seek-pickup.ts
│   ├── engage-player.ts
│   ├── evade-hazard.ts
│   ├── patrol.ts
│   ├── retreat.ts
│   └── avoid-void.ts      # NEW
├── behavior-selector.ts   # Priority-based scoring (not weighted random)
├── movement.ts            # Wall-aware movement, raycast lookahead
├── targeting.ts           # Predictive aim with dash awareness
├── powerup-manager.ts     # Strategic activation logic
├── player-model.ts        # Player pattern tracking
└── bot-ai.ts              # Main update loop, exports updateBotAI
```

### Priority-Based Behavior Selection (Replace Weighted Random)

```typescript
interface BehaviorScore {
  behavior: BehaviorType;
  score: number;
  reason: string;
}

function selectBehavior(bot: Bot, state: GameState): BehaviorType {
  const scores: BehaviorScore[] = [
    scoreSeekPickup(bot, state),
    scoreEngagePlayer(bot, state),
    scoreEvadeHazard(bot, state),
    scoreAvoidVoid(bot, state),      // NEW
    scoreRetreat(bot, state),
    scorePatrol(bot, state),
  ];
  
  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);
  
  // Hysteresis: if current behavior in top 2, keep it (with decay)
  const currentIdx = scores.findIndex(s => s.behavior === bot.behavior);
  if (currentIdx <= 1 && bot.behaviorCommitment > 0) {
    bot.behaviorCommitment--;
    return bot.behavior;
  }
  
  bot.behaviorCommitment = 60 + Math.floor(Math.random() * 60); // 1-2 sec commitment
  return scores[0].behavior;
}
```

### Wall-Aware Movement

```typescript
function getSafeMovementVector(bot: Bot, desired: Vec2, walls: Wall[], lookahead = 48): Vec2 {
  // Sample points along desired vector
  for (let step = lookahead; step > 0; step -= 12) {
    const testX = bot.x + desired.x * step;
    const testY = bot.y + desired.y * step;
    if (wallsCollide(testX, testY, PLAYER_R)) {
      // Try perpendicular vectors
      const perp1 = { x: -desired.y, y: desired.x };
      const perp2 = { x: desired.y, y: -desired.x };
      if (!wallsCollide(bot.x + perp1.x * 12, bot.y + perp1.y * 12, PLAYER_R)) return perp1;
      if (!wallsCollide(bot.x + perp2.x * 12, bot.y + perp2.y * 12, PLAYER_R)) return perp2;
      // Stuck — return zero
      return { x: 0, y: 0 };
    }
  }
  return desired;
}
```

---

## Testing Strategy

### Unit Tests Needed

| Module | Test Cases |
|--------|------------|
| `behavior-selector` | Priority ordering, hysteresis, void awareness overrides |
| `targeting` | Stationary target, moving target, dashing target, wall occlusion |
| `movement` | Wall sliding, corridor navigation, corner sticking |
| `powerup-manager` | Shield activation threshold, overcharge timing, blink usage |

### Integration Tests

1. **Simulation Parity:** Run bot in `game-sim.js` with fixed seed → deterministic behavior
2. **Survival Test:** Bot vs void shrink — should survive > 8:00 consistently
3. **Damage Test:** Bot takes X damage over Y seconds — verify shield/retreat triggers
4. **Pickup Test:** Spawn powerups — verify bot collects appropriate ones for situation

---

## Implementation Priority

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Fix weight mutation bug | 1h | High — fixes erratic behavior |
| **P0** | Add behavior commitment/hysteresis | 2h | High — stops jitter |
| **P0** | Decouple from `window.NOX_GAME` | 1h | High — enables sim testing |
| **P1** | Add void awareness behavior | 3h | High — core trials mechanic |
| **P1** | Wall-aware movement (raycast) | 4h | High — fixes stuck bot |
| **P1** | Extract magic numbers to config | 2h | Medium — enables tuning |
| **P2** | Strategic powerup activation | 3h | Medium — smarter bot |
| **P2** | Predictive aim with dash awareness | 2h | Medium — fairer fights |
| **P3** | Behavior state machine refactor | 6h | Low — maintainability |
| **P3** | Player modeling / adaptation | 4h | Low — depth |
| **P3** | Difficulty scaling system | 3h | Low — accessibility |

---

## Appendix: Current Bot State Shape

```javascript
const bot = {
  // Core
  id: 2,
  x: 0, y: 0,
  vx: 0, vy: 0,
  angle: 0,
  hp: 12, maxHp: 12,
  
  // Combat
  dash: 0, dashCd: 0, inv: 0, shootCd: 0,
  overcharge: 0,
  shield: false, shieldHp: 0, shieldMax: 5,
  speedBoost: 0, extraDash: 0,
  baseSpeed: 3.6,
  
  // Status effects
  squish: 0, inSlime: false,
  lavaCd: 0, voidCd: 0, slimeCd: 0,
  
  // Loadout
  color: '#ffb23e',
  alive: true,
  ammoType: 'standard', ammo: Infinity,
  isBot: true,
  
  // AI State
  behavior: 'patrol',
  behaviorTimer: 0,        // DUAL PURPOSE: reselection + patrol
  targetX: 0, targetY: 0,  // Patrol only
  reactionDelay: 0,        // 80-120ms
  lastShotTime: 0,
  aimError: 0,
};
```

---

## Conclusion

The bot AI works as a baseline but suffers from **architectural shortcuts** (weighted random, no state machine, global coupling) that compound into poor gameplay feel. The highest-ROI fixes are:

1. **Behavior commitment** (stops jitter)
2. **Void awareness** (core to trials mode)
3. **Wall-aware movement** (fixes stuck bot)
4. **Decoupling from globals** (enables testing)

These four changes would elevate the bot from "functional placeholder" to "competent opponent" without a full rewrite.

---

## Fix Status (2026-08-31)

| Issue | Status | Notes |
|-------|--------|-------|
| **1. Behavior Selection Instability** | ✅ **FIXED** | Priority-based scoring + hysteresis (60-120 frame commitment) implemented |
| **2. Weight Mutation Bug** | ✅ **FIXED** | Independent scoring functions, no cross-mutation |
| **3. No Wall Avoidance** | ✅ **FIXED** | Raycast lookahead (3 samples, 36px) with perpendicular sliding |
| **4. Stale Predictive Aim** | ✅ **FIXED** | Live player velocity tracked every frame (`lastVx`/`lastVy` updated in game-logic); dash detection |
| **5. Global Coupling** | ✅ **FIXED** | `GameState` passed explicitly; `window.NOX_GAME` removed from bot-ai.js |
| **6. No Void Awareness** | ✅ **FIXED** | New `avoidVoid` behavior with critical priority when outside safe zone |
| **7. Passive Powerup Usage** | ✅ **FIXED** | Shield auto-activate at HP≤4; overcharge at engage<400px; blink for dodge/close |
| **8. Magic Numbers** | ✅ **FIXED** | All thresholds in `BOT_CONFIG` with difficulty multipliers |
| **9. Patrol Bounds Hardcoded** | ✅ **FIXED** | Uses `BOT_CONFIG.TRIALS_W/H` from config |
| **10. Sqrt for Comparisons** | ✅ **FIXED** | `dist2()` for comparisons, `distance()` only when needed |
| **11. No State Machine** | ⏳ Deferred | String-based with hysteresis; full state machine for future |
| **12. No Player Modeling** | ⏳ Deferred | For future enhancement |
| **13. Random Dash Usage** | 🟡 Partial | Blink dash for dodge/close added; bullet dodge prediction deferred |
| **14. No Team Awareness** | ⏳ Deferred | Out of scope for solo trials |
| **15. Duplicate Distance** | ✅ **FIXED** | Single `distance`/`dist2` in bot-ai.js |
| **16. No TypeScript Types** | ✅ **FIXED** | JSDoc typedefs for BotState, GameState, BotAIOutput |
| **17. Dual-Purpose Timer** | ✅ **FIXED** | Separate `behaviorCommitment` (selector) and `behaviorTimer` (patrol) |
| **18. Aim Error Per Shot** | ✅ **FIXED** | Persists for overcharge burst (`lastBurstAimError`) |
| **19. No Difficulty Scaling** | ✅ **FIXED** | `BOT_CONFIG.DIFFICULTY` with easy/normal/hard multipliers |

**Summary:** All P0 and P1 critical/major issues resolved. Build passes, tests pass, TypeScript warnings cleaned.