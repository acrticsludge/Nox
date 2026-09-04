# Online 1v1 Multiplayer — Test Coverage Map

**Date:** 2026-09-04  
**Purpose:** Map all existing tests, identify gaps, plan regression tests for audit findings

---

## Backend Test Inventory (42 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `test/net.test.js` | 10 | WS auth, origin, rate limits, frame size, tokens |
| `test/policy.test.js` | 5 | Prod secret, origin policy, /ws path, TRUST_PROXY |
| `test/rooms.test.js` | 12 | Create/join/quick, caps, collision, leave, queue fix |
| `test/match.test.js` | 5 | Ready→countdown→snapshots, input validation, grace, duplicate ready |
| `test/reconnect.test.js` | 3 | Credential issue, forged token, seat mismatch |
| `test/rematch.test.js` | 2 | Live reject, natural end→rematchWait→reseed |
| `test/e2e.test.js` | 1 | Full flow: quick→ready→inputs→forfeit→roomClosed |
| `test/ttl.test.js` | 1 | Abandoned room cleanup |
| `test/events.test.js` | 1 | Visual event batches |
| `test/net-client-pipeline.test.js` | 1 | Client pipeline |
| `test/server.test.js` | 1 | HTTP endpoints |

**Total: 42 tests, all passing**

---

## Frontend Test Inventory (36 tests)

| File | Tests | Coverage |
|------|-------|----------|
| `src/game/sim/game-sim.test.js` | 13 | Sim determinism, rounds, scoring, match end |
| `src/game/bot-ai.test.js` | 2 | Bot void avoidance |
| `src/game/core/constants.test.js` | 2 | Constants, power/bullet tables |
| `src/game/trials-ledger.test.js` | 5 | Ledger math, rounding, validation |
| `src/game/trials-save.test.js` | 4 | Save validation, versioning, corruption |
| `src/game/vfx/vfx.test.js` | 10 | Recipes, timeline, event dedupe, sim integration |

**Total: 36 tests, all passing**

---

## Coverage Matrix

### ✅ Well Covered (Multiple Tests)

| Feature | Backend Tests | Frontend Tests |
|---------|---------------|----------------|
| Room create/join | 4 | — |
| Quick match pairing | 3 | — |
| Session auth (hello/token) | 4 | — |
| Origin validation | 3 | — |
| Rate limiting | 2 | — |
| Input validation (seq, mask) | 2 | — |
| Reconnect credentials | 3 | — |
| Rematch flow | 3 | — |
| Forfeit | 2 | — |
| Grace period | 2 | — |
| Sim determinism | — | 3 |
| Sim rounds/scoring | — | 3 |

### ⚠️ Partially Covered (1-2 Tests)

| Feature | Gaps |
|---------|------|
| Countdown protocol | Only E2E tests countdown; no unit test for client countdown logic |
| Binary protocol | No tests for encode/decode round-trip |
| Delta snapshots | No test for delta compression correctness |
| Dead reckoning | No test for extrapolation accuracy |
| Client prediction | No test for prediction/reconciliation |
| Lava vent sync | No test for hazard timer alignment |
| Health bar sync | No test for HUD state updates |
| Queue modal | No test for queue position updates |
| Match end modal | No test for modal actions (rematch/leave) |

### ❌ Not Covered (0 Tests)

| Feature | Risk |
|---------|------|
| Multiple tabs same room | HIGH — undefined behavior |
| Tab visibilitychange during phases | MEDIUM — input reset tested but not full flow |
| Network: packet loss | HIGH — no simulation |
| Network: reordering/duplication | HIGH — no simulation |
| Network: jitter | HIGH — no simulation |
| Sequence number wrap (4.2 min) | HIGH — no test |
| Reconnect during countdown | MEDIUM — not tested |
| Reconnect during round break | MEDIUM — not tested |
| Reconnect during match end | MEDIUM — not tested |
| Clock skew client/server | MEDIUM — no test |
| Forfeit during countdown | LOW — blocked by matchLive check |
| Colorblind accessibility | LOW — no test |
| Reduced motion | LOW — no test |
| Focus management | MEDIUM — no test |
| Frame budget monitoring | LOW — no test |
| Memory growth over time | LOW — no test |

---

## Regression Tests Needed (From Audit)

### Security Audit Findings → Tests

| Finding | Test Needed |
|---------|-------------|
| H1: Reconnect credential replay (1h TTL) | Test: Capture credential, wait 30s, replay → should reject |
| H2: Input seq replay after wrap | Test: Send 300 input frames (wrap), replay frame 100 → should reject |
| H3: GuestId entropy | Test: Connect with predictable guestId → should reject or server-assign |
| M1: Dev origin bypass | Test: Set NODE_ENV=development, connect from evil.com → should reject |
| M2: IP connection limit | Test: Open 50 connections from same IP → should rate limit |
| L4: Credential not invalidated on rejoin | Test: Rejoin successfully, replay same credential → should reject |

### Quality Audit Findings → Tests

| Finding | Test Needed |
|---------|-------------|
| Q2: Input enablement robustness | Test: Countdown completes, onFight fires, matchLive=true, inputs work |
| Q3: Lava vent timer drift | Test: Delay snapshots 500ms, verify client lava state matches server |
| P1: Seq wrap at 255 | Test: Simulate 5 min match, verify no desync |
| P2: Jitter buffer | Test: Inject 100ms jitter, verify no extrapolation artifacts |
| U1: Reduced motion | Test: prefers-reduced-motion=true, verify no transitions |
| U2: Focus management | Test: Open modal, verify focus trapped, close → focus restored |
| U3: Queue modal a11y | Test: Screen reader announces position updates |
| U6: 10s auto-forfeit | Test: Wait 11s on match end modal → should NOT auto-leave |

---

## Test Implementation Plan

### Phase 1: Security Regression Tests (Week 1)
```javascript
// backend/test/security-regression.test.js
test('reconnect credential expires after grace+buffer, not 1h', async () => { ... })
test('input sequence replay after wrap rejected', async () => { ... })
test('guestId must have sufficient entropy or be server-assigned', async () => { ... })
test('development origin bypass blocked', async () => { ... })
test('IP connection rate limiting enforced', async () => { ... })
test('reconnect credential single-use', async () => { ... })
```

### Phase 2: Quality Regression Tests (Week 1-2)
```javascript
// frontend/test/online-quality-regression.test.js
test('countdown onFight callback fires exactly once', async () => { ... })
test('lava vent timer stays synced with delayed snapshots', async () => { ... })
test('sequence number wrap at 256 handled correctly', async () => { ... })
test('adaptive jitter buffer prevents extrapolation artifacts', async () => { ... })
test('reduced motion disables modal transitions', async () => { ... })
test('modal focus trap and restore', async () => { ... })
test('queue position announced to screen readers', async () => { ... })
test('match end modal does not auto-forfeit after 10s', async () => { ... })
```

### Phase 3: Edge Case Tests (Week 2)
```javascript
// backend/test/edge-cases.test.js
test('multiple tabs same room handled gracefully', async () => { ... })
test('visibilitychange during countdown/playing/roundEnd', async () => { ... })
test('packet loss simulation: 10% random drop', async () => { ... })
test('packet reordering: shuffle snapshot arrival', async () => { ... })
test('clock skew: client 5s ahead/behind server', async () => { ... })
test('forfeit during countdown blocked', async () => { ... })

// frontend/test/edge-cases.test.js
test('mobile viewport resize during match', async () => { ... })
test('touch input not implemented (document limitation)', async () => { ... })
test('30 minute match memory stable', async () => { ... })
```

---

## CI/CD Integration

```yaml
# .github/workflows/ci.yml additions
- name: Security Regression Tests
  run: cd backend && node --test test/security-regression.test.js

- name: Quality Regression Tests  
  run: cd frontend && node --test test/online-quality-regression.test.js

- name: Edge Case Tests
  run: |
    cd backend && node --test test/edge-cases.test.js
    cd frontend && node --test test/edge-cases.test.js
```

---

## Test Data Requirements

| Test | Test Data Needed |
|------|------------------|
| Seq wrap | 300+ sequential input frames |
| Jitter buffer | Snapshots with controlled arrival variance |
| Packet loss | Network simulator (tc/netem or mock WS) |
| Clock skew | Time manipulation (mock Date.now) |
| 30-min memory | Long-running test (or accelerated time) |
| Reduced motion | CSS media query mocking |
| Focus management | DOM focus API verification |

---

## Coverage Targets

| Metric | Current | Target |
|--------|---------|--------|
| Backend line coverage | ~85% | >95% |
| Frontend line coverage | ~70% | >90% |
| Branch coverage | ~75% | >90% |
| Critical path coverage | 100% | 100% |
| Security test coverage | 60% | 100% |
| Edge case coverage | 20% | 80% |

---

## Verification Checklist

Before merge to main:
- [ ] All 42 backend tests pass
- [ ] All 36 frontend tests pass
- [ ] All new regression tests pass
- [ ] TypeScript check: 0 errors
- [ ] Frontend build: succeeds
- [ ] No new lint warnings
- [ ] Security audit findings addressed
- [ ] Quality audit findings addressed