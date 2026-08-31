// Task 12: terminal room state + mutual rematch through the REAL createServer
// entrypoint (P0-04: live rematch rejected; P1-04: browser-real rematch flow).
// The match is driven to a natural end via the shared sim's round timer, so the
// onEnd -> rematchWait -> rematchReq -> new match path is fully production code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createServer } from '../server.js';

const PORT = 3114;
let server;

function connect(nick) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: `http://localhost:${PORT}` });
    const box = [];
    ws.on('message', (d) => { try { box.push(JSON.parse(d.toString())); } catch {} });
    ws.on('error', rej);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'hello', guestId: 'guest-' + nick, nick }));
      res({
        ws, box,
        send: (t, d = {}) => ws.send(JSON.stringify({ type: t, ...d })),
        next: (type, ms = 5000) => new Promise((r, j) => {
          const t0 = Date.now();
          const iv = setInterval(() => {
            const i = box.findIndex(x => x.type === type);
            if (i !== -1) { clearInterval(iv); r(box.splice(i, 1)[0]); }
            else if (Date.now() - t0 > ms) { clearInterval(iv); j(new Error('timeout: ' + type)); }
          }, 15);
        }),
      });
    });
  });
}

test.before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
});
test.after(async () => {
  server.closeAllConnections?.();
  server.close();
  setTimeout(() => process.exit(0), 50);
});

const WIN_SCORE = 5;

test('live rematchReq rejected; natural end -> rematchWait -> mutual rematch reseeds (all via createServer)', async () => {
  const a = await connect('ra');
  const b = await connect('rb');
  a.send('quick'); b.send('quick');
  const roomA = await a.next('room');
  await b.next('room');
  const code = roomA.code;
  const room = server.noxNet.noxRooms.get(code);
  assert.ok(room, 'room exists in the real registry');

  a.send('ready'); b.send('ready');
  await a.next('countdown');
  await a.next('snapshot');

  // P0-04: rematch DURING a live match must be rejected
  a.send('rematchReq');
  const liveErr = await a.next('roomError');
  assert.equal(liveErr.reason, 'match in progress');

  // drive the shared sim to a natural match end: short round timer + score at
  // WIN_SCORE so the round resolution crowns a match winner
  // (white-box setup; every transition after this is real server code)
  room.match.sim.scores[0] = WIN_SCORE;
  room.match.sim.timeLeft = 0.05;

  const endA = await a.next('matchEnd');
  assert.equal(endA.winner, 0);
  // reason carries the deciding round's result (timer expiry here)
  assert.ok(endA.reason.length > 0);
  await b.next('matchEnd');

  // P2-04 terminal ordering: NO peerLeft after matchEnd — the room survives
  const waitA = await a.next('room', 2500);
  assert.equal(waitA.rematchWait, true, 'kept room announces rematchWait');
  await b.next('room');
  assert.equal(room.state, 'rematchWait');
  assert.ok(room.match === null, 'no second sim can be running');

  // mutual rematch -> fresh seed -> onRoomFull -> startMatch -> countdown
  const oldSeed = room.seed;
  a.send('rematchReq');
  const oppAsk = await b.next('rematchReq');
  assert.equal(oppAsk.type, 'rematchReq');
  b.send('rematchReq');
  const room2 = await a.next('room');
  const room2b = await b.next('room');
  assert.equal(room2.code, code);
  assert.notEqual(room2.seed, oldSeed, 'rematch must reseed');
  assert.equal(room2.rematchWait, false);
  assert.equal(room.state, 'playing');

  a.send('ready'); b.send('ready');
  await a.next('countdown');
  const snap = await a.next('snapshot', 8000);
  assert.equal(snap.state, 'playing');
  assert.equal((await b.next('snapshot')).state, 'playing');
  room.match.stop();
  a.ws.close(); b.ws.close();
});
