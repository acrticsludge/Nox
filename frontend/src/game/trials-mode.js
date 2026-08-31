import {
  clearPendingTimeouts,
  clearInputState,
  forfeitLock,
  gameMode,
  timeLeft,
  trialPoints,
  trialScoreBreakdown,
  trialHighScore,
  voidRect,
  voidShrinkStart,
  lastSaveTime,
  safeRadius,
  generateTrialsWalls,
  drawWalls,
  drawHazards,
  players,
  bot,
  bullets,
  particles,
  pickups,
  hazardRelocateTimer,
  spawnTrialsPickups,
  updateHUD,
  render,
  startCountdown,
  TRIAL_DURATION,
  TRIALS_H,
  MAX_HP,
  BOT_MAX_HP,
  hazards,
  wallData,
  GRID,
  TRIALS_COLS,
  TRIALS_ROWS,
  TRIALS_HAZARD_COUNT,
  HAZARD_RELOCATE_MIN,
  HAZARD_RELOCATE_MAX,
  setCyberBadgeText,
} from "./game-logic.js";

function generateTrialsHazards() {
  hazards = [];
  const key = (c, r) => `${c},${r}`;
  const occ = new Set();
  wallData.forEach(w => {
    if (!w.isBorder) {
      for(let cx = Math.floor(w.x/GRID); cx <= Math.floor((w.x+w.w)/GRID); cx++)
        for(let cy = Math.floor(w.y/GRID); cy <= Math.floor((w.y+w.h)/GRID); cy++)
          occ.add(`${cx},${cy}`);
    }
  });
  const protectedCells = new Set();
  [[6,14],[7,14],[40,14],[41,14],[23,14],[24,14],[23,13],[24,13],[24,15],[23,15]].forEach(([c, r]) => {
    for(let dc = -2; dc <= 2; dc++) for(let dr = -2; dr <= 2; dr++) protectedCells.add(key(c + dc, r + dr));
  });

  const elapsed = (TRIAL_DURATION || 600) - (timeLeft || 600);
  const target = TRIALS_HAZARD_COUNT + (elapsed > 300 ? 2 : 0) + (elapsed > 420 ? 3 : 0);
  let placed = 0, attempts = 2000;
  while(placed < target && attempts > 0) {
    attempts--;
    const c = 2 + Math.floor(Math.random() * (TRIALS_COLS - 4));
    const r = 2 + Math.floor(Math.random() * (TRIALS_ROWS - 4));
    const k = key(c, r);
    if(occ.has(k) || protectedCells.has(k)) continue;
    let adj = false;
    for(let dc = -1; dc <= 1; dc++) for(let dr = -1; dr <= 1; dr++) {
      if(dc === 0 && dr === 0) continue;
      if(occ.has(key(c + dc, r + dr))) { adj = true; break; }
    }
    if(adj) continue;
    const kind = Math.random() < 0.5 ? 'lava' : 'slime';
    hazards.push({c, r, x: c * GRID + 2, y: r * GRID + 2, w: 36, h: 36, kind, t: Math.random() * 300, lavaCd: 0});
    occ.add(k);
    placed++;
  }
}
function startTrials() {
  clearPendingTimeouts();
  clearInputState();
  forfeitLock = false;
  document.getElementById('gameOverOverlay')?.classList.add('hidden');
  document.getElementById('roundOverlay')?.classList.add('hidden');
  document.getElementById('startOverlay')?.classList.add('hidden');

  gameMode = 'trials';
  timeLeft = TRIAL_DURATION;
  trialPoints = 0;
  voidRect = null;
  voidShrinkStart = 0;
  lastSaveTime = 0;
  safeRadius = 999;

  generateTrialsWalls();
  drawWalls();
  drawHazards();

  const preservedSpeed = globalSpeed;
  players[0].x = 320; players[0].y = TRIALS_H / 2; players[0].hp = MAX_HP; players[0].alive = true;
  players[0].dash = 0; players[0].dashCd = 0; players[0].inv = 0; players[0].overcharge = 0;
  players[0].shield = false; players[0].shieldHp = 0; players[0].speedBoost = 0;
  players[0].extraDash = 0; players[0].squish = 0; players[0].inSlime = false;
  players[0].lavaCd = 0; players[0].voidCd = 0; players[0].baseSpeed = preservedSpeed; players[0].angle = 0;
  players[0].ammoType = 'standard'; players[0].ammo = Infinity;

  // In trials, P2 is not used - hide it so only P1 + bot render (fixes 3-char bug)
  players[1].alive = false;
  players[1].hp = 0;
  players[1].inv = 0;
  players[1].shield = false;
  players[1].overcharge = 0;

  bot.hp = BOT_MAX_HP; bot.alive = true;
  bot.x = TRIALS_W - 320; bot.y = TRIALS_H / 2;
  bot.vx = 0; bot.vy = 0; bot.angle = Math.PI;
  bot.dash = 0; bot.dashCd = 0; bot.inv = 0; bot.shootCd = 0;
  bot.overcharge = 0; bot.shield = false; bot.shieldHp = 0;
  bot.speedBoost = 0; bot.extraDash = 0; bot.baseSpeed = preservedSpeed;
  bot.squish = 0; bot.inSlime = false; bot.lavaCd = 0; bot.voidCd = 0;
  bot.ammoType = 'standard'; bot.ammo = Infinity;
  bot.behavior = 'patrol'; bot.behaviorTimer = 0;
  bot.reactionDelay = 80 + Math.random() * 40;
  bot.aimError = 0;

  pushOutOfWalls(players[0]);
  pushOutOfWalls(bot);

  bullets.length = 0; particles.length = 0; pickups.length = 0;
  if (window.NOX_GAME) {
    window.NOX_GAME.bullets.length = 0;
    window.NOX_GAME.pickups.length = 0;
    window.NOX_GAME.particles.length = 0;
  }

  hazardRelocateTimer = HAZARD_RELOCATE_MIN + Math.random() * (HAZARD_RELOCATE_MAX - HAZARD_RELOCATE_MIN);
  spawnTrialsPickups(4);

  trialHighScore = parseInt(localStorage.getItem('nv_trials_highscore') || '0', 10);
  updateHUD();
  render();
  // 3-2-1 countdown before bot/player can move
  startCountdown();
}
function clearTrialsState() {
  try { localStorage.removeItem('nv_trials_state'); } catch {}
  window.dispatchEvent(new CustomEvent('nox:trialsStateChanged'));
}
function showTrialsGameOver(points, reason, won) {
  clearPendingTimeouts();
  clearInputState();
  const roundOverlay = document.getElementById('roundOverlay');
  const ov = document.getElementById('gameOverOverlay');
  if(roundOverlay) roundOverlay.classList.add('hidden');
  if(ov) ov.classList.remove('hidden');
  document.getElementById('startOverlay')?.classList.add('hidden');
  bullets.length = 0;
  pickups.length = 0;
  const wt = document.getElementById('winnerText');
  const ws = document.getElementById('winnerSub');
  const m = Math.floor(Math.max(0, timeLeft) / 60).toString().padStart(2, '0');
  const s = Math.floor(Math.max(0, timeLeft) % 60).toString().padStart(2, '0');
  if(wt) {
    wt.textContent = won ? 'TRIAL SURVIVED' : 'TRIAL FAILED';
    wt.className = 'result-score ' + (won ? 'winner-p1' : 'winner-p2');
  }
  if(ws) ws.textContent = `${points.toLocaleString()} PTS • ${reason || (won ? 'VOID CONQUERED' : 'VOID CLAIMED YOU')} • ${m}:${s} LEFT`;
  // save high score
  if(points > trialHighScore) {
    trialHighScore = points;
    try { localStorage.setItem('nv_trials_highscore', String(trialHighScore)); } catch {}
  }
  const govBadge = document.querySelector('#gameOverOverlay .cyber-badge');
  if(govBadge) setCyberBadgeText(govBadge, won ? '⬢ TRIAL COMPLETE' : '⬢ TRIAL FAILED');
}
