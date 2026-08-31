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
    return new Promise((resolve, reject) => {
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
        this._emit(m.type, m);
      });
      ws.addEventListener('close', ev => {
        clearTimeout(to);
        this.authed = false;
        this._stopPing();
        this._emit('disconnected', { code: ev.code });
      });
      ws.addEventListener('error', () => { /* close event follows */ });
    });
  }

  _startPing() {
    this._stopPing();
    this._pingTimer = setInterval(() => {
      this._lastPingSent = performance.now();
      this.send('ping');
    }, 5000);
    this.on('pong', () => { this.pingMs = Math.round(performance.now() - (this._lastPingSent || 0)); this._emit('pingChanged', this.pingMs); });
  }

  _stopPing() {
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
  }

  close() {
    this._stopPing();
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
  }
}
