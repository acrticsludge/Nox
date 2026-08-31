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

function isAllowedOrigin(origin, host, extra) {
  if (!origin) return false;
  let o; try { o = new URL(origin); } catch { return false; }
  if (o.host === host) return true;
  if (o.hostname === 'localhost' || o.hostname === '127.0.0.1') return true;
  if (extra && extra.includes(origin)) return true;
  return false;
}

export function attachNet(server, opts = {}) {
  const secret = opts.secret || process.env.WS_SECRET || 'nox-dev-secret';
  const extraOrigins = opts.extraOrigins || (process.env.WS_EXTRA_ORIGINS ? process.env.WS_EXTRA_ORIGINS.split(',') : []);
  const wss = new WebSocketServer({ noServer: true });
  const sessions = new Map();       // ws -> {guestId, nick, token, authed}
  const roomOf = new Map();         // ws -> roomCode (T5 registers itself here)

  server.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin || '';
    if (!isAllowedOrigin(origin, req.headers.host, extraOrigins)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });

  wss.on('connection', ws => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    const rate = { count: 0, windowStart: Date.now() };
    ws._noxRate = rate;
    ws.on('message', data => {
      if (data.length > MAX_MSG_BYTES) { ws.close(1009, 'message too large'); return; }
      const now = Date.now();
      if (now - rate.windowStart >= RATE_WINDOW_MS) { rate.windowStart = now; rate.count = 0; }
      if (++rate.count > RATE_LIMIT) { ws.close(1008, 'rate limit'); return; }
      let msg;
      try { msg = JSON.parse(data.toString('utf8')); } catch { ws.close(1008, 'bad json'); return; }
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

  return { wss, sessions, roomOf, secret, verifyToken: t => verifyToken(t, secret) };
}
