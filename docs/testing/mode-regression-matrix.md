# NOX Mode Regression Matrix

How to verify all three modes without reading source. Evidence (screenshots,
console output) goes in this directory as `YYYY-MM-DD-<area>.md`.

## Setup

```powershell
# terminal 1 — game server (WS + /health only)
cd backend; npm start          # ws://localhost:3000  (WS_SECRET optional in dev)

# terminal 2 — site
cd frontend; npm run dev       # http://localhost:4321  (/ws proxied to :3000)
```

Use a dedicated browser profile. Record console errors for every step.

## 1. Local same-PC 1v1 — /play/1v1

| Step | Expected |
|---|---|
| Load | Start overlay, no console errors, HUD shows PLAYER 1/2 |
| START DUEL | 3-2-1-GO, both ships spawn facing each other (cyan right-facing at left, pink left-facing at right) |
| P1 WASD+Shift+Space / P2 Arrows+/+Enter | Each ship moves, dashes, shoots independently |
| Every pickup (over/shield/blink/standard/needle/cannon/trick) | Effect applies, HUD reflects it, particles fire |
| Damage a ship to 0 | Round overlay, score updates, next round auto-starts |
| Reach 5 | Game over, rematch + menu buttons work, exit clean |
| ESC/P | No effect in local 1v1 (no pause in this mode) |

## 2. Trials — /play/trials

| Step | Expected |
|---|---|
| Load | Start overlay, high score shown, saved-run notice if present |
| ENTER THE TRIAL | 2x arena, bot spawns, timer 10:00 |
| P then Escape (and pause button) | Exactly one pause overlay; toggling twice returns to play; no resume-under-overlay |
| Refresh mid-run | Resume offer restores state; corrupt save is discarded with a message, never crashes |
| Hazards | Lava/slime/void penalties applied; bot behavior per documented void rule |
| Kill bot / survive 10:00 | Results screen, breakdown categories sum to total |

## 3. Online 1v1 — /play/online (two browser contexts)

| Step | Expected |
|---|---|
| Load | Lobby form only; NO 1v1 start overlay flash; no game rAF/input running |
| Backend stopped + join attempt | Visible connection error, lobby unlocked, retry possible |
| Quick match (both tabs) | Pairing: tab A "YOU ARE CYAN", tab B "YOU ARE PINK"; HUD hidden pre-match, appears at countdown |
| Create + share link + join | Same seat assignment rules; join with bad code → clear error |
| 3-2-1-GO | Exactly one countdown; duplicate `ready` cannot double-start |
| Play | Ammo counts real (not ∞ for limited ammo); muzzle/hit/death/pickup particles; cyan controls cyan ship |
| Mid-match tab close (rejoin < 20s) | Survivor sees "OPPONENT DISCONNECTED — REJOIN WITHIN 20s"; refresh + reopen reclaims seat via signed credential |
| Mid-match tab close (wait 20s) | "OPPONENT LEFT — YOU WIN" modal, full lobby reset both sides |
| EXIT during match | Forfeiter returns to lobby; opponent gets result modal; room destroyed |
| Match to 5 | Result modal with final score; both tabs return to clean lobby |
| Nickname typing | Self HUD card updates live; opponent card stays em-dash until paired |

## 4. Cross-mode

| Step | Expected |
|---|---|
| 360px / 768px / desktop | Layout intact, no overlap |
| Keyboard-only walkthrough | All dialogs operable; focus visible; no stuck keys after blur/hidden |
| Console | Zero errors in every mode |
| Reduced motion | Overlays readable, no essential info via animation only |

## Gates before handoff

```powershell
npm.cmd test          # backend + sim suite
npm.cmd run check     # astro typecheck — must be 0 errors
npm.cmd --prefix backend test
```
