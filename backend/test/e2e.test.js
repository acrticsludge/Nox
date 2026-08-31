// O7: end-to-end online match flow — the protocol-level equivalent of the
// two-tab playtest: quick pair -> ready -> countdown -> snapshots -> movement
// via inputs -> forfeit -> rematch reseed.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';

import { attachNet } from '../net.js';
import { attachRooms } from '../rooms.js';
import { startMatch, attachMatchRouting } from '../match.js';

const PORT = 3107;
let server, net, rooms;

function client(nick) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: `http://localhost:${PORT}` });
  const box = [];
  ws.on('message', (d) => { try { box.push(JSON.parse(d.toString())); } catch (e) { console.error('[parse-err]', e.message, d.toString().slice(0, 120)); } });
  const c = {
    ws, box,
    next(type, timeout = 5000) {
      return new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('timeout: ' + type)), timeout);
        let iv = null, done = false;
        const tryBox = () => {
          if (done) return;
          const i = c.box.findIndex((m) => m.type === type);
          if (i !== -1) {
            done = true;
            clearTimeout(to); clearTimeout(diag); if (iv) clearInterval(iv);
            resolve(c.box.splice(i, 1)[0]);
          }
        };
        const diag = setTimeout(() => { if (!done) console.error(`[next] STILL WAITING ${type}; box:`, c.box.map((m) => m.type).join(',')); }, timeout - 500);
        tryBox();
        iv = setInterval(tryBox, 20);
      });
    },
  };
  return c;
}

const send = (c, o) => c.ws.send(typeof o === 'string' ? o : JSON.stringify(o));

test.before(async () => {
  server = http.createServer();
  net = attachNet(server, {});
  rooms = attachRooms(server, net, { onRoomFull: (room) => startMatch(room, net) });
  net.noxRooms = rooms.rooms;
  attachMatchRouting(net);
  await new Promise((r) => server.listen(PORT, r));
});
test.after(async () => {
  for (const ws of net.wss.clients) ws.terminate();
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  setTimeout(() => process.exit(0), 100); // ws upgrade sockets can linger; all work is done
});

test('E2E: quick pair, countdown, movement via inputs, forfeit, rematch reseed', async () => {
  try {
    await e2eFlow();
  } catch (e) {
    console.error('[e2e] FAILED:', e && e.message);
    throw e;
  } finally {
    const room = rooms.rooms.get('x');
    if (room && room.match) room.match.stop();
    for (const [, r] of rooms.rooms) r.match?.stop?.();
    for (const ws of net.wss.clients) ws.terminate();
  }
});

async function e2eFlow() {
  // -- two "tabs" join
  const a = client('E2eA');
  await new Promise((r) => a.ws.on('open', r));
  send(a, JSON.stringify({ type: 'hello', nick: 'E2eA', guestId: 'guest-e2ea12345' }));
  await a.next('session');
  send(a, { type: 'quick' });
  await a.next('queued');

  const b = client('E2eB');
  await new Promise((r) => b.ws.on('open', r));
  send(b, JSON.stringify({ type: 'hello', nick: 'E2eB', guestId: 'guest-e2eb12345' }));
  await b.next('session');
  send(b, { type: 'quick' });

  const roomA = await a.next('room');
  const roomB = await b.next('room');
  assert.equal(roomA.code, roomB.code);
  assert.equal(roomA.seed, roomB.seed);
  assert.notEqual(roomA.youSeat, roomB.youSeat);

  // -- both press ready; countdown then snapshots flow
  send(a, { type: 'ready' });
  send(b, { type: 'ready' });
  await a.next('countdown');
  await b.next('countdown');
  const s0 = await a.next('snapshot');
  await b.next('snapshot');
  assert.equal(s0.state, 'playing');

  // -- movement: drive player 0 with held inputs; seeded wall layouts vary, so
  // try up then right and accept movement in any axis
  let seq = 0;
  const sMid = await a.next('snapshot');
  const drive = async (mask) => {
    const base = sMid.p[0];
    let last = base;
    for (let i = 0; i < 30; i++) {
      send(a, { type: 'input', seq: ++seq, m: mask });
      last = (await a.next('snapshot')).p[0];
    }
    send(a, { type: 'input', seq: ++seq, m: 0 });
    return Math.abs(last[1] - base[1]) + Math.abs(last[0] - base[0]);
  };
  const movedUp = await drive(1);
  const moved = movedUp > 1 ? movedUp : await drive(8);
  console.error('[e2e] movement delta:', movedUp, '->', moved);
  assert.ok(moved > 1, `expected player 0 to move via inputs, delta=${moved}`);

  // -- forfeit: B concedes, A wins the match
  console.error('[e2e] phase: forfeit');
  send(b, { type: 'forfeit' });
  const endA = await a.next('matchEnd');
  const endB = await b.next('matchEnd');
  console.error('[e2e] phase: matchEnd ok');
  assert.equal(endA.winner, 0);
  assert.equal(endB.winner, 0);
  assert.equal(endA.reason, 'OPPONENT FORFEITED');

  // -- rematch handshake: both request -> fresh seed -> new match -> snapshots again
  const oldSeed = rooms.rooms.get(roomA.code).seed;
  console.error('[e2e] phase: rematchReq A');
  send(a, { type: 'rematchReq' });
  await b.next('rematchReq');
  console.error('[e2e] phase: rematchReq B');
  send(b, { type: 'rematchReq' });
  const room2 = await a.next('room');
  await b.next('room');
  console.error('[e2e] phase: room2 ok');
  assert.equal(room2.code, roomA.code);
  assert.notEqual(room2.seed, oldSeed, 'rematch must reseed the map');
  send(a, { type: 'ready' });
  send(b, { type: 'ready' });
  const snap2 = await a.next('snapshot', 8000);
  console.error('[e2e] phase: snap2 ok');
  assert.equal(snap2.state, 'playing');
  rooms.rooms.get(roomA.code).match.stop();
  a.ws.close();
  b.ws.close();
}
