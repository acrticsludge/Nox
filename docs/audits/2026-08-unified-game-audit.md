# NOX Unified Game Audit

**Audit date:** 2026-08-31  
**Scope:** All game modes, frontend, shared simulation, online service/protocol, accessibility, persistence, delivery, docs, tests, and dependency posture.  
**Method:** Static source review, reference search, `npm.cmd test`, `npm.cmd run check`, and native dependency audits. No real-browser MCP is configured, so layout/console/network behavior requiring a browser is explicitly marked **manual verification required**.

## Read this first

This is the current source-of-truth audit. Older audits remain useful historical evidence but should not override a finding here if the code differs. A finding is marked **Confirmed** only when source or command output proves it. Items marked **Risk** need the named runtime test before declaring them fixed or false.

## Verification snapshot

| Check | Result | What it proves / does not prove |
|---|---|---|
| `npm.cmd test` | **Pass** — production Astro build plus 27 Node tests | Backend/simulation paths covered by the suite; does not test React UI, input, Trials, or browser lifecycle. |
| `npm.cmd run check` | **Fail** — 9 TypeScript errors, 31 hints | Online component contract is currently invalid; production build does not typecheck it. |
| `npm.cmd --prefix frontend audit --omit=dev --json` | **1 high** — direct `sharp@0.34.x`, libvips CVEs; patched `0.35.4` is a semver-major update | Build-time image pipeline has a known vulnerable native dependency. |
| `npm.cmd --prefix backend audit --omit=dev --json` | **Pass** | Backend package graph has no reported production advisories. |

## Severity model

- **P0:** integrity/security failure or a core flow that can silently break.
- **P1:** major user-visible defect, data correctness problem, or high regression risk.
- **P2:** important quality, resilience, accessibility, delivery, or maintainability debt.
- **P3:** cleanup, copy, or observability improvement.

## P0 — Fix before public online rollout

| ID | Confirmed issue | Evidence | Required correction |
|---|---|---|---|
| P0-01 | Online lobby eagerly starts the local 1v1 engine. | `GameShell.tsx` imports `game-logic.js` for every mode; module initialization starts rAF/input. `online.astro` claims the opposite. | Make engine/session initialization mode- and state-owned. Online must import/start only after pairing/countdown. |
| P0-02 | Online reconnect is unauthenticated and a disconnected seat is claimable by another guest. | `net-bridge.js` ignores the issued token; `net.js` issues a fresh token; `rooms.js` assigns the first null seat to any joiner. | Reserve seat and require a signed, short-lived `{guestId, roomCode, seat, expiry}` reconnect credential. |
| P0-03 | Server can use the public literal `nox-dev-secret` in production if `WS_SECRET` is missed. | `backend/net.js`. | Fail startup outside explicit development when secret is missing; add deployment preflight. |
| P0-04 | A client can invoke `rematchReq` while a match is live, resetting `fullNotified` and starting a second match loop for the same room. | `rooms.js` has no match-end state guard; `onRoomFull` starts a match. | Allow rematch only from server-owned post-match state; stop/replace no live match implicitly. |
| P0-05 | Trials keyboard pause can immediately resume the game while its pause overlay remains visible. | `GameShell.tsx` handles P/Escape then dispatches `nox:pause`; `game-logic.js` also toggles P/Escape and sees the newly paused state. | One owner for pause keyboard handling; state transition must be idempotent and testable. |
| P0-06 | Coarse-pointer/mobile controls do not control the active player. | Buttons write ArrowLeft/ArrowRight (P2 mapping) while Trials uses WASD; Shoot calls nonexistent `NOX_GAME.mobileShoot`; only horizontal buttons exist. | Build a real per-mode touch input adapter or explicitly remove unsupported controls. Test full movement/dash/shoot. |

## P1 — Major functional and data-quality defects

| ID | Confirmed issue | Evidence | Required correction |
|---|---|---|---|
| P1-01 | Online `connect()` can hang after a pre-session socket close. | `net-bridge.js` clears the timeout in `close` but neither resolves nor rejects its promise. The lobby remains locked. | Reject pending connection exactly once on pre-auth close/error; expose retry state. |
| P1-02 | Client ping is nonfunctional. | Client sends JSON `ping` and waits for JSON `pong`; backend only handles WebSocket control-frame pong, does not reply to app ping, and never sets `_noxPing`. | Define one ping protocol, calculate/surface it, and test it. |
| P1-03 | Duplicate `ready` messages schedule duplicate 3-2-1 countdown timers. | Every full-room broadcast causes each client to send `ready`; `match.js` schedules countdown per ready with no ready set/state. | Per-seat ready set and one-shot `waiting -> countdown` transition. |
| P1-04 | Browser online rematch is not implementable even though lower-level tests pass. | UI dispatches `nox:onlineRematch` with no listener; `server.js` deletes room at `matchEnd`. Existing rematch tests bypass the production end cleanup. | Preserve room for mutual post-match rematch or replace with an explicit fresh-room design; test through `createServer`. |
| P1-05 | Online seat identity/exit ownership is wrong for pink seat. | `PlayerHUD` hard-codes online EXIT to P1/cyan; `online.astro` imperatively rewrites cards. | Declarative online HUD with a self-owned exit affordance, remote status, nickname, color, and ping. |
| P1-06 | Score breakdown is not an accounting ledger. | Trials tracks pickup count (+1) and hit count (+1), but displays them as points; lava/void/survival are not tracked; UI derives values using `points/15` and `points/25`. | Record signed point events/amounts at every award/penalty and render their exact sum. |
| P1-07 | Trials bot predictive velocity is mostly zero. | `lastVx/lastVy` are calculated after movement as `nx - p.x` / `ny - p.y`. | Capture previous position before movement, or use actual applied delta, then add bot aiming tests. |
| P1-08 | Product rules contradict implementation: player copy says bot has “no void sense,” while `bot-ai.js` scores and executes `avoidVoid`. | Start/help copy vs `scoreAvoidVoid` / `executeAvoidVoid`. | Decide intended design; update code or all player-facing copy and tests. |
| P1-09 | Online inputs and legacy inputs leak across mode/UI state. | Window-level handlers capture keys in lobby; legacy handler prevents arrows/space/enter; no blur/visibility reset. | One active input controller; do not capture editing targets; reset on blur, hidden, disconnect, end, and dispose. |
| P1-10 | Invalid TypeScript contracts are already blocking the quality gate. | `astro check` errors: online absent from GameStage/CenterHUD/HowToPlayModal mode types, obsolete GameOverOverlay props, and landing badge types. | Establish one GameMode type; resolve all 9 errors before further feature work. |

## P2 — Reliability, security hardening, accessibility, and delivery

| ID | Confirmed issue / risk | Evidence | Required correction |
|---|---|---|---|
| P2-01 | Open one-player rooms have no expiry; per-IP create limiter maps have no expiry. | `rooms.js` keeps rooms and `createsByIp` indefinitely. | TTL cleanup, bounded maps, metrics, and tests for expiration. |
| P2-02 | Origin policy accepts any `localhost` origin in all environments. | `net.js:isAllowedOrigin`. | Restrict localhost allowance to development; production allowlist only. |
| P2-03 | IP limits may be inaccurate behind Render/proxies. | Uses `req.socket.remoteAddress`; Render deploy uses a proxy. **Risk:** shared proxy IP could rate-limit many users. | Decide trusted-proxy policy, parse forwarded address only behind known proxy, and load-test. |
| P2-04 | Match end cleanup can emit confusing peer-left state after match end. | `onEnd` calls `roomsApi.leave` for both sockets; leave notifies peer. | Add terminal room state / silent cleanup and integration assertions for ordered terminal messages. |
| P2-05 | Trials saved state is unversioned and structurally unvalidated. | Raw JSON is `Object.assign`ed into entities; corrupted/outdated state can create malformed runtime state. | Versioned schema, range/type validation, migration or discard-with-message; never treat local score as trusted leaderboard data. |
| P2-06 | There are two game-rule implementations plus dead/broken-looking modules. | `game-logic.js` redeclares rules; `core/*` and `trials-mode.js` are not imported by live code. `trials-mode.js` imports non-exported/mutable bindings and would not be a safe drop-in. | Inventory imports, designate canonical simulation/Trials rules, then remove only proven unused modules after tests. |
| P2-07 | Shared `game-view.js` and `game-logic.js` form a circular dependency and both mutate DOM/global state. | Direct imports and `window.NOX_GAME` bridge. | Introduce one-way state-to-view adapter and explicit lifecycle cleanup before any major rewrite. |
| P2-08 | Screen-reader behavior is actively noisy and incomplete. | `CyberTimer` has `aria-live=polite` and updates every frame; score announcer exists but is not populated; injected lobby has no dialog lifecycle. | Announce milestone events only; manage focus, modal semantics, focus restore, status/error associations. |
| P2-09 | Touch/SVG behavior conflicts with accessibility/copy. | SVG is `role=application`; Trial `aria-label` says mouse aim/click shoot though controls are keyboard; touch has only tap-to-shoot. | Provide correct concise instructions, keyboard focus model, and either complete touch support or disclose desktop-only mode. |
| P2-10 | No automated frontend/UI/Trials/bot tests. | Root test executes backend tests; no component test setup; sim tests cover only 1v1 core. | Add targeted tests without adding a framework until approved, then browser E2E for the critical matrix. |
| P2-11 | Existing automated rematch/grace coverage is weaker than its names imply. | Tests use direct room/match setup and stop a match before rematch; production `server.js:onEnd` deletes room. | Test via real `createServer`, including terminal cleanup, reconnect ownership, duplicate ready, forged resume, and live rematch request rejection. |
| P2-12 | Known high vulnerability in build dependency `sharp`. | Native audit output; current use is local OG generation, so exposure is build-time not player upload. | Review Sharp 0.35 migration/changelog, update in isolated change, rerun build/audit; do not use `audit fix --force`. |
| P2-13 | Local developer/deployment documentation is stale. | README says backend serves frontend and online deployment is deferred; backend is WS + health only. `backend/package.json` repeats obsolete description. | Update README, package description, architecture docs, and launch runbook. |
| P2-14 | Route inventory/site metadata omits current modes. | `SITE_LINKS` lacks Trials and Online. | Decide public-indexing policy and add all intended public routes/navigation metadata. |
| P2-15 | There is no CI/lint/performance/a11y gate. | Package scripts have build/check/test only; no workflow found. | Add CI after typecheck is green; baseline Lighthouse/axe/console/asset budget. |
| P2-16 | Room/timer cleanup needs runtime stress proof. | Intervals/timers exist for matches, bridge pings, countdowns, rAF, and injected observers. **Risk:** no soak test proves no retained listeners/timers. | Add room/session lifecycle counters and 30-minute soak/reconnect test. |
| P2-17 | WebSocket upgrade accepts every request path and has no handshake/hello rate limit. | `net.js` upgrades without validating `req.url`; documented token-issue cap is absent. | Require `/ws` explicitly and add a bounded per-IP handshake/hello limit. |
| P2-18 | Trials persistence can silently stop working as state grows. | Every two seconds it serializes walls, entities, bullets, pickups, and unbounded particle history to localStorage; quota errors are swallowed and UI does not report failure. | Persist a small validated gameplay snapshot only; omit reconstructable cosmetics; surface save failure. |
| P2-19 | SVG rendering recreates all scene groups through `innerHTML` every frame. | `game-view.js` clears/rebuilds walls, hazards, players, bullets, pickups, and particles. **Risk:** no device profile proves the 2x Trials scene meets frame budget. | Profile first; retain/update stable nodes or cap cosmetic work only if measurement identifies it as the bottleneck. |

## P3 — Consistency and maintenance improvements

| ID | Issue | Required correction |
|---|---|---|
| P3-01 | `HowToPlayModal`, `PauseOverlay`, and game-over overlays duplicate state/presentation patterns. | Create modal primitive after lifecycle ownership is fixed. |
| P3-02 | Accessibility focus styles and color contrast have not been browser-verified. | Run axe/Lighthouse plus keyboard/screen-reader manual matrix at 360px, 768px, desktop. |
| P3-03 | Current FPS label says 60FPS although online snapshot transport is 30Hz and no measured performance budget exists. | Use an accurate diagnostic label and record measured browser targets. |
| P3-04 | Website/docs copy calls 1v1 `CoOp` in structured data. | Use an appropriate competitive/multiplayer classification or omit misleading property. |

## Cross-mode parity contract

| Capability | Same-PC 1v1 | Trials | Online 1v1 | Non-negotiable invariant |
|---|---|---|---|---|
| Authority | local canonical sim | local Trials adapter | server canonical sim | Rules have one owner per mode. |
| Input | two local maps | one local map | one local map -> validated mask | Exactly one controller active; no stuck keys. |
| Lifecycle | menu/countdown/play/round/end | menu/resume/countdown/play/pause/end | lobby/queue/countdown/play/reconnect/end/rematch | Explicit, idempotent state transition and cleanup. |
| UI | 2-player HUD | player + bot + score | self + opponent + connection | UI never needs imperative mutation of React-owned content. |
| Persistence | none | local resumable run | short server room/session only | Validate and version stored state. |

## Manual verification matrix still required

Use a dedicated isolated browser profile and record screenshots/console output for:

1. Local 1v1: both key maps, dash, every pickup, round tie/elimination, exit, rematch.
2. Trials: start, P/Escape pause, mouse/keyboard/touch policy, save/resume after refresh, every penalty/category, bot void rule.
3. Online: connection refused, create/join/quick, cyan and pink seat, duplicate ready, tab hidden/blur, network drop/reconnect, grace expiry, forfeit, real rematch, two concurrent rooms.
4. Each mode: keyboard-only overlays, focus order, reduced motion, 360px/768px/desktop, no console errors.

## Recommended execution order

1. Make TypeScript green and stop session/input interference.
2. Fix online integrity: secret, reconnect, ready, live-rematch guard, terminal ordering.
3. Fix Trials pause, touch controls, score ledger, and bot contract.
4. Add test layers and persistence validation.
5. Complete a11y/performance/CI/docs/dependency hygiene.

The companion spec and plan convert every P0-P3 item into verifiable implementation work:

- `docs/reasonix/specs/unified-game-reliability.md`
- `docs/reasonix/plans/unified-game-reliability-plan.md`
