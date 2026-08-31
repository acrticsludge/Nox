# Specification: Bot AI Hunting Behavior Fix

**Status:** Proposed  
**Date:** 2026-08-31  
**Related:** `docs/audits/bot-ai-analysis.md`, `docs/reasonix/specs/bot-ai-refactor.md`

---

## Problem Statement

The current bot AI in Void Trials exhibits broken behavior:
1. **Buzzes randomly** - Patrol behavior wins too often; engagePlayer not prioritized enough
2. **Accidental powerup pickup** - No intentional seeking; only picks up when wandering nearby
3. **Ignores hazards** - evadeHazard only triggers at 100px; movement is directly away (gets stuck on walls)
4. **360° shooting frenzy** - When player close, bot spins randomly each frame (random strafe direction), shoots wildly

---

## Goals

| Goal | Success Metric |
|------|----------------|
| Bot actively hunts player | Engage behavior selected >80% when player in range |
| No 360° spinning | Consistent strafe direction per engagement |
| Intentional hazard avoidance | Paths around hazards using wall-aware movement |
| Reliable aim | <10° aim error at mid-range; predicts dash |
| Powerup seeking | Goes out of way for shield/overcharge when needed |

---

## Non-Goals
- Full navigation mesh / pathfinding (out of scope)
- Player modeling / adaptation (deferred)
- Team/coop support (out of scope)

---

## Functional Requirements

### FR-01: Aggressive Hunting (engagePlayer Priority Boost)
- **engagePlayer base weight**: 0.30 → **0.60** (double)
- **engage range**: 800 → **1200** (detect player from anywhere in arena)
- **Minimum engage score**: 200 (floor) so it always beats patrol when player alive
- **HP modifier**: Even at low HP, engage if player is close (don't just retreat)

### FR-02: Consistent Strafe Direction (Fix 360° Spin)
- **Strafe direction chosen ONCE per engagement** (when behavior switches TO engagePlayer)
- Store `bot.strafeDir` (-1 or +1) in bot state
- Clear when leaving engagePlayer behavior
- Strafe perpendicular to aim angle consistently

### FR-03: Intentional Hazard Avoidance
- **evadeHazard range**: 100 → **200** (earlier detection)
- **Movement**: Use `getSafeMovementVector` with desired vector AWAY from hazard
- **Combine with engage**: When both engage and hazard, blend vectors (70% engage, 30% evade)
- **Lava prediction**: Check if lava will be active in next 2 seconds

### FR-04: Stable Predictive Aim
- **Aim error**: Only re-roll when:
  - Switching TO engagePlayer behavior
  - Overcharge burst starts
  - Player dashes (detected via velocity change)
- **Base aim error**: 0.15 → **0.08** (tighter)
- **Predict dash**: If `player.dash > 0`, multiply velocity by 2.35

### FR-05: Powerup Hunting (Not Accidental)
- **seekPickup range**: 300 → **500**
- **Shield priority**: +200 score when HP ≤ 4
- **Overcharge priority**: +150 when HP > 8
- **Seek even during engage**: Blend seekPickup vector when pickup is high-value

### FR-06: Close-Range Combat
- **< 150px**: Circle strafe (not back away) - maintain distance while shooting
- **150-300px**: Aggressive strafe + shoot
- **> 300px**: Close distance aggressively
- **Dash to close**: When > 250px and dash available, dash toward player

---

## Interface Contracts

### Bot State Additions
```javascript
/**
 * @typedef {Object} BotState
 * @property {number} strafeDir - -1 or +1, set when entering engagePlayer
 * @property {number} lastEngageTime - timestamp of last engage behavior
 * @property {number} lastHazardAvoidTime - for blending
 */
```

### Game State (already exists)
```javascript
/**
 * @typedef {Object} GameState
 * @property {Object} player - {x, y, vx, vy, dash, inv, alive}
 * @property {Array} hazards - {x, y, w, h, kind, t}
 * @property {Function} wallsCollide
 */
```

---

## Behavior Scoring Changes

| Behavior | Old Base | New Base | Key Changes |
|----------|----------|----------|-------------|
| engagePlayer | 0.30 | **0.60** | Double priority; min score 200 |
| seekPickup | 0.35 | **0.40** | Range 500; bonus for needed powerups |
| evadeHazard | 0.20 | **0.35** | Range 200; lava prediction |
| avoidVoid | 0.00 | **0.50** | Critical when outside safe zone |
| retreat | 0.05 | **0.20** | Only when HP < 25% AND player close |
| patrol | 0.10 | **0.05** | Halved; only when truly nothing else |

---

## Acceptance Criteria

| ID | Criterion | Test |
|----|-----------|------|
| AC-01 | Bot selects engagePlayer >80% when player in 1200px | Unit test: 100 random states, count engage |
| AC-02 | Strafe direction constant during engagement | E2E: log strafeDir, verify no flip |
| AC-03 | Bot paths around hazard (not through) | Visual: 30s trial, zero hazard contacts |
| AC-04 | Aim error < 0.1 rad at 300px | Integration: 100 shots, measure error |
| AC-05 | Bot gets shield when HP≤4 | Unit: simulate low HP + shield pickup |
| AC-06 | No 360° spin when player close | Visual: player at 100px, bot angle stable |

---

## Rollout Plan

1. **Phase 1**: Scoring changes (FR-01, FR-05)
2. **Phase 2**: Strafe fix + aim stability (FR-02, FR-04)
3. **Phase 3**: Hazard avoidance blend (FR-03)
4. **Phase 4**: Close-range combat tuning (FR-06)
5. **Verification**: Build, typecheck, browser test 3 trials