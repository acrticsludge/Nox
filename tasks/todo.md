## Task 1: Fix queue partner loss bug in rooms.js (quick case)

**Description:** When a player does 'quick' and there's a partner in queue but that partner is invalid (disconnected or already in room), the partner is shifted from queue but not put back, losing them from the queue entirely.

**Acceptance criteria:**
- [ ] Invalid partner is put back in queue or handled gracefully
- [ ] Valid partner creates room correctly
- [ ] No queue position loss for waiting players

**Verification:**
- [ ] Run backend tests: `npm test` in backend/
- [ ] Manual test: Two players quick match successfully

**Dependencies:** None

**Files likely touched:**
- `backend/rooms.js` (lines 168-180)

**Estimated scope:** S (1-2 files)

---

## Task 2: Add test for queue partner validation edge case

**Description:** Add regression test for the queue partner validation fix.

**Acceptance criteria:**
- [ ] Test covers: valid partner -> room created
- [ ] Test covers: disconnected partner -> partner requeued, new player queued
- [ ] Test covers: partner already in room -> partner requeued, new player queued

**Verification:**
- [ ] Run backend tests: `npm test` in backend/

**Dependencies:** Task 1

**Files likely touched:**
- `backend/test/rooms.test.js` or `backend/test/e2e.test.js`

**Estimated scope:** S (1 file)

---

## Task 3: Fix matchLive not being set - ensure onFight callback fires

**Description:** The `matchLive` flag controls whether inputs are sent to server. It's set to true in the `onFight` callback of `startOnlineCountdown`. But if the countdown doesn't fire properly or the server sends snapshots before matchLive is true, inputs won't be sent.

**Acceptance criteria:**
- [ ] matchLive becomes true when FIGHT! phase starts
- [ ] Inputs are sent at 60Hz after FIGHT!
- [ ] No input lag during countdown

**Verification:**
- [ ] Run frontend tests: `node --test` in frontend/
- [ ] Manual test: Player movement works immediately after FIGHT!

**Dependencies:** None

**Files likely touched:**
- `frontend/src/pages/play/online.astro` (countdown handler, line 475-485)
- `frontend/src/game/game-logic.js` (startOnlineCountdown, line 911-958)

**Estimated scope:** S (2 files)

---

## Task 4: Fix peerLeft handler to properly reset matchLive and state

**Description:** When a peer disconnects during a match, the `peerLeft` handler shows a message but doesn't set `matchLive = false`, so the remaining player still thinks they're in a match and inputs may behave incorrectly.

**Acceptance criteria:**
- [ ] matchLive set to false when peer leaves during active match
- [ ] HUD shows reconnecting state
- [ ] Grace period message displays correctly

**Verification:**
- [ ] Run frontend tests
- [ ] Manual test: Disconnect one player, verify other sees correct state

**Dependencies:** None

**Files likely touched:**
- `frontend/src/pages/play/online.astro` (peerLeft handler, line 569-578)

**Estimated scope:** XS (1 file)

---

## Task 5: Fix leave/navigation to properly reset to lobby

**Description:** The 'leave' button in matchEnd modal and forfeit flow should properly reset all state and return to the main online lobby, not the game arena.

**Acceptance criteria:**
- [ ] Clicking LEAVE returns to lobby with queue/create/join buttons
- [ ] All match state cleared (roomCode, matchLive, HUD)
- [ ] No stale game overlay visible

**Verification:**
- [ ] Run frontend tests
- [ ] Manual test: Complete a match, click LEAVE, verify lobby shown

**Dependencies:** Task 3

**Files likely touched:**
- `frontend/src/pages/play/online.astro` (showMatchEndModal, matchEnd handler, forfeit handler)

**Estimated scope:** S (1 file)

---

## Task 6: Fix disconnected handler - don't enter reconnecting during active match incorrectly

**Description:** The `disconnected` handler sets `connection: 'reconnecting'` when `roomCode` exists. But it may fire incorrectly during normal match transitions (countdown, round break) causing false reconnecting state.

**Acceptance criteria:**
- [ ] Reconnecting only shown on actual unexpected disconnect
- [ ] Normal transitions (countdown, round break) don't trigger it
- [ ] Reconnection attempt works correctly with credential

**Verification:**
- [ ] Run frontend tests
- [ ] Manual test: Play full match, verify no false reconnecting

**Dependencies:** Task 3

**Files likely touched:**
- `frontend/src/pages/play/online.astro` (disconnected handler, line 594-613)

**Estimated scope:** S (1 file)

---

## Task 7: Ensure reconnectCred is properly managed

**Description:** The reconnect credential should be cleared on deliberate leave but preserved on unexpected disconnect for reconnection.

**Acceptance criteria:**
- [ ] Deliberate leave (LEAVE button) clears reconnectCred
- [ ] Unexpected disconnect preserves reconnectCred
- [ ] Rejoin with credential works

**Verification:**
- [ ] Run backend tests (reconnection tests)
- [ ] Manual test: Disconnect and reconnect within grace period

**Dependencies:** Task 6

**Files likely touched:**
- `frontend/src/game/net/net-bridge.js` (close method, line 140-144)
- `backend/rooms.js` (leave function, line 85-109)

**Estimated scope:** S (2 files)

---

## Task 8: Run all backend tests (41 tests)

**Acceptance criteria:**
- [ ] All 41 backend tests pass

**Verification:**
- [ ] `npm test` in backend/

**Dependencies:** Tasks 1, 2, 7

**Estimated scope:** XS (command only)

---

## Task 9: Run all frontend tests (36 tests)

**Acceptance criteria:**
- [ ] All 36 frontend tests pass

**Verification:**
- [ ] `node --test` in frontend/

**Dependencies:** Tasks 3, 4, 5, 6

**Estimated scope:** XS (command only)

---

## Task 10: TypeScript check and build

**Acceptance criteria:**
- [ ] `npm run check` passes (0 errors)
- [ ] `npm run build` succeeds

**Verification:**
- [ ] Run commands in frontend/

**Dependencies:** All previous tasks

**Estimated scope:** XS (command only)