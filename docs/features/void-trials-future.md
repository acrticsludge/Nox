# Void Trials — Future Ideas (v2+)

This document captures all out-of-scope ideas from the v1 spec for future consideration. Each item is a self-contained expansion that builds on the v1 foundation.

---

## 1. Difficulty Tiers — Trial I / II / III

**Concept:** Three curated difficulty levels with distinct bot personalities and environmental modifiers.

| Tier | Bot Aggression | Void Speed | Pickup Rate | Bot HP | Unlock Condition |
|------|----------------|------------|-------------|--------|------------------|
| Trial I | Standard (current) | 30s shrink | Normal | 12 | Default |
| Trial II | +25% engage weight, -15% patrol | 20s shrink | -20% | 15 | Survive 8:00 on Trial I |
| Trial III | +50% engage, predictive dodge | 15s shrink | -40% | 18 | Survive 6:00 on Trial II |

**Implementation:** Pre-game selector on Trials start screen. Each tier saves separate high score (`nv_trials_highscore_I`, `_II`, `_III`). Tier completion unlocks next.

---

## 2. Daily Seeded Runs

**Concept:** Deterministic RNG seed based on date (UTC). Same walls, hazards, pickup spawns, bot behavior for all players that day.

**Mechanics:**
- Seed = `date.toISOString().split('T')[0]` (e.g., "2026-08-29")
- `Math.seedrandom(seed)` for all RNG in Trials mode
- Local high score per day: `nv_trials_daily_2026-08-29`
- "Today's Trial" badge on mode card with date
- Optional: Share run code (seed + score) for verification

**Social:** Discord bot posts daily seed + top local scores (if users opt in).

---

## 3. Meta Progression — Void Marks

**Concept:** Persistent cosmetic unlocks earned through total points across all runs.

**Currency:** `voidMarks` — 1 mark per 1000 points earned (any tier, any run).

**Unlock Tree:**
```
Ship Hulls (visual only, same hitbox)
├── SPECTRE (default) — Cyan glow
├── RIFT — Pink/magenta, unlocked at 5 marks
├── VOID — Lime/amber pulse, 15 marks
├── ABYSS — Dark with white core, 40 marks
└── NEON — Full rainbow cycle, 100 marks

Trail Effects
├── Standard (default)
├── Dashed — 10 marks
├── Glitch — 25 marks
├── Afterimage — 60 marks

Void Ring Styles
├── Electric (default)
├── Hexagonal — 20 marks
├── Fractured — 50 marks
└── Singularity — 120 marks
```

**Storage:** `nv_void_marks`, `nv_unlocked_hulls`, `nv_unlocked_trails`, `nv_unlocked_rings` in localStorage.

---

## 4. Bot Personality Profiles

**Concept:** Four distinct AI archetypes, randomly assigned or selected per run.

| Profile | Core Weights | Unique Trait |
|---------|--------------|--------------|
| **STALKER** | engage 0.50, seekPickup 0.20, evade 0.15 | Predicts player dash, pre-aims dash endpoint |
| **SNIPER** | engage 0.40 (long range), patrol 0.30 | Prefers cannon/needle, engages >600px, low dash usage |
| **SCAVENGER** | seekPickup 0.50, engage 0.15 | Rushes every pickup, uses blink aggressively, ignores player unless cornered |
| **GHOST** | evade 0.40, patrol 0.30 | Max dash usage, blink priority, flees at 50% HP, rarely shoots |

**Implementation:** `botPersonality` property on bot object. Weight overrides in behavior tree. Personality shown on HUD ("BOT: STALKER").

---

## 5. Mutators — Challenge Modifiers

**Concept:** Optional run modifiers that multiply final score (risk/reward).

| Mutator | Score Mult | Effect |
|---------|------------|--------|
| NO DASH | ×1.5 | Dash disabled for player (bot unaffected) |
| ONE HP | ×2.0 | Player MAX_HP = 1, bot HP = 12 |
| BULLET HELL | ×1.3 | Bot fire rate ×2, all bullets trick type |
| VOID ACCELERATED | ×1.4 | Void starts at 5:00, shrinks in 15s |
| NO PICKUPS | ×1.6 | Zero powerups spawn |
| MIRROR MATCH | ×1.2 | Bot copies player bullet type + powerups |
| BLIND VOID | ×1.3 | Void border invisible, only damage indicator |

**UI:** Mutator panel on start screen (checkboxes). Active mutators shown on HUD. High score tracked per mutator combo.

---

## 6. Replay System — Ghost Playback

**Concept:** Record deterministic input stream + RNG seed, playback with ghost bot.

**Data Structure:**
```javascript
{
  seed: "2026-08-29",
  mutators: ["NO DASH"],
  duration: 600,
  finalScore: 45230,
  inputs: [
    { t: 0, keys: {KeyW: true}, angle: 0.12 },
    { t: 1, keys: {KeyW: true, Space: true}, angle: 0.15 },
    // ... 600 * 60 = 36000 frames max
  ],
  botPersonality: "STALKER"
}
```

**Storage:** `nv_trials_replay_<timestamp>` (keep last 5). Replay mode on start screen: "WATCH REPLAY" → loads ghost bot + player ghost.

**Technical:** Input recording in `update()` loop. Playback uses same simulation with recorded inputs. Determinism requires fixed RNG (seedrandom).

---

## 7. Co-op Trials — 2 Players vs 2 Bots

**Concept:** Two humans (WASD + Arrows) on same keyboard, two bots, 2x arena, shared void.

**Mechanics:**
- P1: WASD + SHIFT + SPACE (Cyan)
- P2: Arrows + / + ENTER (Pink)
- 2 bots with different personalities
- Shared points pool (both contribute)
- Void shrink affects both equally
- Win: both survive 10:00 OR both bots dead
- Lose: both players dead

**UI:** Split HUD (left/right), shared points center. Pause pauses both.

**Scope:** Separate mode entry `/play/trials-coop` or toggle on Trials start screen.

---

## 8. Global Leaderboard — Vercel KV / Supabase

**Concept:** Cross-device, cross-browser high scores with daily/weekly/all-time boards.

**Architecture:**
- Vercel KV (Redis) or Supabase table `trials_scores`
- Schema: `id, date, tier, mutators, score, voidMarksEarned, seed, userHash`
- `userHash` = SHA256(IP + UA) truncated — anonymous but deduplicated
- Rate limit: 10 submissions/hour per hash

**API:**
- `POST /api/trials/submit` — verify score plausibility (server-side sim replay or heuristic)
- `GET /api/trials/leaderboard?tier=I&period=daily` — top 100

**Frontend:** "LEADERBOARD" button on Trials start screen → modal with tabs (Daily/Weekly/All-Time/Tier).

---

## 9. Seasonal Events — Void Convergence

**Concept:** Limited-time events with unique rules, cosmetics, and lore.

**Examples:**
- **BLOOD MOON** (Halloween): Red void, bot = GHOST personality, slime → blood (damage + slow), exclusive "WRAITH" hull
- **SOLSTICE** (Winter): Blue void, ice hazards (slippery), bot = SNIPER, exclusive "FROST" trail
- **GLITCH WEEK** (April): Corrupted visuals, bot randomly switches personalities mid-fight, "DATAMOSH" ring

**Duration:** 7-14 days. Event state in localStorage + server flag.

---

## 10. Accessibility & Quality of Life

- **Colorblind modes:** Protanopia/Deuteranopia/Tritanopia palettes (swap cyan/pink/lime/amber)
- **Reduced motion:** Disable void pulse, particle bursts, screen shake
- **High contrast:** Thicker borders, brighter text, no transparency
- **Key remap:** Custom keybinds stored in localStorage
- **Bot difficulty slider:** 0.5x - 2.0x behavior weights (separate from global speed)

---

## Priority Order (Suggested)

1. **Difficulty Tiers** — Immediate replay value, low complexity
2. **Daily Seeds** — Retention hook, shares well
3. **Meta Progression** — Long-term engagement
4. **Bot Personalities** — Variety without new content
5. **Mutators** — High skill expression
6. **Replay System** — Community content
7. **Co-op** — Social play
8. **Leaderboard** — Competitive layer
9. **Seasonal Events** — Live ops
10. **Accessibility** — Always ongoing

---

## Notes

- All v2+ features must maintain **full backward compatibility** with v1 save files
- No breaking changes to `game-logic.js` public API (`window.NOX_GAME`)
- New features behind feature flags until validated
- Performance budget: 60fps on 5-year-old laptop (Intel UHD 620 / M1 base)