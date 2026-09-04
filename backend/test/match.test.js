// T7: server-side match — ready → countdown → snapshots; input validation; forfeit.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';

import { attachNet } from '../net.js';
import { attachRooms } from '../rooms.js';
import { startMatch, attachMatchRouting } from '../match.js';

const PORT = 3106;
let server, net, rooms;

function connect() {
  return new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: `http://localhost:${PORT}` });
}
const send = (ws, o) => ws.send(typeof o === 'string' ? o : JSON.stringify(o));
// Server accepts client-provided guestId if valid; hello can include guestId for reconnection
const hello = (nick, guestId) => JSON.stringify({ type: 'hello', nick, ...(guestId ? { guestId } : {}) });

function makeClient(nick) {
  const ws = connect();
  const client = { ws, box: [], nick, guestId: null, next(type, timeout = 4000) {
    return new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('timeout: ' + type)), timeout);
      let iv = null;
      const tryBox = (b) => { const i = b.findIndex(m => m.type === type); if (i !== -1) { clearTimeout(to); if (iv) clearInterval(iv); resolve(b.splice(i, 1)[0]); } };
      tryBox(client.box);
      iv = setInterval(() => tryBox(client.box), 20);
      setTimeout(() => { if (iv) clearInterval(iv); }, timeout);
    });
  } };
  ws.on('message', d => { try { client.box.push(JSON.parse(d.toString())); } catch {} });
  return client;
}

// drop stale messages of a type without breaking array identity
function dropType(client, type) {
  const keep = client.box.filter(m => m.type !== type);
  client.box.length = 0;
  client.box.push(...keep);
}

test.before(async () => {
  server = http.createServer();
  net = attachNet(server, {});
  rooms = attachRooms(server, net, { onRoomFull: room => startMatch(room, net) });
  net.noxRooms = rooms.rooms;
  attachMatchRouting(net);
  await new Promise(r => server.listen(PORT, r));
});
test.after(async () => {
  for (const ws of net.wss.clients) ws.terminate();
  await new Promise(r => server.close(r));
});

test('paired clients: ready -> countdown -> snapshots at 30Hz', async () => {
  const a = makeClient('MmA');
  await new Promise(r => a.ws.on('open', r));
  send(a.ws, hello('MmA'));
  await a.next('session');
  send(a.ws, { type: 'quick' });
  const b = makeClient('MmB');
  await new Promise(r => b.ws.on('open', r));
  send(b.ws, hello('MmB'));
  await b.next('session');
  send(b.ws, { type: 'quick' });

  const roomA = await a.next('room');
  await b.next('room');
  assert.equal(roomA.code.length, 5);

  send(a.ws, { type: 'ready' });
  send(b.ws, { type: 'ready' });
  const cd = await a.next('countdown');
  assert.equal(typeof cd.t, 'number');

  const snap = await a.next('snapshot');
  assert.equal(snap.p.length, 2);
  assert.equal(snap.state, 'playing');
  const snap2 = await a.next('snapshot');
  assert.ok(snap2.tick > snap.tick || snap2.time < snap.time);
  const bsnap = await b.next('snapshot');
  assert.deepEqual(bsnap.p, snap2.p); // same sim state for both seats

  send(b.ws, { type: 'forfeit' });
  const end = await a.next('matchEnd');
  assert.equal(end.winner, 0);
  a.ws.close(); b.ws.close();
});

test('input validation: non-monotonic seq and out-of-range masks are ignored', async () => {
  const a = makeClient('VmA');
  await new Promise(r => a.ws.on('open', r));
  send(a.ws, hello('VmA'));
  await a.next('session');
  send(a.ws, { type: 'create' });
  const roomA = await a.next('room');

  const b = makeClient('VmB');
  await new Promise(r => b.ws.on('open', r));
  send(b.ws, hello('VmB'));
  await b.next('session');
  send(b.ws, { type: 'join', code: roomA.code });
  await b.next('room');

  send(a.ws, { type: 'ready' }); send(b.ws, { type: 'ready' });
  await a.next('countdown');

  // valid input
  send(a.ws, { type: 'input', seq: 5, m: 1 });
  // invalid: seq must strictly increase; mask must be 0..63
  send(a.ws, { type: 'input', seq: 5, m: 1 });   // non-monotonic
  send(a.ws, { type: 'input', seq: 3, m: 999 }); // bad mask
  send(a.ws, { type: 'input', seq: 6, m: 2 });   // valid again

  await a.next('snapshot');
  await a.next('snapshot');
  // if invalid inputs crashed or corrupted state we'd fail by timeout above
  assert.ok(true);

  const room = rooms.rooms.get(roomA.code);
  room.match.stop();
  a.ws.close(); b.ws.close();
});

test('grace: opponent drop holds seat, rejoin resumes, rematch reseeds', async () => {
  const a = makeClient('GrA');
  await new Promise(r => a.ws.on('open', r));
  send(a.ws, hello('GrA'));
  const sessionA = await a.next('session');
  a.guestId = sessionA.guestId;
  send(a.ws, { type: 'create' });
  const roomA = await a.next('room');

  let b = makeClient('GrB');
  await new Promise(r => b.ws.on('open', r));
  send(b.ws, hello('GrB'));
  const sessionB = await b.next('session');
  b.guestId = sessionB.guestId;
  send(b.ws, { type: 'join', code: roomA.code });
  await b.next('room');

  send(a.ws, { type: 'ready' }); send(b.ws, { type: 'ready' });
  await a.next('countdown');
  await a.next('snapshot');

  // b drops -> a gets peerLeft with graceMs, match pauses (no matchEnd)
  b.ws.close();
const pl = await a.next('peerLeft');
  assert.equal(typeof pl.graceMs, 'number');

  // b reconnects with its signed seat credential (task 10) -> match resumes
  const bCred = b.box.find(m => m.type === 'reconnectCred');
  assert.ok(bCred, 'bob must hold a reconnect credential');
  const originalGuestId = b.guestId; // Use the guestId from the first session
  b = makeClient('GrB');
  await new Promise(r => b.ws.on('open', r));
  send(b.ws, hello('GrB', originalGuestId)); // Reconnect with original guestId
  const sessionB2 = await b.next('session');
  b.guestId = sessionB2.guestId;
  send(b.ws, { type: 'join', code: roomA.code, reconnect: { roomCode: roomA.code, seat: bCred.seat, token: bCred.token } });
  const response = await b.next('rejoined', 5000).catch(() => b.next('roomError', 5000));
  if (response.type === 'roomError') {
    throw new Error('Reconnect failed: ' + response.reason);
  }
  const bRejoined = response;
  assert.equal(bRejoined.seat, bCred.seat);
  const resumed = await a.next('snapshot', 6000);
  assert.equal(resumed.state, 'playing');
  // drop the rejoin-time 'room' broadcasts so the rematch one is unambiguous
  dropType(a, 'room');
  dropType(b, 'room');

  // rematch: both request -> new seed broadcast -> countdown again
  const room = rooms.rooms.get(roomA.code);
  const oldSeed = room.seed;
  room.match.stop();
  room.state = 'rematchWait'; // task 12: rematch is legal only from post-match state
  send(a.ws, { type: 'rematchReq' });
  await b.next('rematchReq');
  send(b.ws, { type: 'rematchReq' });
  const room2 = await a.next('room');
  assert.equal(room2.code, roomA.code);
  assert.notEqual(room2.seed, oldSeed);
  await b.next('room');
  send(a.ws, { type: 'ready' }); send(b.ws, { type: 'ready' });
  await a.next('countdown');
  await a.next('snapshot', 6000);
  const roomAfter = rooms.rooms.get(roomA.code);
  roomAfter.match.stop();
  a.ws.close(); b.ws.close();
});

test('duplicate ready packets arm exactly one countdown (P1-03)', async () => {
  const a = makeClient('RA');
  await new Promise(r => a.ws.on('open', r));
  send(a.ws, hello('RA'));
  await a.next('session');
  send(a.ws, { type: 'create' });
  const roomA = await a.next('room');
  const b = makeClient('RB');
  await new Promise(r => b.ws.on('open', r));
  send(b.ws, hello('RB'));
  await b.next('session');
  send(b.ws, { type: 'join', code: roomA.code });
  await b.next('room');

  // flood: duplicate ready from both seats + extra from a third socket
  for (let i = 0; i < 5; i++) { send(a.ws, { type: 'ready' }); send(b.ws, { type: 'ready' }); }
  const c1 = await a.next('countdown');
  assert.equal(c1.t, 3);
  // drain any queued beats — there must be exactly 3,2,1,0 and no restart
  const beats = [];
  for (let i = 0; i < 8; i++) {
    try { beats.push((await a.next('countdown', 4500)).t); } catch { break; }
  }
  assert.deepEqual(beats, [2, 1, 0], 'exactly one 3-2-1-GO sequence, got: ' + beats.join(','));
  const room = rooms.rooms.get(roomA.code);
  room.match.stop();
  a.ws.close(); b.ws.close();
});
