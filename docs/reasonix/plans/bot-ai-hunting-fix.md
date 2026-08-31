# Implementation Plan: Bot AI Hunting Fix

## Overview
Fix the Void Trials bot AI to actively hunt the player, avoid hazards intentionally, and stop the 360° spinning frenzy.

## Classification
- **Risk**: Medium (core gameplay behavior change)
- **Type**: Bugfix / behavior tuning
- **Files**: `frontend/src/game/bot-ai.js` (primary), `frontend/src/game/game-logic.js` (minor)

---

## Phase 1: Scoring & Priority Fixes (P0)

### Task 1: Boost engagePlayer Priority
- **Objective**: Make hunting the default behavior when player alive
- **Changes**:
  - `BOT_BEHAVIOR_BASE_WEIGHTS.engagePlayer`: 0.30 → 0.60
  - `BOT_CONFIG.ENGAGE_RANGE`: 800 → 1200
  - Add minimum score floor of 200 in `scoreEngagePlayer`
- **Acceptance**: engagePlayer selected >80% when player in range
- **Verify**: Unit test with mocked states

### Task 2: Fix seekPickup for Intentional Hunting
- **Objective**: Bot seeks powerups proactively, especially shield/overcharge
- **Changes**:
  - `BOT_CONFIG.PICKUP_SEEK_RANGE`: 300 → 500
  - Shield bonus: +100 → +200 when HP ≤ 4
  - Overcharge bonus: +80 → +150 when HP > 8
- **Acceptance**: Bot detours for shield when low HP
- **Verify**: Visual test in browser

### Task 3: Boost evadeHazard Priority
- **Objective**: Hazard avoidance triggers earlier and beats patrol
- **Changes**:
  - `BOT_BEHAVIOR_BASE_WEIGHTS.evadeHazard`: 0.20 → 0.35
  - `BOT_CONFIG.HAZARD_EVADE_RANGE`: 100 → 200
  - `BOT_CONFIG.HAZARD_DASH_RANGE`: 60 → 100
- **Acceptance**: Bot steers clear of hazards at 150px+

---

## Phase 2: Strafe & Aim Fixes (P0)

### Task 4: Consistent Strafe Direction (Fix 360° Spin)
- **Objective**: Bot picks ONE strafe direction per engagement
- **Changes**:
  - Add `bot.strafeDir` property (initialize to 0)
  - In `selectBehavior`: when switching TO `engagePlayer`, set `bot.strafeDir = Math.random() < 0.5 ? -1 : 1`
  - In `executeEngagePlayer`: use `bot.strafeDir` instead of random
  - Clear `bot.strafeDir = 0` when leaving engagePlayer
- **Acceptance**: Strafe direction constant during single engagement
- **Verify**: Log strafeDir in browser console

### Task 5: Stable Aim Error
- **Objective**: Aim doesn't jitter every frame
- **Changes**:
  - `BOT_CONFIG.BASE_AIM_ERROR`: 0.15 → 0.08
  - Only re-roll aimError when:
    - `bot.behavior` just changed to `engagePlayer` (track via `bot.lastBehavior`)
    - `bot.overcharge` just activated
    - Player dash detected (velocity magnitude increase > 2x)
  - Store `bot.lastBehavior` to detect transitions
- **Acceptance**: Aim stable within engagement; only shifts on dash/overcharge
- **Verify**: Visual test + aim error logging

### Task 6: Dash Velocity Prediction
- **Objective**: Predict player dash movement
- **Changes**:
  - In `executeEngagePlayer`: detect `player.dash > 0` and multiply `playerVx/vy` by 2.35
  - Already partially implemented - verify it's working
- **Acceptance**: Bot leads dashing player correctly

---

## Phase 3: Hazard Avoidance Blend (P1)

### Task 7: Blend Engage + Evade Vectors
- **Objective**: Bot avoids hazards WHILE hunting, not instead of
- **Changes**:
  - In `updateBotAI`: after `executeBehavior`, if behavior is `engagePlayer` AND hazard nearby:
    - Get evade vector from `executeEvadeHazard`
    - Blend: `output.mx = 0.7 * engage.mx + 0.3 * evade.mx`
    - Same for `my`
  - Use `getSafeMovementVector` on blended result
- **Acceptance**: Bot circles around lava while shooting at player
- **Verify**: Visual test with lava near player

### Task 8: Lava Active Prediction
- **Objective**: Avoid lava BEFORE it activates
- **Changes**:
  - In `scoreEvadeHazard`: check `hazard.t % 300` - if next active phase within 120 frames (2s), boost score
  - In `executeEvadeHazard`: if lava inactive but activating soon, still evade
- **Acceptance**: Bot clears lava zone before activation

---

## Phase 4: Close-Range Combat Tuning (P1)

### Task 9: Circle Strafe at Close Range
- **Objective**: At < 150px, circle strafe instead of back away
- **Changes**:
  - In `executeEngagePlayer`:
    - `dist < 150`: strafe perpendicular (use `bot.strafeDir`) at 0.8 speed
    - `150-300`: aggressive strafe at 0.7 speed
    - `> 300`: close distance at 1.0 speed
  - Remove back-away behavior entirely
- **Acceptance**: Bot orbits player at close range, maintaining shooting

### Task 10: Aggressive Dash to Close
- **Objective**: Dash to player when far
- **Changes**:
  - `BOT_CONFIG.ENGAGE_DASH_RANGE`: 350 → 250
  - `BOT_CONFIG.ENGAGE_DASH_PROBABILITY`: 0.1 → 0.3
  - Dash when `dist > 250` and dash available
- **Acceptance**: Bot dashes to close gap aggressively

---

## Phase 5: Verification (P0)

### Task 11: Build & Typecheck
- `npm run build` passes
- `npm run check` passes (no new errors)

### Task 12: Browser Test - 3 Full Trials
- Start trial, observe bot behavior for 2 minutes each
- Verify: hunts player, avoids lava, picks up shield, no 360 spin
- Verify: survives to void shrink (8:00)

### Task 13: Unit Tests
- Add test cases to `bot-ai.test.js` (create if needed):
  - `scoreEngagePlayer` returns >200 when player in range
  - `strafeDir` set on behavior switch
  - `aimError` stable within engagement

---

## Dependencies & Ordering

```
Phase 1 (1-3) → Phase 2 (4-6) → Phase 3 (7-8) → Phase 4 (9-10) → Phase 5 (11-13)
```

## Rollback Plan
- Feature flag: `window.USE_NEW_BOT_AI = false` (already in place from refactor)
- Revert `bot-ai.js` to committed version

---

## Files to Modify
1. `frontend/src/game/bot-ai.js` - All changes
2. `frontend/src/game/game-logic.js` - Only if new bot state fields need initialization

---

## Skills Activated
- `spec-driven-development` - Spec created first
- `planning-and-task-breakdown` - This plan
- `incremental-implementation` - Phase-by-phase
- `test-driven-development` - Unit tests for scoring
- `browser-testing-with-devtools` - Visual verification
- `code-review-and-quality` - Review after implementation
- `git-workflow-and-versioning` - Atomic commits per phase