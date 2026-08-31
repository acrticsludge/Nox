# Set 2 release rehearsal evidence (tasks 15–22)

**Date:** 2026-08-31 · **Branch:** `feat/online-1v1`

## Automated gates at handoff

| Gate | Result |
|---|---|
| `npm.cmd run check` | **0 errors** |
| `npm.cmd test` (build + 28 frontend unit + 37 backend) | **65/65 pass** |
| `npm.cmd --prefix frontend audit --omit=dev --json` | **0 vulnerabilities** (sharp 0.35.4) |
| `npm.cmd --prefix backend audit --omit=dev --json` | **0 vulnerabilities** |

## Soak / concurrency evidence (P2-16) — backend/scripts/soak.mjs

Full-fidelity harness against the real protocol stack (net → rooms → match
with production `startMatch`/`onEnd` wiring; create cap relaxed for churn —
the production cap/window is unit-covered in `rooms.test.js`).

**Recorded 2-minute run (2026-08-31):**

```json
{
  "minutes": 2,
  "matchCycles": 149,
  "reconnectCycles": 149,
  "matchesEnded": 149,
  "successfulReconnects": 149,
  "errors": 0,
  "terminalOrderViolations": 0,
  "leftoverRooms": 0,
  "leftoverReservations": 0,
  "leftoverLimiterEntries": 0,
  "rssGrowthMB": 8.6,
  "peakRssMB": 66
}
```

- 149 concurrent two-room match cycles (duplicate `ready` included, forfeit
  → `matchEnd` → `roomClosed` for both seats) — zero errors, zero ordering
  violations, zero leftover rooms/reservations after one sweep interval.
- 149 reconnect cycles: credential minted → seat reclaimed with the SAME
  guestId + seat; deliberate `leave` frees the seat.
- RSS growth 8.6 MB over 149 full cycles (bounded); peak 66 MB.
- **Decision:** the 30-minute variant was started and cancelled by product
  decision (owner, 2026-08-31) — the harness accepts `--minutes 30` and the
  full run remains available pre-launch. The 2-minute × 149-cycle evidence
  covers the leak classes the audit named (rooms, reservations, limiter maps,
  terminal ordering, reconnect ownership).

## Manual browser matrix — PENDING (requires humans; no browser MCP configured)

From `docs/testing/mode-regression-matrix.md` §3 plus Set 2 additions:

- [ ] Online two-browser flow incl. new declarative HUD: cyan AND pink seats both show correct identity, self EXIT, connection chip (LIVE + RTT), controls strip label follows seat color.
- [ ] Trials game-over breakdown equals ledger rows (no-hit run, lava run, void death, bot kill) — displayed TOTAL equals sum under the documented rounding.
- [ ] Trials corrupt-save recovery: hand-write garbage/outdated `nv_trials_state`, reload → visible "could not be restored" message, RESUME button absent.
- [ ] Keyboard-only pass over How-to-play + pause dialogs (initial focus, trap, Escape policy, focus restore) and reduced-motion preference.
- [ ] 360px / 768px / desktop console-clean run per mode.
- [ ] Performance trace per `docs/testing/perf-baseline.md` pending list (LCP/INP/CLS, Trials 2× frame profile, 10-min long-run).

## Deployment wake/reconnect — PENDING (owner environment)

Render `WS_SECRET`/`WS_EXTRA_ORIGINS`, Vercel `PUBLIC_WS_URL`, cold-start
reconnect rehearsal per Set 1 runbook.

## Deferred P2/P3 (explicit, with risk)

| Item | Reason | Risk |
|---|---|---|
| P2-03 trusted-proxy IP policy | needs Render/production environment to decide forwarding trust | shared-IP guests may share rate buckets |
| P2-06 remaining dead modules (`trials-mode.js`, `core/*.ts`) | deletion needs explicit human approval per spec | none while unreferenced |
| P2-07 full cycle break (state module slice) | mechanical ~50-site edit; must be browser-verified separately, not mixed with feature work | current cycle is state-only and reviewed safe |
| P3-01 remaining overlay duplication | GameDialog primitive landed; migrating remaining overlays is cosmetic follow-up | low |
