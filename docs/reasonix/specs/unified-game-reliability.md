# Spec: NOX Unified Reliability and Mode Contract

**Status:** Proposed implementation contract  
**Audience:** GLM 5.3-Flash  
**Audit:** `docs/audits/2026-08-unified-game-audit.md`

## Objective

Turn NOX’s three modes into deliberate adapters around explicit lifecycle, input, presentation, authority, persistence, and transport contracts. Fix every confirmed P0/P1 finding and all P2 findings needed for a safe public launch. Do not change combat balance except when correcting a proven implementation/copy contradiction.

## Commands and gates

```powershell
npm.cmd test
npm.cmd run check
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend audit --omit=dev --json
npm.cmd --prefix backend audit --omit=dev --json
```

All implementation tasks must leave `npm.cmd test` and `npm.cmd run check` green. A browser validation task additionally requires clean console output, keyboard-only walkthrough, and recorded screenshots at 360px, 768px, and desktop.

## Canonical contracts

### Mode and lifecycle

```ts
type GameMode = 'local-1v1' | 'trials' | 'online';
type SessionState =
  | 'menu' | 'lobby' | 'queue' | 'waiting' | 'countdown'
  | 'playing' | 'paused' | 'reconnecting' | 'roundEnd'
  | 'matchEnd' | 'rematchWait' | 'disposed';

interface Session {
  readonly mode: GameMode;
  readonly state: SessionState;
  enter(): Promise<void> | void;
  dispatch(event: SessionEvent): void;
  dispose(): void; // idempotent: clears timers, rAF, sockets, inputs, subscriptions
}
```

- A route owns at most one session.
- A session owns all timers/listeners it creates.
- `dispose` may run repeatedly and must never start game work.
- Online does not load the legacy game engine or install game input until its matched countdown path requires it.

### Input

- Attach input only in `countdown` or `playing` as needed; input packets only in `playing`.
- Do not prevent browser defaults from text inputs, textareas, selects, or contenteditable elements.
- Reset every control on blur, page hidden, pause, leave, disconnect, round end, match end, and dispose.
- Touch support is complete (move in both axes, dash, shoot) for each supported mode, or it is removed/clearly unsupported. Never ship visually enabled controls that have no active API.

### Online trust and room state

```text
waiting -> countdown -> playing -> roundEnd -> playing | matchEnd -> rematchWait -> countdown | closed
```

- Server owns all state transitions and rejects events illegal for the current room state.
- `ready` is a set keyed by seat and round; repeated messages do nothing.
- `rematchReq` is accepted only in `rematchWait`; it cannot create a second active simulation.
- Match cleanup has a terminal state and sends one coherent terminal result, not a later peer-left overwrite.
- Open rooms, reservations, limiter entries, and rematch windows have bounded TTLs.

### Reconnect credential

```text
S -> C room { code, youSeat, reconnect: { token, expiresAt } }
C -> S hello { guestId, nick, reconnect?: { roomCode, seat, token } }
```

- Sign token payload containing guest ID, room, seat, and expiry.
- Reserve a closed seat for 20 seconds. Only a valid matching credential may reclaim it.
- Invalid/expired/mismatched tokens cannot alter a room.
- Store credential only as active-room ephemeral browser state; never in URL or logs.
- Missing `WS_SECRET` is fatal outside declared development mode.

### Presentation and accessibility

- React owns React-rendered UI. Network/game state reaches it through declared state/props, not `querySelector(...).textContent` for owned elements.
- Online HUD has explicit `self`, `opponent`, `seat`, `pingMs`, `connectionState`, and `onLeave` properties.
- Dialog/lobby behavior: role/name, initial focus, focus trap, deliberate Escape policy, and return focus.
- Announce only significant events (paired, countdown start, reconnect, result); never 60 times per second.
- All state conveyed by color also has text/icon/pattern.
- Player instructions must match actual controls and bot rules.

### Trials correctness

- Maintain a score ledger with signed numeric amounts, e.g. `survival`, `hitBonus`, `pickupBonus`, `lavaPenalty`, `slimePenalty`, `voidPenalty`, `botKill`.
- The displayed total equals the sum of the ledger entries (allowing only documented rounding). Never infer values from total points.
- Preserve applied player movement delta before assigning position; bot prediction consumes that delta.
- Decide either **bot avoids void** or **bot has no void awareness**, document it once, then test the intended behavior.
- Saved run state has `version`, schema/range validation, and a safe discard/recovery message. It must not crash on corrupt JSON or unsupported versions.

## Test requirements

### Automated

- Server: secret startup policy, origin policy, room TTL, reconnect ownership and token mismatch, duplicate ready, illegal live rematch, terminal event order, real `createServer` rematch path.
- Simulation: local determinism plus wall gaps, spawn safety, pickup/hazard invariants, timer tie behavior, and every special bullet.
- Trials: pause state transition, ledger sum, penalties, save schema rejection/recovery, bot velocity, selected void policy.
- Client/session: rejected connection, input reset, no gameplay import in lobby, online state transitions.

### Manual browser

- Two independent browser contexts for online; record console/network evidence.
- Same-PC local 1v1 and Trials lifecycle matrix.
- Keyboard-only dialogs; 360px/768px/desktop; touch only if supported.
- Baseline performance trace and a 30-minute room/session soak before launch.

## Boundaries

- **Always:** preserve a green local 1v1 path; use small commits; update audit/spec/plan when a contract changes; include tests with each behavioral fix.
- **Ask first:** dependencies, deleted modules, external service/deploy settings, persisted storage migration, breaking protocol version.
- **Never:** default production secret, trust client game state, accept reconnect by room code alone, display player-controlled data with `innerHTML`, suppress failing tests/typechecks, or ship enabled nonfunctional controls.

## Done definition

- Every P0 and P1 is closed with evidence.
- P2 is either closed or explicitly deferred by a human with risk/owner/date.
- Tests, typecheck, dependency audits, manual matrix, browser quality checks, and delivery docs satisfy the gates above.
