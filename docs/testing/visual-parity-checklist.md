# Cross-Mode Visual Parity — Manual Checklist

**Date:** 2026-08-31
**Branch:** `feat/visual-parity`
**Spec:** `docs/reasonix/specs/visual-parity-sync.md` (Implemented)
**Automated coverage:** `frontend/src/game/vfx/vfx.test.js` (determinism, dedupe, aging, hold, sim branch emission), `backend/test/events.test.js` (server batch ordering, stable bullet ids), full local regression green (`npm.cmd test` 36 frontend + 39 backend, `npm.cmd run check` 0 errors).

Manual side-by-side comparison is the remaining acceptance gate. Run local
1v1 (`/play`), Void Trials (`/play/trials`), and Online (`/play/online`,
backend via `npm start` in `backend/`) and verify each row behaves the same
in every applicable mode.

## Matrix

| # | Check | 1v1 | Trials | Online | Notes |
|---|-------|-----|--------|--------|-------|
| 1 | Muzzle flash on every shot (color by bullet type) | ☐ | ☐ | ☐ | standard=cyan/pink, needle=violet, cannon=amber, trick=cyan |
| 2 | Dash burst + dash flame | ☐ | ☐ (bot too) | ☐ (both seats) | |
| 3 | Standard bullet wall impact | ☐ | ☐ | ☐ | owner-colored burst |
| 4 | Needle wall impact (violet) + needle BLOCK front-graze text | ☐ | ☐ | ☐ | |
| 5 | Cannon wall impact (BOOM -4) + ember rise | ☐ | ☐ | ☐ | |
| 6 | Trick wall impact / bounce sparks + bounce pip label | ☐ | ☐ | ☐ | pips decay per bounce |
| 7 | Shield hit: impact burst + crack shards, chip shows damage | ☐ | ☐ (bot too) | ☐ (both seats) | |
| 8 | Shield break: shard star burst + ring disappears | ☐ | ☐ | ☐ | |
| 9 | Needle rear crit (CRIT +6 star burst) | ☐ | ☐ | ☐ | |
| 10 | Trick hit shows decaying damage number | ☐ | ☐ | ☐ | |
| 11 | Pickup burst + ammo text (`NEEDLE x5`) | ☐ | ☐ | ☐ | |
| 12 | Heal: green burst + `+2` text | ☐ | ☐ | ☐ | |
| 13 | Lava damage (-2 LAVA) + shield-break on depletion | ☐ | ☐ | ☐ | |
| 14 | Void damage (VOID -1) + death burst on elimination | ☐ | ☐ | ☐ | |
| 15 | Death/elimination burst in actor color | ☐ | ☐ | ☐ | |
| 16 | Round-end overlay + score, then next round | ☐ | n/a | ☐ | |
| 17 | Effects keep animating between online snapshots (no frozen dots) | n/a | n/a | ☐ | 60 fps timeline vs 30 Hz snapshots |
| 18 | Effects are never erased/cleared by snapshot application | n/a | n/a | ☐ | |
| 19 | Remote motion is smooth (interpolated), bullets keep trails by identity | n/a | n/a | ☐ | 100 ms interpolation delay |
| 20 | HUD data belongs to the right player (seat 1 = pink: self card shows YOUR hp/ammo) | n/a | n/a | ☐ | test from both seats |
| 21 | No `xInfinity` anywhere; typed ammo with unknown count shows type only | ☐ | ☐ | ☐ | |
| 22 | Match end: single result message, then clean lobby (no 1v1 game-over overlay, no stale `VS … starting…`) | n/a | n/a | ☐ | |
| 23 | No mojibake glyphs (`â€¦`, `âœ•`, `â—‡`) anywhere in online UI | n/a | n/a | ☐ | |
| 24 | Void ring shrinks at 45s and relocates hazards match the opponent's view | n/a | n/a | ☐ | new in snapshots (`sr`, `hz`) |

## Known tuning knob

- `NET_INTERP_TICKS = 6` (100 ms) in `game-logic.js` — display delay for
  remote state and effects. If online feels laggy locally (same-machine
  backend), try 3–4; for real WAN play keep ≥ 6. Document any change here.

## Deployment note

Playing against an **older backend build** (e.g. a stale Render deployment)
degrades online gracefully: no visual events (server sends none), no bullet
ids (fallback identity per snapshot), no ammo field (HUD shows type only).
Deploy the current backend for full parity.
