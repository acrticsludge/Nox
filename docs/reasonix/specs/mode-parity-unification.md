# Spec: NOX Mode Parity and Session Unification

**Status:** Implemented (2026-08-31) — Set 1 + Set 2 tasks and the cross-mode visual parity work shipped on feat/online-1v1 / feat/visual-parity
**Audience:** GLM 5.3-Flash implementation agent  
**Source audit:** `docs/audits/2026-08-cross-mode-parity-audit.md`

## Objective

Make Same-PC 1v1, Void Trials, and Online 1v1 feel like one game with intentional mode differences. Same-PC 1v1 is the baseline for arena rules and presentation. Void Trials adds solo/bot/persistence rules. Online replaces local opponent input with a server-authoritative transport. No mode may silently start another mode’s loop, input handler, or overlay.

## Non-goals

- Do not redesign combat balance, map generation, Trials scoring, or bot difficulty in this initiative.
- Do not add accounts, ranked matchmaking, chat, spectators, or mobile multiplayer.
- Do not delete legacy game code until tests demonstrate it is no longer used.
- Do not change deployment providers or introduce dependencies without explicit approval.

## Commands

```powershell
npm.cmd test
npm.cmd run check
npm.cmd --prefix frontend run build
npm.cmd --prefix backend test
```

## Source ownership

| Area | Canonical owner after change |
|---|---|
| Shared arena rules | `frontend/src/game/sim/game-sim.js` |
| Server authority | `backend/match.js` |
| Mode lifecycle/input ownership | new small session/mode modules under `frontend/src/game/` |
| Shared stage and visual primitives | `frontend/src/components/game/` |
| Local 1v1 adapter | local mode module |
| Trials-only rules/persistence/bot adapter | trials mode module |
| Online transport/reconnect/presence | `net/net-bridge.js`, `pages/play/online.astro`, backend room/match modules |

## Required behavior

### Shared lifecycle

Every route must use the explicit lifecycle below. A transition must be idempotent, clean up its prior resources, and update the view from declared state rather than direct DOM mutation where React owns the element.

```text
MENU/LOBBY -> WAITING -> COUNTDOWN -> PLAYING -> ROUND_END -> MATCH_END -> MENU/LOBBY
                                      |              |
                                   PAUSED*        REMATCH_WAIT*
```

`PAUSED` is Trials-only. `REMATCH_WAIT` is online-only. Exiting from any state must clear local input and timers before changing screens.

### Input

- Only the active mode may install its input controller.
- Do not call `preventDefault()` while focus is in an input, textarea, select, or contenteditable element.
- Clear all active controls on blur, visibility hidden, pause, disconnect, forfeit, and session end.
- Local 1v1 retains WASD/Shift/Space for cyan and arrows/Slash-or-RightShift/Enter for pink.
- Trials retains the cyan mapping only.
- Online always uses one local mapping (WASD/Shift/Space), independent of assigned color; the HUD must make that clear.

### Online-specific requirements

- No import of `game-logic.js`, no animation loop, and no gameplay input handler while the online page is in lobby, queue, or private-room waiting state.
- The server issues a signed reconnect credential tied to room code, seat, guest id, and 20-second expiry. The client retains it only for the active room and sends it during reconnect.
- A reserved disconnected seat cannot be filled by a different guest during grace. Reconnect restores original seat/color and match state.
- `ready` is idempotent per seat/round. A full room produces exactly one 3-2-1-GO sequence.
- The match-end view exposes rematch and return-to-lobby. Two rematch confirmations retain the room, generate a new seed, and begin one fresh countdown. Room expiry/leave remains safe.
- The in-match HUD shows own name/color, opponent name/color, network state, ping, and a leave control attached to the local player—not a hard-coded cyan card.

### UI and accessibility

- Export one `GameMode = 'local-1v1' | 'trials' | 'online'` type (or a clearly equivalent canonical type) and remove incompatible duplicate unions.
- Every modal/lobby has an accessible name, initial focus, focus trap, Escape policy, and focus restoration to its trigger.
- Use `aria-live="polite"` for meaningful status transitions (paired, countdown, reconnecting, round result); do not announce every gameplay frame.
- Controls, status, and errors must use text/icon as well as color.
- Support `prefers-reduced-motion` for decorative animation.

## Interface contracts

### Client session adapter

```ts
type SessionState = 'menu' | 'waiting' | 'countdown' | 'playing' | 'paused' | 'roundEnd' | 'matchEnd' | 'reconnect';

interface GameSession {
  enter(): Promise<void> | void;
  start(): void;
  pause?(): void;
  resume?(): void;
  leave(): void;
  dispose(): void; // clears listeners, timers, animation work, input
}
```

### Reconnect protocol

```text
C -> S hello { guestId, nick, reconnect?: { roomCode, seat, token } }
S -> C session { token }
S -> C room { code, youSeat, seats, seed, reconnectToken? }
```

The server must reject a token that has expired, has an invalid signature, mismatches guest/room/seat, or attempts to occupy a non-reserved seat. Never put a long-lived token in a URL.

## Testing strategy

- Unit-test session state transitions and input reset conditions.
- Add backend tests for forged/mismatched reconnect credentials, reserved-seat denial, same-seat restoration, duplicate ready, and rematch lifecycle.
- Add frontend tests or narrowly scoped DOM tests for lobby/online HUD state. If a frontend test framework is not present, add no dependency until approved; document manual checks instead.
- Run the manual matrix in the plan on desktop plus 360px and 768px widths, keyboard-only, and two-browser online play.

## Boundaries

- **Always:** work in small commits, run the relevant tests plus `npm.cmd run check`, preserve local 1v1 behavior, and update docs when contracts change.
- **Ask first:** new dependencies, schema/storage migrations, protocol changes that break deployed clients, deleting legacy modules, deployment/configuration changes.
- **Never:** expose `WS_SECRET`, trust client-supplied game state, accept a reconnect based only on a room code, or use `innerHTML` for player-controlled text.

## Success criteria

- The P0 and P1 audit findings are resolved with automated coverage where feasible.
- Each mode passes its complete lifecycle without affecting another mode.
- `npm.cmd test` and `npm.cmd run check` are green.
- The UI presents the correct controls, ownership, status, and end-state actions for every mode.
