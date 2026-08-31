# Spec: Void Trials // Solo Mode

## Objective

Add a single-player "Void Trials" mode where 1 player (WASD controls) fights an AI bot on a 2x scaled arena (1920x1120) for 10 minutes. At 7:30 the void begins shrinking from 2x to 1x over 30 seconds, dealing exponential damage outside the safe zone. Player wins by surviving 10 minutes OR killing the bot. Points awarded for survival, hits, pickups; penalties for lava/slime. 2x points/penalties after 7:30. Full state persistence via localStorage with resume capability. Exit and pause controls. Bot uses predictive aim with human-like reaction delay, picks up powerups, avoids hazards, but has NO knowledge of void timing.

## Tech Stack

- **Frontend:** Astro + React (existing)
- **Game Logic:** Vanilla JS module (`frontend/src/game/game-logic.js`)
- **Rendering:** SVG (existing, no canvas)
- **Storage:** localStorage (full state serialization)
- **Styling:** CSS custom properties per `docs/design/DESIGN.md`

## Commands

```
Build: npm --prefix frontend run build
Dev: npm --prefix frontend run dev
Test: npm --prefix frontend run test
Lint: npm --prefix frontend run lint
```

## Project Structure

```
frontend/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ pages/
â”‚   â”‚   â”œâ”€â”€ play/
â”‚   â”‚   â”‚   â”œâ”€â”€ 1v1.astro          # existing
â”‚   â”‚   â”‚   â””â”€â”€ trials.astro        # NEW - Void Trials entry point
â”‚   â”‚   â””â”€â”€ play.astro              # mode selection (update Trials card)
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ GameShell.tsx           # existing - extend for Trials mode
â”‚   â”‚   â””â”€â”€ trials/
â”‚   â”‚       â”œâ”€â”€ TrialsGameShell.tsx # NEW - solo-specific shell
â”‚   â”‚       â”œâ”€â”€ TrialsHUD.tsx       # NEW - points, timer, void status
â”‚   â”‚       â”œâ”€â”€ TrialsBot.tsx       # NEW - bot AI logic (or in game-logic)
â”‚   â”‚       â”œâ”€â”€ PauseOverlay.tsx    # NEW
â”‚   â”‚       â””â”€â”€ ExitOverlay.tsx     # NEW
â”‚   â”œâ”€â”€ game/
â”‚   â”‚   â”œâ”€â”€ game-logic.js           # EXTEND - add Trials mode, bot AI, 2x arena
â”‚   â”‚   â””â”€â”€ bot-ai.js               # NEW - separated bot behavior tree
â”‚   â””â”€â”€ styles/
â”‚       â””â”€â”€ global.css              # EXTEND - Trials-specific tokens
â”œâ”€â”€ public/
â”‚   â””â”€â”€ og.png                      # update if needed
```

## Code Style

- TypeScript for React components, vanilla JS for game logic
- Monospace typography (`Courier New` / `--nox-mono`)
- Square radius (`0`), hairline borders (`var(--nox-border)`)
- Semantic color tokens only â€” no ad-hoc hex
- Async module loading via dynamic `import()`
- Event-driven communication via `window.dispatchEvent` / `window.NOX_GAME`

### Example: Trials Bot AI Structure

```javascript
// frontend/src/game/bot-ai.js
const BOT_BEHAVIORS = {
  seekPickup:   { weight: 0.35, fn: (bot, state) => { /* path to nearest pickup */ } },
  engagePlayer: { weight: 0.30, fn: (bot, state) => { /* predictive aim + strafe */ } },
  evadeHazard:  { weight: 0.20, fn: (bot, state) => { /* flee lava/slime */ } },
  patrol:       { weight: 0.10, fn: (bot, state) => { /* random waypoint */ } },
  retreat:      { weight: 0.05, fn: (bot, state) => { /* fallback when low HP */ } },
};

function selectBehavior(bot, state) {
  // Weighted random with bias toward highest when HP low
}
```

## Testing Strategy

- **Unit:** Bot AI behavior selection, void shrink math, point calculations, state serialization
- **Integration:** Full 10-min simulation (accelerated), pause/resume cycle, localStorage round-trip
- **E2E:** Browser devtools - verify bot moves, shoots, picks up, avoids hazards, void damage scales
- **Visual:** Hero preview on `/play` card, docs demo components

## Boundaries

- **Always:**
  - Reuse existing `game-logic.js` rendering pipeline (SVG, filters, particles)
  - Follow `docs/design/DESIGN.md` tokens exactly
  - Serialize full state to localStorage every 2 seconds
  - 60Hz fixed-step simulation (`SIM_STEP = 1000/60`)
  - No em dashes â€” use hyphens
- **Ask First:**
  - New npm dependencies
  - Changes to `global.css` design tokens
  - Database/backend integration (none for v1)
- **Never:**
  - Canvas rendering (SVG only)
  - Commit secrets
  - Hardcode colors outside token system
  - Skip localStorage persistence

## Success Criteria

1. **Mode Selection:** `/play` shows "VOID TRIALS // SOLO" card with amber accent, "LIVE // 1P â€¢ 10:00 â€¢ VOID CRUSH" badge, scary cyber styling, WASD hint, difficulty warning
2. **Arena:** 2x scale (1920x1120 viewBox), walls/pickups/hazards scale proportionally, same rendering quality
3. **Bot:** Moves, aims predictively (80-120ms delay), shoots all bullet types, picks up powerups, dodges lava/slime, uses dash, retreats when low HP â€” NO void awareness
4. **Void Shrink:** At 7:30 (450s), rectangular border begins shrinking from 2x edges to 1x center over 30s. Exponential damage outside: low at edge â†’ lethal at 1x boundary
5. **Scoring:** +1/sec survival, +25/hit, +75/powerup, -30/lava tick, -15/slime tick. After 7:30: gains Ã—2, losses Ã—3. High score persisted in localStorage
6. **Controls:** P1 = WASD + SHIFT (dash) + SPACE (shoot). Pause = P or ESC. Exit = forfeit with confirmation
7. **Persistence:** Full state (timer, HPs, positions, velocities, powerups, bot state, points, pause) saved every 2s. On reload, "Resume Trial" button appears on Trials start screen
8. **HUD:** Points large, timer with void warning at 7:30, bot HP, player HP, active powerups, current bullet type
9. **Docs:** `/docs` manual updated with Trials section. New demo components if needed

## Open Questions

- [RESOLVED] Void shrink: rectangular border, 30s duration (7:30-8:00), exponential damage
- [RESOLVED] Points: local high score only, values as specified above
- [RESOLVED 2026-08-31] Bot: predictive aim (real applied player velocity) + reaction delay, AVOIDS the shrinking void (intended design, audit P1-08), all powerup types
- [RESOLVED] Persistence: full run state snapshot every 2s, resume on reload
- [RESOLVED] Arena: 2x scale (1920x1120), proportional wall/hazard/pickup scaling
- [RESOLVED] Win: survive 10:00 OR kill bot (bot has 12 HP like player)
- [RESOLVED] Speed: configurable pre-game like 1v1 (global speed slider)

---

## Out of Scope (Future Ideas - Documented Separately)

See `docs/features/void-trials-future.md` for:

1. **Difficulty Tiers** â€” Trial I/II/III with increasing bot aggression, faster void, less pickup spawn
2. **Daily Seeded Runs** â€” Deterministic RNG seed per day, shared leaderboard via localStorage sync
3. **Meta Progression** â€” Unlock cosmetic ship variants, trail colors, void ring styles via total points
4. **Bot Personality Profiles** â€” "Stalker" (aggro), "Sniper" (long range), "Scavenger" (pickup priority), "Ghost" (evasive)
5. **Mutators** â€” "No Dashes", "One HP", "Bullet Hell", "Void Accelerated"
6. **Replay System** â€” Record inputs, playback with ghost bot
7. **Co-op Trials** â€” 2 players (WASD + Arrows) vs 2 bots on 2x arena
8. **Global Leaderboard** â€” Vercel KV or Supabase for cross-device scores