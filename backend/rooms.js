// T5: RoomManager + matchmaking — create / join(5-char code) / quick FIFO queue.
import crypto from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 5;

export function attachRooms(server, net, opts = {}) {
  const queueCap = opts.queueCap ?? 100;
  const createCap = opts.createCap ?? 5;
  const createWindowMs = opts.createWindowMs ?? 60 * 60 * 1000;
  const graceMs = opts.graceMs ?? 20000;
  const reconnectTtlMs = opts.reconnectTtlMs ?? 60 * 60 * 1000;
  const genCode = opts.genCode || (() => {
    let s = '';
    for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    return s;
  });

  const rooms = new Map();          // code -> { code, seats:[ws|null, ws|null], seed, createdAt }
  const queue = [];                 // waiting sockets (FIFO)
  const createsByIp = new Map();    // ip -> { count, windowStart }
  // Task 10: seat reservations — code:seat -> { guestId, expiresAt } holds a
  // disconnected player's seat for graceMs; only their signed credential reclaims it
  const reservations = new Map();

  const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };

  // signed {guestId, roomCode, seat, exp} credential; only the same guest may
  // present it, and only back into the same room/seat
  function issueReconnectCredential(ws, room, seat) {
    const sess = net.sessions.get(ws);
    if (!sess) return;
    const token = net.sign({ guestId: sess.guestId, roomCode: room.code, seat, exp: Date.now() + reconnectTtlMs });
    room.credentials = room.credentials || {};
    room.credentials[seat] = { token, guestId: sess.guestId };
    send(ws, { type: 'reconnectCred', roomCode: room.code, seat, token, expiresAt: Date.now() + reconnectTtlMs });
  }

  function seatsView(room) {
    return room.seats.map(s => (s ? { nick: net.sessions.get(s)?.nick ?? 'guest', ping: s._noxPing ?? 0 } : null));
  }

  function sendRoom(ws, room) {
    send(ws, {
      type: 'room',
      code: room.code,
      youSeat: room.seats.indexOf(ws),
      seats: seatsView(room),
      seed: room.seed,
      rematchWait: room.state === 'rematchWait',   // Task 12: post-match room survives for mutual rematch
    });
  }

  function broadcastRoom(room) {
    for (const s of room.seats) if (s) sendRoom(s, room);
    if (room.seats.every(s => s) && !room.fullNotified) {
      room.fullNotified = true;
      opts.onRoomFull?.(room);
    }
  }

  function makeRoom(wsA, wsB) {
    let code = '';
    for (let tries = 0; tries < 50; tries++) {
      code = genCode();
      if (!rooms.has(code)) break;
      code = '';
    }
    if (!code || rooms.has(code)) return null; // collision retry exhausted
    const room = {
      code,
      seats: [wsA, wsB],
      seed: crypto.randomBytes(4).readUInt32LE(0),
      createdAt: Date.now(),
      state: 'waiting',
    };
    rooms.set(code, room);
    for (const s of room.seats) if (s) net.roomOf.set(s, code);
    // Task 10: every seated player gets a signed reconnect credential
    for (let i = 0; i < 2; i++) if (room.seats[i]) issueReconnectCredential(room.seats[i], room, i);
    broadcastRoom(room);
    return room;
  }

  function leave(ws, notifyPeer = true, reserve = true) {
    const code = net.roomOf.get(ws);
    if (!code) return false;
    net.roomOf.delete(ws);
    const room = rooms.get(code);
    if (!room) return false;
    const i = room.seats.indexOf(ws);
    if (i !== -1) {
      room.seats[i] = null;
      // Task 10: a DISCONNECT reserves the seat for the departing guest
      // (grace window); a deliberate leave frees it immediately
      const sess = net.sessions.get(ws);
      if (reserve && sess && room.credentials?.[i]) {
        room.credentials[i].token = net.sign({ guestId: sess.guestId, roomCode: code, seat: i, exp: Date.now() + reconnectTtlMs });
        reservations.set(code + ':' + i, { guestId: sess.guestId, expiresAt: Date.now() + graceMs });
      }
    }
    if (room.seats.every(s => !s)) {
      rooms.delete(code);
    } else if (notifyPeer) {
      const peer = room.seats.find(s => s);
      if (peer) send(peer, { type: 'peerLeft', graceMs });
    }
    return true;
  }

  const queueIndex = ws => queue.indexOf(ws);

  net.wss.on('nox:message', (ws, sess, msg) => {
    const ip = ws._noxIp || 'unknown';

    switch (msg.type) {
      case 'create': {
        if (net.roomOf.has(ws)) { send(ws, { type: 'roomError', reason: 'already in room' }); return; }
        const now = Date.now();
        let rl = createsByIp.get(ip);
        if (!rl || now - rl.windowStart >= createWindowMs) { rl = { count: 0, windowStart: now }; createsByIp.set(ip, rl); }
        if (++rl.count > createCap) { send(ws, { type: 'roomError', reason: 'too many rooms, try later' }); return; }
        makeRoom(ws, null);
        return;
      }
      case 'join': {
        if (net.roomOf.has(ws)) { send(ws, { type: 'roomError', reason: 'already in room' }); return; }
        const code = String(msg.code ?? '').toUpperCase();
        const room = rooms.get(code);
        if (!room) { send(ws, { type: 'roomError', reason: 'room not found' }); return; }
        const sess = net.sessions.get(ws);
        // Task 10: reconnect claim — the credential is a signed
        // {guestId, roomCode, seat, exp} minted at seat assignment; it must be
        // the caller's own guestId, bound to this room + seat, unexpired, and
        // the seat must still be reserved for that guest
        const rec = msg.reconnect;
        if (rec && typeof rec === 'object') {
          const t = net.verifyToken(String(rec.token || ''));
          const seat = Number(rec.seat);
          const resv = t && reservations.get(code + ':' + t.seat);
          const ok = t && t.guestId === sess?.guestId && t.roomCode === code
            && t.seat === seat && t.exp > Date.now()
            && room.seats[seat] === null && resv && resv.guestId === sess.guestId
            && Date.now() <= resv.expiresAt;
          if (!ok) { send(ws, { type: 'roomError', reason: 'reconnect failed' }); return; }
          room.seats[seat] = ws;
          net.roomOf.set(ws, code);
          reservations.delete(code + ':' + seat);
          broadcastRoom(room);
          send(ws, { type: 'rejoined', code, seat });
          return;
        }
        // seats reserved for a disconnected guest are invisible to everyone
        // else — they see 'room full' until the reservation expires
        const claimed = room.seats.map((s, i) => {
          if (s) return s;
          const resv = reservations.get(code + ':' + i);
          return resv && Date.now() <= resv.expiresAt ? 'reserved' : null;
        });
        const free = claimed.findIndex(s => s === null);
        if (free === -1) { send(ws, { type: 'roomError', reason: 'room full' }); return; }
        room.seats[free] = ws;
        net.roomOf.set(ws, code);
        issueReconnectCredential(ws, room, free);
        broadcastRoom(room);
        return;
      }
      case 'quick': {
        if (net.roomOf.has(ws)) { send(ws, { type: 'roomError', reason: 'already in room' }); return; }
        if (queueIndex(ws) !== -1) { send(ws, { type: 'queued', position: queueIndex(ws) + 1 }); return; }
        if (queue.length >= queueCap) { send(ws, { type: 'roomError', reason: 'queue full' }); return; }
        // Find a valid partner from the queue (skip disconnected or already-in-room sockets)
        let partner = null;
        const requeue = [];
        while (queue.length > 0 && !partner) {
          const candidate = queue.shift();
          if (candidate && candidate.readyState === 1 && !net.roomOf.has(candidate)) {
            partner = candidate;
          } else if (candidate && candidate.readyState === 1) {
            // Candidate is connected but already in a room (race condition) - requeue at front
            requeue.push(candidate);
          }
          // Disconnected candidates are dropped (not requeued)
        }
        // Put back any in-room candidates at the front (they'll be cleaned by sweep)
        for (let i = requeue.length - 1; i >= 0; i--) queue.unshift(requeue[i]);
        if (partner) {
          makeRoom(partner, ws);
        } else {
          queue.push(ws);
          send(ws, { type: 'queued', position: queue.length });
        }
        return;
      }
      case 'leave': {
        leave(ws, true, false);   // deliberate leave: no seat reservation
        return;
      }
      case 'rematchReq': {
        // Task 12 (P0-04/P1-04): rematch only from the server-owned
        // post-match state — never while a match is live, never a second sim
        const code = net.roomOf.get(ws);
        const room = code && rooms.get(code);
        if (!room) return;
        if (!room.seats.every(s => s)) { send(ws, { type: 'roomError', reason: 'opponent left the room' }); return; }
        if (room.match || room.state === 'playing') {
          send(ws, { type: 'roomError', reason: 'match in progress' });
          return;
        }
        if (room.state !== 'rematchWait') return;
        room.rematch = room.rematch || new Set();
        room.rematch.add(ws);
        if (room.rematch.size === 2) {
          room.rematch.clear();
          room.fullNotified = false;
          room.state = 'waiting';
          room.seed = crypto.randomBytes(4).readUInt32LE(0);
          broadcastRoom(room);   // re-fires onRoomFull -> startMatch with new seed
        } else {
          const peer = room.seats.find(s => s && s !== ws);
          if (peer) send(peer, { type: 'rematchReq' });
        }
        return;
      }
    }
  });

  net.wss.on('nox:close', ws => {
    const i = queueIndex(ws);
    if (i !== -1) queue.splice(i, 1);
    leave(ws);
  });

  // Task 14: bounded state — reservations, stale queues, half-empty waiting
  // rooms, and limiter entries all expire; nothing grows without bound
  const sweep = () => {
    const now = Date.now();
    for (const [key, resv] of reservations) if (now > resv.expiresAt) reservations.delete(key);
    for (const [ip, rl] of createsByIp) if (now - rl.windowStart >= createWindowMs) createsByIp.delete(ip);
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].readyState !== 1) queue.splice(i, 1);
    const roomTtlMs = Math.max(graceMs * 3, 60000);   // generous but bounded
    for (const [code, room] of rooms) {
      const age = now - room.createdAt;
      if (room.match) continue;                       // active match: owned by match.js
      const abandoned = room.seats.filter(s => s && s.readyState === 1).length < 2;
      if (abandoned && age > roomTtlMs) {
        for (const s of room.seats) if (s) { net.roomOf.delete(s); try { s.close(1001, 'room expired'); } catch {} }
        rooms.delete(code);
      }
    }
  };
  const sweepTimer = setInterval(sweep, 5000);
  if (sweepTimer.unref) sweepTimer.unref();

  return { rooms, queue, leave, createsByIp, reservations, sendRoomTo: sendRoom };
}
