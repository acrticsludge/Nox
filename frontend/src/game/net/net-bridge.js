// T6 (part 1): client WebSocket bridge — guest identity, hello handshake, typed events.
// Consumed by /play/online UI; later feeds snapshots into game-logic's mirror seam (T8).

const GUEST_KEY = 'nv_guest_id';

export function getGuestId() {
  let id = localStorage.getItem(GUEST_KEY);
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    const b = new Uint8Array(12);
    crypto.getRandomValues(b);
    id = 'g-' + Array.from(b, x => x.toString(36).padStart(2, '0')).join('').slice(0, 22);
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

export function getNick() {
  return localStorage.getItem('nv_nick') || '';
}

export function setNick(nick) {
  localStorage.setItem('nv_nick', nick);
}

export class NetBridge {
  constructor() {
    this.handlers = new Map();
    this.ws = null;
    this.authed = false;
    this.pingMs = 0;
    this._pingTimer = null;
    this._pongBound = null;
    this.reconnectCred = null;   // signed {roomCode, seat, token} from the server
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }

  _emit(type, data) {
    const set = this.handlers.get(type);
    if (set) for (const fn of set) fn(data);
  }

  send(type, data = {}) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type, ...data }));
  }

  connect(url) {
    // T13: single-flight — a connect() while one is pending returns the same promise
    if (this.ws && this.ws.readyState === 0 && this._connecting) return this._connecting;
    this._connecting = new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      const to = setTimeout(() => reject(new Error('connection timeout')), 8000);
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'hello', guestId: getGuestId(), nick: getNick() || 'Player' }));
      });
      ws.addEventListener('message', ev => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m.type === 'session') {
          clearTimeout(to);
          this.authed = true;
          this._startPing();
          resolve(m);
        }
        if (m.type === 'reconnectCred') {
          // Task 10: ephemeral seat credential — kept only in memory for the
          // active room, never persisted or logged
          this.reconnectCred = { roomCode: m.roomCode, seat: m.seat, token: m.token, expiresAt: m.expiresAt };
        }
        this._emit(m.type, m);
      });
      ws.addEventListener('close', ev => {
        clearTimeout(to);
        // T13: a socket that closed before the session handshake must reject
        // the pending connect() — the lobby must never stay locked
        if (!this.authed) {
          const err = new Error(ev.code === 1008 ? 'server refused connection (origin/secret)' : 'connection closed before session');
          err.code = ev.code;
          reject(err);
        }
        this.authed = false;
        this._stopPing();
        this._emit('disconnected', { code: ev.code });
      });
      ws.addEventListener('error', () => { /* close event follows */ });
    });
    this._connecting.finally(() => { this._connecting = null; });
    return this._connecting;
  }

  _startPing() {
    this._stopPing();
    if (this._pongBound) { this.off('pong', this._pongBound); }
    this._pongBound = () => { this.pingMs = Math.round(performance.now() - (this._lastPingSent || 0)); this._emit('pingChanged', this.pingMs); };
    this.on('pong', this._pongBound);
    this._pingTimer = setInterval(() => {
      this._lastPingSent = performance.now();
      this.send('ping');
    }, 5000);
  }

  off(type, fn) { this.handlers.get(type)?.delete(fn); }

  _stopPing() {
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
  }

  close() {
    this._stopPing();
    this.reconnectCred = null;   // leaving: the seat credential dies with the session
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
  }
}
