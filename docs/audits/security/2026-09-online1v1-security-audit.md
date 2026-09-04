# Online 1v1 Multiplayer — Security Audit

**Date:** 2026-09-04  
**Auditor:** Reasonix/Deepseek  
**Scope:** Full online 1v1 stack (frontend WS client, backend WS server, matchmaking, match sim, reconnection)

---

## Executive Summary

**Overall Risk: MEDIUM** — The system has strong security foundations (HMAC tokens, origin validation, rate limiting, input validation) but has several gaps that could be exploited by determined attackers. No critical vulnerabilities found, but several high/medium issues require remediation before production.

---

## Trust Boundary Analysis

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRUST BOUNDARIES                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  INTERNET                                                            │
│     │                                                                │
│     ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Vercel (Static Frontend)                                    │   │
│  │  - Serves online.astro (HTML/JS)                            │   │
│  │  - NO server-side logic for game                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│     │                                                                │
│     │ HTTPS + WSS                                                    │
│     ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Render Ohio (WebSocket Server)                               │   │
│  │  - /ws endpoint ONLY                                        │   │
│  │  - Origin check (prod: exact match; dev: localhost OK)      │   │
│  │  - Rate limit: 60 msg/s, 1024 bytes/frame                    │   │
│  │  - HMAC session tokens (12h TTL)                            │   │
│  │  - Signed reconnect credentials (1h TTL, guestId+room+seat) │   │
│  │  - TCP_NODELAY + KeepAlive                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Findings

### CRITICAL (0)

None found.

### HIGH (3)

#### H1: Reconnect Credential Replay Window (1 hour TTL)
**Location:** `backend/rooms.js:30-37`, `backend/net.js:10-27`
**Issue:** Reconnect credentials are valid for 1 hour (`reconnectTtlMs = 60*60*1000`). If an attacker captures a credential (via XSS, MITM, or compromised client), they can reclaim the seat for up to 1 hour.
**Impact:** Seat hijacking, match manipulation.
**Evidence:** Token includes `exp: Date.now() + reconnectTtlMs`. No rotation or single-use enforcement.
**Fix:** Reduce TTL to match grace period (20s) + small buffer, or implement single-use tokens with server-side tracking.

#### H2: No Replay Protection on Binary Input Frames
**Location:** `backend/match.js:232-239`, `frontend/src/game/net/binary-codec.js:25-41`
**Issue:** Input frames use 8-bit sequence number (`seq & 0xFF`). At 60Hz, sequence wraps every ~4.2 minutes. No server-side tracking of used sequence numbers within a window.
**Impact:** Attacker could replay old input frames to cause desync or manipulate movement.
**Evidence:** `st.seq = msg.seq` only checks `msg.seq <= st.seq` — doesn't prevent replay of old but higher sequence numbers after wrap.
**Fix:** Track received sequence numbers per seat with a sliding window (e.g., last 256), reject duplicates.

#### H3: Guest ID Generated Client-Side Without Server Verification
**Location:** `frontend/src/game/net/net-bridge.js:8-17`
**Issue:** `getGuestId()` generates ID client-side using `crypto.getRandomValues()`. Server accepts any valid-format guestId in hello message without verifying entropy or checking for collisions.
**Impact:** Attacker could choose predictable guestId, enabling targeted reconnection attacks or session fixation.
**Evidence:** Server only validates format `/^[A-Za-z0-9_-]{8,64}$/` in `net.js:35`.
**Fix:** Server should assign guestId on first connection, or verify client-provided ID has sufficient entropy (min 128 bits).

### MEDIUM (6)

#### M1: Origin Validation Bypass in Development
**Location:** `backend/net.js:37-46`
**Issue:** `isAllowedOrigin()` allows `localhost`/`127.0.0.1`/`[::1]` in development. If deployed with `NODE_ENV=development` (common misconfiguration), any origin can connect by spoofing `Origin: http://localhost:3000` header.
**Impact:** CSRF-style attacks, unauthorized connections in misconfigured prod.
**Evidence:** Line 43: `if (isDev && (o.hostname === 'localhost' || ...)) return true;`
**Fix:** Add explicit allowlist even in dev, or require `WS_EXTRA_ORIGINS` in all environments.

#### M2: No Per-IP Rate Limiting on WebSocket Connections
**Location:** `backend/net.js:107-111` (per-socket), `backend/rooms.js:119-122` (create only)
**Issue:** Rate limiting is per-socket (60 msg/s). No limit on total connections from single IP. Attacker can open many sockets to exhaust server resources.
**Impact:** DoS via connection exhaustion (Render free tier has low connection limits).
**Fix:** Add IP-based connection rate limiting at HTTP upgrade level.

#### M3: Seat Reservation Grace Period Not Configurable Per-Environment
**Location:** `backend/rooms.js:11` (hardcoded 20000ms)
**Issue:** `graceMs = 20000` hardcoded. No way to adjust for different network conditions (mobile, high latency).
**Impact:** Legitimate players on high-latency connections may lose seat during brief disconnects.
**Fix:** Make configurable via environment variable.

#### M4: Binary Protocol Version Not Negotiated
**Location:** `backend/net.js:115-133`, `frontend/src/game/net/binary-codec.js`
**Issue:** Binary frame types hardcoded. No version negotiation in hello handshake. If protocol changes, clients/servers mismatch silently.
**Impact:** Silent failures, desync, potential downgrade attacks.
**Fix:** Add protocol version in hello, reject incompatible versions.

#### M5: No Input Sanitization on Nickname Beyond Length/Control Chars
**Location:** `backend/net.js:29-34`, `frontend/src/pages/play/online.astro:203`
**Issue:** Nickname sanitization only strips control chars and limits to 16 chars. No Unicode normalization, no profanity filter, no homoglyph detection.
**Impact:** Impersonation via lookalike characters, UI breakage via RTL overrides, XSS if rendered unsafely (though React text nodes protect).
**Fix:** Add Unicode normalization (NFC), directional character filtering, allowlist safe characters.

#### M6: WebSocket Close Codes Not Standardized
**Location:** `backend/net.js:82-90, 108-111, 138-139`
**Issue:** Custom close codes used (1008, 1009) but not consistently documented. No mapping to user-facing error messages.
**Impact:** Debugging difficulty, inconsistent client handling.
**Fix:** Document close code meanings, use standard codes where possible (1000 normal, 1001 going away, 1002 protocol error, 1003 unsupported data, 1008 policy violation, 1009 too big, 1011 server error).

### LOW (8)

#### L1: No CSP Header on WebSocket Upgrade Response
**Location:** `backend/server.js:13-28`
**Issue:** HTTP responses lack Content-Security-Policy header. While WS upgrade responses don't execute script, defense in depth.
**Fix:** Add CSP header to all HTTP responses.

#### L2: No HSTS Header
**Location:** `backend/server.js:13-28`
**Issue:** HTTP responses lack Strict-Transport-Security. Render provides TLS termination, but HSTS still recommended.
**Fix:** Add HSTS header.

#### L3: Ping/Pong Timestamp Uses Client Clock (No Server Validation)
**Location:** `backend/net.js:151-160`, `frontend/src/game/net/binary-codec.js:44-71`
**Issue:** Server echoes client timestamp in pong without validating it's recent. Client RTT measurement trusts server echo.
**Impact:** Client could report artificially low RTT by sending future timestamps.
**Fix:** Server validates `clientTs` is within reasonable window of server time.

#### L4: Reconnect Credential Not Invalidated on Successful Rejoin
**Location:** `backend/rooms.js:146-150`
**Issue:** After successful reconnect, credential remains valid until expiry. Could be reused if captured.
**Fix:** Delete credential on successful reconnect (`delete room.credentials[seat]`).

#### L5: No Audit Logging of Security Events
**Location:** All backend files
**Issue:** No structured logging of: failed auth, rate limit hits, reconnect failures, seat reclaim attempts.
**Impact:** No visibility into attacks.
**Fix:** Add structured logging (JSON) for security-relevant events.

#### L6: Queue Position Information Leak
**Location:** `backend/rooms.js:177`, `frontend/src/pages/play/online.astro:472`
**Issue:** Queue position broadcast to all queued players. Could be used to infer player count/timing.
**Impact:** Minor information disclosure.
**Fix:** Consider if queue position is necessary UX or can be replaced with "searching...".

#### L7: Room Code Generation Uses `crypto.randomInt` (Good) But No Entropy Check
**Location:** `backend/rooms.js:13-17`
**Issue:** `genCode()` uses `crypto.randomInt` which is cryptographically secure. Good. But no validation that generated code hasn't been used recently (collision retry only checks current rooms map).
**Impact:** Extremely low — 32^5 = 33M combinations, collision unlikely.
**Fix:** Current implementation is acceptable.

#### L8: Frontend Sends Nickname in Plaintext in Hello
**Location:** `frontend/src/game/net/net-bridge.js:70`
**Issue:** Nickname sent in hello message over WSS. Encrypted in transit, but visible in browser DevTools/network tab.
**Impact:** None (nickname is public in-game anyway).
**Fix:** Acceptable as-is.

---

## Attack Surface Mapping

| Vector | Entry Point | Mitigation | Gap |
|--------|-------------|------------|-----|
| WS Connection | `/ws` upgrade | Origin check, rate limit | Dev localhost bypass |
| Hello Message | `type: 'hello'` | GuestId format, HMAC token | Client-chosen guestId |
| Room Create | `type: 'create'` | Per-IP cap (3/hr) | No total IP connection limit |
| Room Join | `type: 'join'` | Code format, seat check | Code enumeration possible (5-char) |
| Quick Match | `type: 'quick'` | Queue cap (100) | Queue position info leak |
| Input Frames | `type: 'input'` | Seq monotonic, 6-bit mask | Seq wrap replay (4.2 min) |
| Reconnect | `reconnect` in join | Signed token, seat binding | 1h TTL, no single-use |
| Forfeit | `type: 'forfeit'` | Seat ownership | None needed |
| Rematch | `type: 'rematchReq'` | State check (`rematchWait`) | None needed |

---

## Recommendations Priority Order

1. **H1** — Reduce reconnect credential TTL to 30s (grace + buffer)
2. **H2** — Add sequence number replay protection (sliding window)
3. **H3** — Server-assigned guestId or entropy verification
4. **M1** — Require explicit allowlist in all environments
5. **M2** — Add IP-based connection rate limiting
6. **M3** — Make grace period configurable
7. **M4** — Add protocol version negotiation
8. **M5** — Enhanced nickname sanitization
9. **M6** — Document close codes
10. **L1-L8** — Defense in depth improvements

---

## Test Coverage Gaps (Security)

| Scenario | Covered? | Test File |
|----------|----------|-----------|
| Valid hello → session token | ✅ | net.test.js |
| Invalid origin (prod) | ✅ | policy.test.js |
| Invalid origin (dev) | ✅ | policy.test.js |
| Non-hello first message | ✅ | net.test.js |
| Bad nickname | ✅ | net.test.js |
| Rate limit >60/s | ✅ | net.test.js |
| Oversized frame | ✅ | net.test.js |
| Token sign/verify/expiry | ✅ | net.test.js |
| Reconnect credential issued | ✅ | reconnect.test.js |
| Forged reconnect token rejected | ✅ | reconnect.test.js |
| Mismatched seat in token | ✅ | reconnect.test.js |
| **Reconnect token replay** | ❌ | **MISSING** |
| **Input seq replay after wrap** | ❌ | **MISSING** |
| **GuestId collision/entropy** | ❌ | **MISSING** |
| **Multiple connections from same IP** | ❌ | **MISSING** |
| **Protocol version mismatch** | ❌ | **MISSING** |

---

## Compliance Notes

- **OWASP A01 (Broken Access Control):** ✅ Seat ownership enforced, room join validates seat
- **OWASP A02 (Cryptographic Failures):** ✅ HMAC-SHA256 tokens, crypto.randomValues
- **OWASP A03 (Injection):** ✅ JSON parsing only, no SQL/eval
- **OWASP A04 (Insecure Design):** ⚠️ Dev origin bypass, long credential TTL
- **OWASP A05 (Security Misconfiguration):** ⚠️ Missing CSP/HSTS, dev defaults
- **OWASP A06 (Vulnerable Components):** ✅ Minimal deps, `ws` library only
- **OWASP A07 (Auth Failures):** ✅ Session tokens, no passwords
- **OWASP A08 (Software Integrity):** ⚠️ No supply chain verification documented
- **OWASP A09 (Logging Failures):** ❌ No security event logging
- **OWASP A10 (SSRF):** ✅ No outbound requests from server

---

## Verification Commands

```bash
# Run all backend tests (should pass 42/42)
cd backend && npm test

# Run security-specific tests
cd backend && node --test test/net.test.js test/policy.test.js test/reconnect.test.js

# Check for secrets in code
cd .. && git log --all --oneline --grep="secret\|password\|token\|key" -i

# Dependency audit
cd backend && npm audit --audit-level=high
cd ../frontend && npm audit --audit-level=high
```

---

## Sign-Off

- [ ] All CRITICAL issues resolved
- [ ] All HIGH issues resolved or risk accepted with mitigation
- [ ] MEDIUM issues triaged with target dates
- [ ] Security test gaps filled
- [ ] Documentation updated