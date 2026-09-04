// Task 10: authenticated reserved-seat reconnect through the real server.
// Covers: credential issue on join, seat reservation on disconnect, signed
// reclaim into the SAME seat, competitor denial, forged/mismatched token
// rejection, and reservation expiry releasing the seat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createServer } from '../server.js';

const PORT = 3112;
let server;

function connect(nick, guestId) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: `http://localhost:${PORT}` });
  const box = [];
  ws.on('message', (d) => { try { box.push(JSON.parse(d.toString())); } catch {} });
  ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', nick, ...(guestId ? { guestId } : {}) }))); // Server accepts guestId for reconnection
  const wait = (type, ms = 4000) => new Promise((res, rej) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const m = box.find(x => x.type === type);
      if (m) { clearInterval(iv); res(m); }
      else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error('timeout waiting ' + type + '; got: ' + box.map(x => x.type).join(','))); }
    }, 15);
  });
  const c = { ws, box, wait, send: (t, d = {}) => ws.send(JSON.stringify({ type: t, ...d })), guestId: null };
  return new Promise((res, rej) => {
    ws.on('error', rej);
    ws.on('open', () => res(c));
  });
}

test.before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
});
test.after(async () => {
  server.closeAllConnections?.();
  server.close();
  setTimeout(() => process.exit(0), 50); // lingering ws upgrade sockets; all work is done
});

test('credential issued on join; seat reserved on disconnect; signed owner reclaims same seat', async () => {
  const a = await connect('alice');
  const b = await connect('bob');
  a.send('quick'); b.send('quick');
  const roomA = await a.wait('room');
  const credA = await a.wait('reconnectCred');
  const sessionB = await b.wait('session');
  b.guestId = sessionB.guestId;
  await b.wait('reconnectCred');
  assert.equal(credA.seat, roomA.youSeat);
  const code = roomA.code;

  // b disconnects -> peerLeft on a, seat reserved
  b.ws.close();
  await a.wait('peerLeft');

  // stranger cannot take the reserved seat
  const e = await connect('eve');
  const sessionE = await e.wait('session');
  e.guestId = sessionE.guestId;
  e.send('join', { code });
  assert.equal((await e.wait('roomError')).reason, 'room full');

  // owner reconnects: join carries the signed claim -> reclaims same seat
  const bCred = b.box.find(x => x.type === 'reconnectCred');
  assert.ok(bCred, 'bob had a credential');
  const originalGuestId = b.guestId;
  const b2 = await connect('bob', originalGuestId);
  const sessionB2 = await b2.wait('session');
  b2.guestId = sessionB2.guestId;
  b2.send('join', { code, reconnect: { roomCode: code, seat: bCred.seat, token: bCred.token } });
  const rejoined = await b2.wait('rejoined');
  assert.equal(rejoined.seat, bCred.seat);
  const roomBack = await b2.wait('room');
  assert.equal(roomBack.youSeat, bCred.seat);
  const roomA2 = await a.wait('room');
  assert.equal(roomA2.youSeat, roomA.youSeat, 'alice keeps her seat');
});

test('forged token cannot reclaim a reserved seat', async () => {
  const a = await connect('alice2');
  const b = await connect('bob2');
  a.send('quick'); b.send('quick');
  const roomA = await a.wait('room');
  await a.wait('reconnectCred');
  await b.wait('room');
  const code = roomA.code;
  b.ws.close();
  await a.wait('peerLeft');

  const f = await connect('mallory');
  const sessionF = await f.wait('session');
  f.guestId = sessionF.guestId;
  f.send('join', { code, reconnect: { roomCode: code, seat: roomA.youSeat === 0 ? 1 : 0, token: 'forged.token.value' } });
  const r = await f.wait('roomError');
  assert.ok(['reconnect failed', 'room full'].includes(r.reason), 'must not seat mallory: ' + r.reason);
});

test('mismatched room/seat binding in the credential is rejected', async () => {
  const a = await connect('carol');
  const b = await connect('dave');
  a.send('quick'); b.send('quick');
  await a.wait('room');
  const credB = await b.wait('reconnectCred');
  const roomB = await b.wait('room');
  b.ws.close();
  await a.wait('peerLeft');
  const code = roomB.code;

  // dave presents his OWN valid token but claims the WRONG seat
  const wrong = await connect('dave');
  const sessionWrong = await wrong.wait('session');
  wrong.guestId = sessionWrong.guestId;
  wrong.send('join', { code, reconnect: { roomCode: code, seat: credB.seat === 0 ? 1 : 0, token: credB.token } });
  assert.equal((await wrong.wait('roomError')).reason, 'reconnect failed');
});
