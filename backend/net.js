// T4: WebSocket layer — origin check, guest sessions (HMAC tokens), rate limits.
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';

const MAX_MSG_BYTES = 1024;
const RATE_LIMIT = 60;          // msgs per window per socket
const RATE_WINDOW_MS = 1000;
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

export function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verifyToken(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expect = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

export function sanitizeNick(raw) {
  if (typeof raw !== 'string') return null;
  // strip control chars + whitespace collapse, cap 16
  const s = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().slice(0, 16);
  return s.length >= 2 ? s : null;
}
function validGuestId(g) { return typeof g === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(g); }

function isAllowedOrigin(origin, host, extra, isDev) {
  if (!origin) return false;
  let o; try { o = new URL(origin); } catch { return false; }
  if (o.host === host) return true;
  // P2-02: the localhost allowance is development-only; production relies on
  // the explicit allowlist (o.host === host + WS_EXTRA_ORIGINS)
  if (isDev && (o.hostname === 'localhost' || o.hostname === '127.0.0.1' || o.hostname === '[::1]')) return true;
  if (extra && extra.includes(origin)) return true;
  return false;
}

export function attachNet(server, opts = {}) {
  const isDev = (process.env.NODE_ENV || 'development') !== 'production';
  // P0-03: a production deploy without WS_SECRET must fail fast, never fall
  // back to the public dev literal
  if (!opts.secret && !process.env.WS_SECRET) {
    if (!isDev) throw new Error('WS_SECRET is required in production — refusing to start with the development fallback secret.');
    console.warn('[nox] WS_SECRET not set — using the development-only fallback secret (never ship this).');
  }
  const secret = opts.secret || process.env.WS_SECRET || 'nox-dev-secret';
  const extraOrigins = opts.extraOrigins || (process.env.WS_EXTRA_ORIGINS ? process.env.WS_EXTRA_ORIGINS.split(',') : []);
  // P2-03: trusted-proxy IP policy. Behind a known reverse proxy (Render),
  // req.socket.remoteAddress is the proxy, so per-IP limits would lump every
  // guest into one bucket. Forwarded IPs are honored ONLY when
  // TRUST_PROXY=1 is explicitly set in the environment — otherwise the
  // socket address is used and the header is ignored (spoof-safe default).
  const trustProxy = process.env.TRUST_PROXY === '1' || opts.trustProxy === true;
  const clientIp = (req) => {
    if (trustProxy) {
      const fwd = String(req.headers['x-forwarded-for'] || '');
      const first = fwd.split(',')[0].trim();
      if (first) return first;
    }
    return req.socket.remoteAddress || 'unknown';
  };
  const wss = new WebSocketServer({ noServer: true });
  const sessions = new Map();       // ws -> {guestId, nick, token, authed}
  const roomOf = new Map();         // ws -> roomCode (T5 registers itself here)

  server.on('upgrade', (req, socket, head) => {
    // P2-17: WebSocket upgrades are only served on /ws
    const path = (req.url || '').split('?')[0];
    if (path !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const origin = req.headers.origin || '';
    if (!isAllowedOrigin(origin, req.headers.host, extraOrigins, isDev)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws, req) => {
    ws._noxIp = clientIp(req);
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    // TCP optimizations for lower latency
    if (ws._socket) {
      ws._socket.setNoDelay(true);       // Disable Nagle's algorithm
      ws._socket.setKeepAlive(true, 10000); // Keep-alive every 10s
    }
    const rate = { count: 0, windowStart: Date.now() };
    ws._noxRate = rate;
    ws.on('message', data => {
      if (data.length > MAX_MSG_BYTES) { ws.close(1009, 'message too large'); return; }
      const now = Date.now();
      if (now - rate.windowStart >= RATE_WINDOW_MS) { rate.windowStart = now; rate.count = 0; }
      if (++rate.count > RATE_LIMIT) { ws.close(1008, 'rate limit'); return; }
      let msg;
      try {
        // Handle binary frames (input, ping)
        if (data instanceof Buffer) {
          const buf = new Uint8Array(data);
          // Binary input frame: [type:1][seq:1][mask:1]
          if (buf.length === 3 && buf[0] === 0x01) {
            msg = { type: 'input', seq: buf[1], m: buf[2] };
          }
          // Binary ping: [type:1][timestamp:8]
          else if (buf.length === 9 && buf[0] === 0x03) {
            const view = new DataView(buf.buffer, buf.byteOffset + 1);
            msg = { type: 'ping', t: Number(view.getBigUint64(0, false)) };
          }
          // Binary pong from client (we don't expect this, but handle it)
          else if (buf.length === 9 && buf[0] === 0x04) {
            const view = new DataView(buf.buffer, buf.byteOffset + 1);
            msg = { type: 'pong', t: Number(view.getBigUint64(0, false)) };
          }
          else {
            msg = JSON.parse(data.toString('utf8'));
          }
        } else {
          msg = JSON.parse(data.toString('utf8'));
        }
      } catch { ws.close(1008, 'bad json'); return; }
      if (!msg || typeof msg.type !== 'string') { ws.close(1008, 'bad frame'); return; }
      const sess = sessions.get(ws);
      if (!sess) {
        if (msg.type !== 'hello') { ws.close(1008, 'expected hello'); return; }
        const nick = sanitizeNick(msg.nick);
        if (!nick || !validGuestId(msg.guestId)) { ws.close(1008, 'bad hello'); return; }
        const token = signToken({ guestId: msg.guestId, nick, exp: Date.now() + TOKEN_TTL_MS }, secret);
        sessions.set(ws, { guestId: msg.guestId, nick, token, authed: true });
        ws.send(JSON.stringify({ type: 'session', token, nick }));
        wss.emit('nox:authed', ws, sessions.get(ws));
        return;
      }
      if (!sess.authed) return;
      // T13: one app-level ping protocol — client measures RTT to this reply
      // Respond with binary pong if ping was binary, else JSON
      if (msg.type === 'ping') {
        const clientTs = msg.t;
        const buf = Buffer.alloc(9);
        buf[0] = 0x04; // MSG_TYPE.PONG
        const view = new DataView(buf.buffer);
        view.setBigUint64(1, BigInt(clientTs), false);
        ws.send(buf);
        return;
      }
      wss.emit('nox:message', ws, sess, msg);
    });
    ws.on('close', () => { wss.emit('nox:close', ws, sessions.get(ws)); sessions.delete(ws); roomOf.delete(ws); });
    ws.on('error', () => { try { ws.close(); } catch {} });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { try { ws.terminate(); } catch {} continue; }
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
  }, 30000);
  if (heartbeat.unref) heartbeat.unref();
  wss.on('close', () => clearInterval(heartbeat));

  return { wss, sessions, roomOf, secret, verifyToken: t => verifyToken(t, secret), sign: p => signToken(p, secret) };
}
