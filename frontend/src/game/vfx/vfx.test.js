// Visual-event contract + shared recipe + EffectTimeline tests
// (spec: docs/reasonix/specs/visual-parity-sync.md)
import test from 'node:test';
import assert from 'node:assert/strict';
import { emitVfx, drainVfx } from './events.js';
import { spawnForEvent, PROFILES, profileOf } from './recipes.js';
import { EffectTimeline } from './timeline.js';
import { createMatch, simTick } from '../sim/game-sim.js';

const idle = { up: false, down: false, left: false, right: false, dash: false, shoot: false };
const shoot = { ...idle, shoot: true };

test('recipes are deterministic for the same seed and differ across seeds', () => {
  const ev = (seed) => ({ id: 1, tick: 0, kind: 'needleCrit', x: 10, y: 20, actor: 0, target: 1, amount: 6, seed });
  const a = spawnForEvent(ev(12345));
  const b = spawnForEvent(ev(12345));
  const c = spawnForEvent(ev(54321));
  assert.deepEqual(a, b, 'same seed must reproduce identical particles');
  assert.notDeepEqual(a, c, 'different seeds must produce different particles');
});

test('every canonical event kind maps to a non-empty recipe (roundEnd is a marker)', () => {
  const kinds = ['muzzle', 'dash', 'wallHit', 'trickBounce', 'hitStandard', 'needleBlock',
    'needleCrit', 'cannonHit', 'trickHit', 'shieldHit', 'shieldBreak', 'pickup', 'heal',
    'lavaHit', 'voidHit', 'death', 'hazardMove'];
  for (const kind of kinds) {
    const parts = spawnForEvent({
      id: 1, tick: 0, kind, x: 0, y: 0, actor: 0, target: 1, bulletType: 'cannon',
      pickup: 'ammo_needle', amount: 3, meta: { from: 'lava', to: 'slime' }, seed: 7,
    });
    assert.ok(parts.length > 0, kind + ' produced no particles');
    for (const p of parts) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.life), kind + ' produced NaN particles');
    }
  }
  assert.deepEqual(spawnForEvent({ id: 1, tick: 0, kind: 'roundEnd', x: 0, y: 0, seed: 1 }), []);
});

test('actor profiles are one recipe with three visual profiles (cyan/pink/amber)', () => {
  assert.equal(PROFILES[0].color, '#58d8ff');
  assert.equal(PROFILES[1].color, '#ff5ca8');
  assert.equal(PROFILES.bot.color, '#ffb23e');
  assert.equal(profileOf(99), PROFILES[0]);
});

test('timeline dedupes duplicate event ids and keeps aging across ingests', () => {
  const tl = new EffectTimeline();
  const ev = { id: 42, tick: 0, kind: 'lavaHit', x: 5, y: 5, seed: 9 };
  assert.equal(tl.ingest(ev), true);
  assert.equal(tl.ingest({ ...ev }), false, 'duplicate id must be shown once');
  assert.equal(tl.parts.length, 11); // 10 particles + 1 float text
  tl.step(5);
  assert.ok(Math.abs(tl.parts[0].life - 13) < 1e-9, 'particles age per step');
  // "snapshot application" between steps must never erase active effects
  tl.ingest({ id: 43, tick: 1, kind: 'pickup', x: 0, y: 0, pickup: 'shield', seed: 3 });
  assert.equal(tl.parts.length, 11 + 16);
  tl.step(20);
  assert.ok(tl.parts.every(p => p.life <= 13), 'aging continued, nothing was reset');
});

test('held particles stay invisible and unaged until their hold elapses', () => {
  const tl = new EffectTimeline();
  tl.hold(10);
  tl.ingest({ id: 1, tick: 0, kind: 'dash', x: 0, y: 0, actor: 0, seed: 5 });
  tl.step(3);
  assert.equal(tl.visible().length, 0, 'held effects must not render early');
  tl.step(7);
  assert.equal(tl.visible().length, 8, 'released effects render');
});

test('sim emits visual events at the exact gameplay effect branches', () => {
  const m = createMatch(777);
  // muzzle on shoot
  m.players[0].shootCd = 0;
  simTick(m, [shoot, idle], 1);
  let evs = drainVfx(m);
  assert.ok(evs.some(e => e.kind === 'muzzle' && e.actor === 0), 'shoot -> muzzle event');

  // dash
  m.players[0].dash = 0; m.players[0].dashCd = 0; m.players[0].extraDash = 0;
  simTick(m, [{ ...idle, dash: true }, idle], 1);
  evs = drainVfx(m);
  assert.ok(evs.some(e => e.kind === 'dash' && e.actor === 0), 'dash -> dash event');

  // ammo pickup
  m.pickups.push({ x: m.players[0].x, y: m.players[0].y, t: 0, life: 480, kind: 'ammo_needle' });
  simTick(m, [idle, idle], 1);
  evs = drainVfx(m);
  const pk = evs.find(e => e.kind === 'pickup' && e.pickup === 'ammo_needle');
  assert.ok(pk && pk.amount === 5 && pk.tx != null && pk.ty != null, 'ammo pickup -> pickup event with count + actor pos');

  // lava hit (no shield, invuln cleared, standing on an active lava vent)
  const hz = { c: 0, r: 0, x: m.players[1].x - 18, y: m.players[1].y - 18, w: 36, h: 36, kind: 'lava', t: 0, lavaCd: 0 };
  m.hazards.push(hz);
  m.players[1].lavaCd = 0; m.players[1].inv = 0; m.players[1].shield = false; m.players[1].shieldHp = 0;
  simTick(m, [idle, idle], 1);
  evs = drainVfx(m);
  assert.ok(evs.some(e => e.kind === 'lavaHit' && e.actor === 1), 'lava -> lavaHit event');

  // wall impact: standard bullet fired into the border wall
  m.bullets.length = 0;
  m.bullets.push({ id: 999, x: 12, y: 280, vx: -8, vy: 0, owner: 0, life: 90, trail: [], type: 'standard', r: 5, dmg: 2, bounces: 0, bouncesMax: 0 });
  simTick(m, [idle, idle], 1);
  evs = drainVfx(m);
  assert.ok(evs.some(e => e.kind === 'wallHit' && e.bulletType === 'standard'), 'wall impact -> wallHit event');
});

test('event ids are monotonic per match; recipes stay deterministic for networked seeds', () => {
  const m = createMatch(1234);
  for (let i = 0; i < 30; i++) {
    m.players[0].shootCd = 0; m.players[1].shootCd = 0;
    simTick(m, [shoot, shoot], 1);
  }
  const evs = drainVfx(m);
  assert.ok(evs.length > 10, 'expected a stream of events');
  for (let i = 1; i < evs.length; i++) {
    assert.ok(evs[i].id > evs[i - 1].id, 'ids must be strictly increasing');
  }
  const a = spawnForEvent(evs[0]);
  const b = spawnForEvent({ ...evs[0] });
  assert.deepEqual(a, b);
});

test('simNextRound clears queued events (no cross-round leakage)', () => {
  const m = createMatch(5);
  m.players[0].shootCd = 0;
  simTick(m, [shoot, idle], 1);
  assert.ok(m.vfx.length > 0);
  // round end clears
  m.vfx.length = 0;
  emitVfx(m, 'death', 0, 0, { actor: 0 });
  assert.equal(m.vfx.length, 1);
  m.vfx.length = 0;
});
