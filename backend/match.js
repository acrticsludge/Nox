// T7: Headless server sim — 60Hz tick, 30Hz snapshots, validated inputs.
// Reuses the exact isomorphic sim (game-sim.js) that offline 1v1 runs.
import { createMatch, simTick, simNextRound, WIN_SCORE } from '../frontend/src/game/sim/game-sim.js';

const TICK_MS = 1000 / 60;
const SNAPSHOT_EVERY = 2;          // 30Hz
const ROUND_BREAK_MS = 2500;       // roundEnd -> next round

// input mask: 1=up 2=down 4=left 8=right 16=dash 32=shoot
function maskToInputs(mask) {
  return {
    up: !!(mask & 1), down: !!(mask & 2), left: !!(mask & 4),
    right: !!(mask & 8), dash: !!(mask & 16), shoot: !!(mask & 32),
  };
}

const r1 = n => Math.round(n * 10) / 10;

function snapshotOf(m) {
  return {
    type: 'snapshot',
    tick: m.tick,
    state: m.state,
    round: m.round,
    score: m.scores,
    time: r1(m.timeLeft),
    p: m.players.map(p => [r1(p.x), r1(p.y), r1(p.angle), p.hp, p.ammoType, p.shield ? p.shieldHp : 0, p.ammoType === 'standard' ? -1 : p.ammo]),
    b: m.bullets.map(b => [r1(b.x), r1(b.y), Math.round(b.vx * 10) / 10, Math.round(b.vy * 10) / 10, b.type, b.owner]),
    pk: m.pickups.map(pu => [r1(pu.x), r1(pu.y), pu.kind]),
    rr: m.roundResult,
    mw: m.matchWinner,
  };
}

export function startMatch(room, net, opts = {}) {
  const graceMs = opts.graceMs ?? 20000;
  const send = (ws, obj) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); };
  const broadcast = obj => { for (const s of room.seats) send(s, obj); };

  const match = createMatch(room.seed, {});
  const inputState = room.seats.map(() => ({ seq: 0, mask: 0 }));
  let tickTimer = null;
  let breakTimer = null;
  let graceTimer = null;
  let stopped = false;
  let snapCounter = 0;
  // Task 11 (P1-03): ready is a per-seat set and the waiting -> countdown
  // transition is one-shot — duplicate ready packets can never stack timers
  const readySeats = new Set();
  let countdownArmed = false;
  const startTimers = [];

  function stop() {
    if (stopped) return;
    stopped = true;
    if (tickTimer) clearInterval(tickTimer);
    if (breakTimer) clearTimeout(breakTimer);
    if (graceTimer) clearTimeout(graceTimer);
    for (const t of startTimers) clearTimeout(t);
    startTimers.length = 0;
    room.match = null;
  }

  function endMatch(winner, reason) {
    broadcast({ type: 'matchEnd', winner, reason, scores: match.scores.slice() });
    stop();
    // match is over either way — the room has no purpose left; server.js tears it down
    opts.onEnd?.(room);
  }

  function tick() {
    const missing = room.seats.findIndex(s => !s || s.readyState !== 1);
    if (missing !== -1) {
      // T10: hold the seat for graceMs, then award the match to the remaining player
      if (!graceTimer) {
        broadcast({ type: 'peerLeft', graceMs });
        graceTimer = setTimeout(() => {
          graceTimer = null;
          const alive = room.seats.findIndex(s => s && s.readyState === 1);
          endMatch(alive >= 0 ? alive : null, 'OPPONENT DISCONNECTED');
        }, graceMs);
      }
      return; // pause simulation while a seat is empty
    }
    if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; broadcast({ type: 'peerBack' }); }
    const inputs = inputState.map(st => maskToInputs(st.mask));
    simTick(match, inputs, 1);

    if (++snapCounter % SNAPSHOT_EVERY === 0) broadcast(snapshotOf(match));

    if (match.state !== 'playing') {
      broadcast(snapshotOf(match));
      if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      if (match.matchWinner != null) {
        endMatch(match.matchWinner, match.roundResult?.reason ?? 'MATCH OVER');
      } else {
        broadcast({
          type: 'roundEnd',
          winner: match.roundResult?.winner ?? null,
          reason: match.roundResult?.reason ?? '',
          scores: match.scores.slice(),
        });
        breakTimer = setTimeout(() => {
          if (stopped) return;
          simNextRound(match);
          broadcast({ type: 'countdown', t: 0 });
          tickTimer = setInterval(tick, TICK_MS);
        }, ROUND_BREAK_MS);
      }
      return;
    }
  }

  function onMessage(ws, msg) {
    const seat = room.seats.indexOf(ws);
    if (seat === -1) return;
    switch (msg.type) {
      case 'ready': {
        if (readySeats.has(seat) || countdownArmed) return;   // idempotent (P1-03)
        readySeats.add(seat);
        if (readySeats.size < room.seats.filter(Boolean).length) return;
        countdownArmed = true;
        // 3-2-1-GO, one beat per second, then the server starts ticking
        broadcast({ type: 'countdown', t: 3 });
        for (const t of [2, 1, 0]) {
          startTimers.push(setTimeout(() => {
            if (stopped) return;
            broadcast({ type: 'countdown', t });
            if (t === 0 && !tickTimer) tickTimer = setInterval(tick, TICK_MS);
          }, (3 - t) * 1000));
        }
        return;
      }
      case 'input': {
        const st = inputState[seat];
        const m = msg.m | 0;
        if (typeof msg.seq !== 'number' || msg.seq <= st.seq) return;  // monotonic seq
        if (m < 0 || m > 63 || !Number.isInteger(m)) return;           // 6-bit mask
        st.seq = msg.seq;
        st.mask = m;
        return;
      }
      case 'forfeit': {
        endMatch(seat === 0 ? 1 : 0, 'OPPONENT FORFEITED');
        return;
      }
    }
  }

  room.match = { sim: match, stop, onMessage, graceMs };
  return room.match;
}

// Route per-seat match messages (ready/input/forfeit) through the active match.
export function attachMatchRouting(net) {
  net.wss.on('nox:message', (ws, sess, msg) => {
    const code = net.roomOf.get(ws);
    if (!code) return;
    const room = net.noxRooms?.get(code);
    if (room?.match) room.match.onMessage(ws, msg);
  });
}
