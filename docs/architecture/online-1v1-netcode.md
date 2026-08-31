# NOX — Online 1v1 Architecture (Guest-Only, Global Play)

**Status:** Proposed (implementation not started)
**Date:** 2026-08-31
**Scope:** Real-money-free, login-free online 1v1. One player per PC. Play with anyone worldwide.
**Grounded in:** `docs/decisions/0001-render-hosting-static-server.md` (Render WS pre-approved), `docs/decisions/0002-astro-frontend-vercel-monorepo.md` (Vercel cannot host WS), `docs/architecture/nox-architecture.md:89-104` (server-authoritative roadmap), full backend inventory (2026-08-31).

---

## 1. Current State (verified, not assumed)

| Fact                                                                                                             | Evidence                                                                                   |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Frontend is fully static (Astro, Vercel). No API routes.                                                         | `frontend/astro.config.mjs:12` (`output: 'static'`), `vercel.json`                         |
| Backend is a**zero-dependency** stateless Node HTTP server. **No WebSocket layer. No DB. No rooms.**             | `backend/server.js` (163 lines), `backend/package.json` (zero deps)                        |
| Render free tier is WebSocket-capable, 750h/mo,**spins down after 15 min idle (~1 min cold start)**              | ADR 0001,`render.yaml:2-4`                                                                 |
| Game = one 3,201-line client module exposing`window.NOX_GAME` + CustomEvents (`nox:startGame`, `nox:forfeit`, …) | `game-logic.js:3182-3192`, `560-615`                                                       |
| Input is**one shared keyboard** (P1 WASD, P2 arrows) — both players on one machine                               | `game-logic.js:1049-1073`                                                                  |
| Map/pickup generation uses client-side`Math.random()` — **non-deterministic across peers**                       | `game-logic.js:73+`, architecture doc flag at `nox-architecture.md:100-101`                |
| Round logic exists and is reusable: first-to-5, 60s rounds, countdown, forfeit, rematch                          | `startGame` 3112, `endRound` 2505, `forfeit` 3154                                          |
| Zero networking code anywhere today                                                                              | regex sweep: no`WebSocket`/`RTCPeerConnection`/`socket.io` in `frontend/src` or `backend/` |

**Conclusion:** the game loop is reusable as a _simulation_, but it is welded to DOM/render/HUD and to shared-keyboard input. The refactor (§5) is the real work; networking itself is the easy part.

---

## 2. Netcode Decision: Server-Authoritative WebSockets

Three options were evaluated:

| Option                                                      | Latency                                                              | Cheat resistance                                          | Complexity                                                                                                                                | Verdict           |
| ----------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **A. Server-authoritative sim (WebSocket, 30Hz snapshots)** | client→server→client (~50-150ms regional, 100-300ms cross-continent) | **Maximal** — clients send only booleans, never positions | Medium                                                                                                                                    | ✅**v1 — chosen** |
| B. WebRTC P2P (DataChannel + rollback)                      | Lowest (direct)                                                      | Weak (peer-hosted)                                        | **High** — needs signaling server anyway, TURN relay costs money, requires deterministic sim; current sim uses `Math.random()` per-client | ❌ v2 at best     |
| C. Lockstep input relay                                     | Low                                                                  | Weak                                                      | High — requires full determinism refactor of every`Math.random()` and float op                                                            | ❌                |

**Why A wins for NOX:**

1. Guests are maximally untrusted — only an authority model prevents teleport/aimbot-by-state-injection. Matches CLAUDE.md security baseline (never trust client).
2. The existing `update(dt)` sim is deterministic-per-frame _on one machine_ — it can run unmodified inside Node once DOM calls are stripped. No determinism gymnastics.
3. Existing ADR 0001 already provisioned exactly this (Render + WS rooms).
4. 2 players × 30Hz ≈ 20 KB/s — trivially inside Render free tier.

**Latency reality check (honesty gate):** a US-East Render server means an India↔Brazil match carries ~250-350ms round-trip. Mitigations, in order: (1) client-side prediction of _own_ movement with server reconciliation (§6.4), (2) 100ms input buffering feels fine for a twitch arena shooter at this budget, (3) v2: region pinning or Cloudflare DO edge (§8). **Do not promise esports-grade feel on free infra.**

---

## 3. Guest Identity (No Login)

```
First visit → client generates guestId (UUID v4) → localStorage('nv_guest_id')
             → nickname (player-entered, sanitized server-side)
WS connect  → server issues session token (HMAC-signed, 12h TTL, no PII)
Reconnect   → same guestId + token within grace window resumes room seat
```

- **No email, no password, no accounts table.** Identity = in-memory map + signed token. Server restart = sessions reset (acceptable: matches are minutes, not days).
- Nickname rules: 2-16 chars, strip control chars/HTML (rendered via `textContent` already), unique per room only (not globally).
- Abuse valves (CLAUDE.md baseline): per-IP token issuance (10/hour), per-socket message rate cap (60 msg/s), room-create cap (5/hour/IP). No CAPTCHA for v1; revisit if abused.

---

## 4. Matchmaking — "Play With Anyone in the World"

Two paths, both trivial on an authoritative server:

| Path             | Flow                                                                                     | UI                                 |
| ---------------- | ---------------------------------------------------------------------------------------- | ---------------------------------- |
| **Private room** | Creator gets 5-char code (`7XK2Q`) → share link `/play/online?room=7XK2Q` → friend joins | "Create Room" / "Join Code"        |
| **Quick Match**  | Player hits "Quick Match" → enters global FIFO queue → server pairs first two waiting    | "Quick Match" button + queue timer |

- Queue is a simple in-memory array — no DB needed at this scale.
- Room capacity is hard-capped at 2 (no spectators in v1 — keeps bandwidth and cheat surface minimal).
- Auto-fill seat 0 = creator, seat 1 = joiner. Colors follow seat (cyan/pink, existing).
- Cold-start UX (Render spin-down): the `/play/online` page pings `/health` on load to warm the server (~1 min first match of the day only). Document this; do not hide it.

---

## 5. The Real Work: Extract the Sim Core

This is the phase that decides success. `game-logic.js` mixes three layers:

```
SIM (pure, portable):  update(dt), physics, bullets, collisions, pickups,
                       walls, round/timer/score state machine
VIEW (DOM-bound):      render(), updateHUD(), updatePlayerCardHUD(), particles,
                       drawWalls/drawHazards, overlays
INPUT (shared-kbd):    window keydown handlers, keys map, per-player keymaps
```

**Phase 0 — split (behavior-preserving):**

1. `game-sim.js` — pure sim: `createMatch(seed)`, `simTick(match, inputs, dt)`, no `document.*`, no `window.*`, no `Math.random()` except via injected RNG seeded from `match.seed` (fixes the determinism flag from `nox-architecture.md:100`).
2. `game-view.js` — current render/HUD/overlay code, reads match state, untouched UX.
3. `input.js` — per-client single-player keymap (WASD **or** arrows — user choice, both mapped to the same 6-bit input struct).
4. Local 1v1 keeps working post-split by running `simTick` twice through the same interface (regression: play local 1v1 before proceeding — it must feel identical).

**Scope guard:** Trials mode (bot) stays 100% local — it needs zero networking. Online mode is 1v1 only in v1. Do not touch `trials-mode.js` or `bot-ai.js`.

---

## 6. Online Game Architecture

### 6.1 Topology

```
PLAYER A (browser)                    PLAYER B (browser)
  input.js ── 6-bit input @30Hz ──┐  ┌── 6-bit input @30Hz ── input.js
  game-view.js ◄─ snapshot @30Hz ─┤  ├─ snapshot @30Hz ► game-view.js
                                  ▼  ▼
                    RENDER WORKER (backend/server.js + ws)
                    ├─ RoomManager (Map<code, Room>)
                    ├─ Room { seats[2], match, queue }
                    ├─ game-sim.js (same module as client, headless)
                    └─ tick loop: 60 sim steps/s, snapshot every 2nd tick
```

The **same** `game-sim.js` module runs in browser (local mode) and Node (server) — one source of truth for rules, zero drift.

### 6.2 Wire Protocol (v1)

| Dir | Msg                            | Payload (abridged)                                                                        |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| C→S | `hello`                        | `{guestId, nick, token?}`                                                                 |
| S→C | `session`                      | `{token, youSeat: null}`                                                                  |
| C→S | `create` / `join` / `quick`    | `{code?}`                                                                                 |
| S→C | `room`                         | `{code, seats:[{nick,ping}...], youSeat}`                                                 |
| C→S | `ready`                        | —                                                                                         |
| S→C | `countdown`                    | `{t: 3..0}`                                                                               |
| C→S | `input`                        | `{seq, m: 6-bit mask}` @30Hz                                                              |
| S→C | `snapshot`                     | `{tick, p:[{x,y,hp,dash,shld,ammo,inv}×2], b:[{x,y,o}...] , pk:[...], score, time}` @30Hz |
| S→C | `roundEnd` / `matchEnd`        | winner, reason                                                                            |
| C→S | `rematchReq` / S→C `rematchOk` | handshake both seats                                                                      |
| C→S | `forfeit` / S→C `peerLeft`     | grace countdown if disconnect                                                             |
| C↔S | `ping`/`pong`                  | RTT display per player                                                                    |

Bytes: snapshot ≈ 200-400 B → **≤ 25 KB/s down per client**. Input ≈ 40 B @30Hz.

### 6.3 Server Rules (authoritative, non-negotiable)

- Client input messages are **6 booleans**. Positions, bullets, damage, pickups — computed server-side only. A client claiming `x:5000` is ignored by construction.
- Server validates: message rate, tick seq monotonicity, room membership before any game message.
- Disconnect → seat frozen 20 s (`peerLeft` + reconnect window keyed on guestId+token) → then round forfeited, room closed.
- Server-side `Math.random()` via `match.seed`, broadcast at `room` time → both clients render identical walls/pickups.

### 6.4 Client Feel (the 30Hz trick)

1. **Own-player prediction:** apply local input immediately at 60fps client-side; on each snapshot, if own pos differs > ε from server, smooth-lerp (reconciliation, ~200ms). Own movement feels instant.
2. **Remote player + bullets:** pure interpolation between last two snapshots (100ms buffer). No prediction (bullet speeds are moderate; 30Hz interpolation looks smooth).
3. **Hit feedback:** client plays particles/effects optimistically; authoritative HP comes from snapshots.

---

## 7. Feature Checklist ("all features of online gameplay")

| Feature                                  | v1      | Mechanism                                                                                               |
| ---------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| Play anyone worldwide                    | ✅      | Quick Match global queue                                                                                |
| Private match with a friend              | ✅      | Room code + share URL                                                                                   |
| Nicknames                                | ✅      | sanitized strings, per-room                                                                             |
| Ping display                             | ✅      | ping/pong per seat                                                                                      |
| Synchronized countdown/rounds/first-to-5 | ✅      | server-driven states                                                                                    |
| Forfeit                                  | ✅      | existing`forfeit` flow → server                                                                         |
| Disconnect grace + reconnect             | ✅      | 20s window, token resume                                                                                |
| Rematch (side-swap)                      | ✅      | handshake, seats swap colors                                                                            |
| Anti-cheat (movement/damage)             | ✅      | authority model                                                                                         |
| Chat                                     | ❌ v1.1 | quick-messages only (fixed strings, rate-limited) — free-text chat = moderation burden, skip for guests |
| Spectators / tournaments / ELO           | ❌      | post-login feature; guest-only scope ends here                                                          |
| Region select                            | ❌ v2   | single region v1; see §8                                                                                |

---

## 8. Hosting: Render Now, Cloudflare DO Later

|           | Render free (ADR 0001)    | Cloudflare Durable Objects                                               |
| --------- | ------------------------- | ------------------------------------------------------------------------ |
| WS        | ✅                        | ✅ (with hibernation)                                                    |
| Always-on | ❌ spins down 15 min idle | ✅                                                                       |
| Cost      | $0                        | $0 tight (100k msg/day ≈ 7 matches/day) → $5/mo Workers Paid comfortable |
| Fit       | Fine for v1 launch        | One DO per room = perfect room primitive at scale                        |

**Decision:** ship v1 on Render per existing ADR — zero new infra, `render.yaml` is ready, deploy plan already documented (`docs/reasonix/plans/nox-render-deploy.md`). Migrate to DO **when** daily matches make free-tier message caps or cold starts a real complaint. The `ws` server code moves as-is conceptually; only transport wiring changes. Record as an ADR addendum at migration time, not before.

---

## 9. Security Gate (guest = untrusted)

- [ ] All state mutations server-side; clients never send positions/damage
- [ ] `wss://` only; Origin check on WS upgrade
- [ ] Token: HMAC-signed, 12h TTL, no PII; never logged
- [ ] Rate limits: token issuance, room create, per-socket msgs, queue joins
- [ ] Nickname sanitized (control chars stripped, length cap, `textContent` rendering — no innerHTML)
- [ ] Flood → kick; oversized frames → close 1009
- [ ] No secrets in repo; Render env vars for `WS_SECRET`/`PORT`
- [ ] DoS: one room per code, 2 seats max, queue capped (e.g., 100 waiting)

---

## 10. Implementation Phases (each independently shippable)

| Phase                         | Deliverable                                                                                                 | Verify                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **0. Sim split**              | `game-sim.js` (pure) + `game-view.js` + `input.js`; local 1v1 unchanged                                     | Local 1v1 plays identically;`node --test` sim unit tests (server test harness already exists) |
| **1. WS + rooms + guests**    | `backend/server.js` + `ws` dep; RoomManager; session tokens; lobby UI on `/play/online` (create/join/quick) | Two browser tabs join a room, see each other's nickname/ping                                  |
| **2. Server sim + snapshots** | Headless`game-sim.js` on server; client `net-bridge.js` renders snapshots; walls from `seed`                | Full match playable tab↔tab, first-to-5, scoreboard correct                                   |
| **3. Feel + robustness**      | Own-player prediction/reconciliation; disconnect grace; rematch; forfeit                                    | Kill network tab mid-match → 20s grace → loss; rematch swaps colors                           |
| **4. Ship hardening**         | Rate limits, flood kick,`/health` warm-ping on page load, latency meter                                     | Load test 2×50 matches simulated;`npm test` green; deploy Render + verify                     |

Estimate weighting: **Phase 0 ≈ 60% of total effort** (surgical extraction from a 3,200-line monolith). Phases 1-4 are incremental and low-risk once the sim is pure.

---

## 11. Risks

| Risk                                    | Impact   | Mitigation                                                                             |
| --------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| Sim extraction breaks local 1v1         | High     | Phase 0 is behavior-preserving; screenshot + manual parity checklist before proceeding |
| Cross-continent latency feels bad       | Medium   | Own-movement prediction; set expectation ("regional server v1"); v2 DO edge            |
| Render free cold start                  | Medium   | Page-load warm ping; ADR documents DO path                                             |
| Render free tier egress/limits at scale | Low (v1) | Snapshot cap 30Hz; kick floods; migrate trigger defined in §8                          |
| Guest abuse (room spam, nick trolls)    | Low      | Per-IP caps; nick rules; no free-text chat in v1                                       |

---

_Prepared from verified repo inventory (backend zero-dep server, ADRs 0001/0002, game-logic.js structure). No implementation started; no infra changed._
