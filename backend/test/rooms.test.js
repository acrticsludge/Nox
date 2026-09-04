// T5: room lifecycle — create/join/quick pairing, caps, collision retry, cleanup.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';

import { attachNet } from '../net.js';
import { attachRooms } from '../rooms.js';

const PORT = 3105;
let server, net, rooms;
let genCodes = [];
let codeN = 0;

// Server now assigns guestId; hello only needs nick
function hello(nick) {
  return JSON.stringify({ type: 'hello', nick });
}

function send(ws, obj) { ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); }

// Per-socket inbox: every message is buffered, so nothing is lost between expectMsg calls.
const inboxes = new WeakMap();
const waiters = new WeakMap();

function connect(origin = `http://localhost:${PORT}`) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin });
  inboxes.set(ws, []);
  waiters.set(ws, []);
  ws.on('message', d => {
    try { inboxes.get(ws).push(JSON.parse(d.toString())); } catch { return; }
    drain(ws);
  });
  ws.on('close', () => {
    for (const w of waiters.get(ws)) { clearTimeout(w.to); w.reject(new Error('socket closed waiting for ' + w.type)); }
    waiters.set(ws, []);
  });
  return ws;
}

function drain(ws) {
  const box = inboxes.get(ws);
  const pending = waiters.get(ws) || [];
  for (let i = pending.length - 1; i >= 0; i--) {
    const w = pending[i];
    const mi = box.findIndex(m => m.type === w.type);
    if (mi !== -1) {
      const [m] = box.splice(mi, 1);
      pending.splice(i, 1);
      clearTimeout(w.to);
      w.resolve(m);
    }
  }
}

function expectMsg(ws, type, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const w = { type, resolve, reject, to: setTimeout(() => reject(new Error('timeout: ' + type)), timeout) };
    waiters.get(ws).push(w);
    drain(ws);
  });
}

test.before(async () => {
  server = http.createServer();
  net = attachNet(server, {});
  rooms = attachRooms(server, net, {
    queueCap: 3,
    createCap: 3,
    createWindowMs: 60 * 60 * 1000,
    genCode: () => (genCodes.length ? genCodes.shift() : 'C' + String(++codeN).padStart(4, 'A')),
  });
  await new Promise(r => server.listen(PORT, r));
});

test.after(async () => {
  for (const ws of net.wss.clients) ws.terminate();
  await new Promise(r => server.close(r));
});

test('create → room msg with 5-char code, seat 0, uint32 seed', async () => {
  const a = connect();
  await new Promise(r => a.on('open', r));
  send(a, hello('Creator'));
  await expectMsg(a, 'session');
  send(a, { type: 'create' });
  const room = await expectMsg(a, 'room');
  assert.equal(room.youSeat, 0);
  assert.equal(room.code.length, 5);
  assert.match(room.code, /^[A-Z0-9]{5}$/);
  assert.equal(Number.isInteger(room.seed), true);
  assert.equal(room.seats[0].nick, 'Creator');
  assert.equal(room.seats[1], null);
  a.close();
});

test('join pairs creator + joiner, same seed, seats 0/1', async () => {
  const a = connect();
  await new Promise(r => a.on('open', r));
  send(a, hello('Host'));
  await expectMsg(a, 'session');
  send(a, { type: 'create' });
  const roomA = await expectMsg(a, 'room');

  const b = connect();
  await new Promise(r => b.on('open', r));
  send(b, hello('Guest'));
  await expectMsg(b, 'session');
  send(b, { type: 'join', code: roomA.code });
  const roomB = await expectMsg(b, 'room');
  const roomA2 = await expectMsg(a, 'room'); // creator sees the update

  assert.equal(roomB.youSeat, 1);
  assert.equal(roomB.code, roomA.code);
  assert.equal(roomB.seed, roomA.seed);
  assert.equal(roomA2.seats[1].nick, 'Guest');
  a.close(); b.close();
});

test('join bad code → roomError', async () => {
  const a = connect();
  await new Promise(r => a.on('open', r));
  send(a, hello('Wanderer'));
  await expectMsg(a, 'session');
  send(a, { type: 'join', code: 'ZZZZZ' });
  const err = await expectMsg(a, 'roomError');
  assert.equal(err.reason, 'room not found');
  a.close();
});

test('join full room (3rd seat) → roomError', async () => {
  const a = connect(); await new Promise(r => a.on('open', r)); send(a, hello('H2')); await expectMsg(a, 'session');
  send(a, { type: 'create' });
  const room = await expectMsg(a, 'room');
  const b = connect(); await new Promise(r => b.on('open', r)); send(b, hello('G2')); await expectMsg(b, 'session');
  send(b, { type: 'join', code: room.code });
  await expectMsg(b, 'room');
  const c = connect(); await new Promise(r => c.on('open', r)); send(c, hello('C2')); await expectMsg(c, 'session');
  send(c, { type: 'join', code: room.code });
  const err = await expectMsg(c, 'roomError');
  assert.equal(err.reason, 'room full');
  a.close(); b.close(); c.close();
});

test('quick pairs two waiting sockets (FIFO), distinct seats, same seed', async () => {
  const a = connect(); await new Promise(r => a.on('open', r)); send(a, hello('QuickA')); await expectMsg(a, 'session');
  send(a, { type: 'quick' });
  await expectMsg(a, 'queued');

  const b = connect(); await new Promise(r => b.on('open', r)); send(b, hello('QuickB')); await expectMsg(b, 'session');
  send(b, { type: 'quick' });

  const roomA = await expectMsg(a, 'room');
  const roomB = await expectMsg(b, 'room');
  assert.equal(roomA.code, roomB.code);
  assert.equal(roomA.seed, roomB.seed);
  assert.notEqual(roomA.youSeat, roomB.youSeat);
  a.close(); b.close();
});

test('queue cap enforced (cap 3 in test opts) → roomError queue full', async () => {
  // quick pairs immediately from the FIFO, so fill the queue with stub sockets
  for (let i = 0; i < 3; i++) rooms.queue.push({ readyState: 1 });
  const d = connect(); await new Promise(r => d.on('open', r)); send(d, hello('Overflow')); await expectMsg(d, 'session');
  send(d, { type: 'quick' });
  const err = await expectMsg(d, 'roomError');
  assert.equal(err.reason, 'queue full');
  rooms.queue.length = 0;
  d.close();
});

test('quick: invalid partner in queue is skipped, valid partner pairs correctly', async () => {
  rooms.queue.length = 0;
  // Add a disconnected socket to queue (simulates stale entry)
  const deadSocket = { readyState: 3 }; // WebSocket.CLOSED
  rooms.queue.push(deadSocket);
  
  // Add a connected but already-in-room socket (race condition)
  const inRoomSocket = { readyState: 1 };
  rooms.queue.push(inRoomSocket);
  // Mark it as already in a room
  net.roomOf.set(inRoomSocket, 'EXISTING_ROOM');
  
  // Player A queues
  const a = connect(); await new Promise(r => a.on('open', r)); send(a, hello('QuickA')); await expectMsg(a, 'session');
  send(a, { type: 'quick' });
  await expectMsg(a, 'queued'); // A is now in queue (position 1 after cleanup)
  
  // Player B quick matches - should skip dead/in-room and pair with A
  const b = connect(); await new Promise(r => b.on('open', r)); send(b, hello('QuickB')); await expectMsg(b, 'session');
  send(b, { type: 'quick' });
  
  const roomA = await expectMsg(a, 'room');
  const roomB = await expectMsg(b, 'room');
  assert.equal(roomA.code, roomB.code);
  assert.equal(roomA.seed, roomB.seed);
  assert.notEqual(roomA.youSeat, roomB.youSeat);
  
  // The in-room socket should be requeued (at front)
  // Dead socket should be dropped
  a.close(); b.close();
  
  // Cleanup: remove the in-room socket from net.roomOf
  net.roomOf.delete(inRoomSocket);
});

test('code collision: genCode returns existing code once, server retries and succeeds', async () => {
  rooms.createsByIp.clear();
  const a = connect(); await new Promise(r => a.on('open', r)); send(a, hello('HostX')); await expectMsg(a, 'session');
  send(a, { type: 'create' });
  const room1 = await expectMsg(a, 'room');

  // next genCode() call returns the SAME code (simulated collision), retry gets a fresh unique one
  genCodes.push(room1.code);
  const b = connect(); await new Promise(r => b.on('open', r)); send(b, hello('HostY')); await expectMsg(b, 'session');
  send(b, { type: 'create' });
  const room2 = await expectMsg(b, 'room');
  assert.notEqual(room2.code, room1.code);
  a.close(); b.close();
});

test('room-create per-IP cap (cap 3 in test opts) → roomError', async () => {
  rooms.createsByIp.clear();
  const ok = [];
  for (let i = 0; i < 3; i++) {
    const c = connect(); await new Promise(r => c.on('open', r)); send(c, hello('Spammer' + i)); await expectMsg(c, 'session');
    send(c, { type: 'create' });
    await expectMsg(c, 'room');
    ok.push(c);
  }
  const d = connect(); await new Promise(r => d.on('open', r)); send(d, hello('Spammer4')); await expectMsg(d, 'session');
  send(d, { type: 'create' });
  const err = await expectMsg(d, 'roomError');
  assert.equal(err.reason, 'too many rooms, try later');
  d.close();
  for (const c of ok) c.close();
});

test('leave frees seat; closed socket removed from queue and room', async () => {
  rooms.createsByIp.clear();
  const a = connect(); await new Promise(r => a.on('open', r)); send(a, hello('Leaver')); await expectMsg(a, 'session');
  send(a, { type: 'create' });
  const room = await expectMsg(a, 'room');

  const b = connect(); await new Promise(r => b.on('open', r)); send(b, hello('Stay')); await expectMsg(b, 'session');
  send(b, { type: 'join', code: room.code });
  await expectMsg(b, 'room');

  // a leaves → b gets peerLeft
  send(a, { type: 'leave' });
  const pl = await expectMsg(b, 'peerLeft');
  assert.equal(typeof pl.graceMs, 'number');

  // seat free again → joiner c can take it
  const c = connect(); await new Promise(r => c.on('open', r)); send(c, hello('Newbie')); await expectMsg(c, 'session');
  send(c, { type: 'join', code: room.code });
  const roomC = await expectMsg(c, 'room');
  // freed seat (index 0, vacated by the leaver) is reused
  assert.equal(roomC.youSeat, 0);

  // b closes → seat freed again; c sees peerLeft; room persists for c
  b.close();
  await expectMsg(c, 'peerLeft');
  c.close();
  a.close();
});
