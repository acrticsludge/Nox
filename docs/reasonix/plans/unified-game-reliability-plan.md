## Status

- Tasks 1-14: **DONE** (see docs/testing/2026-08-31-set1-verification.md)
- Tasks 15-22: pending (Set 2 + Phase 4)

## Status

- Tasks 1-14: **DONE** (see docs/testing/2026-08-31-set1-verification.md)
- Tasks 15-22: pending (Set 2 + Phase 4)
# Plan: NOX Unified Reliability and Mode Contract

**Spec:** `docs/reasonix/specs/unified-game-reliability.md`  
**Audit:** `docs/audits/2026-08-unified-game-audit.md`  
**Operating rule:** one focused commit per task; preserve local 1v1 at every checkpoint; do not delete duplicate code before a replacement test proves its path.

## Phase 0 â€” Restore trustworthy feedback

1. **Make typecheck green.** Create canonical `GameMode`; repair online prop unions, obsolete overlay props, and existing landing type errors.  
   - Verify: `npm.cmd run check`, `npm.cmd test`.
2. **Add the mode regression matrix and evidence directory.** Cover all lifecycle states, both local seat maps, Trials pause/resume/save, two-browser online, keyboard-only, mobile widths, and console checks.  
   - Verify: a new contributor can execute it without source reading.
3. **Correct docs/runbook inventory.** Align README, backend package description, architecture, route links, and online deployment configuration with current behavior.  
   - Verify: clean-clone local instructions start Astro + backend correctly.

**Checkpoint:** tests/typecheck green; no implementation begins against an invalid UI contract.

## Phase 1 â€” Isolate sessions, input, and presentation

4. **Introduce a disposable session boundary.** Own rAF/timers/listeners/socket subscriptions through a per-mode session object.  
   - Verify: repeated enter/leave leaks no listener/timer; local 1v1 full match and Trials full lifecycle still work.
5. **Stop online lobby engine boot.** Remove unconditional GameShell import for online; defer engine/input until matched game flow.  
   - Verify: lobby has no game rAF/input side effects; nickname/code arrow editing works; no packets before playing.
6. **Replace global key leakage.** Make input mode-specific; preserve editing defaults; reset state on blur/hidden/terminal transitions.  
   - Verify: automated input reset tests; two-tab tab-switch manual test.
7. **Fix Trials pause ownership.** One transition owner for button/P/Escape; prevent duplicate toggle and save once.  
   - Verify: unit/state test plus manual P and Escape behavior.
8. **Fix or remove incomplete touch controls.** Implement full mapped directional controls/dash/shoot for the declared modes, including cleanup; otherwise hide them and mark the game keyboard-only.  
   - Verify: real device/coarse-pointer test; no controls call nonexistent APIs.

**Checkpoint:** local and Trials do not regress; online lobby is inert; all input can be safely abandoned.

## Phase 2 â€” Repair online integrity and state machine

9. **Require production WS secret and narrow origins.** Add fail-fast environment policy, development-only localhost exception, and documented Render/Vercel origin setup.  
   - Verify: server tests for production missing secret/origin denial and documented dev allowance.
10. **Build authenticated reserved-seat reconnect.** Add credential issue/verify, room seat reservation, client storage/retry, invalid-token handling, and expiry cleanup.  
    - Verify: real-server tests for correct reclaim, forged mismatch, competitor denial, expiry.
11. **Make ready/countdown idempotent.** Add room state + ready set and cancellation semantics.  
    - Verify: event-count tests prove exactly one countdown; reconnect-during-countdown policy tested.
12. **Repair terminal room/rematch behavior.** Reject live rematch; add server-owned post-match room state, mutual rematch, timeout/leave cleanup, and ordered final messages.  
    - Verify: full test through `createServer`, including normal win/forfeit/disconnect/rematch.
13. **Fix NetBridge reliability.** Reject pre-auth close, avoid duplicate pong handlers, implement app ping/pong or use a defined server metric, add bounded retries/backoff and visible errors.  
    - Verify: connection-refused, reconnect, ping, and retry tests.
14. **Bound server state.** TTL rooms, reservations, queues, and per-IP limiter records; add metrics/logs that avoid tokens.  
    - Verify: fake-clock tests and soak test.

**Checkpoint:** online game starts once, reconnects securely, reports status/ping, ends once, and rematches once.

## Phase 3 â€” Correct game-specific truth

15. **Replace Trials score breakdown with a ledger.** Wire exact amounts at every score/penalty mutation and assert displayed sum equals total.  
    - Verify: focused Trials tests for no-hit, pickup, lava, slime, void, kill, timeout and rounding.
16. **Fix bot movement history and choose void rule.** Correct applied velocity; resolve awareness contradiction in code/copy/spec; add behavior tests.  
    - Verify: deterministic bot fixtures show intended lead/void behavior.
17. **Validate/version Trials saves.** Add schema, clamps, migration/discard policy, safe restore, and user-visible recovery.  
    - Verify: corrupt/old/tampered state cases never crash and never preserve invalid runtime geometry.
18. **Inventory and migrate duplicate gameplay modules.** Map live imports; move exactly one subsystem at a time to canonical source; get approval before deletion.  
    - Verify: import graph plus parity tests; update architecture document.

**Checkpoint:** Trials rules, score, saved state, copy, and bot behavior all agree.

## Phase 4 â€” Final UX, quality, and release health

19. **Build declarative online HUD/lobby/post-match UI.** Correct own/opponent color/name/exit, connection, ping, lobby errors, rematch actions; remove imperative ownership conflicts.  
    - Verify: screenshots from cyan/pink seats and keyboard flow.
20. **Normalize modal and live-region accessibility.** Focus management, Escape policy, milestone-only announcements, correct game description, reduced motion.  
    - Verify: axe/Lighthouse plus screen-reader smoke check.
21. **Close delivery/dependency gaps.** Review/update Sharp in isolated change, add CI test/check/audit gates, baseline browser performance and bundle budget.  
    - Verify: patched audit, clean CI, performance/a11y reports.
22. **Release rehearsal.** Run the complete manual matrix, 30-minute soak, two-room concurrency, and deployment wake/reconnect test.  
    - Verify: archived evidence in `docs/testing/` and human sign-off.

## Sequencing constraints

- Tasks 4â€“8 are sequential before UI polish because they establish resource ownership.
- Tasks 9â€“14 are sequential server/client protocol work; do not parallelize conflicting wire changes.
- Tasks 15â€“18 may run after Phase 1, but no deletion occurs without approval.
- Tasks 19â€“22 only start after online integrity checkpoint is green.

## Final acceptance

- [ ] Every P0/P1 audit item has a linked code/test/manual proof.
- [ ] `npm.cmd test` and `npm.cmd run check` are green.
- [ ] Frontend and backend production dependency audits are reviewed/green or have explicit approved exception.
- [ ] All three modes complete the regression matrix without console errors.
- [ ] Online secure reconnect, terminal ordering, and rematch work through the production server entrypoint.
- [ ] A human has approved any P2 deferral and all legacy-code removals.
