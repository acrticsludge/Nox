# Game module inventory — live vs dead code (audit P2-06 / P2-07)

**Date:** 2026-08-31 · **Branch:** `feat/online-1v1` · **Method:** import-graph scan of
`frontend/src/**/*.{js,ts,tsx,astro}` plus manual verification of every importer.

## Live modules (imported by runtime code)

| Module | Imported by | Role |
|---|---|---|
| `game/game-logic.js` | `GameShell.tsx`, `play/online.astro`, `game-view.js` | Legacy monolith: 1v1 + Trials rules, input, scoring, HUD mutation. Boots only via `bootEngine()` (T4). |
| `game/game-view.js` | `game-logic.js` | SVG/DOM rendering. Reads live state bindings from game-logic (state→view edge). |
| `game/bot-ai.js` | `game-logic.js` | Trials bot AI (pure, DOM-free, unit-tested). |
| `game/sim/game-sim.js` | `game-logic.js` | Canonical 1v1 simulation used for online snapshots; deterministic, unit-tested. |
| `game/core/constants.js` | `game-logic.js`, `game-view.js` | **Canonical gameplay constants** (migration slice 1, this task). |
| `game/trials-ledger.js` | `game-logic.js` | Canonical Trials score ledger (P1-06). |
| `game/trials-save.js` | `game-logic.js`, `StartOverlay.tsx` | Canonical Trials save schema/validation (P2-05/P2-18). |
| `game/net/net-bridge.js` | `play/online.astro` | Online transport bridge. |

## Dead modules (zero importers outside themselves)

| Module | Status | Replacement coverage | Disposition |
|---|---|---|---|
| `game/trials-mode.js` | Dead | **None** — imports non-exported/mutable bindings from game-logic and would break as a drop-in | Do not delete yet; do not wire in. Candidate for deletion once Trials rules are fully covered by `trials-ledger.js` + `trials-save.js` tests and a human approves deletion. |
| `game/core/bullets.ts`, `hazards.ts`, `index.ts`, `particles.ts`, `physics.ts`, `void.ts`, `walls.ts` | Dead | **None** — live code does not import them | Same policy. `core/constants.ts` mirrors `core/constants.js` (see below). |
| `game/core/constants.ts` | Dead | `core/constants.js` is the live canonical; `.ts` mirror has typing value but is unused | Keep as the type-reference source; if a future migration adopts TS, consolidate into the `.ts` file. **Drift risk noted** — parity is asserted by test (see below). |

## Circular dependency status (P2-07)

`game-logic.js ↔ game-view.js` existed in both directions. Migration slice 1
moved the **constants subsystem** to `core/constants.js`:

- `game-logic.js` imports + re-exports constants (public surface unchanged).
- `game-view.js` imports constants **directly from the canonical module**.
- The remaining cycle is state-only: view reads live state bindings from
  game-logic, and game-logic calls view render functions.

**Next slice (planned, not started):** extract mutable state
(`players, bot, bullets, pickups, particles, hazards, wallData, scores, round,
timeLeft, safeRadius, gameState, gameMode, prevHp, trialPoints`) into a
`game-state.js` owned module with exported setters. Every `gameState = x`
assignment in game-logic (~50 sites) becomes `setGameState(x)`. This is a
mechanical but wide edit — it requires its own browser-verified session and
must not be mixed with feature work.

## Migration rules (from spec)

- One subsystem per commit, with parity tests before/after.
- No deletion of dead modules without: proven-zero imports, replacement
  coverage, and explicit human approval.
- `window.NOX_GAME` exposure and `export {}` lines are the compatibility
  contract — re-export from the new owner rather than changing importers.
