# Online 1v1 UX & Architecture Audit — 2026-08

Status: In Progress · Scope: online play state presentation, backend responsibility boundary, dev workflow.

## 1. Online game UX state matrix (industry-standard reference)

An online match client has exactly five presentation states. Each state must
show a distinct subset of chrome, and only that subset:

| State | Shown | Hidden |
| --- | --- | --- |
| LOBBY | nickname identity, Quick Match / Create / Join, connection status/errors | arena, both HUDs, controls strip, round timer |
| QUEUEING | queue position, cancel | arena, both HUDs, controls strip |
| ROOM-WAIT | room code (copyable), share link, opponent slot (empty → "waiting"), leave | arena, keybind strip (opponent is not on this keyboard), local EXIT for P2 |
| IN-MATCH | own HUD (name/HP/ammo/dash), opponent HUD (name/HP/ammo — no local keybinds), round timer, score, forfeit | second EXIT (only one "leave match" affordance), P2 keybinds, global-speed slider (server-authoritative) |
| POST-MATCH | result, score, rematch (handshake state: "waiting for opponent"), leave-to-lobby | arena input |

Rules derived:
- R1: Exactly one identity card for the local player; opponent card shows remote nick/status, never local keybinds.
- R2: No arena interaction exists before `countdown(0)`. The game engine must not even be loaded during LOBBY/QUEUE/ROOM-WAIT.
- R3: Refresh at any state lands in a defined state (lobby, or auto-rejoin via room code), never a flash of the local 1v1 menu.
- R4: One forfeit/leave affordance per screen; it maps to one server action.

## 2. Findings in current implementation

| # | Severity | Finding | Root cause |
| --- | --- | --- | --- |
| F1 | Critical | Hydration failure; 1v1 flash on refresh; lobby disappears | `online.astro` imports `game-logic.js` eagerly at parse time; its rAF mutates HUD DOM before React hydrates; React regenerates island |
| F2 | Critical | Full arena interaction available while queueing | Same eager import: the local game engine boots in the lobby |
| F3 | Major | P2 HUD, P2 keybinds, dual EXIT shown online | GameShell `mode="online"` reuses 1v1 layout verbatim; no online HUD variant |
| F4 | Major | WS unreachable on Astro dev port 4321 | No dev proxy for `/ws`; backend listens on 3000 only |
| F5 | Major | Backend serves the static website (UI logic in backend) | `backend/server.js` retained legacy static-file serving; online phase made this the de-facto dev host |
| F6 | Minor | Global-speed slider irrelevant online | Server owns pacing; slider is a local-sim affordance |
| F7 | Minor | Rematch keeps seats (spec FR-9 wanted swap) | Documented in security audit; follow-up |

## 3. Backend responsibility audit

Current `backend/server.js`: static site serving (legacy) + `/health` + WS protocol
(net/rooms/match). Per the product architecture (website = Astro on Vercel;
backend = authoritative game server on Render), the backend must expose ONLY:

- `GET /health` (Render health check)
- `WS /ws` — the game protocol (origin-checked)
- nothing else

Static serving is a dev convenience that masks misconfiguration (F4) and blurs
the deployment boundary. Removal is a planned task (O6), gated on the Astro dev
proxy (O2) so local development stays one-command.

## 4. Verification gap

The two-tab playtest and hydration regression check require a browser session;
deferred until O1–O3 land (they change the boot path entirely).
