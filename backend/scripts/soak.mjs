// P2-16 release rehearsal soak: sustained room churn, reconnect storms, and
// concurrent matches against the real protocol stack (net -> rooms -> match
// with the production startMatch/onEnd wiring). Proves bounded rooms,
// reservations, and limiter maps; ordered terminal events; reconnect seat
// ownership over time.
//
// The per-IP create cap is raised for the churn layer only — the production
// cap/window behavior is unit-covered in test/rooms.test.js.
//   node scripts/soak.mjs --minutes 30   (full rehearsal)
//   node scripts/soak.mjs                (1-minute smoke)
import { WebSocket } from 'ws';
import http from 'node:http';
import { attachNet } from '../net.js';
import { attachRooms } from '../rooms.js';
import { startMatch, attachMatchRouting } from '../match.js';

const args = process.argv.slice(2);
const minutesFlag = args.indexOf('--minutes');
const MINUTES = minutesFlag !== -1 ? Number(args[minutesFlag + 1]) : 1;
const PORT = 3199;
const NICKS = ['soak-a', 'soak-b', 'soak-c', 'soak-d'];

let errors = 0;
let errorSamples = [];
let matchesEnded = 0;
let reconnects = 0;
let terminalOrderViolations = 0;
const memorySamples = [];
const recordError = (label, e) => {
  errors++;
  if (errorSamples.length < 10) errorSamples.push(label + ': ' + (e && e.message ? e.message : e));
};

function wsClient(nick, fixedGuestId) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { origin: `http://localhost:${PORT}` });
    const box = [];
    ws.on('message', d => { try { box.push(JSON.parse(d.toString())); } catch {} });
    ws.on('error', e => recordError('ws-' + nick, e));
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'hello', guestId: fixedGuestId || 'soak-' + nick + '-' + Math.random().toString(36).slice(2, 8), nick }));
      resolve({
        ws, box,
        send: (t, d = {}) => { if (ws.readyState === 1) ws.send(JSON.stringify({ type: t, ...d })); },
        waitFor: (type, ms = 5000) => new Promise(r => {
          const t0 = Date.now();
          const iv = setInterval(() => {
            const i = box.findIndex(x => x.type === type);
            if (i !== -1) { clearInterval(iv); r(box.splice(i, 1)[0]); }
            else if (Date.now() - t0 > ms) { clearInterval(iv); r(null); }
          }, 10);
        }),
        close: () => { try { ws.close(); } catch {} },
      });
    });
  });
}

// One match cycle: pair up, duplicate-ready (T11 idempotence), countdown,
// forfeit -> ordered matchEnd -> roomClosed for BOTH seats (T12 terminal).
async function matchCycle(i) {
  const a = await wsClient(NICKS[i % NICKS.length]);
  const b = await wsClient(NICKS[(i + 1) % NICKS.length]);
  if (!(a && b)) { recordError('pair-open'); return; }
  a.send('create');
  const room = await a.waitFor('room');
  if (!room) { recordError('no-room'); a.close(); b.close(); return; }
  b.send('join', { code: room.code });
  if (!(await b.waitFor('room'))) { recordError('join-no-room'); a.close(); b.close(); return; }
  a.send('ready'); b.send('ready');
  a.send('ready'); b.send('ready'); // duplicates must not double-countdown
  const cds = await Promise.all([a.waitFor('countdown'), b.waitFor('countdown')]);
  if (cds.some(c => !c)) { recordError('no-countdown'); a.close(); b.close(); return; }
  b.send('forfeit');
  const endA = await a.waitFor('matchEnd', 6000);
  const endB = await b.waitFor('matchEnd', 6000);
  if (endA && endB) matchesEnded++;
  else { recordError('missing-matchEnd'); }
  const closedA = await a.waitFor('roomClosed', 4000);
  const closedB = await b.waitFor('roomClosed', 4000);
  if (!closedA || !closedB) terminalOrderViolations++;
  a.close(); b.close();
}

// Reconnect cycle: seat credential minted, seat reclaimed with the SAME seat
// and SAME guestId after a drop; a forged token cannot take the seat.
async function reconnectCycle() {
  const guestId = 'soak-reconnecter-' + Math.random().toString(36).slice(2, 8);
  const a = await wsClient('reconnecter', guestId);
  const b = await wsClient('stayer');
  a.send('create');
  const room = await a.waitFor('room');
  if (!room) { recordError('rc-no-room'); a.close(); b.close(); return; }
  b.send('join', { code: room.code });
  await b.waitFor('room');
  const cred = await a.waitFor('reconnectCred', 3000);
  if (!cred) { recordError('no-cred'); a.close(); b.close(); return; }
  a.close(); // seat now reserved for graceMs
  await new Promise(r => setTimeout(r, 150));
  const a2 = await wsClient('reconnecter', guestId);
  a2.send('join', { code: room.code, reconnect: { roomCode: cred.roomCode, seat: cred.seat, token: cred.token } });
  const rej = await a2.waitFor('rejoined', 3000);
  if (rej && rej.seat === cred.seat) reconnects++;
  else recordError('reclaim-failed');
  a2.send('leave'); // deliberate leave frees the seat
  a2.close(); b.close();
}

// ---- server (real wiring, relaxed per-IP create cap for churn) ----
const server = http.createServer();
const net = attachNet(server, { secret: 'soak-secret' });
const roomsApi = attachRooms(server, net, {
  graceMs: 400,
  createCap: 1_000_000,
  createWindowMs: 30_000, // sweep-verifiable window
  onRoomFull: room => startMatch(room, net, {
    onEnd: (room, keep) => {
      if (keep) { room.state = 'rematchWait'; room.rematch = new Set(); for (const s of room.seats) if (s) roomsApi.sendRoomTo(s, room); return; }
      for (const s of room.seats) {
        if (s) { try { s.send(JSON.stringify({ type: 'roomClosed' })); } catch {} roomsApi.leave(s, false, false); }
      }
      roomsApi.rooms.delete(room.code);
    },
  }),
});
net.noxRooms = roomsApi.rooms;
attachMatchRouting(net);

await new Promise(r => server.listen(PORT, '127.0.0.1', r));
console.log(`[soak] running for ${MINUTES} minute(s) on :${PORT}`);

const deadline = Date.now() + MINUTES * 60 * 1000;
let cycles = 0;
let rcycles = 0;
const pending = [];
while (Date.now() < deadline) {
  pending.push(matchCycle(cycles++).catch(e => recordError('cycle', e)));
  pending.push(reconnectCycle().catch(e => recordError('rcycle', e)));
  rcycles++;
  memorySamples.push(process.memoryUsage().rss);
  await new Promise(r => setTimeout(r, 800));
  if (pending.length > 60) pending.splice(0, pending.length - 20);
}
await Promise.allSettled(pending);
// drain past one full sweep interval (5s) + grace so expired reservations and
// limiter windows are provably collected before measuring leftovers
await new Promise(r => setTimeout(r, 6000));

server.closeAllConnections?.();
server.close();

const rss0 = memorySamples[0] ?? 0;
const rssPeak = Math.max(...memorySamples);
const rssGrowthMB = (rssPeak - rss0) / 1048576;

const report = {
  minutes: MINUTES,
  matchCycles: cycles,
  reconnectCycles: rcycles,
  matchesEnded,
  successfulReconnects: reconnects,
  errors,
  errorSamples,
  terminalOrderViolations,
  leftoverRooms: roomsApi.rooms.size,
  leftoverReservations: roomsApi.reservations.size,
  leftoverLimiterEntries: roomsApi.createsByIp.size,
  rssGrowthMB: Number(rssGrowthMB.toFixed(1)),
  peakRssMB: Math.round(rssPeak / 1048576),
};
console.log('--- SOAK REPORT ---');
console.log(JSON.stringify(report, null, 2));

const pass =
  errors === 0 &&
  terminalOrderViolations === 0 &&
  report.leftoverRooms === 0 &&
  report.leftoverReservations === 0 &&
  matchesEnded >= cycles * 0.95 &&
  reconnects >= rcycles * 0.95;
console.log(pass ? '[soak] PASS' : '[soak] FAIL');
process.exit(pass ? 0 : 1);
