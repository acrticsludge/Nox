# Implementation Plan: Fix Online 1v1 Edge Case Issues

## Overview
Fix multiple edge case issues in online 1v1 multiplayer:
1. Queue logic bug - partner lost when invalid
2. Reconnecting mode triggered incorrectly
3. Inputs not working (matchLive not set)
4. Peer left state not handled properly
5. Navigation back to menu broken

## Architecture Decisions
- Keep existing WebSocket protocol and binary encoding
- Fix root causes in backend queue logic and frontend state management
- Add regression tests for queue behavior and reconnection handling

## Task List

### Phase 1: Backend Queue Fix
- [ ] Task 1: Fix queue partner loss bug in rooms.js (quick case)
- [ ] Task 2: Add test for queue partner validation edge case

### Phase 2: Frontend State Management Fixes
- [ ] Task 3: Fix matchLive not being set - ensure onFight callback fires
- [ ] Task 4: Fix peerLeft handler to properly reset matchLive and state
- [ ] Task 5: Fix leave/navigation to properly reset to lobby

### Phase 3: Reconnection Handling
- [ ] Task 6: Fix disconnected handler - don't enter reconnecting during active match incorrectly
- [ ] Task 7: Ensure reconnectCred is properly managed

### Phase 4: Verification
- [ ] Task 8: Run all backend tests (41 tests)
- [ ] Task 9: Run all frontend tests (36 tests)
- [ ] Task 10: TypeScript check and build

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Queue fix breaks existing matchmaking | High | Add test for quick match with valid/invalid partners |
| matchLive fix breaks input handling | High | Test with local 1v1 to ensure no regression |
| Reconnection logic changes break resume | Medium | Test disconnect/reconnect scenario |

## Open Questions
- None - issues are well-understood from code analysis