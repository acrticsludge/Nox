// P2-06 migration parity: core/constants.js is the canonical constants
// owner. game-logic.js re-exports the same objects; this test pins the
// canonical tuning values so a drift (either direction) fails CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from './constants.js';

test('canonical constants keep the balanced tuning values', () => {
  assert.equal(C.W, 960);
  assert.equal(C.H, 560);
  assert.equal(C.PLAYER_R, 16);
  assert.equal(C.BULLET_R, 5);
  assert.equal(C.BULLET_SPEED, 7.2);
  assert.equal(C.BASE_SPEED, 3.6);
  assert.equal(C.MAX_HP, 12);
  assert.equal(C.WIN_SCORE, 5);
  assert.equal(C.SHIELD_MAX_HP, 5);
  assert.equal(C.TRIALS_W, 1920);
  assert.equal(C.TRIALS_H, 1120);
  assert.equal(C.TRIAL_DURATION, 600);
  assert.equal(C.VOID_START_TIME, 450);
  assert.equal(C.VOID_SHRINK_DURATION, 30);
  assert.equal(C.BOT_MAX_HP, 12);
  assert.equal(C.REQUIRED_WALL_GAP, 34);
});

test('power / bullet / ammo tables are intact', () => {
  assert.deepEqual(Object.keys(C.POWER_TYPES).sort(), ['blink', 'heal', 'overcharge', 'shield']);
  assert.deepEqual(Object.keys(C.BULLET_TYPES).sort(), ['cannon', 'needle', 'standard', 'trick']);
  assert.equal(C.BULLET_TYPES.trick.bouncesMax, 5);
  assert.equal(C.BULLET_TYPES.cannon.dmg, 4);
  assert.equal(C.BULLET_TYPES.needle.dmgRear, 6);
  assert.equal(C.AMMO_PICKUP_CFG.ammo_cannon.ammo, 3);
  assert.equal(C.AMMO_PICKUP_CFG.ammo_needle.bullet, 'needle');
});

test('shield powerup heals exactly SHIELD_MAX_HP', () => {
  assert.equal(C.POWER_TYPES.shield.hp, C.SHIELD_MAX_HP);
});
