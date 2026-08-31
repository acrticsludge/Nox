import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, simTick, simNextRound, MAX_HP, WIN_SCORE } from './game-sim.js';

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function hashMatch(m) {
  const s = JSON.stringify({
    tick: m.tick,
    state: m.state,
    timeLeft: m.timeLeft,
    scores: m.scores,
    round: m.round,
    players: m.players.map(p => [p.x, p.y, p.hp, p.dash, p.dashCd, p.inv, p.shootCd, p.overcharge, p.shield, p.shieldHp, p.speedBoost, p.extraDash, p.ammoType, p.ammo, p.alive, p.angle]),
    bullets: m.bullets.map(b => [b.x, b.y, b.vx, b.vy, b.life, b.type, b.dmg, b.bounces]),
    pickups: m.pickups.map(pu => [pu.x, pu.y, pu.t, pu.life, pu.kind]),
    hazards: m.hazards.map(h => [h.c, h.r, h.kind, h.t]),
    walls: m.walls.map(w => [w.x, w.y, w.w, w.h]),
    safeRadius: Math.round(m.safeRadius),
  });
  return fnv1a(s);
}

// deterministic scripted input generator (independent of match rng)
function makeScriptedInputs(scriptSeed) {
  let a = scriptSeed >>> 0;
  const rnd = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return (tick, pid) => {
    const phase = Math.floor(tick / 37) + pid * 13;
    const dir = phase % 8;
    return {
      up: dir === 0 || dir === 4,
      down: dir === 1,
      left: dir === 2 || dir === 5,
      right: dir === 3 || dir === 7,
      dash: tick % 97 === pid * 7,
      shoot: (tick + pid * 31) % 23 < 4,
    };
  };
}

function runMatch(seed, scriptSeed, ticks) {
  const m = createMatch(seed);
  const input = makeScriptedInputs(scriptSeed);
  for (let t = 0; t < ticks; t++) {
    simTick(m, [input(t, 0), input(t, 1)]);
    if (m.state === 'roundEnd') simNextRound(m);
    if (m.state === 'matchEnd') break;
  }
  return m;
}

test('sim module imports in Node with zero DOM', async () => {
  const mod = await import('./game-sim.js');
  assert.equal(typeof mod.createMatch, 'function');
  assert.equal(typeof mod.simTick, 'function');
});

test('createMatch initializes a valid match', () => {
  const m = createMatch(12345);
  assert.equal(m.state, 'playing');
  assert.equal(m.round, 1);
  assert.deepEqual(m.scores, [0, 0]);
  assert.equal(m.players.length, 2);
  assert.equal(m.players[0].hp, MAX_HP);
  assert.ok(m.walls.length >= 5, 'has border + inner walls');
  assert.ok(m.pickups.length > 0, 'initial pickup spawned');
});

test('determinism: same seed + same inputs = identical hash over 10,000 ticks', () => {
  const a = runMatch(777, 424242, 10000);
  const b = runMatch(777, 424242, 10000);
  assert.equal(hashMatch(a), hashMatch(b));
});

test('different seeds produce divergent matches', () => {
  const a = runMatch(1, 999, 2000);
  const b = runMatch(2, 999, 2000);
  assert.notEqual(hashMatch(a), hashMatch(b));
});

test('elimination ends round, scores, next round resets', () => {
  const m = createMatch(42);
  m.walls = m.walls.filter(w => w.isBorder);
  m.hazards = [];
  m.pickups = [];
  const p0 = m.players[0], p1 = m.players[1];
  p0.x = 300; p0.y = 280; p0.angle = 0;
  p1.x = 380; p1.y = 280;
  const idle = { up: false, down: false, left: false, right: false, dash: false, shoot: false };
  const fire = { ...idle, shoot: true };
  let guard = 0;
  while (m.state === 'playing' && guard++ < 4000) {
    simTick(m, [fire, idle]);
  }
  assert.equal(m.state, 'roundEnd', 'round ended by elimination');
  assert.equal(m.roundResult.winner, 0);
  assert.equal(m.scores[0], 1);
  simNextRound(m);
  assert.equal(m.state, 'playing');
  assert.equal(m.round, 2);
  assert.equal(m.players[1].hp, MAX_HP);
  assert.equal(m.bullets.length, 0);
});

test('time expiry resolves round by HP advantage', () => {
  const m = createMatch(7);
  m.players[1].hp = 3;
  m.timeLeft = 0.02;
  const idle = { up: false, down: false, left: false, right: false, dash: false, shoot: false };
  let guard = 0;
  while (m.state === 'playing' && guard++ < 5) simTick(m, [idle, idle]);
  assert.equal(m.state, 'roundEnd');
  assert.equal(m.roundResult.winner, 0);
  assert.ok(m.roundResult.reason.includes('TIME'));
});

test('match ends at WIN_SCORE', () => {
  const m = createMatch(99);
  m.scores = [WIN_SCORE - 1, 0];
  m.walls = m.walls.filter(w => w.isBorder);
  m.hazards = [];
  m.pickups = [];
  const p0 = m.players[0], p1 = m.players[1];
  p0.x = 300; p0.y = 280; p0.angle = 0;
  p1.x = 380; p1.y = 280;
  const idle = { up: false, down: false, left: false, right: false, dash: false, shoot: false };
  const fire = { ...idle, shoot: true };
  let guard = 0;
  while (m.state === 'playing' && guard++ < 4000) simTick(m, [fire, idle]);
  assert.equal(m.state, 'matchEnd');
  assert.equal(m.matchWinner, 0);
});

test('simTick ignores input when not playing', () => {
  const m = createMatch(5);
  m.state = 'roundEnd';
  const before = m.tick;
  const full = { up: true, down: true, left: true, right: true, dash: true, shoot: true };
  simTick(m, [full, full]);
  assert.equal(m.tick, before);
});
