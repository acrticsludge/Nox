# NOX Cross-Mode Parity Audit

**Date:** 2026-08-31  
**Scope:** Same-PC 1v1 (`/play/1v1`), Void Trials (`/play/trials`), Online 1v1 (`/play/online`)  
**Baseline:** The currently shipped same-PC 1v1 rules and presentation are the gameplay baseline. Online is authoritative only for multiplayer state; it must not own a divergent ruleset or UI system.

## Executive verdict

The three modes share a visual shell but not a clean mode contract. Trials is feature-rich but remains coupled to the legacy monolith. Online has the most serious parity failures: it eagerly starts the offline engine in the lobby, cannot securely reclaim a disconnected seat, and advertises rematch without a functional end-to-end rematch path.

Do not polish individual screens first. Establish one mode lifecycle, one game-session boundary, and explicit mode-specific adapters. That fixes the online mess while preventing the next enhancement from drifting across all three modes.

## Evidence and verification

| Check | Result |
|---|---|
| `npm.cmd test` | Passed: Astro production build + 27 Node/backend/simulation tests |
| `npm.cmd run check` | Failed: 9 TypeScript errors, including online mode excluded from `CenterHUD`, `GameStage`, and `HowToPlayModal` prop types; 31 non-blocking hints |
| Browser visual run | Not performed: Chrome DevTools MCP is not configured in this workspace. Treat the visual observations below as static-code findings until the manual matrix in the plan is run. |

The existing tests cover backend protocol behavior, including a *server-side* grace/rejoin case. They do not prove the browser client presents the correct UI, sends an authenticated reconnect credential, or completes a rematch.

## Findings

### P0 — Online lobby boots the local game engine

**Evidence:** `frontend/src/components/GameShell.tsx` imports `../game/game-logic.js` unconditionally in its mount effect. `frontend/src/pages/play/online.astro` separately claims to lazy-load the engine only when a room starts. Importing `game-logic.js` calls `init()`, starts an animation loop, installs global 1v1 input listeners, and initializes `gameMode` as `1v1`.

**Impact:** The online lobby can receive local-game keyboard behavior, prevent arrow-key scrolling/navigation, mutate shared SVG/HUD DOM before a match, and undermine the intended lobby/match separation.

**Required outcome:** No simulation loop, gameplay key listener, HUD mutation, or local mode initialization before the server has paired the player and the countdown begins.

### P0 — Reconnect is neither authenticated nor seat-safe

**Evidence:** `frontend/src/game/net/net-bridge.js` receives a session token but does not store or transmit it. `backend/net.js` accepts a fresh `hello` and issues a new token; `backend/rooms.js` fills the first empty room seat on `join` without proving that the joining guest owns it.

**Impact:** The promised 20-second reconnect can be taken by another guest, and a returning player is not guaranteed their original seat/color. This is a gameplay integrity failure, not just a UX gap.

**Required outcome:** Server-issued reconnect credential bound to `{roomCode, seat, guestId, expiry}`; only that credential may reclaim a disconnected seat. A new guest must receive `room full` while the seat is reserved.

### P0 — Type checking exposes incomplete online component support

**Evidence:** `npm.cmd run check` reports online-mode prop errors in `GameShell.tsx` because `GameStage`, `CenterHUD`, and `HowToPlayModal` only accept `'1v1' | 'trials'`. It also reports obsolete props passed to `GameOverOverlay`.

**Impact:** Production builds happen to succeed, but the typed component contract says online is unsupported. This makes UI regressions easy to introduce and masks real workarounds.

**Required outcome:** A single shared `GameMode` type, with each component explicitly supporting a mode or receiving a narrower caller type. `astro check` must become green before shipping further mode UI work.

### P1 — Online rematch is documented but not playable

**Evidence:** `GameShell` dispatches `nox:onlineRematch`, but `online.astro` has no listener. The server calls `onEnd`, removes both seats, and deletes the room after `matchEnd`; `rematchReq` therefore cannot be reached from the real browser flow.

**Impact:** The game offers different post-match expectations between modes and violates the online feature spec.

**Required outcome:** Preserve the completed room through a two-party rematch decision, show a post-match dialog, then create a fresh seed/countdown. Expire the room only after both leave or a short post-match timeout.

### P1 — Duplicate readiness can schedule duplicate online countdowns

**Evidence:** Each client receives the full-room `room` broadcast and sends `ready`. `backend/match.js` starts a new 3-2-1 schedule for every `ready` message; no ready-set or countdown state prevents duplication.

**Impact:** Duplicate countdown events race in the browser and can cause flickering/inconsistent match-start feedback.

**Required outcome:** Maintain a ready set and transition `waiting -> countdown` exactly once. Ignore repeated ready messages for the current round.

### P1 — Online HUD does not fulfil its own contract

**Evidence:** The shared `PlayerHUD` still names seats `PLAYER 1/2`; online code mutates names directly in `online.astro`. The EXIT button is always attached to the cyan card, so a player assigned pink sees their own exit control on the opponent’s card. Server `ping` exists in room data but no in-match ping/status is rendered.

**Impact:** Seat/color identity is ambiguous, especially for the pink seat, and connection health disappears during the moment it matters.

**Required outcome:** Build a declarative `OnlineMatchHUD` with `self`, `opponent`, seat color, connection state, ping, and a single self-owned leave control. Do not imperatively rewrite React-owned card text.

### P1 — Global input handling leaks across state and mode

**Evidence:** `game-logic.js` and `online.astro` attach window-level key listeners. The legacy listener calls `preventDefault()` for arrows/space/enter regardless of focus or session state. Online input state has no `blur`/`visibilitychange` reset.

**Impact:** Lobby text controls and browser navigation may feel broken; held movement/shoot input can remain stuck after tab switching; the two input systems may observe the same keys.

**Required outcome:** Attach one mode-specific input controller only while a session is active; do not capture typing targets; clear input on blur, visibility hidden, pause, disconnect, and match end.

### P1 — Mode lifecycle and overlays are inconsistent

| Concern | Same-PC 1v1 | Trials | Online | Required parity |
|---|---|---|---|---|
| Pre-game | Start overlay | Start/resume overlay | Injected lobby | Explicit `menu/lobby` state with a focus target |
| Start | Local countdown | Local countdown | Server countdown + custom overlay | One canonical countdown presentation |
| Pause | None | Pause/resume + persistence | None / no disconnect state | Deliberate per-mode policy, communicated in UI |
| Exit | Per-seat immediate forfeit | Confirmed exit | Single event, immediate lobby reset | Confirm before destructive local exit; online show pending result/disconnect state |
| End | Game-over dialog + rematch | Results + run again | transient message, return lobby | Mode-aware post-game dialog with consistent navigation |
| Help | Modal | Modal | No reachable online help | Mode-specific help entry and copy |

### P2 — Trials remains a parallel implementation, not an adapter

**Evidence:** `game-logic.js` contains legacy 1v1, trials, online mirror behavior, rendering, persistence, input, and UI DOM mutation. `trials-mode.js` duplicates trials functions but is not the canonical execution path. `core/*.ts` coexists with a separate JS implementation.

**Impact:** Fixes to collision, controls, scoring, or overlays can silently land in one mode only. Dead/duplicate code makes it unclear which implementation an AI should edit.

**Required outcome:** Preserve the proven 1v1 simulation as the canonical rule core and replace the three bespoke loops with mode adapters. Delete nothing until it is proven unused and a parity test exists.

### P2 — Accessibility and responsive behavior are not a shared quality bar

**Evidence:** Modal focus is not trapped or restored; injected online lobby has no dialog semantics/focus management; live game state is mostly not announced; mobile controls only map a partial control set and do not target online input.

**Required outcome:** Define WCAG 2.2 AA baseline for menus/overlays, preserve keyboard-only play, add reduced-motion support, and test desktop plus 360px/768px layouts for every mode.

## Recommended architecture

```text
GameMode registry
  ├─ Shared presentation: stage, HUD primitives, overlays, a11y/live region
  ├─ Shared game session: lifecycle + input ownership + cleanup
  ├─ Local 1v1 adapter: two local inputs -> canonical sim
  ├─ Trials adapter: one local input + bot/ruleset -> canonical sim extensions
  └─ Online adapter: one local input -> transport -> server snapshots
                                     server authoritative canonical sim
```

The migration is additive: keep current routes working, route one mode at a time through the session boundary, and remove legacy paths only after the parity tests prove replacement behavior.

## Acceptance gate

Do not call the parity initiative complete until all of these are true:

- `npm.cmd test` and `npm.cmd run check` both pass.
- All three modes pass the shared manual lifecycle matrix in the implementation plan.
- Online reconnect preserves the same authenticated seat; an unrelated guest cannot claim it.
- Online has no engine import or gameplay key capture in the lobby.
- Online rematch works end-to-end with one new seed and one countdown.
- The mode matrix has one documented owner for rules, input, UI, persistence, and network authority.
