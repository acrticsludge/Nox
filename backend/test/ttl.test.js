// Task 14: bounded server state — rooms, reservations, limiter maps expire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import http from 'node:http';
import { attachNet } from '../net.js';
import { attachRooms } from '../rooms.js';

const PORT = 3115;
let server, net, rooms;

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
        next: (type, ms = 4000) => new Promise((r, j) => {
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
  server = http.createServer();
  net = attachNet(server, { secret: 's3' });
  rooms = attachRooms(server, net, { graceMs: 20000 });
  net.noxRooms = rooms.rooms;
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
});
test.after(async () => {
  server.closeAllConnections?.();
  server.close();
  setTimeout(() => process.exit(0), 50);
});

test('half-empty waiting rooms expire; limiter maps are swept', async () => {
  rooms.createsByIp.clear();
  const a = await connect('ttl');
  a.send('create');
  const room = await a.next('room');
  assert.ok(rooms.rooms.has(room.code));

  // seed a stale limiter entry and a stale reservation
  rooms.createsByIp.set('198.51.100.9', { count: 1, windowStart: Date.now() - 61 * 60 * 1000 });
  rooms.reservations.set('ZZZZZ:0', { guestId: 'guest-stale', expiresAt: Date.now() - 1000 });

  // the sweep runs every 5s; monkey-patch Date.now via age — instead, age the
  // room directly to prove the expiry logic without waiting
  rooms.rooms.get(room.code).createdAt = Date.now() - 61 * 1000;
  // trigger the sweep logic synchronously through the exported api: force by
  // waiting one sweep tick (5s) is slow — instead assert the logic directly
  // by invoking the same rules
  a.ws.close();
  // wait for the real 5s sweep tick to fire at least once
  const t0 = Date.now();
  while (rooms.createsByIp.has('198.51.100.9') && Date.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 250));
  assert.ok(!rooms.rooms.has(room.code), 'abandoned room must be gone (leave or sweep)');
  assert.ok(!rooms.createsByIp.has('198.51.100.9'), 'stale limiter entry must be swept');
  assert.ok(!rooms.reservations.has('ZZZZZ:0'), 'expired reservation must be swept');
});
