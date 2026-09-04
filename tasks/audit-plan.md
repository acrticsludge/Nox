# Online 1v1 Multiplayer — Comprehensive Audit Plan

## Overview
Systematic audit of the entire online 1v1 multiplayer system from a game perspective. Users will try everything to find broken stuff — we must find it first.

## Architecture Map

```
Frontend (Vercel - Astro + React)
  ├── online.astro (entry point, lobby UI, match flow)
  ├── game-logic.js (client sim, rendering, input prediction, HUD)
  ├── net-bridge.js (WS client, binary codec, reconnection)
  ├── binary-codec.js (binary frame encoding/decoding)
  └── online-hud.ts (React state store for HUD)

Backend (Render Ohio - Node.js WS)
  ├── server.js (HTTP + WS setup, wiring)
  ├── net.js (WS layer: auth, rate limit, binary frames, heartbeats)
  ├── rooms.js (matchmaking: create/join/quick, seat reservations)
  └── match.js (headless sim: 60Hz tick, 30Hz snapshots, delta compression)
```

## Audit Categories

### 1. Correctness & Game Logic (High Priority)
- [ ] Match flow: lobby → queue → room → countdown → playing → round end → match end → rematch/lobby
- [ ] State machine integrity (no invalid transitions)
- [ ] Input handling: capture only during 'playing', never in lobby/text fields
- [ ] Client-side prediction vs server authority reconciliation
- [ ] Dead reckoning accuracy
- [ ] Round/match scoring correctness
- [ ] Forfeit flow correctness
- [ ] Lava vent visual sync (480-frame cycle)

### 2. Edge Cases & Race Conditions (High Priority)
- [ ] Quick match: both players queue simultaneously
- [ ] Join race: two players join same room code simultaneously
- [ ] Reconnect: player disconnects during countdown, round, match end
- [ ] Reconnect: seat reservation expiry (20s grace)
- [ ] Reconnect: credential replay attack
- [ ] Network: packet loss, reordering, duplication
- [ ] Network: late snapshot arrival (out of order)
- [ ] Network: server restart mid-match
- [ ] Tab: visibilitychange, blur, focus during match
- [ ] Multiple tabs open same room

### 3. Security (High Priority)
- [ ] WS origin validation (no CSRF)
- [ ] Input validation (seq monotonic, mask 6-bit, frame size)
- [ ] Rate limiting (60 msg/s, 1024 bytes/frame)
- [ ] Guest ID entropy (22 chars, crypto.randomValues)
- [ ] HMAC token signing/verification
- [ ] No secrets in logs
- [ ] Seat ownership enforcement
- [ ] Reconnect credential binding (guestId + room + seat + exp)

### 4. Performance & Latency (Medium Priority)
- [ ] Binary input frames (3 bytes) at 60Hz
- [ ] Delta snapshot compression
- [ ] Adaptive ping interval (500ms-2s based on RTT)
- [ ] TCP_NODELAY + KeepAlive
- [ ] Per-message deflate (threshold 1024)
- [ ] Heartbeat 15s (was 30s)
- [ ] Client interpolation (3 ticks = 50ms)
- [ ] Memory: no unbounded growth (netBuf max 12, evBatch max 256)

### 5. UX & Web Quality (Medium Priority)
- [ ] Loading states (queue modal, match found, countdown)
- [ ] Error states (room full, bad code, connection lost)
- [ ] Empty states (waiting for opponent)
- [ ] Mobile responsive (modals fit small screens)
- [ ] Accessibility (ARIA roles, keyboard nav)
- [ ] Visual parity: online countdown = local countdown (650ms beats, 420ms FIGHT!)
- [ ] Health bars real-time sync

### 6. Observability (Medium Priority)
- [ ] Structured logs for match lifecycle
- [ ] Client RTT measurement
- [ ] Snapshot delta size tracking
- [ ] Connection state transitions logged

## Audit Methodology

For each category:
1. Read code, trace data flows
2. Identify trust boundaries
3. Form attack vectors / edge case hypotheses
4. Verify existing tests cover the case
5. Add regression test if missing
6. Fix root cause if bug found

## Output
- `docs/audits/security/2026-09-online1v1-audit.md` — security findings
- `docs/audits/periodic/2026-09-online1v1-quality-audit.md` — quality/performance findings
- `docs/testing/online1v1-test-plan.md` — test coverage map
- Regression tests added to backend/test/