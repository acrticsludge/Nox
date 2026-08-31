// P2-05 / P2-18: Trials saves are versioned, validated, never crash, and
// never preserve invalid runtime geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTrialsSave, buildTrialsSaveSnapshot, loadTrialsSave, TRIALS_SAVE_VERSION } from './trials-save.js';

const VALID = {
  version: TRIALS_SAVE_VERSION,
  timeLeft: 500,
  trialPoints: 123.456,
  trialHighScore: 5000,
  wallData: [{ x: 100, y: 100, w: 40, h: 120 }],
  hazards: [{ x: 200, y: 200, w: 36, h: 36, t: 10, lavaCd: 0, kind: 'lava' }],
  players: [{ x: 960, y: 560, hp: 12, alive: true, ammo: 5, ammoType: 'standard' }],
  bot: { x: 1400, y: 560, hp: 12, alive: true, isBot: true },
  bullets: [{ x: 900, y: 560, vx: 7, vy: 0, type: 'standard', owner: 0 }],
  pickups: [{ x: 500, y: 500, t: 3, life: 400, kind: 'shield' }],
  voidRect: null,
  voidShrinkStart: 0,
  safeRadius: 999,
  lastSaveTime: 600,
};

test('valid save passes and normalizes', () => {
  const r = validateTrialsSave(VALID);
  assert.equal(r.ok, true);
  assert.equal(r.state.version, TRIALS_SAVE_VERSION);
  assert.equal(r.state.bot.isBot, true);
  assert.ok(r.state.players[0].hp > 0);
});

test('corrupt JSON payloads are rejected as malformed, not crash', () => {
  for (const bad of [null, 'string', 42, [], { noVersion: true }, { version: 'x' }]) {
    const r = validateTrialsSave(bad);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'malformed');
  }
});

test('old/new versions are discarded with a stable reason', () => {
  assert.equal(validateTrialsSave({ ...VALID, version: 1 }).reason, 'unsupported-version');
  assert.equal(validateTrialsSave({ ...VALID, version: 99 }).reason, 'newer-version');
});

test('out-of-range / non-finite fields never survive validation', () => {
  assert.equal(validateTrialsSave({ ...VALID, timeLeft: -5 }).reason, 'invalid-field');
  assert.equal(validateTrialsSave({ ...VALID, timeLeft: 99999 }).reason, 'invalid-field');
  assert.equal(validateTrialsSave({ ...VALID, trialPoints: NaN }).reason, 'invalid-field');
  assert.equal(validateTrialsSave({ ...VALID, safeRadius: Infinity }).reason, 'invalid-field');
  assert.equal(validateTrialsSave({ ...VALID, players: [] }).reason, 'invalid-field');
  assert.equal(validateTrialsSave({ ...VALID, wallData: [] }).reason, 'invalid-field');
  assert.equal(validateTrialsSave({ ...VALID, hazards: [{ ...VALID.hazards[0], kind: 'acid' }] }).reason, 'invalid-field');
  assert.equal(validateTrialsSave({ ...VALID, wallData: [{ x: 1e9, y: 0, w: 40, h: 40 }] }).reason, 'invalid-field');
});

test('void rect geometry is validated (no invalid runtime geometry)', () => {
  assert.equal(validateTrialsSave({ ...VALID, voidRect: { x: 0, y: 0, w: -10, h: 10 } }).reason, 'invalid-field');
  assert.equal(validateTrialsSave({ ...VALID, voidRect: 'big void' }).reason, 'invalid-field');
  assert.equal(validateTrialsSave({ ...VALID, voidRect: null }).ok, true);
});

test('snapshot builder omits reconstructable cosmetics (P2-18)', () => {
  const snapshot = buildTrialsSaveSnapshot({
    timeLeft: 500, trialPoints: 10, trialHighScore: 0,
    wallData: [{ x: 1, y: 2, w: 3, h: 4 }],
    hazards: [{ x: 1, y: 2, w: 36, h: 36, t: 0, lavaCd: 0, kind: 'slime' }],
    players: [{ x: 1, y: 2, hp: 12 }],
    bot: { x: 3, y: 4, hp: 12 },
    bullets: [],
    pickups: [],
    particles: [{ x: 0, y: 0, vx: 1, life: 5, color: '#fff', type: 'hit' }],
    voidRect: null, voidShrinkStart: 0, safeRadius: 999, lastSaveTime: 0,
  });
  assert.ok(!('particles' in snapshot));
  // walls keep only structural fields
  assert.deepEqual(Object.keys(snapshot.wallData[0]), ['x', 'y', 'w', 'h']);
});

test('loadTrialsSave discards failing blobs from storage (self-healing)', () => {
  const store = new Map();
  const fakeStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: k => store.delete(k),
  };
  assert.equal(loadTrialsSave(fakeStorage).reason, 'no-save');
  fakeStorage.setItem('nv_trials_state', '{broken json');
  assert.equal(loadTrialsSave(fakeStorage).reason, 'corrupt-json');
  assert.equal(store.has('nv_trials_state'), false, 'corrupt blob must be removed');
  fakeStorage.setItem('nv_trials_state', JSON.stringify({ ...VALID, version: 1 }));
  assert.equal(loadTrialsSave(fakeStorage).reason, 'unsupported-version');
  assert.equal(store.has('nv_trials_state'), false, 'outdated blob must be removed');
  fakeStorage.setItem('nv_trials_state', JSON.stringify(VALID));
  assert.equal(loadTrialsSave(fakeStorage).ok, true);
});
