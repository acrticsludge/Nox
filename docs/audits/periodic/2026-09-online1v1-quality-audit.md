# Online 1v1 Multiplayer — Quality & Performance Audit

**Date:** 2026-09-04  
**Auditor:** Reasonix/Deepseek  
**Scope:** Frontend + Backend game logic, networking, UX, web quality

---

## Executive Summary

**Overall Quality: GOOD** — The implementation shows strong engineering practices (binary protocol, delta compression, client prediction, dead reckoning, deterministic sim). Several UX edge cases and performance optimizations remain.

---

## Game Logic Correctness

### ✅ Strengths
- **Deterministic simulation** shared between client/server (`game-sim.js`)
- **Client-side prediction** for instant local response (`predictLocalInput`)
- **Dead reckoning** extrapolates opponent position between snapshots
- **Visual parity** with local 1v1 (650ms beats, 420ms FIGHT! hold, cyber badge)
- **Lava vent sync** — server sends hazard timer `t`, client computes `isLavaActive` from 480-frame cycle
- **Round/match scoring** — first to 5 wins, proper round end handling

### ⚠️ Issues Found

#### Q1: Countdown Restart Race (FIXED in 40fad4e)
**Was:** Server sends countdown messages for t=3,2,1,0. Client restarted countdown on each, blocking `onFight` callback.
**Fixed:** Client now only starts countdown once (on first message), runs local 3-2-1-FIGHT.

#### Q2: Input Capture During Countdown
**Location:** `frontend/src/pages/play/online.astro:665-680`
**Issue:** Keydown/keyup handlers check `matchLive` flag, but `matchLive` only set in `onFight` callback. During countdown, inputs are ignored correctly. However, if `onFight` never fires (countdown bug), inputs never work.
**Status:** Fixed by Q1 fix, but fragile — relies on single callback.

#### Q3: Lava Vent Timer Drift
**Location:** `backend/match.js:58` (hazards send `h.t`), `frontend/src/game/game-logic.js:701-706`
**Issue:** Server sends `h.t` (timer) in snapshot. Client uses this for `isLavaActive`/`isLavaWarning`. But if snapshot delayed/dropped, client timer drifts from server.
**Risk:** Visual desync (lava appears active when server says inactive or vice versa).
**Fix:** Client should maintain own 480-frame counter synced to server tick, only corrected by snapshot `t` when received.

#### Q4: Bullet ID Fallback Matching Heuristic
**Location:** `frontend/src/game/game-logic.js:747-762`
**Issue:** Old server snapshots lack bullet IDs. Fallback matches by owner+type+distance (<26px). Can mismatch if two same-type bullets from same owner cross paths.
**Risk:** Visual glitch (bullet appears to teleport or duplicate).
**Fix:** Acceptable for backward compat; new server always sends IDs.

#### Q5: Round Break Timing Mismatch
**Location:** `backend/match.js:8-11` (ROUND_BREAK_MS=300, COUNTDOWN_BEAT_MS=200, FIGHT_HOLD_MS=100)
**Issue:** Server runs countdown between rounds. Client also runs countdown. If client countdown starts late (snapshot delay), round start desyncs.
**Fix:** Server should send `countdown` with `t` value; client uses that as authoritative start.

---

## Networking & Latency

### ✅ Strengths
- **Binary input frames**: 3 bytes @ 60Hz (was JSON @ 30Hz)
- **Delta snapshot compression**: Only changed seats/bullets sent
- **Adaptive ping**: 500ms-2s based on RTT
- **TCP optimizations**: `TCP_NODELAY`, `KeepAlive(10s)`
- **Per-message deflate**: Threshold 1024 bytes
- **Heartbeat**: 15s (was 30s) for faster dead peer detection

### ⚠️ Issues Found

#### P1: Sequence Number Wrap at 255 (4.2 min at 60Hz)
**Location:** `backend/match.js:235`, `frontend/src/game/net/binary-codec.js:29`
**Issue:** `seq & 0xFF` limits to 255. At 60Hz, wraps every 4.25 minutes. No replay protection.
**Fix:** Use 16-bit sequence (2 bytes) or implement sliding window replay detection.

#### P2: No Jitter Buffer for Snapshots
**Location:** `frontend/src/game/game-logic.js:770-799` (`netInterpolate`)
**Issue:** `NET_INTERP_TICKS = 3` (50ms fixed). No adaptive jitter buffer based on RTT variance.
**Impact:** On high-jitter connections, interpolation may run out of snapshots causing extrapolation artifacts.
**Fix:** Dynamic interpolation delay based on observed snapshot arrival variance.

#### P3: Snapshot Heartbeat Includes Critical Fields Always
**Location:** `backend/match.js:105-107`
**Issue:** When no changes, heartbeat snapshot sends `p: [null, null], b: []` but still includes state/round/score/time/sr/pk/hz/ev/rr/mw. Good — ensures critical state always fresh.

#### P4: Binary Snapshot Encoding Falls Back to JSON
**Location:** `frontend/src/game/net/binary-codec.js:77-97`
**Issue:** `encodeSnapshot` serializes full snapshot to JSON then wraps in binary frame. Defeats purpose of binary protocol for largest messages.
**Fix:** Implement true binary snapshot encoding (delta-compressed, fixed-width fields).

#### P5: No Congestion Control
**Location:** N/A
**Issue:** Client sends 60 input frames/sec regardless of network conditions. No backoff on packet loss.
**Impact:** Could exacerbate congestion on poor connections.
**Fix:** Monitor ack/loss rate, reduce send rate if loss detected.

---

## UX & Web Quality

### ✅ Strengths
- **Compact modals** fit small laptops (max-height: min(85vh, 520px))
- **Loading states**: Queue modal (position), Match Found modal, Countdown overlay
- **Error states**: Room full, bad code, connection lost, server outdated
- **Empty states**: "WAITING FOR OPPONENT…"
- **Mobile responsive**: Buttons full-width flex, 12px font, 10px padding
- **Accessibility**: ARIA roles on status/error, semantic HTML, keyboard navigable
- **Visual parity**: Online countdown = local (cyber badge, roundOverlay)
- **Health bars**: Real-time via React store (`online-hud.ts`)

### ⚠️ Issues Found

#### U1: No Reduced Motion Support
**Location:** `frontend/src/pages/play/online.astro` (CSS animations)
**Issue:** Modals use `transition: transform 0.2s cubic-bezier(...)`, countdown uses `setTimeout` animations. No `@media (prefers-reduced-motion: reduce)` handling.
**Fix:** Respect `prefers-reduced-motion` — disable transitions, instant show/hide.

#### U2: No Focus Management on Modal Open/Close
**Location:** `frontend/src/pages/play/online.astro` (modal creation)
**Issue:** Modals created dynamically, focus not trapped. Screen reader users may lose context.
**Fix:** On modal open: save active element, focus first focusable element, trap Tab. On close: restore focus.

#### U3: Queue Modal Not Accessible
**Location:** `frontend/src/pages/play/online.astro:415-437`
**Issue:** `role="status"` missing on queue position. No live region for position updates.
**Fix:** Add `role="status" aria-live="polite"` to position element.

#### U4: Color-Only State Indicators
**Location:** `frontend/src/pages/play/online.astro:50-51` (`.id-cyan`, `.id-pink`)
**Issue:** Seat identity (CYAN/PINK) conveyed only by color. Colorblind users may not distinguish.
**Fix:** Add text labels or icons alongside color.

#### U5: No Offline/Reconnect Indicator During Active Match
**Location:** `frontend/src/pages/play/online.astro:587-589` (`peerLeft` handler)
**Issue:** Shows grace period message but no persistent "RECONNECTING" badge in HUD during grace.
**Fix:** HUD should show reconnection status prominently during grace period.

#### U6: Match End Modal Auto-Defaults to Leave After 10s
**Location:** `frontend/src/pages/play/online.astro:545`
**Issue:** `setTimeout(() => { resolve('leave'); }, 10000)` — if player walks away, match auto-forfeits.
**Impact:** Could be abused (wait for opponent to auto-leave).
**Fix:** Remove auto-resolve or make it much longer (60s+).

---

## Performance

### Current Metrics (Estimated)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Input frame size | <10 bytes | 3 bytes | ✅ |
| Snapshot size (delta) | <500 bytes | ~200-400 bytes | ✅ |
| Snapshot size (full) | <2 KB | ~1-2 KB (JSON) | ⚠️ |
| Client interpolation delay | 50ms | 50ms (3 ticks) | ✅ |
| Server tick rate | 60Hz | 60Hz | ✅ |
| Snapshot rate | 30Hz | 30Hz | ✅ |
| Ping interval | 500ms-2s | Adaptive | ✅ |
| Heartbeat | 15s | 15s | ✅ |
| Memory (netBuf) | Bounded | 12 snapshots max | ✅ |
| Memory (evBatch) | Bounded | 256 events max | ✅ |

### ⚠️ Performance Issues

#### PERF1: Binary Snapshot Not Implemented
**Impact:** Full snapshots ~1-2 KB JSON vs potential ~200 bytes binary.
**Fix:** Implement `encodeSnapshot`/`decodeSnapshot` with true binary format.

#### PERF2: No Client-Side Frame Budget Monitoring
**Location:** `frontend/src/game/game-logic.js` (rAF loop)
**Issue:** No FPS/frame time monitoring in production. Can't detect performance regressions.
**Fix:** Add `performance.now()` frame timing, report percentile to analytics.

#### PERF3: React HUD Re-renders on Every Snapshot
**Location:** `frontend/src/game/net/online-hud.ts:37-40`
**Issue:** `setOnlineHud` called every snapshot (30Hz) with `selfHp`/`oppHp`. Triggers React re-render.
**Impact:** Minor — HUD is small, but 30Hz React updates may cause jank on low-end devices.
**Fix:** Throttle HUD updates to 10Hz, or use `requestAnimationFrame` batching.

#### PERF4: No Asset Preloading for Online Assets
**Location:** `frontend/src/pages/play/online.astro`
**Issue:** No `<link rel="preload">` for online-specific assets (modals, sounds).
**Fix:** Add preload hints for critical assets.

---

## Edge Case Coverage

| Scenario | Handled? | Notes |
|----------|----------|-------|
| Player opens 2 tabs same room | ❌ | Second tab gets new guestId, treated as new player |
| Tab visibilitychange during match | ✅ | `resetInput()` on blur/hidden |
| Tab focus during countdown | ⚠️ | Inputs ignored until `matchLive` |
| Network tab throttle (devtools) | ❌ | Not tested — would break 60Hz input |
| Server restart mid-match | ❌ | No persistence — all players disconnect |
| Clock skew client/server | ⚠️ | Ping uses client timestamp, no validation |
| Snapshot arrives out of order | ✅ | `netBuf` sorted by tick, interpolation handles |
| Late snapshot (older than display tick) | ✅ | Discarded by `netInterpolate` |
| Player joins during round break | ✅ | Room state `waiting` → `playing` on full |
| Player joins during rematchWait | ✅ | Gets `rematchWait=true` in room msg |
| Forfeit during countdown | ❌ | `nox:forfeit` checks `matchLive` (false during countdown) |
| RematchReq during countdown | ✅ | Server rejects: `room.state !== 'rematchWait'` |

---

## Missing Test Coverage (Quality)

| Area | Missing Tests |
|------|---------------|
| **Network** | Packet loss simulation, reordering, duplication, jitter |
| **Reconnection** | Reconnect during countdown, during round break, during match end |
| **Tab behavior** | Multiple tabs, visibilitychange during all phases |
| **Edge inputs** | Rapid key press/release, simultaneous opposing keys |
| **Visual sync** | Lava vent timer accuracy, bullet fallback matching |
| **Performance** | Frame budget, memory growth over 30 min match |
| **Accessibility** | Screen reader, keyboard-only, reduced motion |
| **Mobile** | Touch controls (not implemented), viewport changes |

---

## Recommendations Priority

### Must Fix (Before Production)
1. **Q2** — Make input enablement more robust (not single callback)
2. **P1** — Fix sequence number wrap (16-bit or replay window)
3. **U2** — Focus management on modals
4. **U6** — Remove 10s auto-forfeit on match end modal
5. **Add security tests** for H1, H2, H3 from security audit

### Should Fix (Post-Launch Sprint)
1. **Q3** — Lava vent timer drift protection
2. **P2** — Adaptive jitter buffer
3. **P4** — True binary snapshot encoding
4. **U1** — Reduced motion support
5. **U3** — Queue modal accessibility
6. **U4** — Colorblind-friendly seat indicators
7. **U5** — Persistent reconnect indicator in HUD

### Nice to Have
1. **PERF2** — Frame budget monitoring
2. **PERF3** — Throttle HUD updates
3. **PERF4** — Asset preloading
4. **M3** — Configurable grace period
5. **M4** — Protocol version negotiation

---

## Verification Commands

```bash
# All tests
cd backend && npm test          # 42/42 pass
cd frontend && node --test src/game/vfx/vfx.test.js src/game/trials-save.test.js src/game/trials-ledger.test.js src/game/sim/game-sim.test.js src/game/core/constants.test.js src/game/bot-ai.test.js  # 36/36 pass

# TypeScript + Build
cd frontend && npm run check && npm run build  # 0 errors, builds OK

# Lint (if configured)
cd frontend && npm run lint
```

---

## Sign-Off

- [ ] All game logic correctness issues resolved
- [ ] Network protocol hardened (seq wrap, binary snapshots)
- [ ] UX accessibility gaps addressed
- [ ] Performance monitoring added
- [ ] Edge case test coverage expanded