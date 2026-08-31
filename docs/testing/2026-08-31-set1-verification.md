# Set 1 (Reliability Tasks 1–14) — Verification Evidence

**Date:** 2026-08-31 · **Branch:** `feat/online-1v1`

## Automated gates (run at handoff)

| Gate | Result |
|---|---|
| `npm.cmd run check` (astro check) | **0 errors**, 0 warnings, 31 hints |
| `npm.cmd test` (frontend build + backend suite) | **37/37 pass** |
| `npm.cmd --prefix backend test` | **37/37 pass** |
| `frontend` production build | 7 pages, Complete, no errors |

### Test inventory (protocol/lifecycle coverage added this set)

| File | Proves |
|---|---|
| `policy.test.js` | production `WS_SECRET` fail-fast; dev-only localhost origin; `/ws`-only upgrades (404 otherwise) |
| `reconnect.test.js` | signed credential minted on seat; disconnect reserves seat; stranger denied ('room full'); owner reclaims SAME seat; forged token rejected; wrong-seat claim rejected |
| `match.test.js` (+ flood test) | duplicate `ready` packets arm exactly ONE 3-2-1-GO; per-seat idempotence |
| `rematch.test.js` | live `rematchReq` rejected ('match in progress'); natural end → `rematchWait` broadcast; mutual rematch → reseed → new match — all through `createServer` |
| `e2e.test.js` | full two-client flow incl. terminal semantics: forfeit → `matchEnd` → `roomClosed` → room destroyed; late rematch silently ignored |
| `ttl.test.js` | real 5s sweep removes stale limiter windows, expired reservations, dead queue sockets, abandoned rooms |
| `match.test.js` grace test | reconnect now uses the real signed-credential reclaim path |

## Per-task behavior fixed (1–14)

1. `astro check` 9 errors → 0 (mode unions, obsolete props, badge variants)
2. `docs/testing/mode-regression-matrix.md` (lifecycle matrix + evidence procedure)
3. README/backend description match game-server-only architecture
4. Engine boots only via `bootEngine()`; `shutdownEngine()` cancels rAF + input
5. Online never imports/boots the engine in the lobby (P0-01)
6. Input: match-live-only capture, resets on blur/hidden/roundEnd/matchEnd/disconnect/forfeit; typing targets never captured; keyup always honored
7. Trials pause: engine is the single P/Escape owner; shell mirrors via events (P0-05)
8. Broken coarse-pointer controls removed; keyboard-only policy documented (P0-06)
9. `WS_SECRET` fail-fast in production; localhost origin dev-only; `/ws`-only upgrades
10. Signed reserved-seat reconnect (HMAC `{guestId, roomCode, seat, exp}`), in-memory credential, auto-rejoin uses it
11. One-shot ready/countdown with per-seat ready set
12. Room state machine `waiting|playing|rematchWait`; live rematch rejected; mutual rematch through `server.js`; silent terminal teardown + `roomClosed`
13. NetBridge: single-flight connect, pre-auth close rejects, one pong handler, real RTT ping, retry exhaustion surfaces an error
14. 5s sweep: reservations, limiter windows, dead queue sockets, abandoned rooms all expire

## Manual browser validation — PENDING (requires human)

Automated coverage is protocol-level; the two-browser visual pass in
`docs/testing/mode-regression-matrix.md` §3 (create/join, quick, cyan/pink
seats, connection refusal, reconnect, grace expiry, forfeit, mutual rematch,
console cleanliness at 360/768/desktop) has **not** been executed in a real
browser in this set and must be completed before public rollout.

## Deferred (Set 2 per scope)

Trials score ledger (P1-06), bot velocity/void rule (P1-07/P1-08), save
validation (P2-05), duplicate-module inventory (P2-06/P2-18).
