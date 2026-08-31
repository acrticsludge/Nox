# Frontend performance & bundle baseline (P2-19 / P3-03)

**Date:** 2026-08-31 · **Branch:** `feat/online-1v1` · **Build:** `astro build` (static), Node 24.19.0, Windows 11.

## Static bundle budget (measured from `frontend/dist`)

| Asset | Size (KB) | Notes |
|---|---|---|
| Total dist | ~1613 | includes icons + og images |
| JS total | 612 | before brotli/gzip |
| CSS total | 198 | one shared stylesheet |
| `Landing.*.js` | 214 | landing page island (largest route chunk) |
| `client.*.js` | 176 | Astro/React client runtime |
| `game-logic.*.js` | 118 | engine — **lazy-loaded only on /play routes after boot** (T4/T5); never in the landing/online-lobby critical path |
| `GameShell.*.js` | 51 | shell island |
| `online.*.js` (page script) | 11 | online page incl. NetBridge |
| `trials-save.*.js` | 4 | save validation module |

**Budget rule going forward:** the game engine (`game-logic` + `game-view` + `bot-ai`) must stay out of the landing-page critical path (verify: landing `index.html` must not preload game-logic). Any change that adds >20KB to a route's first-load JS needs justification in the PR.

## Frame loop facts (code-level, matches audit P3-03)

- Local 1v1 + Trials: single rAF loop at display refresh (60Hz typical), sim in `game-logic.js`.
- Online: server tick 30Hz (`match.js` snapshot interval); client interpolates snapshots. Footer now says `LOCAL 60FPS // NET 30HZ` for online routes — no unmeasured "60FPS" claim remains.

## Measured browser targets — PENDING (requires a real browser)

The following must be recorded with Chrome DevTools/Lighthouse before public
launch (task 22 manual matrix; a browser MCP is not configured in this
environment):

- [ ] LCP / INP / CLS for `/`, `/play`, `/play/trials`, `/play/online` at 360px, 768px, desktop.
- [ ] Trials 2x-scene frame rate (P2-19's named risk: SVG group rebuilds every frame — profile before optimizing).
- [ ] Long tasks during a 10-minute Trials run (memory/timer leak check).
- [ ] Console cleanliness per route/mode.

Until those runs are archived here, no performance claim beyond bundle sizes above is made.
