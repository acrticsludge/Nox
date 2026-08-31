// T5: RoomManager + matchmaking — create / join(5-char code) / quick FIFO queue.
import crypto from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 5;

export function attachRooms(server, net, opts = {}) {
  const queueCap = opts.queueCap ?? 100;
  const createCap = opts.createCap ?? 5;
  const createWindowMs = opts.createWindowMs ?? 60 * 60 * 1000;
  const graceMs = opts.graceMs ?? 20000;
  const genCode = opts.genCode || (() => {
    let s = '';
    for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    return s;
  });

  const rooms = new Map();          // code -> { code, seats:[ws|null, ws|null], seed, createdAt }
  const queue = [];                 // waiting sockets (FIFO)
  const createsByIp = new Map();    // ip -> { count, windowStart }

  const send = (ws, obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };

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
    });
  }

  function broadcastRoom(room) {
    for (const s of room.seats) if (s) sendRoom(s, room);
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
    };
    rooms.set(code, room);
    for (const s of room.seats) if (s) net.roomOf.set(s, code);
    broadcastRoom(room);
    return room;
  }

  function leave(ws, notifyPeer = true) {
    const code = net.roomOf.get(ws);
    if (!code) return false;
    net.roomOf.delete(ws);
    const room = rooms.get(code);
    if (!room) return false;
    const i = room.seats.indexOf(ws);
    if (i !== -1) room.seats[i] = null;
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
        const slot = room.seats.indexOf(null);
        if (slot === -1) { send(ws, { type: 'roomError', reason: 'room full' }); return; }
        room.seats[slot] = ws;
        net.roomOf.set(ws, code);
        broadcastRoom(room);
        return;
      }
      case 'quick': {
        if (net.roomOf.has(ws)) { send(ws, { type: 'roomError', reason: 'already in room' }); return; }
        if (queueIndex(ws) !== -1) { send(ws, { type: 'queued', position: queueIndex(ws) + 1 }); return; }
        if (queue.length >= queueCap) { send(ws, { type: 'roomError', reason: 'queue full' }); return; }
        const partner = queue.shift();
        if (partner && partner.readyState === 1 && !net.roomOf.has(partner)) {
          makeRoom(partner, ws);
        } else {
          queue.push(ws);
          send(ws, { type: 'queued', position: queue.length });
        }
        return;
      }
      case 'leave': {
        leave(ws);
        return;
      }
    }
  });

  net.wss.on('nox:close', ws => {
    const i = queueIndex(ws);
    if (i !== -1) queue.splice(i, 1);
    leave(ws);
  });

  return { rooms, queue, leave, createsByIp };
}
