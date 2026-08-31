// P1-07 / P1-08: bot consumes the player's REAL applied velocity for
// predictive aim, and the bot AVOIDS the shrinking void (documented rule).
import test from 'node:test';
import assert from 'node:assert/strict';
import { updateBotAI } from './bot-ai.js';

const BASE_STATE = (over = {}) => ({
  player: { x: 800, y: 560, vx: 0, vy: 0, dash: 0, inv: 0, alive: true },
  pickups: [],
  hazards: [],
  bullets: [],
  walls: [],
  voidRect: null,
  safeRadius: 999,
  gameMode: 'trials',
  wallsCollide: () => false,
  ...over,
});

const BOT = (over = {}) => ({
  id: 2, x: 1600, y: 560, vx: 0, vy: 0, angle: Math.PI, hp: 12, maxHp: 12, alive: true,
  dash: 0, dashCd: 0, inv: 0, shootCd: 0, overcharge: 0, shield: false, shieldHp: 0,
  speedBoost: 0, extraDash: 0, baseSpeed: 3.6, squish: 0, inSlime: false,
  lavaCd: 0, voidCd: 0, slimeCd: 0, ammoType: 'standard', ammo: Infinity,
  isBot: true, behavior: 'patrol', behaviorTimer: 0, targetX: 0, targetY: 0,
  reactionDelay: 0, lastShotTime: 0, aimError: 0, behaviorCommitment: 0,
  lastBehavior: 'patrol', lastPlayerDash: 0, strafeDir: 0,
  ...over,
});

function normalizeAngleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

test('perpendicular applied velocity produces a real angular lead (P1-07)', () => {
  const bot = BOT();
  const state = BASE_STATE({
    // player 800px away moving +y (perpendicular to LOS) at 3.6 px/frame
    player: { x: 800, y: 560, vx: 0, vy: 0, lastVx: 0, lastVy: 3.6, dash: 0, inv: 0, alive: true },
  });
  updateBotAI(bot, state);
  const lead = normalizeAngleDelta(bot.targetAngle, Math.PI);
  assert.ok(Math.abs(lead) > 0.01, `aim must LEAD a moving player (lead=${lead})`);
  assert.ok(lead < 0, 'player moving +y must pull predicted aim toward +y (negative delta vs PI)');
});

test('stale player.vx is ignored when real applied lastVx exists (P1-07)', () => {
  const bot = BOT();
  const state = BASE_STATE({
    player: { x: 800, y: 560, vx: 9, vy: 0, lastVx: 0, lastVy: 0, dash: 0, inv: 0, alive: true },
  });
  updateBotAI(bot, state);
  assert.ok(Math.abs(normalizeAngleDelta(bot.targetAngle, Math.PI)) < 0.001,
    'zero applied velocity must aim exactly at the player, not at the stale vx');
});

test('applied dash delta is not double-multiplied (P1-07)', () => {
  // perpendicular dash at 8.46 px/frame — prediction must lead by the applied
  // delta, not 2.35x on top of it
  const botA = BOT();
  const stA = BASE_STATE({
    player: { x: 800, y: 560, vx: 0, vy: 0, lastVx: 0, lastVy: 8.46, dash: 16, inv: 0, alive: true },
  });
  updateBotAI(botA, stA);
  const leadA = Math.abs(normalizeAngleDelta(botA.targetAngle, Math.PI));
  assert.ok(leadA > 0.1, `dash delta must produce a large lead (leadA=${leadA})`);
  assert.ok(leadA < Math.PI / 4, 'prediction must stay bounded (30-frame cap)');
});

test('bot outside the shrinking void selects avoidVoid and moves to safety (P1-08)', () => {
  const bot = BOT({ x: 200, y: 300, behavior: 'engagePlayer', lastBehavior: 'engagePlayer', behaviorCommitment: 0 });
  const state = BASE_STATE({
    voidRect: { x: 300, y: 200, w: 1320, h: 720 }, // bot (200,300) is outside
    safeRadius: 300,
    player: { x: 700, y: 500, vx: 0, vy: 0, lastVx: 0, lastVy: 0, dash: 0, inv: 0, alive: true },
  });
  updateBotAI(bot, state);
  assert.equal(bot.behavior, 'avoidVoid', 'outside the safe zone the bot must select avoidVoid');
  // avoidVoid must steer back toward the safe-zone center (960, 560): +x
  const out = updateBotAI(bot, state);
  assert.ok(out.mx > 0, 'avoidVoid movement must go back toward the safe zone');
});

test('bot inside the safe zone does not void-avoid (P1-08)', () => {
  const bot = BOT({ x: 960, y: 560 });
  const state = BASE_STATE({ voidRect: { x: 300, y: 200, w: 1320, h: 720 }, safeRadius: 300 });
  updateBotAI(bot, state);
  assert.notEqual(bot.behavior, 'avoidVoid');
});
