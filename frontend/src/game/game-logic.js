// NEON VOID // 2P Duel Game Logic + Void Trials Solo
// Extracted from play.astro to separate concerns

import { updateBotAI } from './bot-ai.js';
import { drawWalls, drawHazards, render, setCyberBadgeText, setCyberBadgeVariant, updateHUD } from './game-view.js';
import { createMatch, simTick, simNextRound, mulberry32 } from './sim/game-sim.js';
import { emitVfx, drainVfx } from './vfx/events.js';
import { EffectTimeline } from './vfx/timeline.js';
import { TRICK_DMG } from './vfx/recipes.js';
import { applyLedger, createLedger, ledgerTotal, sumLedger } from './trials-ledger.js';
import { TRIALS_SAVE_KEY, buildTrialsSaveSnapshot, loadTrialsSave } from './trials-save.js';
// Optional import for online HUD (not available in backend test environment)
let setOnlineHud = () => {};
let getOnlineHud = () => ({ selfSeat: 0 });
const _loadOnlineHud = async () => {
  try {
    const mod = await import('./net/online-hud.js');
    setOnlineHud = mod.setOnlineHud;
    getOnlineHud = mod.getOnlineHud;
  } catch {}
};
// Preload for browser environments
if (typeof window !== 'undefined') _loadOnlineHud();
// P2-06 migration slice 1: gameplay constants are owned by core/constants.js
// (pre-existing canonical module). game-logic re-exports them so NOX_GAME and
// existing importers keep working; tuning happens in exactly one file.
import {
  W, H, PLAYER_R, BULLET_R, BULLET_SPEED, BASE_SPEED, DASH_COOLDOWN, DASH_TIME,
  MAX_HP, ROUND_TIME, WIN_SCORE, SHIELD_MAX_HP, HEAL_AMOUNT, GRID, COLS, ROWS,
  TRIALS_W, TRIALS_H, TRIALS_COLS, TRIALS_ROWS, TRIAL_DURATION, VOID_START_TIME,
  VOID_SHRINK_DURATION, BOT_MAX_HP, TRIALS_HAZARD_COUNT, TRIALS_WALL_TARGET,
  REQUIRED_WALL_GAP, POWER_TYPES, BULLET_TYPES, AMMO_PICKUP_CFG,
} from './core/constants.js';

const AMMO_KINDS = ['ammo_needle','ammo_cannon','ammo_trick'];

let wallData = [];
let hazards = [];
let safeRadius = 999;
let voidTick = [0, 0];
const HAZARD_RELOCATE_MIN = 480; // 8s @60fps
const HAZARD_RELOCATE_MAX = 720; // 12s
let hazardRelocateTimer = HAZARD_RELOCATE_MIN + Math.random() * (HAZARD_RELOCATE_MAX - HAZARD_RELOCATE_MIN);
function wallGap(a, b) {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  if (dx === 0 && dy === 0) return -1; // overlap (shouldn't happen)
  if (dx === 0) return dy;
  if (dy === 0) return dx;
  return Math.hypot(dx, dy);
}

function generateRandomWalls() {
  // Outer frame walls - non-overlapping corners so they merge as one piece
  const walls = [
    {x:0, y:0, w:960, h:10, isBorder: true}, {x:0, y:550, w:960, h:10, isBorder: true},
    {x:0, y:10, w:10, h:540, isBorder: true}, {x:950, y:10, w:10, h:540, isBorder: true},
  ];
  const occ = new Set();
  const key = (c, r) => `${c},${r}`;
  const protectedCells = new Set();
  [[3,7],[4,7],[20,7],[19,7],[11,7],[12,7],[11,6],[12,6],[12,8],[11,8]].forEach(([c, r]) => {
    for(let dc = -1; dc <= 1; dc++) for(let dr = -1; dr <= 1; dr++) protectedCells.add(key(c + dc, r + dr));
  });

  function canPlace(c, r, len, isHoriz) {
    const cells = [];
    for(let k = 0; k < len; k++) {
      const cc = isHoriz ? c + k : c;
      const rr = isHoriz ? r : r + k;
      if(cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS) return null;
      if(protectedCells.has(key(cc, rr))) return null;
      if(occ.has(key(cc, rr))) return null;
      for(let dc = -1; dc <= 1; dc++) for(let dr = -1; dr <= 1; dr++) {
        if(dc === 0 && dr === 0) continue;
        const nc = cc + dc, nr = rr + dr;
        if(occ.has(key(nc, nr))) return null;
      }
      cells.push([cc, rr]);
    }
    return cells;
  }

  const target = 8 + Math.floor(Math.random() * 4);
  let placed = 0, attempts = 200;
  for(let a = 0; a < attempts && placed < target; a++) {
    const isHoriz = Math.random() < 0.5;
    const len = 2 + Math.floor(Math.random() * 4);
    // keep 1 cell margin from outer border so walls don't overlap frame
    const cMax = COLS - (isHoriz ? len : 1) - 1;
    const rMax = ROWS - (isHoriz ? 1 : len) - 1;
    if (cMax < 2 || rMax < 2) continue;
    const c = 1 + Math.floor(Math.random() * (cMax - 1 + 1));
    const r = 1 + Math.floor(Math.random() * (rMax - 1 + 1));
    const cells = canPlace(c, r, len, isHoriz);
    if(!cells) continue;
    let x, y, w, h;
    if(isHoriz) {
      x = c * GRID; y = r * GRID - 6; w = len * GRID; h = 12;
    } else {
      x = c * GRID - 6; y = r * GRID; w = 12; h = len * GRID;
    }
    // Enforce exact pointer-width gap: player diameter = 32, require 36px clearance
    const newWall = {x, y, w, h};
    let tooClose = false;
    for (const ew of walls) {
      const g = wallGap(newWall, ew);
      if (g !== -1 && g < REQUIRED_WALL_GAP) { tooClose = true; break; }
    }
    if (tooClose) continue;
    cells.forEach(([cc, rr]) => occ.add(key(cc, rr)));
    walls.push({x, y, w, h, rx: 6});
    placed++;
  }
  if(placed < 6) {
    walls.push(
      {x: 6 * GRID - 6, y: 4 * GRID, w: 12, h: 6 * GRID, rx: 6},
      {x: 18 * GRID - 6, y: 4 * GRID, w: 12, h: 6 * GRID, rx: 6},
      {x: 8 * GRID, y: 4 * GRID - 6, w: 8 * GRID, h: 12, rx: 6},
      {x: 8 * GRID, y: 10 * GRID - 6, w: 8 * GRID, h: 12, rx: 6}
    );
  }
  wallData = walls;
  hazards = [];
  const hCount = 4 + Math.floor(Math.random() * 3);
  let hAttempts = 0, hPlaced = 0;
  while(hPlaced < hCount && hAttempts < 90) {
    hAttempts++;
    const c = 1 + Math.floor(Math.random() * (COLS - 2));
    const r = 1 + Math.floor(Math.random() * (ROWS - 2));
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
    hPlaced++;
  }
}

function generateTrialsWalls() {
  const walls = [
    {x:0, y:0, w:TRIALS_W, h:10, isBorder: true}, {x:0, y:TRIALS_H-10, w:TRIALS_W, h:10, isBorder: true},
    {x:0, y:10, w:10, h:TRIALS_H-20, isBorder: true}, {x:TRIALS_W-10, y:10, w:10, h:TRIALS_H-20, isBorder: true},
  ];
  const occ = new Set();
  const key = (c, r) => `${c},${r}`;
  const protectedCells = new Set();
  [[6,14],[7,14],[40,14],[41,14],[23,14],[24,14],[23,13],[24,13],[24,15],[23,15]].forEach(([c, r]) => {
    for(let dc = -1; dc <= 1; dc++) for(let dr = -1; dr <= 1; dr++) protectedCells.add(key(c + dc, r + dr));
  });

  function canPlace(c, r, len, isHoriz) {
    const cells = [];
    for(let k = 0; k < len; k++) {
      const cc = isHoriz ? c + k : c;
      const rr = isHoriz ? r : r + k;
      if(cc < 0 || cc >= TRIALS_COLS || rr < 0 || rr >= TRIALS_ROWS) return null;
      if(protectedCells.has(key(cc, rr))) return null;
      if(occ.has(key(cc, rr))) return null;
      for(let dc = -1; dc <= 1; dc++) for(let dr = -1; dr <= 1; dr++) {
        if(dc === 0 && dr === 0) continue;
        const nc = cc + dc, nr = rr + dr;
        if(occ.has(key(nc, nr))) return null;
      }
      cells.push([cc, rr]);
    }
    return cells;
  }

  const target = TRIALS_WALL_TARGET;
  let placed = 0, attempts = 400;
  for(let a = 0; a < attempts && placed < target; a++) {
    const isHoriz = Math.random() < 0.5;
    const len = 2 + Math.floor(Math.random() * 5);
    const cMax = TRIALS_COLS - (isHoriz ? len : 1) - 1;
    const rMax = TRIALS_ROWS - (isHoriz ? 1 : len) - 1;
    if (cMax < 2 || rMax < 2) continue;
    const c = 1 + Math.floor(Math.random() * (cMax - 1 + 1));
    const r = 1 + Math.floor(Math.random() * (rMax - 1 + 1));
    const cells = canPlace(c, r, len, isHoriz);
    if(!cells) continue;
    let x, y, w, h;
    if(isHoriz) { x = c * GRID; y = r * GRID - 6; w = len * GRID; h = 12; }
    else { x = c * GRID - 6; y = r * GRID; w = 12; h = len * GRID; }
    const newWall = {x, y, w, h};
    let tooClose = false;
    for (const ew of walls) {
      const g = wallGap(newWall, ew);
      if (g !== -1 && g < REQUIRED_WALL_GAP) { tooClose = true; break; }
    }
    if (tooClose) continue;
    cells.forEach(([cc, rr]) => occ.add(key(cc, rr)));
    walls.push({x, y, w, h, rx: 6});
    placed++;
  }
  if(placed < 12) {
    walls.push(
      {x: 12 * GRID - 6, y: 8 * GRID, w: 12, h: 12 * GRID, rx: 6},
      {x: 36 * GRID - 6, y: 8 * GRID, w: 12, h: 12 * GRID, rx: 6},
      {x: 16 * GRID, y: 8 * GRID - 6, w: 16 * GRID, h: 12, rx: 6},
      {x: 16 * GRID, y: 20 * GRID - 6, w: 16 * GRID, h: 12, rx: 6},
      {x: 8 * GRID - 6, y: 14 * GRID, w: 12, h: 8 * GRID, rx: 6},
      {x: 40 * GRID - 6, y: 14 * GRID, w: 12, h: 8 * GRID, rx: 6},
    );
  }
  wallData = walls;
  generateTrialsHazards();
}

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

function spawnTrialsPickups(count) {
  for(let i = 0; i < count; i++) {
    const kind = pickRandomPowerKind();
    const cfg = POWER_TYPES[kind] || AMMO_PICKUP_CFG[kind];
    const life = cfg ? cfg.life : 480;
    let placed = false;
    for(let attempt = 0; attempt < 50 && !placed; attempt++) {
      const x = 80 + Math.random() * (TRIALS_W - 160);
      const y = 60 + Math.random() * (TRIALS_H - 120);
      if(isValidTrialsPickupPos(x, y)) {
        pickups.push({x, y, t: 0, life, kind});
        placed = true;
      }
    }
    if(!placed) pickups.push({x: TRIALS_W/2, y: TRIALS_H/2, t: 0, life, kind});
  }
}

function isValidTrialsPickupPos(x, y) {
  if(wallsCollide(x, y, 28)) return false;
  if(len2(x, y, 320, TRIALS_H/2) < 80 || len2(x, y, TRIALS_W-320, TRIALS_H/2) < 80) return false;
  if(hazardAt(x, y)) return false;
  return true;
}

// Bot AI lives in bot-ai.js (imported above)

function distance(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.hypot(dx, dy);
}

function hazardAt(x, y) {
  for(const h of hazards) if(x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
  return null;
}

function isLavaActive(h) {
  const mod = h.t % 300;
  return mod >= 120 && mod < 228;
}


function findValidHazardPos(ignoreIdx = -1) {
  // mode-aware so trials (48x28) doesn't pick from 24x14 only
  const cols = gameMode === 'trials' ? TRIALS_COLS : COLS;
  const rows = gameMode === 'trials' ? TRIALS_ROWS : ROWS;
  const vcX = gameMode === 'trials' ? TRIALS_W/2 : W/2;
  const vcY = gameMode === 'trials' ? TRIALS_H/2 : H/2;
  for (let attempt = 0; attempt < 80; attempt++) {
    const c = 1 + Math.floor(Math.random() * (cols - 2));
    const r = 1 + Math.floor(Math.random() * (rows - 2));
    const x = c * GRID + 2, y = r * GRID + 2;
    const cx = x + 18, cy = y + 18;
    // avoid spawn protects — mirror generators' protectedCells per mode
    if (gameMode === 'trials') {
      const inTrialSpawn = (c>=5&&c<=8&&r>=12&&r<=16) || (c>=39&&c<=42&&r>=12&&r<=16) || (c>=21&&c<=26&&r>=12&&r<=16);
      if (inTrialSpawn) continue;
      // also block 1-cell halo
      let nearSpawn=false;
      for(let dc=-1;dc<=1;dc++) for(let dr=-1;dr<=1;dr++){
        const cc=c+dc, rr=r+dr;
        const near = (cc>=5&&cc<=8&&rr>=12&&rr<=16) || (cc>=39&&cc<=42&&rr>=12&&rr<=16) || (cc>=21&&cc<=26&&rr>=12&&rr<=16);
        if(near){ nearSpawn=true; break; }
      }
      if(nearSpawn) continue;
    } else {
      if ((c >= 2 && c <= 5 && r >= 6 && r <= 8) || (c >= 18 && c <= 21 && r >= 6 && r <= 8) || (c >= 10 && c <= 13 && r >= 5 && r <= 9)) continue;
    }
    if (wallsCollide(cx, cy, 22)) continue;
    let nearWall = false;
    for (const w of wallData) {
      if (w.isBorder) continue;
      if (rectCircleCollide(cx, cy, 28, w.x, w.y, w.w, w.h)) { nearWall = true; break; }
    }
    if (nearWall) continue;
    let overlap = false;
    for (let i = 0; i < hazards.length; i++) {
      if (i === ignoreIdx) continue;
      const h = hazards[i];
      if (Math.abs(h.x - x) < 42 && Math.abs(h.y - y) < 42) { overlap = true; break; }
    }
    if (overlap) continue;
    // avoid players/bot (80px) — include bot in trials
    const avoid = gameMode === 'trials' ? [players[0], bot] : [players[0], players[1]];
    let nearEnt=false;
    for(const ent of avoid){ if(ent && ent.alive && len2(cx,cy,ent.x,ent.y)<88){ nearEnt=true; break; } }
    if(nearEnt) continue;
    let nearPickup = false;
    for (const pu of pickups) if (len2(cx, cy, pu.x, pu.y) < 60) { nearPickup = true; break; }
    if (nearPickup) continue;
    // avoid void: circle for 1v1, rect for trials
    if (gameMode === 'trials' && safeRadius < 900 && voidRect) {
      const inSafeX = cx > voidRect.x && cx < voidRect.x+voidRect.w;
      const inSafeY = cy > voidRect.y && cy < voidRect.y+voidRect.h;
      if (!inSafeX || !inSafeY) continue;
    } else if (safeRadius < 900 && len2(cx, cy, vcX, vcY) > safeRadius - 32) continue;
    return { c, r, x, y };
  }
  return null;
}

function relocateRandomHazards() {
  if (hazards.length === 0 || gameState !== 'playing') return;
  const elapsed = (TRIAL_DURATION || 600) - (timeLeft || 600);
  const target = TRIALS_HAZARD_COUNT + (elapsed > 300 ? 2 : 0) + (elapsed > 420 ? 3 : 0);
  // adaptive: add missing hazards if density increased
  while (hazards.length < target && hazards.length < 25) {
    const c = 2 + Math.floor(Math.random() * (TRIALS_COLS - 4));
    const r = 2 + Math.floor(Math.random() * (TRIALS_ROWS - 4));
    const k = `${c},${r}`;
    let safe = true;
    for (let h of hazards) if (Math.abs(h.c - c) <= 1 && Math.abs(h.r - r) <= 1) safe = false;
    if (safe) {
      const kind = Math.random() < 0.5 ? 'lava' : 'slime';
      hazards.push({c, r, x: c * GRID + 2, y: r * GRID + 2, w: 36, h: 36, kind, t: Math.random() * 300, lavaCd: 0});
      break;
    }
  }
  // relocate 1-2 hazards each trigger for chaos
  const count = hazards.length <= 3 ? 1 : (Math.random() < 0.5 ? 1 : 2);
  const indices = [...Array(hazards.length).keys()].sort(() => Math.random() - 0.5).slice(0, count);
  for (const idx of indices) {
    const pos = findValidHazardPos(idx);
    if (!pos) continue;
    const h = hazards[idx];
    // poof out
    for (let k = 0; k < 12; k++) particles.push({ x: h.x + 18, y: h.y + 18, vx: Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*2.5), vy: Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*2.5), life: 16, max: 16, r: 1.8, color: h.kind === 'lava' ? '#fb923c' : '#6ee7b7', type: 'hit' });
    // optional: randomize kind on relocate 30% chance
    if (Math.random() < 0.3) h.kind = Math.random() < 0.5 ? 'lava' : 'slime';
    h.c = pos.c; h.r = pos.r; h.x = pos.x; h.y = pos.y;
    h.t = Math.random() * 300;
    h.lavaCd = 0;
    // poof in
    for (let k = 0; k < 14; k++) particles.push({ x: h.x + 18, y: h.y + 18, vx: Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*2.2), vy: Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*2.2), life: 18, max: 18, r: 2, color: h.kind === 'lava' ? '#f97316' : '#10b981', type: 'star' });
  }
  drawHazards();
  hazardRelocateTimer = HAZARD_RELOCATE_MIN + Math.random() * (HAZARD_RELOCATE_MAX - HAZARD_RELOCATE_MIN);
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function len2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.hypot(dx, dy); }
function rectCircleCollide(cx, cy, cr, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny; return (dx * dx + dy * dy) < cr * cr;
}
function wallsCollide(x, y, r) {
  for(const w of wallData) if(rectCircleCollide(x, y, r, w.x, w.y, w.w, w.h)) return true;
  return false;
}
function pushOutOfWalls(p) {
  const maxW = gameMode === 'trials' ? TRIALS_W : W;
  const maxH = gameMode === 'trials' ? TRIALS_H : H;
  p.x = clamp(p.x, 10 + PLAYER_R, maxW - 10 - PLAYER_R);
  p.y = clamp(p.y, 10 + PLAYER_R, maxH - 10 - PLAYER_R);
  for(let iter = 0; iter < 4; iter++) {
    for(const w of wallData) {
      if(!rectCircleCollide(p.x, p.y, PLAYER_R, w.x, w.y, w.w, w.h)) continue;
      const closestX = clamp(p.x, w.x, w.x + w.w);
      const closestY = clamp(p.y, w.y, w.y + w.h);
      let dx = p.x - closestX;
      let dy = p.y - closestY;
      let dist = Math.hypot(dx, dy);
      if(dist < 0.01) {
        const dl = p.x - w.x;
        const dr = (w.x + w.w) - p.x;
        const dt = p.y - w.y;
        const db = (w.y + w.h) - p.y;
        const m = Math.min(dl, dr, dt, db);
        if(m === dl) { dx = -1; dy = 0; dist = 1; p.x = w.x - PLAYER_R - 1; continue; }
        else if(m === dr) { dx = 1; dy = 0; dist = 1; p.x = w.x + w.w + PLAYER_R + 1; continue; }
        else if(m === dt) { dx = 0; dy = -1; dist = 1; p.y = w.y - PLAYER_R - 1; continue; }
        else { dx = 0; dy = 1; dist = 1; p.y = w.y + w.h + PLAYER_R + 1; continue; }
      }
      const need = PLAYER_R - dist + 0.5;
      if(need > 0) {
        p.x += (dx / dist) * need;
        p.y += (dy / dist) * need;
      }
    }
  }
  p.x = clamp(p.x, 10 + PLAYER_R, maxW - 10 - PLAYER_R);
  p.y = clamp(p.y, 10 + PLAYER_R, maxH - 10 - PLAYER_R);
}

function tryMove(p, nx, ny) {
  if(!wallsCollide(nx, ny, PLAYER_R)) { p.x = nx; p.y = ny; return; }
  if(!wallsCollide(nx, p.y, PLAYER_R)) p.x = nx;
  if(!wallsCollide(p.x, ny, PLAYER_R)) p.y = ny;
  pushOutOfWalls(p);
}

function spawnMuzzle(x, y, color, ang) {
  return Array.from({length: 6}, () => ({
    x, y,
    vx: Math.cos(ang + (Math.random() - 0.5) * 0.9) * (2 + Math.random() * 3),
    vy: Math.sin(ang + (Math.random() - 0.5) * 0.9) * (2 + Math.random() * 3),
    life: 12, max: 12, r: 2, color, type: 'spark'
  }));
}

function spawnHit(x, y, color) {
  return Array.from({length: 10}, () => ({
    x, y,
    vx: Math.cos(Math.random() * Math.PI * 2) * (1 + Math.random() * 4),
    vy: Math.sin(Math.random() * Math.PI * 2) * (1 + Math.random() * 4),
    life: 18 + Math.random() * 10 | 0, max: 18, r: 1.5 + Math.random() * 2, color, type: 'hit'
  }));
}

function spawnPickupEffect(x, y, color) {
  return Array.from({length: 16}, () => ({
    x, y,
    vx: Math.cos(Math.random() * Math.PI * 2) * (2 + Math.random() * 3),
    vy: Math.sin(Math.random() * Math.PI * 2) * (2 + Math.random() * 3),
    life: 22, max: 22, r: 2.2, color: color || '#ffb23e', type: 'star'
  }));
}

// --- Per-damage distinct minimal FX (small, type-specific) ---
function spawnHitStandard(x, y, color) { // cyan/pink 10 hit, crisp ring
  return Array.from({length: 10}, () => ({
    x, y, vx: Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*3.8), vy: Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*3.8),
    life: 16, max: 16, r: 1.6 + Math.random()*1.8, color, type:'hit'
  }));
}
function spawnHitNeedleBlock(x, y) { // front graze: tiny violet hex, 6 micro, short
  return Array.from({length: 6}, (_,i) => ({
    x, y, vx: Math.cos(i*1.047)*(1+Math.random()*1.2), vy: Math.sin(i*1.047)*(1+Math.random()*1.2),
    life: 10, max: 10, r: 1.1 + Math.random()*0.8, color:'#a78bfa', type:'hit'
  })).concat([{x,y,vx:0,vy:-0.7,life:18,max:18,r:0,color:'#a78bfa',type:'healText',text:'BLOCK'}]);
}
function spawnHitNeedleCrit(x, y) { // rear crit: violet star burst 12 + 4 core
  const a = Array.from({length: 12}, () => ({
    x, y, vx: Math.cos(Math.random()*Math.PI*2)*(1.2+Math.random()*4.2), vy: Math.sin(Math.random()*Math.PI*2)*(1.2+Math.random()*4.2),
    life: 20, max: 20, r: 1.8 + Math.random()*1.6, color:'#a78bfa', type:'star'
  }));
  a.push(...Array.from({length:4},()=>({x,y,vx:(Math.random()-0.5)*1.2,vy:(Math.random()-0.5)*1.2,life:14,max:14,r:3.2,color:'#ede9fe',type:'hit'})));
  a.push({x,y: y-18, vx:0, vy:-0.9, life:28, max:28, r:0, color:'#a78bfa', type:'healText', text:'CRIT +6'});
  return a;
}
function spawnHitCannon(x, y, color) { // heavy amber ember: 14 big + 4 ember rise
  const b = Array.from({length: 14}, () => ({
    x, y, vx: Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*4.6), vy: Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*4.6),
    life: 22, max: 22, r: 2.2 + Math.random()*1.8, color: color||'#ffb23e', type:'hit'
  }));
  b.push(...Array.from({length:4},()=>({x,y,vx:(Math.random()-0.5)*1.6,vy:-1.2 -Math.random()*1.4,life:18,max:18,r:1.4,color:'#fb923c',type:'spark'})));
  b.push({x, y:y-20, vx:0, vy:-0.8, life:26, max:26, r:0, color:'#ffb23e', type:'healText', text:'BOOM -4'});
  return b;
}
function spawnHitTrick(x, y, color, bounces) { // cyan bounce: 8 + pip count text
  const c = Array.from({length: 8}, () => ({
    x, y, vx: Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*3.2), vy: Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*3.2),
    life: 16, max: 16, r: 1.5 + Math.random()*1.2, color: color||'#58d8ff', type:'hit'
  }));
  const dmg = trickDmgAt(bounces);
  c.push({x, y:y-16, vx:0, vy:-0.7, life:22, max:22, r:0, color:'#58d8ff', type:'healText', text:`-${dmg}`});
  return c;
}
function spawnHitLava(x, y) {
  return Array.from({length:10},()=>({x,y,vx:Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*3),vy:Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*3),life:18,max:18,r:1.7+Math.random()*1.4,color:'#fb923c',type:'hit'}))
    .concat([{x,y:y-18,vx:0,vy:-0.6,life:26,max:26,r:0,color:'#fb923c',type:'healText',text:'-2 LAVA'}]);
}
function spawnHitVoid(x, y) {
  return Array.from({length:9},()=>({x,y,vx:Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*2.8),vy:Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*2.8),life:18,max:18,r:1.5+Math.random()*1.2,color:'#c9ff2f',type:'hit'}))
    .concat([{x,y:y-18,vx:0,vy:-0.6,life:26,max:26,r:0,color:'#c9ff2f',type:'healText',text:'VOID -1'}]);
}
function spawnBounceSpark(x, y, color) {
  return Array.from({length:6},()=>({x,y,vx:Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*2.2),vy:Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*2.2),life:12,max:12,r:1.4,color:color||'#58d8ff',type:'spark'}));
}
function trickDmgAt(bounces){ const t=[2.5,2,1.6,1.2,0.8,0.5]; return t[Math.min(bounces,5)]; }
function damageShake(p, intensity=1){ p.squish = Math.max(p.squish, 6 + intensity*4); }

let globalSpeed = BASE_SPEED;
let gameMode = '1v1';
const players = [
  { id: 0, x: 160, y: 280, vx: 0, vy: 0, angle: 0, hp: MAX_HP, dash: 0, dashCd: 0, inv: 0, shootCd: 0, overcharge: 0, shield: false, shieldHp: 0, shieldMax: SHIELD_MAX_HP, speedBoost: 0, extraDash: 0, baseSpeed: BASE_SPEED, squish: 0, inSlime: false, lavaCd: 0, voidCd: 0, slimeCd: 0, color: '#58d8ff', alive: true, ammoType:'standard', ammo:Infinity },
  { id: 1, x: 800, y: 280, vx: 0, vy: 0, angle: Math.PI, hp: MAX_HP, dash: 0, dashCd: 0, inv: 0, shootCd: 0, overcharge: 0, shield: false, shieldHp: 0, shieldMax: SHIELD_MAX_HP, speedBoost: 0, extraDash: 0, baseSpeed: BASE_SPEED, squish: 0, inSlime: false, lavaCd: 0, voidCd: 0, slimeCd: 0, color: '#ff5ca8', alive: true, ammoType:'standard', ammo:Infinity },
];

const bot = { id: 2, x: 1600, y: 560, vx: 0, vy: 0, angle: 0, hp: BOT_MAX_HP, maxHp: BOT_MAX_HP, dash: 0, dashCd: 0, inv: 0, shootCd: 0, overcharge: 0, shield: false, shieldHp: 0, shieldMax: SHIELD_MAX_HP, speedBoost: 0, extraDash: 0, baseSpeed: BASE_SPEED, squish: 0, inSlime: false, lavaCd: 0, voidCd: 0, slimeCd: 0, color: '#ffb23e', alive: true, ammoType:'standard', ammo:Infinity, isBot: true, behavior: 'patrol', behaviorTimer: 0, targetX: 0, targetY: 0, reactionDelay: 0, lastShotTime: 0, aimError: 0, behaviorCommitment: 0 };
// Early event queue so React can trigger start/forfeit even before init finishes
if (typeof window !== 'undefined') {
  window.addEventListener('nox:startGame', () => {
    const tryStart = () => {
      if (window.NOX_GAME && window.NOX_GAME.startGame) window.NOX_GAME.startGame();
      else setTimeout(tryStart, 30);
    };
    tryStart();
  });
  window.addEventListener('nox:startTrials', () => {
    const tryStart = () => {
      if (window.NOX_GAME && window.NOX_GAME.startTrials) window.NOX_GAME.startTrials();
      else setTimeout(tryStart, 30);
    };
    tryStart();
  });
  window.addEventListener('nox:forfeit', (e) => {
    const pid = (e.detail && e.detail.playerId) ?? 0;
    const tryForfeit = () => {
      if (window.NOX_GAME && window.NOX_GAME.forfeit) window.NOX_GAME.forfeit(pid);
      else setTimeout(tryForfeit, 30);
    };
    tryForfeit();
  });
  window.addEventListener('nox:forfeitTrials', () => {
    const tryFT = () => {
      if (window.NOX_GAME && window.NOX_GAME.forfeitTrials) window.NOX_GAME.forfeitTrials();
      else setTimeout(tryFT, 30);
    };
    tryFT();
  });
  window.addEventListener('nox:backToMenu', () => {
    const tryMenu = () => {
      if (window.NOX_GAME && window.NOX_GAME.backToMenu) window.NOX_GAME.backToMenu();
      else setTimeout(tryMenu, 30);
    };
    tryMenu();
  });
  // Trials pause/resume via React overlay buttons
  window.addEventListener('nox:pause', () => {
    if (gameMode !== 'trials' || gameState !== 'playing') return;
    gameState = 'paused';
    try { localStorage.setItem('nv_trials_paused', '1'); } catch {}
  });
  window.addEventListener('nox:resume', () => {
    if (gameMode !== 'trials' || gameState !== 'paused') return;
    gameState = 'playing';
    try { localStorage.removeItem('nv_trials_paused'); } catch {}
  });
  window.addEventListener('nox:resumeTrial', () => {
    const tryR = () => {
      if (window.NOX_GAME && window.NOX_GAME.resumeTrials) window.NOX_GAME.resumeTrials();
      else setTimeout(tryR, 30);
    };
    tryR();
  });
}
function setGlobalSpeed(v) {
  const clamped = clamp(parseFloat(v), 2.5, 5.5);
  if (isNaN(clamped)) return;
  globalSpeed = clamped;
  players[0].baseSpeed = clamped;
  players[1].baseSpeed = clamped;
  if (simMatch) { simMatch.baseSpeed = clamped; simMatch.players[0].baseSpeed = clamped; simMatch.players[1].baseSpeed = clamped; }
  try { localStorage.setItem('nv_speedGlobal', String(clamped)); } catch {}
  // legacy keys cleanup
  try { localStorage.removeItem('nv_speedP1'); localStorage.removeItem('nv_speedP2'); } catch {}
  const el = document.getElementById('speedValGlobal');
  if (el) el.textContent = clamped.toFixed(1);
  const inp = document.getElementById('speedGlobal');
  if (inp && inp.value !== String(clamped)) inp.value = String(clamped);
}
let bullets = [];
let pickups = [];
let particles = [];
let keys = {};
let gameState = 'menu';
let scores = [0, 0];
let round = 1;
let timeLeft = ROUND_TIME;
let prevHp = [MAX_HP, MAX_HP, BOT_MAX_HP];
let pendingTimeouts = [];
let forfeitLock = false;

// T2 sim adapter: when set, 1v1 runs through the pure sim core (offline parity path)
let simMatch = null;
let onlineActive = false;

// --- Visual effect timelines (spec: docs/reasonix/specs/visual-parity-sync.md) ---
// One shared timeline for the sim-driven modes (local 1v1 + online) and one for
// Trials. Display-only: they age at frame rate and are never touched by state
// application. simVfxSeed is a dedicated cosmetic rng for Trials event seeds.
const simFxTimeline = new EffectTimeline();
const trialsFxTimeline = new EffectTimeline();
const trialsVfxState = { vfx: [], _vfxSeq: 0, tick: 0, fxRng: mulberry32(0x7411d5f) };

function emitTrialsVfx(kind, x, y, opts = {}) {
  return emitVfx(trialsVfxState, kind, x, y, opts);
}

// Copy visible timeline particles into the legacy render array (same array
// reference the view + NOX_GAME hold). Held particles (online display
// scheduling) stay invisible until released.
function mirrorTimelineToParticles(tl) {
  particles.length = 0;
  for (const p of tl.parts) {
    if (p._hold > 0) continue;
    particles.push(p);
  }
}

// --- Online 1v1 (T8): server snapshots + ordered visual events drive the same
// render pipeline. Effects are NEVER synthesized from snapshot diffs; remote
// state renders from a small interpolation buffer (100ms delay) while the
// EffectTimeline ages at frame rate between 30Hz snapshots.
const NET_INTERP_TICKS = 6;   // 100 ms at 60 Hz server ticks (spec default; measure before tuning)
let netBuf = [];              // recent snapshots for interpolation
let pendingEv = [];           // { due, ev } events scheduled against server tick
let netDisplayTick = 0;       // server-tick clock the client renders at
let netBulletViews = new Map(); // stable bullet id -> interpolated view + trail
let netPickupT = 0;

export function startOnlineMatch(seed) {
  onlineActive = true;
  simMatch = createMatch(seed >>> 0, { baseSpeed: globalSpeed });
  netBuf = [];
  pendingEv = [];
  netDisplayTick = 0;
  netBulletViews = new Map();
  netFallbackSeq = 0;
  applyNetSnapshot._buildWarned = false;
  netPickupT = 0;
  simFxTimeline.clear();
  mirrorSimToLegacy();
  drawWalls();
  drawHazards();
  updateHUD();
}

export function applyNetSnapshot(s) {
  if (!simMatch || !onlineActive) return;
  // Backend build detection: snapshots without event batches / player flags /
  // bullet ids come from a server that predates visual parity. Warn once,
  // loudly — chips, dash bar, void ring, wall effects and stable bullets all
  // require the new build.
  if (!applyNetSnapshot._buildWarned && (!Array.isArray(s.ev) || !(s.p || []).length || !Array.isArray(s.p[0][7]))) {
    applyNetSnapshot._buildWarned = true;
    try { console.warn('[nox] SERVER BUILD OUT OF DATE — the running backend predates visual parity. Restart it (npm start in backend/) or redeploy. Missing: visual events, stable bullet ids, HUD flags, safeRadius.'); } catch {}
    try { window.dispatchEvent(new CustomEvent('nox:serverOutdated')); } catch {}
  }
  netBuf.push(s);
  if (netBuf.length > 12) netBuf.shift();
  // authoritative discrete state — drives overlays, scores and the timer
  simMatch.state = s.state;
  if (s.score) { simMatch.scores[0] = s.score[0]; simMatch.scores[1] = s.score[1]; }
  simMatch.timeLeft = s.time;
  simMatch.roundResult = s.rr ?? null;
  simMatch.matchWinner = s.mw ?? null;
  if (typeof s.round === 'number') round = s.round;
  if (typeof s.sr === 'number') {
    simMatch.safeRadius = s.sr;
  } else {
    // old-server fallback: the shrink schedule is deterministic in time
    const elapsed = ROUND_TIME - s.time;
    simMatch.safeRadius = elapsed < 45 ? 999 : Math.max(110, 400 - ((elapsed - 45) / 15) * (400 - 110));
  }
  if (Array.isArray(s.hz)) {
    simMatch.hazards.length = 0;
    for (const h of s.hz) simMatch.hazards.push({ x: h[0], y: h[1], w: 36, h: 36, kind: h[2], t: 0, lavaCd: 0 });
    hazards.length = 0;
    for (const h of simMatch.hazards) hazards.push(h);
    drawHazards();
  }
  // ordered visual events: display each exactly once, aligned to server tick
  // plus the same interpolation delay used for remote state
  for (const ev of (s.ev || [])) {
    if (!ev || typeof ev.tick !== 'number') continue;
    pendingEv.push({ due: ev.tick + NET_INTERP_TICKS, ev });
  }
  pendingEv.sort((a, b) => a.due - b.due || a.ev.id - b.ev.id);
  if (pendingEv.length > 256) pendingEv.splice(0, pendingEv.length - 256);
  const target = s.tick - NET_INTERP_TICKS;
  if (target > netDisplayTick) netDisplayTick = target;
}

// One frame of online presentation: release due events into the timeline,
  // age effects at frame rate, then render interpolated remote state.
  function netFrame(dt) {
    netDisplayTick += dt;
    while (pendingEv.length && pendingEv[0].due <= netDisplayTick) {
      simFxTimeline.ingest(pendingEv.shift().ev);   // dedupe by id inside the timeline
    }
    simFxTimeline.step(dt);
    netInterpolate();
    mirrorNetStateToLegacy();
    updateHUD();
    const { selfSeat } = getOnlineHud();
    const myIdx = selfSeat === 0 ? 0 : 1;
    const oppIdx = selfSeat === 0 ? 1 : 0;
    setOnlineHud({ selfHp: players[myIdx]?.hp ?? 6, oppHp: players[oppIdx]?.hp ?? 6 });
    mirrorTimelineToParticles(simFxTimeline);
    simVoidVisuals();
  }

const lerp = (a, b, t) => a + (b - a) * t;
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Old-server compat: snapshots without bullet ids would otherwise spawn a new
// view per snapshot (the same bullet rendered twice). Match each id-less row
// to the closest existing fallback view (same owner + type within one
// snapshot's travel distance) so a bullet stays a single entity.
let netFallbackSeq = 0;
function matchFallbackBulletId(row) {
  const owner = row[5] ?? 0, type = row[4], x = row[0], y = row[1];
  let best = null, bestD = 1e9;
  for (const [id, v] of netBulletViews) {
    if (!v.fallback || v.owner !== owner || v.type !== type) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bestD) { bestD = d; best = id; }
  }
  if (best != null && bestD < 26) return best;
  return `f${netFallbackSeq++}`;
}

function netInterpolate() {
  if (!simMatch || netBuf.length === 0) return;
  const buf = netBuf;
  let ai = 0;
  for (let i = buf.length - 1; i >= 0; i--) {
    if (buf[i].tick <= netDisplayTick) { ai = i; break; }
  }
  const a = buf[ai], b = buf[ai + 1] || null;
  const span = b && b.tick > a.tick ? b.tick - a.tick : 0;
  const alpha = span ? Math.min(1, Math.max(0, (netDisplayTick - a.tick) / span)) : 1;

  // players: position/angle interpolated, discrete state from the snapshot at
  // or before the display tick (state changes appear exactly when their tick
  // is rendered — never before the corresponding effect)
  (a.p || []).forEach((d, i) => {
    const sp = simMatch.players[i];
    if (!sp) return;
    const e = (b && b.p && b.p[i]) || d;
    sp.x = lerp(d[0], e[0], alpha);
    sp.y = lerp(d[1], e[1], alpha);
    sp.angle = lerpAngle(d[2], e[2], alpha);
    sp.hp = d[3];
    sp.alive = d[3] > 0;
    sp.ammoType = d[4];
    sp.shield = d[5] > 0;
    sp.shieldHp = d[5];
    sp.ammo = d[6] === -1 || d[6] == null ? Infinity : d[6];
    // visual flags: [dash, dashCd, inv, overcharge, speedBoost, extraDash, squish]
    const f = d[7];
    if (Array.isArray(f)) {
      sp.dash = f[0]; sp.dashCd = f[1]; sp.inv = f[2];
      sp.overcharge = f[3]; sp.speedBoost = f[4]; sp.extraDash = f[5]; sp.squish = f[6];
    }
  });

  // bullets: interpolated by stable id; trails built from rendered positions
  const seen = new Set();
  const aB = a.b || [], bB = (b && b.b) || [];
  const bMap = new Map();
  for (const row of bB) if (row[6] != null) bMap.set(row[6], row);
  for (const row of aB) {
    const id = row[6] != null ? row[6] : matchFallbackBulletId(row);
    seen.add(id);
    const o = bMap.get(id);
    const x = o ? lerp(row[0], o[0], alpha) : row[0];
    const y = o ? lerp(row[1], o[1], alpha) : row[1];
    let v = netBulletViews.get(id);
    if (!v) { v = { trail: [] }; netBulletViews.set(id, v); }
    if (row[6] == null) v.fallback = true;
    v.type = row[4];
    v.owner = row[5] ?? 0;
    v.bounces = row[7] ?? 0;
    v.trail.push({ x, y });
    const trailLen = v.type === 'cannon' ? 6 : v.type === 'needle' ? 2 : v.type === 'trick' ? 5 : 4;
    while (v.trail.length > trailLen) v.trail.shift();
    v.x = x; v.y = y; v.last = netDisplayTick;
  }
  for (const [id, v] of netBulletViews) {
    // a vanished id is dead server-side; its death/impact event covers the FX.
    // Keep it briefly so the trail fades instead of popping out.
    if (!seen.has(id) && netDisplayTick - v.last > 2) netBulletViews.delete(id);
  }

  // pickups: positions from the display snapshot (they never move), pulse
  // clock advances locally so the animation never freezes
  netPickupT += 0.14;
  simMatch.pickups.length = 0;
  for (const row of (a.pk || [])) simMatch.pickups.push({ x: row[0], y: row[1], kind: row[2], t: netPickupT, life: 9999 });
}

// Write the interpolated remote state into the legacy render structures.
function mirrorNetStateToLegacy() {
  const m = simMatch;
  if (!m) return;
  for (let i = 0; i < 2; i++) {
    const sp = m.players[i], lp = players[i];
    if (!sp || !lp) continue;
    lp.x = sp.x; lp.y = sp.y; lp.angle = sp.angle; lp.hp = sp.hp; lp.alive = sp.alive;
    lp.dash = sp.dash; lp.dashCd = sp.dashCd; lp.inv = sp.inv; lp.shootCd = sp.shootCd;
    lp.overcharge = sp.overcharge; lp.shield = sp.shield; lp.shieldHp = sp.shieldHp;
    lp.speedBoost = sp.speedBoost; lp.extraDash = sp.extraDash; lp.squish = sp.squish;
    lp.ammoType = sp.ammoType; lp.ammo = sp.ammo;
  }
  scores[0] = m.scores[0]; scores[1] = m.scores[1];
  timeLeft = m.timeLeft;
  safeRadius = m.safeRadius;
  bullets.length = 0;
  for (const v of netBulletViews.values()) {
    bullets.push({
      x: v.x, y: v.y, type: v.type, owner: v.owner, bounces: v.bounces,
      r: BULLET_TYPES[v.type] ? BULLET_TYPES[v.type].r : BULLET_R,
      dmg: TRICK_DMG[Math.min(v.bounces, 5)],
      trail: v.trail,
    });
  }
  pickups.length = 0;
  for (const pu of m.pickups) pickups.push(pu);
  hazards.length = 0;
  for (const h of m.hazards) hazards.push(h);
  wallData = m.walls;
}

export function onlineResume() {
  if (!simMatch || !onlineActive) return;
  simMatch.state = 'playing';
  simMatch.roundResult = null;
  simMatch.matchWinner = null;
  gameState = 'playing';
  const ro = document.getElementById('roundOverlay');
  if (ro) ro.classList.add('hidden');
}

/**
 * Start countdown for online mode - uses same roundOverlay + cyber badge as local modes
 * Driven by server countdown value (3, 2, 1, 0 for FIGHT!)
 * @param serverT - server countdown value (3, 2, 1, or 0)
 * @param onFight - optional callback fired when FIGHT! phase starts (gameState = 'playing')
 */
export function startOnlineCountdown(serverT, onFight) {
  clearPendingTimeouts();
  clearInputState();
  gameState = 'countdown';
  const ro = document.getElementById('roundOverlay');
  const badge = document.getElementById('roundBadge');
  const title = document.getElementById('roundTitle');
  const sub = document.getElementById('roundSub');
  const go = document.getElementById('gameOverOverlay');
  if (!ro) return;
  go?.classList.add('hidden');
  ro.classList.remove('hidden');

  // Ensure HUD is visible
  setOnlineHud({ hudVisible: true });

  // Cyber badge for online: ROUND N
  if (badge) {
    setCyberBadgeText(badge, `ROUND ${round || 1}`);
    setCyberBadgeVariant(badge, 'cyan');
  }

  const beatMs = 200;
  const fightHoldMs = 100;
  let c = serverT > 0 ? serverT : 3;

  const tick = () => {
    if (gameState !== 'countdown') return;
    if (c > 0) {
      if (title) { title.textContent = String(c); title.className = 'result-score winner-draw'; }
      if (sub) sub.textContent = 'Get ready...';
      c--;
      trackTimeout(setTimeout(tick, beatMs));
    } else {
      // FIGHT!
      if (title) { title.textContent = 'FIGHT!'; title.className = 'result-score winner-draw'; }
      if (sub) sub.textContent = 'Dash = invincible • Grab the orb!';
      trackTimeout(setTimeout(() => {
        if (gameState !== 'countdown') return;
        ro.classList.add('hidden');
        gameState = 'playing';
        onlineResume();
        if (onFight) onFight();
      }, fightHoldMs));
    }
  };
  tick();
}

export function stopOnlineMatch() {
  onlineActive = false;
  gameState = 'menu';   // unmounts RoundOverlay / GameOverOverlay (React-driven)
  clearPendingTimeouts();   // never let a queued showGameOver fire into the lobby
  const ro = document.getElementById('roundOverlay');
  if (ro) ro.classList.add('hidden');
  const gov = document.getElementById('gameOverOverlay');
  if (gov) gov.classList.add('hidden');
  simMatch = null;
  netBuf = [];
  pendingEv = [];
  netBulletViews = new Map();
  simFxTimeline.clear();
}

// Online round end: display-only. The server owns round advancement and the
// match flow — no local timers, no showGameOver (online.astro owns the
// match-end presentation).
function showRoundEndOnline(winner, reason) {
  gameState = 'roundEnd';
  clearInputState();
  const ro = document.getElementById('roundOverlay');
  if (!ro) return;
  ro.classList.remove('hidden');
  announce(winner === null ? 'Round drawn.' : `Player ${winner + 1} wins the round. Score ${scores[0]} to ${scores[1]}.`);
  const badge = document.getElementById('roundBadge');
  const title = document.getElementById('roundTitle');
  const sub = document.getElementById('roundSub');
  if (winner === null) {
    setCyberBadgeText(badge, `ROUND ${round} // DRAW`);
    setCyberBadgeVariant(badge, 'lime');
    if (title) { title.textContent = 'DRAW!'; title.className = 'result-score winner-draw'; }
    if (sub) sub.textContent = reason + ' • No points';
  } else {
    setCyberBadgeText(badge, `ROUND ${round} // ${reason}`);
    setCyberBadgeVariant(badge, winner === 0 ? 'cyan' : 'pink');
    if (title) { title.textContent = `PLAYER ${winner + 1} WINS ROUND!`; title.className = 'result-score ' + (winner === 0 ? 'winner-p1' : 'winner-p2'); }
    if (sub) sub.textContent = `${scores[0]} // ${scores[1]} • First to ${WIN_SCORE}`;
  }
}

// Void Trials state. trialPoints is the EXACT running sum of the ledger
// (audit P1-06); it is only ever mutated through awardTrials(), never clamped
// or inferred. Display clamping/flooring happens at render time only.
let trialPoints = 0;
let trialsLedger = createLedger();
let trialHighScore = 0;
let voidRect = null;
let voidShrinkStart = 0;
let lastSaveTime = 0;
const SAVE_INTERVAL = 120;

function trackTimeout(id) { pendingTimeouts.push(id); return id; }
function clearPendingTimeouts() { pendingTimeouts.forEach(clearTimeout); pendingTimeouts.length = 0; }
function clearInputState() { keys = {}; }
// The ONLY mutation path for Trials score (audit P1-06). Penalties are stored
// as signed (negative) amounts; bonuses as positive amounts.
function awardTrials(key, amount) { trialPoints = applyLedger(trialsLedger, key, amount); }
function trialsFinal() { return ledgerTotal(trialsLedger); }
// P2-08: milestone-only live announcements — significant events (round end,
// match end, trials result), never per-frame updates.
function announce(text) {
  const el = document.getElementById('nox-score-announcer');
  if (el) el.textContent = text;
}
function hardResetInternalState() {
  clearPendingTimeouts();
  clearInputState();
  forfeitLock = false;
  // keep same array refs for external NOX_GAME exposure
  bullets.length = 0;
  pickups.length = 0;
  particles.length = 0;
  scores[0] = 0; scores[1] = 0;
  if (window.NOX_GAME) {
    window.NOX_GAME.scores[0] = 0; window.NOX_GAME.scores[1] = 0;
  }
  round = 1;
  timeLeft = ROUND_TIME;
  prevHp[0] = MAX_HP; prevHp[1] = MAX_HP; prevHp[2] = BOT_MAX_HP;
  players.forEach(pl => { pl.ammoType = 'standard'; pl.ammo = Infinity; });
  hazardRelocateTimer = HAZARD_RELOCATE_MIN + Math.random() * (HAZARD_RELOCATE_MAX - HAZARD_RELOCATE_MIN);
  safeRadius = 999;
  voidTick = [0, 0];
  const voidG = document.getElementById('void');
  if (voidG) voidG.setAttribute('opacity', '0');
  ['voidHole','voidRing','voidInner','voidRing2','voidCore'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('r', '420');
  });
  // Trials reset
  trialPoints = 0;
  trialsLedger = createLedger();
  voidRect = null;
  voidShrinkStart = 0;
  lastSaveTime = 0;
  bot.hp = BOT_MAX_HP;
  bot.alive = true;
  bot.x = TRIALS_W - 320; bot.y = TRIALS_H / 2;
  bot.vx = 0; bot.vy = 0; bot.angle = Math.PI;
  bot.dash = 0; bot.dashCd = 0; bot.inv = 0; bot.shootCd = 0;
  bot.overcharge = 0; bot.shield = false; bot.shieldHp = 0;
  bot.speedBoost = 0; bot.extraDash = 0; bot.baseSpeed = globalSpeed;
  bot.squish = 0; bot.inSlime = false; bot.lavaCd = 0; bot.voidCd = 0; bot.slimeCd = 0;
  bot.ammoType = 'standard'; bot.ammo = Infinity;
  bot.behavior = 'patrol'; bot.behaviorTimer = 0;
  bot.behaviorCommitment = 0;
  bot.reactionDelay = 80 + Math.random() * 40;
  bot.aimError = 0;
  bot.strafeDir = 0;
  bot.lastBurstAimError = undefined;
  bot.lastBehavior = 'patrol';
  bot.lastPlayerDash = 0;
  try { localStorage.removeItem('nv_trials_state'); } catch {}
}

// Input handling
function setupInput() {
  // T6: never capture keys while the user is typing in a text field
  const isTypingTarget = (t) => t instanceof HTMLElement &&
    (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  window.addEventListener('keydown', e => {
    if (isTypingTarget(e.target)) return;
    keys[e.code] = true;
    keys[e.key] = true;
    keys[e.key.toLowerCase()] = true;
    if(e.code === 'Space') keys['Space'] = true, keys[' '] = true;
    if(e.code === 'Enter' || e.code === 'NumpadEnter') keys['Enter'] = true, keys['enter'] = true;
    if(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'NumpadEnter'].includes(e.code)) e.preventDefault();
  }, {passive: false});

  window.addEventListener('keyup', e => {
    keys[e.code] = false;
    keys[e.key] = false;
    keys[e.key.toLowerCase()] = false;
    if(e.code === 'Space') keys['Space'] = false, keys[' '] = false;
    if(e.code === 'Enter' || e.code === 'NumpadEnter') keys['Enter'] = false, keys['enter'] = false;
  });

  // T6: stuck-key protection - reset all controls on blur / hidden tab
  window.addEventListener('blur', clearInputState);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInputState(); });

  window.addEventListener('keydown', e => {
    if(e.key.toLowerCase() === 'r' && gameState === 'gameOver') document.getElementById('rematchBtn')?.click();
  });
}

function isDown(...ks) { return ks.some(k => !!keys[k]); }
function isDownCode(code) { return !!keys[code]; }

function shoot(p) {
  if(p.shootCd > 0) return;
  // resolve ammo type - revert to standard if empty
  let active = p.ammoType || 'standard';
  if (active !== 'standard' && (!p.ammo || p.ammo <= 0)) { p.ammoType = 'standard'; p.ammo = Infinity; active = 'standard'; }
  const cfg = BULLET_TYPES[active] || BULLET_TYPES.standard;
  // overcharge shaves 2 ticks off cd, floor 7
  const baseCd = cfg.cd ?? 11;
  p.shootCd = p.overcharge > 0 ? Math.max(7, baseCd - 2) : baseCd;
  const speed = cfg.speed ?? BULLET_SPEED;
  const r = cfg.r ?? BULLET_R;
  const life = cfg.life ?? 90;
  const mx = p.x + Math.cos(p.angle) * 18;
  const my = p.y + Math.sin(p.angle) * 18;
  const spread = p.overcharge > 0 ? [-0.22, 0, 0.22] : [0];
  // ammo counts per trigger, not per spread bullet
  let fired = 0;
  spread.forEach(s => {
    const ang = p.angle + s + (Math.random() - 0.5) * 0.03;
    const dmg = active === 'trick' ? trickDmgAt(0) : (cfg.dmg ?? 2);
    bullets.push({
      x: mx, y: my,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      owner: p.id, life, trail: [], type: active, r, dmg, bounces: 0, bouncesMax: cfg.bouncesMax ?? 0
    });
    fired++;
  });
  if (active !== 'standard') {
    if (p.ammo !== Infinity) {
      p.ammo--;
      if (p.ammo <= 0) { p.ammoType = 'standard'; p.ammo = Infinity; }
    }
  }
  // typed muzzle: same canonical recipe as every mode (color by bullet type)
  emitTrialsVfx('muzzle', mx, my, { actor: p.id, bulletType: active });
  if(navigator.vibrate) navigator.vibrate(active==='cannon'? 20 : active==='needle'? 8 : 10);
}

function isValidPickupPos(x, y) {
  if(wallsCollide(x, y, 28)) return false;
  if(len2(x, y, 140, 280) < 68 || len2(x, y, 820, 280) < 68) return false;
  if(hazardAt(x, y)) return false;
  return true;
}

function pickRandomPowerKind() {
  const r = Math.random();
  if(r < 0.22) return 'overcharge';
  if(r < 0.40) return 'shield';
  if(r < 0.60) return 'blink';
  if(r < 0.70) return 'heal';
  if(r < 0.80) return 'ammo_needle';
  if(r < 0.90) return 'ammo_cannon';
  return 'ammo_trick';
}

function spawnPickupSoon(force = false) {
  if(pickups.length > 0 && !force) return;
  const kind = pickRandomPowerKind();
  const cfg = POWER_TYPES[kind] || AMMO_PICKUP_CFG[kind];
  const life = cfg ? cfg.life : 480;
  const spots = [
    {x: 480, y: 280}, {x: 320, y: 280}, {x: 640, y: 280},
    {x: 480, y: 180}, {x: 480, y: 380}, {x: 240, y: 140},
    {x: 720, y: 420}, {x: 480, y: 120}, {x: 480, y: 440}
  ];
  for(let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  for(const pos of spots) {
    if(isValidPickupPos(pos.x, pos.y) && len2(pos.x, pos.y, players[0].x, players[0].y) > 64 && len2(pos.x, pos.y, players[1].x, players[1].y) > 64) {
      pickups.push({x: pos.x, y: pos.y, t: 0, life, kind});
      return;
    }
  }
  for(let k = 0; k < 50; k++) {
    const x = 80 + Math.random() * 800;
    const y = 60 + Math.random() * 440;
    if(isValidPickupPos(x, y)) { pickups.push({x, y, t: 0, life, kind}); return; }
  }
  pickups.push({x: 480, y: 280, t: 0, life, kind});
}

function resetRound(regenerateWalls = false) {
  if(regenerateWalls) {
    generateRandomWalls();
    drawWalls();
    drawHazards();
  } else {
    if(hazards.length && document.getElementById('hazards').childElementCount === 0) drawHazards();
  }
  safeRadius = 999;
  voidTick = [0, 0];
  const voidG = document.getElementById('void');
  if(voidG) voidG.setAttribute('opacity', '0');

  // preserve global speed across rounds (single source of truth)
  const preservedSpeed = globalSpeed;
  players[0].x = 140; players[0].y = 280; players[0].hp = MAX_HP; players[0].alive = true;
  players[0].dash = 0; players[0].dashCd = 0; players[0].inv = 0; players[0].overcharge = 0;
  players[0].shield = false; players[0].shieldHp = 0; players[0].speedBoost = 0;
  players[0].extraDash = 0; players[0].squish = 0; players[0].inSlime = false;
  players[0].lavaCd = 0; players[0].voidCd = 0; players[0].baseSpeed = preservedSpeed; players[0].angle = 0;
  players[0].ammoType = 'standard'; players[0].ammo = Infinity;

  players[1].x = 820; players[1].y = 280; players[1].hp = MAX_HP; players[1].alive = true;
  players[1].dash = 0; players[1].dashCd = 0; players[1].inv = 0; players[1].overcharge = 0;
  players[1].shield = false; players[1].shieldHp = 0; players[1].speedBoost = 0;
  players[1].extraDash = 0; players[1].squish = 0; players[1].inSlime = false;
  players[1].lavaCd = 0; players[1].voidCd = 0; players[1].baseSpeed = preservedSpeed; players[1].angle = Math.PI;
  players[1].ammoType = 'standard'; players[1].ammo = Infinity;

  pushOutOfWalls(players[0]); pushOutOfWalls(players[1]);
  let tries = 0;
  while(wallsCollide(players[0].x, players[0].y, PLAYER_R + 4) && tries < 10) {
    players[0].y = 120 + Math.random() * 320; pushOutOfWalls(players[0]); tries++;
  }
  tries = 0;
  while(wallsCollide(players[1].x, players[1].y, PLAYER_R + 4) && tries < 10) {
    players[1].y = 120 + Math.random() * 320; pushOutOfWalls(players[1]); tries++;
  }
  bullets.length = 0; particles.length = 0; pickups.length = 0;
  simFxTimeline.clear(); trialsFxTimeline.clear();
  // keep NOX_GAME refs in sync
  if (window.NOX_GAME) {
    window.NOX_GAME.bullets.length = 0;
    window.NOX_GAME.pickups.length = 0;
    window.NOX_GAME.particles.length = 0;
  }
  timeLeft = ROUND_TIME;
  prevHp[0] = MAX_HP; prevHp[1] = MAX_HP; prevHp[2] = BOT_MAX_HP;
  hazardRelocateTimer = HAZARD_RELOCATE_MIN + Math.random() * (HAZARD_RELOCATE_MAX - HAZARD_RELOCATE_MIN);
  spawnPickupSoon(true);
  updateHUD();
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
  trialsLedger = createLedger();
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
  bot.squish = 0; bot.inSlime = false; bot.lavaCd = 0; bot.voidCd = 0; bot.slimeCd = 0;
  bot.ammoType = 'standard'; bot.ammo = Infinity;
  bot.behavior = 'patrol'; bot.behaviorTimer = 0;
  bot.behaviorCommitment = 0;
  bot.reactionDelay = 80 + Math.random() * 40;
  bot.aimError = 0;
  bot.strafeDir = 0;
  bot.lastBurstAimError = undefined;
  bot.lastBehavior = 'patrol';
  bot.lastPlayerDash = 0;

  pushOutOfWalls(players[0]);
  pushOutOfWalls(bot);

  bullets.length = 0; particles.length = 0; pickups.length = 0;
  simFxTimeline.clear(); trialsFxTimeline.clear();
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

function prepareTrialsMenu() {
  gameMode = 'trials';
  timeLeft = TRIAL_DURATION;
  trialPoints = 0;
  trialsLedger = createLedger();
  voidRect = null;
  safeRadius = 999;
  // Ensure P2 hidden in menu preview as well
  players[1].alive = false;
  updateHUD();
}

// --- T2 sim adapter (offline 1v1 routed through game-sim.js) ---
function simLocalSeed() { return (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0; }

function mirrorSimToLegacy() {
  const m = simMatch;
  if (!m) return;
  for (let i = 0; i < 2; i++) {
    const sp = m.players[i], lp = players[i];
    lp.x = sp.x; lp.y = sp.y; lp.angle = sp.angle; lp.hp = sp.hp;
    lp.dash = sp.dash; lp.dashCd = sp.dashCd; lp.inv = sp.inv; lp.shootCd = sp.shootCd;
    lp.overcharge = sp.overcharge; lp.shield = sp.shield; lp.shieldHp = sp.shieldHp;
    lp.speedBoost = sp.speedBoost; lp.extraDash = sp.extraDash; lp.squish = sp.squish;
    lp.inSlime = sp.inSlime; lp.lavaCd = sp.lavaCd; lp.voidCd = sp.voidCd; lp.slimeCd = sp.slimeCd;
    lp.alive = sp.alive; lp.ammoType = sp.ammoType; lp.ammo = sp.ammo; lp.baseSpeed = sp.baseSpeed;
  }
  scores[0] = m.scores[0]; scores[1] = m.scores[1];
  timeLeft = m.timeLeft;
  safeRadius = m.safeRadius;
  bullets.length = 0; for (const b of m.bullets) bullets.push(b);
  pickups.length = 0; for (const pu of m.pickups) pickups.push(pu);
  hazards.length = 0; for (const h of m.hazards) hazards.push(h);
  wallData = m.walls;
  // Effects come from the shared EffectTimeline — never overwritten by state.
  mirrorTimelineToParticles(simFxTimeline);
}

function simInputs() {
  const i0 = {
    up: isDownCode('KeyW') || isDown('w'),
    down: isDownCode('KeyS') || isDown('s'),
    left: isDownCode('KeyA') || isDown('a'),
    right: isDownCode('KeyD') || isDown('d'),
    dash: isDownCode('ShiftLeft') || isDown('Shift') || isDown('shift'),
    shoot: isDownCode('Space') || isDown(' ') || isDown('space'),
  };
  const i1 = {
    up: isDownCode('ArrowUp') || isDown('arrowup'),
    down: isDownCode('ArrowDown') || isDown('arrowdown'),
    left: isDownCode('ArrowLeft') || isDown('arrowleft'),
    right: isDownCode('ArrowRight') || isDown('arrowright'),
    dash: isDownCode('Slash') || isDownCode('ShiftRight') || isDown('/') || isDownCode('NumpadDivide'),
    shoot: isDownCode('Enter') || isDownCode('NumpadEnter') || isDown('Enter') || isDown('enter'),
  };
  return [i0, i1];
}

function simVoidVisuals() {
  // DOM void ring visuals — identical to legacy block, safeRadius sourced from sim
  const elapsed = ROUND_TIME - timeLeft;
  if(elapsed < 45) {
    safeRadius = 999;
    const voidG = document.getElementById('void');
    if(voidG) voidG.setAttribute('opacity', '0');
    const vh = document.getElementById('voidHole');
    if(vh) vh.setAttribute('r', 420);
    const vr = document.getElementById('voidRing');
    if(vr) vr.setAttribute('r', 420);
    const vi = document.getElementById('voidInner');
    if(vi) vi.setAttribute('r', 420);
    const vr2 = document.getElementById('voidRing2');
    if(vr2) vr2.setAttribute('r', 420);
    const vc = document.getElementById('voidCore');
    if(vc) vc.setAttribute('r', 420);
  } else {
    const voidHole = document.getElementById('voidHole');
    const voidRing = document.getElementById('voidRing');
    const voidInner = document.getElementById('voidInner');
    const voidRing2 = document.getElementById('voidRing2');
    const voidCore = document.getElementById('voidCore');
    const voidStars = document.getElementById('voidStars');
    const voidG = document.getElementById('void');
    if(voidHole) voidHole.setAttribute('r', safeRadius);
    if(voidRing) voidRing.setAttribute('r', safeRadius);
    if(voidInner) voidInner.setAttribute('r', safeRadius);
    if(voidRing2) voidRing2.setAttribute('r', safeRadius);
    if(voidCore) voidCore.setAttribute('r', safeRadius);
    if(voidG) voidG.setAttribute('opacity', '1');
    voidTick[0] = (voidTick[0] + 0.7) % 48;
    voidTick[1] = (voidTick[1] + 0.4) % 48;
    if(voidStars) voidStars.setAttribute('patternTransform', `translate(${voidTick[0]} ${voidTick[1]})`);
    const voidBlocks = document.getElementById('voidBlocks');
    if(voidBlocks) voidBlocks.setAttribute('patternTransform', `translate(${voidTick[0]*0.6} ${voidTick[1]*0.6})`);
    if(voidRing) {
      voidRing.setAttribute('stroke-dashoffset', String((Date.now()/14)% 17));
      voidRing.setAttribute('transform', `rotate(${(Date.now()/28)%360} 480 280)`);
    }
    if(voidRing2) {
      voidRing2.setAttribute('stroke-dashoffset', String((Date.now()/10)% 13));
      voidRing2.setAttribute('transform', `rotate(${-(Date.now()/38)%360} 480 280)`);
    }
    if(voidCore) {
      const pulse = 0.5 + Math.sin(Date.now()/380)*0.35;
      voidCore.setAttribute('opacity', String(pulse*0.4));
      voidCore.setAttribute('stroke-width', String(1 + pulse*0.8));
    }
  }
}

// Self-healing arena chrome for online: walls/hazards are drawn once per
// match, so a stage DOM replacement (late hydration, React re-mount) would
// leave them blank forever while per-frame groups (players/bullets) recover
// on their own. Rebuild them the moment their SVG groups are found empty.
function ensureArenaChrome() {
  const wallsG = document.getElementById('walls');
  if (wallsG && wallsG.childElementCount === 0 && wallData.length) drawWalls();
  const hazG = document.getElementById('hazards');
  if (hazG && hazG.childElementCount === 0 && hazards.length) drawHazards();
}

// Idempotent arena refresh for page-level callers (countdown beats, lobby
// returns) — cheap no-op when the chrome is already intact.
export function refreshOnlineArena() {
  if (!simMatch || !onlineActive) return;
  ensureArenaChrome();
  drawHazards();
  updateHUD();
}

// Test hook: advance the online presentation by dt frames without the rAF loop.
export function _netStep(dt) {
  if (!simMatch || !onlineActive) return;
  netFrame(dt);
  ensureArenaChrome();
  updateHUD();
}

function simUpdate(dt) {
  const m = simMatch;
  if (onlineActive) {
    // server-authoritative: no local ticking. Snapshots arrive via
    // applyNetSnapshot; effects age on the timeline at frame rate.
    netFrame(dt);
    ensureArenaChrome();
    drawHazards();
    if (m.state !== 'playing' && gameState === 'playing') {
      // display-only round overlay; match end is owned by online.astro
      if (m.state === 'roundEnd' && m.matchWinner == null) {
        showRoundEndOnline(m.roundResult?.winner ?? null, m.roundResult?.reason ?? '');
      }
    }
    updateHUD();
    return;
  }
  const [i0, i1] = simInputs();
  simTick(m, [i0, i1], dt);
  // the sim now emits visual events instead of particles — drain them into
  // the shared timeline and age them at the same cadence the old fx had
  for (const ev of drainVfx(m)) simFxTimeline.ingest(ev);
  simFxTimeline.step(dt);
  mirrorSimToLegacy();
  simVoidVisuals();
  drawHazards();
  if (m.state !== 'playing' && gameState === 'playing') {
    if (m.state === 'roundEnd' || m.state === 'matchEnd') {
      endRound(m.roundResult.winner, m.roundResult.reason);
    }
  }
  updateHUD();
}

function simStartFresh() {
  simMatch = createMatch(simLocalSeed(), { baseSpeed: globalSpeed });
  mirrorSimToLegacy();
  drawWalls();
  drawHazards();
  updateHUD();
}

function simAdvanceRound() {
  if (!simMatch) return;
  simNextRound(simMatch);
  mirrorSimToLegacy();
  drawWalls();
  drawHazards();
  updateHUD();
}

function update(dt) {
  if(gameState !== 'playing') {
    // Online presentation keeps running through round breaks so queued
    // effects age out and display on time (the arena state itself is frozen
    // at the last snapshot — the server owns the break).
    if (onlineActive && simMatch && gameState === 'roundEnd') { simUpdate(dt); return; }
    return;
  }

  if(gameMode === 'trials') {
    updateTrials(dt);
    return;
  }

  if (simMatch) {
    simUpdate(dt);
    return;
  }

  timeLeft -= dt / 60;

  if(timeLeft <= 0) {
    if(players[0].hp !== players[1].hp) {
      const winner = players[0].hp > players[1].hp ? 0 : 1;
      scores[winner]++; endRound(winner, 'TIME // HP ADVANTAGE');
    } else {
      endRound(null, 'DRAW // TIME UP');
    }
    return;
  }

  if(pickups.length === 0 && Math.random() < 0.008) spawnPickupSoon();
  pickups.forEach(p => p.t += 0.14);
  {
    const kept = pickups.filter(p => p.life-- > 0);
    pickups.length = 0; kept.forEach(v => pickups.push(v));
    if (window.NOX_GAME) { window.NOX_GAME.pickups.length = 0; kept.forEach(v => window.NOX_GAME.pickups.push(v)); }
  }

  hazards.forEach(h => h.t += 1);
  if (--hazardRelocateTimer <= 0) {
    relocateRandomHazards();
  }
  drawHazards();

  const elapsed = ROUND_TIME - timeLeft;
  if(elapsed < 45) {
    safeRadius = 999;
    const voidG = document.getElementById('void');
    if(voidG) voidG.setAttribute('opacity', '0');
    const vh = document.getElementById('voidHole');
    if(vh) vh.setAttribute('r', 420);
    const vr = document.getElementById('voidRing');
    if(vr) vr.setAttribute('r', 420);
    const vi = document.getElementById('voidInner');
    if(vi) vi.setAttribute('r', 420);
    const vr2 = document.getElementById('voidRing2');
    if(vr2) vr2.setAttribute('r', 420);
    const vc = document.getElementById('voidCore');
    if(vc) vc.setAttribute('r', 420);
  } else {
    safeRadius = 400 - ((elapsed - 45) / 15) * (400 - 110);
    safeRadius = Math.max(110, safeRadius);
    const voidHole = document.getElementById('voidHole');
    const voidRing = document.getElementById('voidRing');
    const voidInner = document.getElementById('voidInner');
    const voidRing2 = document.getElementById('voidRing2');
    const voidCore = document.getElementById('voidCore');
    const voidStars = document.getElementById('voidStars');
    const voidG = document.getElementById('void');
    if(voidHole) voidHole.setAttribute('r', safeRadius);
    if(voidRing) voidRing.setAttribute('r', safeRadius);
    if(voidInner) voidInner.setAttribute('r', safeRadius);
    if(voidRing2) voidRing2.setAttribute('r', safeRadius);
    if(voidCore) voidCore.setAttribute('r', safeRadius);
    if(voidG) voidG.setAttribute('opacity', '1');
    voidTick[0] = (voidTick[0] + 0.7) % 48;
    voidTick[1] = (voidTick[1] + 0.4) % 48;
    if(voidStars) voidStars.setAttribute('patternTransform', `translate(${voidTick[0]} ${voidTick[1]})`);
    const voidBlocks = document.getElementById('voidBlocks');
    if(voidBlocks) voidBlocks.setAttribute('patternTransform', `translate(${voidTick[0]*0.6} ${voidTick[1]*0.6})`);
    if(voidRing) {
      voidRing.setAttribute('stroke-dashoffset', String((Date.now()/14)% 17));
      voidRing.setAttribute('transform', `rotate(${(Date.now()/28)%360} 480 280)`);
    }
    if(voidRing2) {
      voidRing2.setAttribute('stroke-dashoffset', String((Date.now()/10)% 13));
      voidRing2.setAttribute('transform', `rotate(${-(Date.now()/38)%360} 480 280)`);
    }
    if(voidCore) {
      const pulse = 0.5 + Math.sin(Date.now()/380)*0.35;
      voidCore.setAttribute('opacity', String(pulse*0.4));
      voidCore.setAttribute('stroke-width', String(1 + pulse*0.8));
    }
  }

  players.forEach(p => {
    if(!p.alive) return;
    if(p.dashCd > 0) p.dashCd--;
    if(p.inv > 0) p.inv--;
    if(p.shootCd > 0) p.shootCd--;
    if(p.overcharge > 0) p.overcharge--;
    if(p.speedBoost > 0) p.speedBoost--;
    if(p.squish > 0) p.squish--;
    if(p.lavaCd > 0) p.lavaCd--;
    if(p.voidCd > 0) p.voidCd--;
    if(p.slimeCd > 0) p.slimeCd--;
    if(p.dash > 0) { p.dash--; if(p.dash === 0) p.inv = 6; }
    if(wallsCollide(p.x, p.y, PLAYER_R)) pushOutOfWalls(p);
    p.inSlime = false;

    let mx = 0, my = 0;
    if(p.id === 0) {
      if(isDownCode('KeyW') || isDown('w')) my -= 1;
      if(isDownCode('KeyS') || isDown('s')) my += 1;
      if(isDownCode('KeyA') || isDown('a')) mx -= 1;
      if(isDownCode('KeyD') || isDown('d')) mx += 1;
      const dashKey = isDownCode('ShiftLeft') || isDown('Shift') || isDown('shift');
      const canDash = p.dash === 0 && (p.dashCd === 0 || p.extraDash > 0);
      if(dashKey && canDash) {
        if(p.extraDash > 0) p.extraDash--; else p.dashCd = DASH_COOLDOWN;
        p.dash = DASH_TIME; p.inv = DASH_TIME + 4;
        for(let i = 0; i < 8; i++) particles.push({x: p.x, y: p.y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 10, max: 10, r: 2, color: p.color, type: 'dash'});
      }
      if(isDownCode('Space') || isDown(' ') || isDown('space')) shoot(p);
    } else {
      if(isDownCode('ArrowUp') || isDown('arrowup')) my -= 1;
      if(isDownCode('ArrowDown') || isDown('arrowdown')) my += 1;
      if(isDownCode('ArrowLeft') || isDown('arrowleft')) mx -= 1;
      if(isDownCode('ArrowRight') || isDown('arrowright')) mx += 1;
      const dashKey = isDownCode('Slash') || isDownCode('ShiftRight') || isDown('/') || isDownCode('NumpadDivide');
      const canDash2 = p.dash === 0 && (p.dashCd === 0 || p.extraDash > 0);
      if(dashKey && canDash2) {
        if(p.extraDash > 0) p.extraDash--; else p.dashCd = DASH_COOLDOWN;
        p.dash = DASH_TIME; p.inv = DASH_TIME + 4;
        for(let i = 0; i < 8; i++) particles.push({x: p.x, y: p.y, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 10, max: 10, r: 2, color: p.color, type: 'dash'});
      }
      if(isDownCode('Enter') || isDownCode('NumpadEnter') || isDown('Enter') || isDown('enter')) shoot(p);
    }

    const hzPre = hazardAt(p.x, p.y);
    if(hzPre && hzPre.kind === 'slime') p.inSlime = true;

    let mag = Math.hypot(mx, my);
    if(mag > 0) { mx /= mag; my /= mag; p.angle = Math.atan2(my, mx); }
    let curSpeed = p.baseSpeed * (p.speedBoost > 0 ? 1.22 : 1);
    if(p.inSlime) curSpeed *= 0.55;
    let dashSpd = p.baseSpeed * 2.35;
    if(p.inSlime) dashSpd *= 0.70;
    let spd = p.dash > 0 ? dashSpd : curSpeed;
    if(p.dash > 0 && mag === 0) { mx = Math.cos(p.angle); my = Math.sin(p.angle); }
    let nx = p.x + mx * spd;
    let ny = p.y + my * spd;
    // P1-07: capture pre-move position, then record the APPLIED delta so bot
    // prediction uses real velocity (wall slides included, free moves nonzero)
    const px0 = p.x, py0 = p.y;
    if(mx || my || p.dash > 0) tryMove(p, nx, ny);
    else { pushOutOfWalls(p); }

    // Track player velocity for bot predictive aim (updated every frame)
    p.lastVx = p.x - px0;
    p.lastVy = p.y - py0;

    const hz = hazardAt(p.x, p.y);
    if(hz && hz.kind === 'lava' && isLavaActive(hz) && p.lavaCd === 0) {
      if(p.shield && p.shieldHp > 0) {
        p.shieldHp--; p.lavaCd = 60; p.inv = Math.max(p.inv, 12);
        particles.push(...spawnHitLava(p.x, p.y));
        damageShake(p, 0.6);
        if(p.shieldHp <= 0) {
          p.shield = false; p.shieldHp = 0;
          for(let k = 0; k < 10; k++) particles.push({x: p.x, y: p.y, vx: Math.cos(Math.random() * Math.PI * 2) * (2 + Math.random() * 2.5), vy: Math.sin(Math.random() * Math.PI * 2) * (2 + Math.random() * 2.5), life: 18, max: 18, r: 1.9, color: '#ffd9a6', type: 'star'});
        }
      } else if(p.inv === 0) {
        p.hp = Math.max(0, p.hp - 2); p.lavaCd = 60; p.inv = 26;
        particles.push(...spawnHitLava(p.x, p.y));
        damageShake(p, 1);
        if(p.hp <= 0) {
          p.alive = false;
          for(let k = 0; k < 16; k++) particles.push({x: p.x, y: p.y, vx: Math.cos(Math.random() * Math.PI * 2) * (1 + Math.random() * 4), vy: Math.sin(Math.random() * Math.PI * 2) * (1 + Math.random() * 4), life: 20, max: 20, r: 2, color: p.color, type: 'hit'});
          const winner = p.id === 0 ? 1 : 0; scores[winner]++; endRound(winner, 'LAVA // BURNED'); return;
        }
      }
    }

    const dVoid = Math.hypot(p.x - 480, p.y - 280);
    if(safeRadius < 900 && dVoid > safeRadius - PLAYER_R) {
      if(p.voidCd === 0) {
        p.voidCd = 54;
        if(p.shield && p.shieldHp > 0) {
          p.shieldHp--; p.inv = Math.max(p.inv, 10);
          particles.push(...spawnHitVoid(p.x, p.y));
          damageShake(p, 0.5);
          if(p.shieldHp <= 0) { p.shield = false; p.shieldHp = 0; }
        } else if(p.inv === 0) {
          p.hp = Math.max(0, p.hp - 1); p.inv = 22;
          particles.push(...spawnHitVoid(p.x, p.y));
          damageShake(p, 0.8);
          if(p.hp <= 0) {
            p.alive = false;
            for(let k = 0; k < 16; k++) particles.push({x: p.x, y: p.y, vx: Math.cos(Math.random() * Math.PI * 2) * (1 + Math.random() * 4), vy: Math.sin(Math.random() * Math.PI * 2) * (1 + Math.random() * 4), life: 20, max: 20, r: 2, color: p.color, type: 'hit'});
            const winner = p.id === 0 ? 1 : 0; scores[winner]++; endRound(winner, 'VOID // CRUSHED'); return;
          }
        }
      }
    }

    for(let idx = pickups.length - 1; idx >= 0; idx--) {
      const pu = pickups[idx];
      if(len2(p.x, p.y, pu.x, pu.y) < 24) {
        // ammo pickups first
        if(pu.kind && pu.kind.indexOf('ammo_') === 0) {
          const cfg = AMMO_PICKUP_CFG[pu.kind];
          if(cfg){
            p.ammoType = cfg.bullet;
            p.ammo = cfg.ammo;
            particles.push(...spawnPickupEffect(pu.x, pu.y, cfg.color));
            // ammo icon text
            particles.push({x: p.x, y: p.y - 22, vx:0, vy:-0.9, life:42, max:42, r:0, color: cfg.color, type:'healText', text: cfg.bullet.toUpperCase()+` x${cfg.ammo}`});
            // small dash indicator
            p.squish = 10;
          }
          pickups.splice(idx, 1);
          continue;
        }
        const pt = POWER_TYPES[pu.kind];
        if(pu.kind === 'overcharge') {
          p.overcharge = pt.duration;
          particles.push(...spawnPickupEffect(pu.x, pu.y, pt.color));
          pickups.splice(idx, 1);
        } else if(pu.kind === 'shield') {
          p.shield = true; p.shieldHp = SHIELD_MAX_HP; p.inv = Math.max(p.inv, 8);
          particles.push(...spawnPickupEffect(pu.x, pu.y, pt.color));
          pickups.splice(idx, 1);
        } else if(pu.kind === 'blink') {
          p.extraDash = Math.min(2, p.extraDash + 1);
          p.dashCd = 0;
          p.speedBoost = pt.duration;
          particles.push(...spawnPickupEffect(pu.x, pu.y, pt.color));
          pickups.splice(idx, 1);
        } else if(pu.kind === 'heal') {
          if(p.hp < MAX_HP) {
            p.hp = Math.min(MAX_HP, p.hp + HEAL_AMOUNT);
            const hEl = document.getElementById(p.id === 0 ? 'heartsP1' : 'heartsP2');
            if(hEl) { hEl.classList.add('healed'); setTimeout(() => hEl.classList.remove('healed'), 480); }
            particles.push({x: p.x, y: p.y - 26, vx: 0, vy: -0.9, life: 42, max: 42, r: 0, color: '#22c55e', type: 'healText', text: `+${HEAL_AMOUNT}`});
          } else {
            if(p.overcharge < 60) p.overcharge = Math.min(240, p.overcharge + 30);
          }
          particles.push(...spawnPickupEffect(pu.x, pu.y, pt.color));
          for(let k = 0; k < 8; k++) particles.push({x: pu.x, y: pu.y, vx: Math.cos(Math.random() * Math.PI * 2) * (1 + Math.random() * 2.2), vy: Math.sin(Math.random() * Math.PI * 2) * (1 + Math.random() * 2.2), life: 18, max: 18, r: 1.8, color: '#22c55e', type: 'hit'});
          pickups.splice(idx, 1);
        }
      }
    }
  });

  const d = len2(players[0].x, players[0].y, players[1].x, players[1].y);
  const minDist = PLAYER_R * 2 + 2;
  if(d < minDist && d > 0.01) {
    const ang = Math.atan2(players[1].y - players[0].y, players[1].x - players[0].x);
    const overlap = minDist - d;
    const push = overlap / 2 + 0.6;
    players[0].x -= Math.cos(ang) * push; players[0].y -= Math.sin(ang) * push;
    players[1].x += Math.cos(ang) * push; players[1].y += Math.sin(ang) * push;
    players[0].squish = 8; players[1].squish = 8;
    pushOutOfWalls(players[0]); pushOutOfWalls(players[1]);
    const d2 = len2(players[0].x, players[0].y, players[1].x, players[1].y);
    if(d2 < minDist) {
      const j = 1.2;
      players[0].x -= Math.cos(ang) * j; players[0].y -= Math.sin(ang) * j;
      players[1].x += Math.cos(ang) * j; players[1].y += Math.sin(ang) * j;
    }
  } else if(d <= 0.01) {
    players[0].x -= 5; players[1].x += 5;
    players[0].squish = 10; players[1].squish = 10;
  }

  for(let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const br = b.r ?? BULLET_R;
    const trailLen = b.type === 'cannon' ? 6 : b.type === 'needle' ? 2 : b.type === 'trick' ? 5 : 4;
    b.trail.unshift({x: b.x, y: b.y});
    if(b.trail.length > trailLen) b.trail.pop();
    b.x += b.vx; b.y += b.vy;
    b.life--;
    // wall collision with typed radius
    let hitWall = null;
    for(const w of wallData) { if(rectCircleCollide(b.x, b.y, br, w.x, w.y, w.w, w.h)) { hitWall = w; break; } }
    if(hitWall) {
      if(b.type === 'trick' && (b.bounces ?? 0) < (b.bouncesMax ?? 5)) {
        // reflect: compute normal via closest point
        const closestX = clamp(b.x, hitWall.x, hitWall.x + hitWall.w);
        const closestY = clamp(b.y, hitWall.y, hitWall.y + hitWall.h);
        let nx = b.x - closestX, ny = b.y - closestY;
        let nlen = Math.hypot(nx, ny);
        if(nlen < 0.01){
          // inside wall: push to nearest edge
          const dl = b.x - hitWall.x;
          const dr = (hitWall.x + hitWall.w) - b.x;
          const dt = b.y - hitWall.y;
          const db = (hitWall.y + hitWall.h) - b.y;
          const m = Math.min(dl,dr,dt,db);
          if(m===dl){ nx=-1; ny=0; } else if(m===dr){ nx=1; ny=0; } else if(m===dt){ nx=0; ny=-1; } else { nx=0; ny=1; }
          nlen = 1;
        } else { nx/=nlen; ny/=nlen; }
        const dot = b.vx*nx + b.vy*ny;
        b.vx = (b.vx - 2*dot*nx) * 0.97;
        b.vy = (b.vy - 2*dot*ny) * 0.97;
        b.x += nx * (br + 2);
        b.y += ny * (br + 2);
        b.bounces = (b.bounces ?? 0) + 1;
        // decay dmg per bounce
        b.dmg = trickDmgAt(b.bounces);
        particles.push(...spawnBounceSpark(b.x, b.y, '#58d8ff'));
        // keep trail dim after bounce
        continue;
      }
      // non-trick or max bounces: die with typed wall FX
      if(b.type === 'cannon') particles.push(...spawnHitCannon(b.x, b.y, '#ffb23e'));
      else if(b.type === 'needle') particles.push(...spawnHit(b.x, b.y, '#a78bfa'));
      else if(b.type === 'trick') particles.push(...spawnBounceSpark(b.x,b.y,'#58d8ff'));
      else particles.push(...spawnHit(b.x, b.y, b.owner === 0 ? '#58d8ff' : '#ff5ca8'));
      bullets.splice(i, 1); continue;
    }
    if(b.life <= 0 || b.x < -20 || b.x > 980 || b.y < -20 || b.y > 580) {
      bullets.splice(i, 1); continue;
    }
    for(const p of players) {
      if(p.id === b.owner) continue;
      if(p.inv > 0) continue;
      if(!p.alive) continue;
      const effR = p.squish > 0 ? PLAYER_R * 0.88 : PLAYER_R;
      if(len2(b.x, b.y, p.x, p.y) < effR + br) {
        // shield absorbs with typed shield damage
        if(p.shield) {
          let shieldDmg = 1;
          if(b.type === 'cannon') shieldDmg = 2;
          else if(b.type === 'needle') {
            // needle block does 0 shield, rear does 2
            const f = Math.cos(p.angle), ff = Math.sin(p.angle);
            const dnorm = Math.hypot(b.vx,b.vy) || 1;
            const dnX = b.vx/dnorm, dnY = b.vy/dnorm;
            const dotN = f*dnX + ff*dnY;
            shieldDmg = dotN > 0.5 ? 2 : 0;
          } else if(b.type === 'trick') shieldDmg = 1;
          else shieldDmg = 1;
          if(shieldDmg === 0){
            // needle front graze vs shield == block with no shield loss
            p.inv = 8;
            particles.push(...spawnHitNeedleBlock(b.x, b.y));
            bullets.splice(i, 1); break;
          }
          p.shieldHp = (p.shieldHp || SHIELD_MAX_HP) - shieldDmg;
          if(p.shieldHp < 0) p.shieldHp = 0;
          p.inv = b.type==='cannon'? 18 : 16;
          particles.push(...spawnHit(b.x, b.y, '#58d8ff'));
          damageShake(p, shieldDmg>1?1.2:0.8);
          const crackCount = p.shieldHp <= 1 ? 10 : p.shieldHp <= 2 ? 8 : 14;
          for(let k = 0; k < crackCount; k++) {
            const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 3.2;
            const shard = p.shieldHp <= 0 ? '#a9e9ff' : '#58d8ff';
            particles.push({x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 16 + Math.round(Math.random() * 8), max: 22, r: p.shieldHp <= 0 ? 2.4 : 1.9, color: shard, type: 'hit'});
          }
          if(p.shieldHp <= 0) {
            p.shield = false; p.shieldHp = 0;
            for(let k = 0; k < 12; k++) particles.push({x: p.x, y: p.y, vx: Math.cos(Math.random() * Math.PI * 2) * (2 + Math.random() * 4), vy: Math.sin(Math.random() * Math.PI * 2) * (2 + Math.random() * 4), life: 20, max: 20, r: 2.2, color: '#a9e9ff', type: 'star'});
          }
          bullets.splice(i, 1); break;
        }
        // direct HP damage per type
        let dmg = 2; let inv = 28; let fx = null; let shake = 1;
        if(b.type === 'standard'){ dmg = 2; inv = 28; fx = spawnHitStandard(b.x,b.y,p.color); shake = 1; }
        else if(b.type === 'needle'){
          const f = Math.cos(p.angle), ff = Math.sin(p.angle);
          const dnorm = Math.hypot(b.vx,b.vy) || 1;
          const dnX = b.vx/dnorm, dnY = b.vy/dnorm;
          const dot = f*dnX + ff*dnY; // rear if >0.5
          if(dot > 0.5){
            dmg = 6; inv = 30; fx = spawnHitNeedleCrit(p.x,p.y); shake = 1.6;
          } else {
            // front graze: no dmg, small block FX, brief inv, keep bullet? consume but no hp loss
            p.inv = 6;
            particles.push(...spawnHitNeedleBlock(b.x,b.y));
            damageShake(p, 0.4);
            bullets.splice(i, 1); break;
          }
        } else if(b.type === 'cannon'){ dmg = 4; inv = 34; fx = spawnHitCannon(p.x,p.y,p.color); shake = 1.5; }
        else if(b.type === 'trick'){ dmg = b.dmg ?? trickDmgAt(b.bounces ?? 0); inv = 26; fx = spawnHitTrick(p.x,p.y,p.color,b.bounces ?? 0); shake = 0.9 + (b.bounces ?? 0)*0.12; }
        else { dmg = b.dmg ?? 2; fx = spawnHitStandard(b.x,b.y,p.color); }
        p.hp = Math.max(0, p.hp - dmg); p.inv = inv;
        damageShake(p, shake);
        if(fx) particles.push(...fx);
        bullets.splice(i, 1);
        if(p.hp <= 0) {
          p.alive = false;
          for(let k = 0; k < 18; k++) particles.push({x: p.x, y: p.y, vx: Math.cos(Math.random() * Math.PI * 2) * (1 + Math.random() * 5), vy: Math.sin(Math.random() * Math.PI * 2) * (1 + Math.random() * 5), life: 24, max: 24, r: 2 + Math.random() * 2, color: p.color, type: 'hit'});
          const winner = b.owner; scores[winner]++; endRound(winner, 'ELIMINATION');
        }
        break;
      }
    }
  }

  particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vx *= 0.96; pt.vy *= 0.96; pt.life--; });
  {
    const kept = particles.filter(pt => pt.life > 0);
    particles.length = 0; kept.forEach(v => particles.push(v));
    if (window.NOX_GAME) { window.NOX_GAME.particles.length = 0; kept.forEach(v => window.NOX_GAME.particles.push(v)); }
  }

  updateHUD();
}

function updateTrials(dt) {
  if(gameState !== 'playing') return;
  trialsVfxState.tick++;

  // Timer
  timeLeft -= dt / 60;
  if(timeLeft <= 0) {
    // Survived 10 minutes - WIN
    gameState = 'gameOver';
    const finalPoints = trialsFinal();
    if(finalPoints > trialHighScore) {
      trialHighScore = finalPoints;
      try { localStorage.setItem('nv_trials_highscore', String(trialHighScore)); } catch {}
    }
    clearTrialsState();
    if(window.NOX_GAME && window.NOX_GAME.onTrialsWin) window.NOX_GAME.onTrialsWin(finalPoints);
    showTrialsGameOver(finalPoints, 'TIME SURVIVED', true);
    return;
  }

  // Void shrink logic - rectangular border, starts at VOID_START_TIME (450s),
  // shrinks from 2x arena edges toward the 1x center safe zone over VOID_SHRINK_DURATION (30s)
  const elapsed = TRIAL_DURATION - timeLeft;
  if(elapsed >= VOID_START_TIME) {
    const shrinkProgress = Math.min(1, (elapsed - VOID_START_TIME) / VOID_SHRINK_DURATION);
    const startRect = { x: 0, y: 0, w: TRIALS_W, h: TRIALS_H };
    const endRect = { x: (TRIALS_W - 960) / 2, y: (TRIALS_H - 560) / 2, w: 960, h: 560 };
    voidRect = {
      x: startRect.x + (endRect.x - startRect.x) * shrinkProgress,
      y: startRect.y + (endRect.y - startRect.y) * shrinkProgress,
      w: startRect.w + (endRect.w - startRect.w) * shrinkProgress,
      h: startRect.h + (endRect.h - startRect.h) * shrinkProgress,
    };
    safeRadius = Math.max(480, Math.min(TRIALS_W, TRIALS_H) * 0.5 - shrinkProgress * (Math.min(TRIALS_W, TRIALS_H) * 0.5 - 480));

    // Draw void border (rectangular)
    const voidG = document.getElementById('void');
    if(voidG) voidG.setAttribute('opacity', '1');

    // Update void rect visuals
    const vr = voidRect;
    const vHole = document.getElementById('voidHole');
    const vRing = document.getElementById('voidRing');
    const vRing2 = document.getElementById('voidRing2');
    const vInner = document.getElementById('voidInner');
    const vCore = document.getElementById('voidCore');
    [vHole, vRing, vRing2, vInner, vCore].forEach(el => {
      if(el) {
        el.setAttribute('x', vr.x);
        el.setAttribute('y', vr.y);
        el.setAttribute('width', vr.w);
        el.setAttribute('height', vr.h);
      }
    });
    const vBlock = document.getElementById('voidBlocksRect');
    if(vBlock) vBlock.setAttribute('mask', 'url(#voidMaskRect)');
    const vStars = document.getElementById('voidStarsRect');
    if(vStars) vStars.setAttribute('mask', 'url(#voidMaskRect)');
    const vEdge = document.getElementById('voidEdgeRect');
    if(vEdge) vEdge.setAttribute('mask', 'url(#voidMaskRect)');
    const vPurple = document.getElementById('voidPurpleRect');
    if(vPurple) vPurple.setAttribute('mask', 'url(#voidMaskRect)');
  } else {
    safeRadius = 999;
    voidRect = null;
    const voidG = document.getElementById('void');
    if(voidG) voidG.setAttribute('opacity', '0');
    const vBlock = document.getElementById('voidBlocksRect');
    if(vBlock) vBlock.setAttribute('mask', 'url(#voidMask)');
    const vStars = document.getElementById('voidStarsRect');
    if(vStars) vStars.setAttribute('mask', 'url(#voidMask)');
    const vEdge = document.getElementById('voidEdgeRect');
    if(vEdge) vEdge.setAttribute('mask', 'url(#voidMask)');
    const vPurple = document.getElementById('voidPurpleRect');
    if(vPurple) vPurple.setAttribute('mask', 'url(#voidMask)');
  }

  // Point accrual: +1 per second (survival), exact fractional ledger entry
  const elapsedTotal = TRIAL_DURATION - timeLeft;
  if(elapsedTotal >= 1) {
    const multiplier = elapsedTotal >= VOID_START_TIME ? 2 : 1;
    awardTrials('survival', 1 * multiplier / 60); // per frame at 60fps
  }

  // Hazard movement
  hazards.forEach(h => h.t += 1);
  if(--hazardRelocateTimer <= 0) {
    relocateRandomHazards();
  }
  drawHazards();

  // Pickup update
  if(pickups.length === 0 && Math.random() < 0.008) spawnTrialsPickups(2);
  pickups.forEach(p => p.t += 0.14);
  {
    const kept = pickups.filter(p => p.life-- > 0);
    pickups.length = 0; kept.forEach(v => pickups.push(v));
    if(window.NOX_GAME) { window.NOX_GAME.pickups.length = 0; kept.forEach(v => window.NOX_GAME.pickups.push(v)); }
  }

  // Assemble GameState for new bot AI (decoupled from globals)
  const gameStateForBot = {
    player: {
      x: players[0].x,
      y: players[0].y,
      vx: players[0].vx || 0,
      vy: players[0].vy || 0,
      dash: players[0].dash || 0,
      inv: players[0].inv || 0,
      alive: players[0].alive,
    },
    pickups,
    hazards,
    bullets: bullets.filter(b => b.owner !== 2), // Only player bullets (owner 0)
    walls: wallData,
    voidRect,
    safeRadius,
    gameMode: 'trials',
    wallsCollide: (x, y, r) => wallsCollide(x, y, r),
  };

  // Bot AI - new priority-based system
  const botResult = updateBotAI(bot, gameStateForBot);

  // Apply bot cooldowns (frame-based, handled in updateBotAI but keep for compatibility)
  if(bot.dash > 0) { bot.dash--; if(bot.dash <= 0) { bot.dash = 0; bot.inv = 6; } }

  // Apply bot movement with wall-aware physics
  bot.vx = botResult.mx; bot.vy = botResult.my;
  // Bot ALWAYS faces movement direction (like player) for fairness
  // AI tracks targetAngle separately for shooting calculations
  if (botResult.mx || botResult.my) {
    const moveAngle = Math.atan2(botResult.my, botResult.mx);
    bot.angle = moveAngle;
  }

  let botSpd = bot.baseSpeed * (bot.speedBoost > 0 ? 1.22 : 1);
  if(bot.inSlime) botSpd *= 0.55;
  let botDashSpd = bot.baseSpeed * 2.35;
  if(bot.inSlime) botDashSpd *= 0.70;
  const spdBot = bot.dash > 0 ? botDashSpd : botSpd;
  let nx = bot.x + botResult.mx * spdBot;
  let ny = bot.y + botResult.my * spdBot;

  if(botResult.mx || botResult.my || bot.dash > 0) {
    tryMove(bot, nx, ny);
  } else {
    pushOutOfWalls(bot);
  }

  // Bot dash from AI
  if (botResult.dash && bot.dash === 0 && (bot.dashCd === 0 || bot.extraDash > 0)) {
    if(bot.extraDash > 0) bot.extraDash--; else bot.dashCd = DASH_COOLDOWN;
    bot.dash = DASH_TIME; bot.inv = DASH_TIME + 4;
    emitTrialsVfx('dash', bot.x, bot.y, { actor: 'bot' });
  }

  // Bot powerup activations from AI
  if (botResult.activateShield && bot.shield && bot.shieldHp > 0) {
    // Shield activates automatically via existing pickup logic
  }
  if (botResult.activateOvercharge && bot.overcharge === 0) {
    // Overcharge will be picked up via seekPickup behavior
  }
  if (botResult.useBlinkDash && bot.extraDash > 0 && bot.dash === 0) {
    bot.extraDash--;
    bot.dash = DASH_TIME;
    bot.inv = DASH_TIME + 4;
    emitTrialsVfx('dash', bot.x, bot.y, { actor: 'bot' });
  }

  // Bot hazard detection (slime/lava) - not void (handled by avoidVoid behavior)
  const hz = hazardAt(bot.x, bot.y);
  if(hz && hz.kind === 'slime') bot.inSlime = true;
  if(hz && hz.kind === 'lava' && isLavaActive(hz) && bot.lavaCd === 0 && bot.inv === 0) {
    bot.hp = Math.max(0, bot.hp - 2);
    bot.lavaCd = 60; bot.inv = 26;
    emitTrialsVfx('lavaHit', bot.x, bot.y, { actor: 'bot' });
    damageShake(bot, 1);
    if(bot.hp <= 0) {
      bot.alive = false;
      gameState = 'gameOver';
      clearTrialsState(); if(window.NOX_GAME && window.NOX_GAME.onTrialsLose) window.NOX_GAME.onTrialsLose(trialsFinal(), 'BOT LAVA'); showTrialsGameOver(trialsFinal(), 'BOT BURNED IN LAVA', false);
      return;
    }
  }

  // Void damage to bot (bot doesn't know about void, but still takes damage)
  if(voidRect && (bot.x < voidRect.x || bot.x > voidRect.x + voidRect.w || bot.y < voidRect.y || bot.y > voidRect.y + voidRect.h) && bot.inv === 0) {
    bot.voidCd = 54;
    bot.hp = Math.max(0, bot.hp - 1);
    emitTrialsVfx('voidHit', bot.x, bot.y, { actor: 'bot' });
    damageShake(bot, 0.8);
    if(bot.hp <= 0) {
      bot.alive = false;
      gameState = 'gameOver';
      clearTrialsState(); if(window.NOX_GAME && window.NOX_GAME.onTrialsLose) window.NOX_GAME.onTrialsLose(trialsFinal(), 'BOT VOID'); showTrialsGameOver(trialsFinal(), 'BOT LOST TO THE VOID', false);
      return;
    }
  }

  // Bot shooting — handled by AI (predictive aim, reaction delay already applied)
  if(botResult.shoot && bot.shootCd <= 0) {
    shoot(bot);
  }

  // Bot powerup pickup
  for(let idx = pickups.length - 1; idx >= 0; idx--) {
    const pu = pickups[idx];
    if(distance(bot.x, bot.y, pu.x, pu.y) < 24) {
      pickupBotPowerup(bot, pu);
      pickups.splice(idx, 1);
    }
  }

  // Player (P1) update - reuse existing logic but without 1v1 collision
  players.forEach(p => {
    if(!p.alive) return;
    if(p.dashCd > 0) p.dashCd--;
    if(p.inv > 0) p.inv--;
    if(p.shootCd > 0) p.shootCd--;
    if(p.overcharge > 0) p.overcharge--;
    if(p.speedBoost > 0) p.speedBoost--;
    if(p.squish > 0) p.squish--;
    if(p.lavaCd > 0) p.lavaCd--;
    if(p.voidCd > 0) p.voidCd--;
    if(p.slimeCd > 0) p.slimeCd--;
    if(p.dash > 0) { p.dash--; if(p.dash === 0) p.inv = 6; }
    if(wallsCollide(p.x, p.y, PLAYER_R)) pushOutOfWalls(p);
    p.inSlime = false;

    let mx = 0, my = 0;
    if(isDownCode('KeyW') || isDown('w')) my -= 1;
    if(isDownCode('KeyS') || isDown('s')) my += 1;
    if(isDownCode('KeyA') || isDown('a')) mx -= 1;
    if(isDownCode('KeyD') || isDown('d')) mx += 1;
    const dashKey = isDownCode('ShiftLeft') || isDown('Shift') || isDown('shift');
    const canDash = p.dash === 0 && (p.dashCd === 0 || p.extraDash > 0);
    if(dashKey && canDash) {
      if(p.extraDash > 0) p.extraDash--; else p.dashCd = DASH_COOLDOWN;
      p.dash = DASH_TIME; p.inv = DASH_TIME + 4;
      emitTrialsVfx('dash', p.x, p.y, { actor: 0 });
    }
    if(isDownCode('Space') || isDown(' ') || isDown('space')) shoot(p);

    const hzPre = hazardAt(p.x, p.y);
    if(hzPre && hzPre.kind === 'slime') p.inSlime = true;

    let mag = Math.hypot(mx, my);
    if(mag > 0) { mx /= mag; my /= mag; p.angle = Math.atan2(my, mx); }
    let curSpeed = p.baseSpeed * (p.speedBoost > 0 ? 1.22 : 1);
    if(p.inSlime) {
      if(p.slimeCd <= 0) {
        const slimePenalty = elapsedTotal >= VOID_START_TIME ? 45 : 15;
        awardTrials('slimePenalty', -slimePenalty);
        p.slimeCd = 60;
      }
      curSpeed *= 0.55;
    }
    let dashSpd = p.baseSpeed * 2.35;
    if(p.inSlime) dashSpd *= 0.70;
    let spd = p.dash > 0 ? dashSpd : curSpeed;
    if(p.dash > 0 && mag === 0) { mx = Math.cos(p.angle); my = Math.sin(p.angle); }
    let nx = p.x + mx * spd;
    let ny = p.y + my * spd;
    // P1-07: record the APPLIED movement delta (see 1v1 twin site)
    const px0 = p.x, py0 = p.y;
    if(mx || my || p.dash > 0) tryMove(p, nx, ny);
    else { pushOutOfWalls(p); }

    // Track player velocity for bot predictive aim (updated every frame)
    p.lastVx = p.x - px0;
    p.lastVy = p.y - py0;

    // Lava damage
    const hz = hazardAt(p.x, p.y);
    if(hz && hz.kind === 'lava' && isLavaActive(hz) && p.lavaCd === 0) {
      if(p.shield && p.shieldHp > 0) {
        p.shieldHp--; p.lavaCd = 60; p.inv = Math.max(p.inv, 12);
        emitTrialsVfx('lavaHit', p.x, p.y, { actor: 0 });
        damageShake(p, 0.6);
        if(p.shieldHp <= 0) {
          p.shield = false; p.shieldHp = 0;
          emitTrialsVfx('shieldBreak', p.x, p.y, { actor: 0 });
        }
      } else if(p.inv === 0) {
        const penalty = elapsedTotal >= VOID_START_TIME ? 60 : 30; // 3x after 7:30
        p.hp = Math.max(0, p.hp - 2); p.lavaCd = 60; p.inv = 26;
        awardTrials('lavaPenalty', -penalty);
        emitTrialsVfx('lavaHit', p.x, p.y, { actor: 0 });
        damageShake(p, 1);
        if(p.hp <= 0) {
          p.alive = false;
          emitTrialsVfx('death', p.x, p.y, { actor: 0 });
          gameState = 'gameOver';
          clearTrialsState(); if(window.NOX_GAME && window.NOX_GAME.onTrialsLose) window.NOX_GAME.onTrialsLose(trialsFinal(), 'LAVA BURNED'); showTrialsGameOver(trialsFinal(), 'LAVA BURNED', false);
          return;
        }
      }
    }

    // Void damage to player (rectangular, exponential with distance from safe edge)
    if(voidRect) {
      const inSafeX = p.x + PLAYER_R > voidRect.x && p.x - PLAYER_R < voidRect.x + voidRect.w;
      const inSafeY = p.y + PLAYER_R > voidRect.y && p.y - PLAYER_R < voidRect.y + voidRect.h;
      if(!inSafeX || !inSafeY) {
        if(p.voidCd === 0) {
          p.voidCd = 54;
          // Exponential: deeper into the void = more damage
          const dx = Math.max(voidRect.x - (p.x - PLAYER_R), (p.x + PLAYER_R) - (voidRect.x + voidRect.w), 0);
          const dy = Math.max(voidRect.y - (p.y - PLAYER_R), (p.y + PLAYER_R) - (voidRect.y + voidRect.h), 0);
          const depth = Math.max(dx, dy);
          const dmg = Math.min(6, Math.floor(Math.pow(2, depth / 150))); // 1 at edge, lethal deeper
          if(p.shield && p.shieldHp > 0) {
            p.shieldHp--; p.inv = Math.max(p.inv, 10);
            emitTrialsVfx('voidHit', p.x, p.y, { actor: 0 });
            damageShake(p, 0.5);
            if(p.shieldHp <= 0) {
              p.shield = false; p.shieldHp = 0;
              emitTrialsVfx('shieldBreak', p.x, p.y, { actor: 0 });
            }
          } else if(p.inv === 0) {
            p.hp = Math.max(0, p.hp - dmg); p.inv = 22;
            const penalty = dmg * (elapsedTotal >= VOID_START_TIME ? 3 : 1);
            awardTrials('voidPenalty', -penalty);
            emitTrialsVfx('voidHit', p.x, p.y, { actor: 0 });
            damageShake(p, 0.8);
            if(p.hp <= 0) {
              p.alive = false;
              emitTrialsVfx('death', p.x, p.y, { actor: 0 });
              gameState = 'gameOver';
              clearTrialsState(); if(window.NOX_GAME && window.NOX_GAME.onTrialsLose) window.NOX_GAME.onTrialsLose(trialsFinal(), 'VOID CRUSHED'); showTrialsGameOver(trialsFinal(), 'VOID CRUSHED', false);
              return;
            }
          }
        }
      }
    }

    // Player pickup pickup
    for(let idx = pickups.length - 1; idx >= 0; idx--) {
      const pu = pickups[idx];
      if(distance(p.x, p.y, pu.x, pu.y) < 24) {
        // Award points for pickup
        const pt = POWER_TYPES[pu.kind];
        const pointValue = elapsedTotal >= VOID_START_TIME ? 150 : 75;
        awardTrials('pickupBonus', pointValue);

        if(pu.kind && pu.kind.indexOf('ammo_') === 0) {
          const cfg = AMMO_PICKUP_CFG[pu.kind];
          if(cfg) {
            p.ammoType = cfg.bullet; p.ammo = cfg.ammo;
            emitTrialsVfx('pickup', pu.x, pu.y, { actor: 0, pickup: pu.kind, tx: p.x, ty: p.y, amount: cfg.ammo });
            p.squish = 10;
          }
        } else if(pt) {
          if(pu.kind === 'overcharge') p.overcharge = pt.duration;
          else if(pu.kind === 'shield') { p.shield = true; p.shieldHp = SHIELD_MAX_HP; p.inv = Math.max(p.inv, 8); }
          else if(pu.kind === 'blink') { p.extraDash = Math.min(2, p.extraDash + 1); p.dashCd = 0; p.speedBoost = pt.duration; }
          else if(pu.kind === 'heal') {
            if(p.hp < MAX_HP) { p.hp = Math.min(MAX_HP, p.hp + HEAL_AMOUNT); emitTrialsVfx('heal', pu.x, pu.y, { actor: 0, tx: p.x, ty: p.y, amount: HEAL_AMOUNT }); }
            else if(p.overcharge < 60) p.overcharge = Math.min(240, p.overcharge + 30);
          }
          if(pu.kind !== 'heal') emitTrialsVfx('pickup', pu.x, pu.y, { actor: 0, pickup: pu.kind });
        }
        pickups.splice(idx, 1);
      }
    }
  });

  // Bullets — identical physics to 1v1 update(), just bounds scaled to 1920x1120
  for(let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const br = b.r ?? BULLET_R;
    const trailLen = b.type === 'cannon' ? 6 : b.type === 'needle' ? 2 : b.type === 'trick' ? 5 : 4;
    b.trail.unshift({x: b.x, y: b.y});
    if(b.trail.length > trailLen) b.trail.pop();
    b.x += b.vx; b.y += b.vy;
    b.life--;
    let hitWall = null;
    for(const w of wallData) { if(rectCircleCollide(b.x, b.y, br, w.x, w.y, w.w, w.h)) { hitWall = w; break; } }
    if(hitWall) {
      if(b.type === 'trick' && (b.bounces ?? 0) < (b.bouncesMax ?? 5)) {
        const closestX = clamp(b.x, hitWall.x, hitWall.x + hitWall.w);
        const closestY = clamp(b.y, hitWall.y, hitWall.y + hitWall.h);
        let nx2 = b.x - closestX, ny2 = b.y - closestY;
        let nlen = Math.hypot(nx2, ny2);
        if(nlen < 0.01){
          const dl = b.x - hitWall.x; const dr = (hitWall.x + hitWall.w) - b.x; const dt = b.y - hitWall.y; const db = (hitWall.y + hitWall.h) - b.y; const m = Math.min(dl,dr,dt,db);
          if(m===dl){ nx2=-1; ny2=0; } else if(m===dr){ nx2=1; ny2=0; } else if(m===dt){ nx2=0; ny2=-1; } else { nx2=0; ny2=1; } nlen = 1;
        } else { nx2/=nlen; ny2/=nlen; }
        const dot = b.vx*nx2 + b.vy*ny2;
        b.vx = (b.vx - 2*dot*nx2) * 0.97; b.vy = (b.vy - 2*dot*ny2) * 0.97;
        b.x += nx2 * (br + 2); b.y += ny2 * (br + 2);
        b.bounces = (b.bounces ?? 0) + 1; b.dmg = trickDmgAt(b.bounces);
        emitTrialsVfx('trickBounce', b.x, b.y, { actor: b.owner, bulletType: 'trick', amount: b.bounces });
        continue;
      }
      emitTrialsVfx('wallHit', b.x, b.y, { actor: b.owner, bulletType: b.type });
      bullets.splice(i, 1); continue;
    }
    if(b.life <= 0 || b.x < -20 || b.x > TRIALS_W + 20 || b.y < -20 || b.y > TRIALS_H + 20) { bullets.splice(i, 1); continue; }
    // hit checks
    if(b.owner === 2) {
      const p = players[0];
      if(!p || !p.alive || p.inv > 0) continue;
      if(distance(b.x, b.y, p.x, p.y) < br + PLAYER_R) {
        // shield absorb same as 1v1
        if(p.shield && p.shieldHp > 0) {
          let sd = 1; if(b.type==='cannon') sd=2; else if(b.type==='needle'){ const f=Math.cos(p.angle), ff=Math.sin(p.angle), dn=Math.hypot(b.vx,b.vy)||1, dot2=f*b.vx/dn+ff*b.vy/dn; sd = dot2>0.5?2:0; } else if(b.type==='trick') sd=1;
          if(sd===0){ p.inv=8; emitTrialsVfx('needleBlock', b.x, b.y, { actor: 2, target: 0, bulletType: 'needle' }); bullets.splice(i,1); continue; }
          p.shieldHp-=sd; p.inv= b.type==='cannon'?18:16; damageShake(p, sd>1?1.2:0.8);
          emitTrialsVfx('shieldHit', b.x, b.y, { actor: 2, target: 0, bulletType: b.type, tx: p.x, ty: p.y, amount: Math.max(0, p.shieldHp) });
          if(p.shieldHp<=0){ p.shield=false; p.shieldHp=0; emitTrialsVfx('shieldBreak', p.x, p.y, { actor: 0 }); }
          bullets.splice(i,1); continue;
        }
        // direct
        let dmg=2, inv=28, shake=1, fxKind='standard';
        if(b.type==='standard'){ dmg=2; inv=28; }
        else if(b.type==='needle'){ const f=Math.cos(p.angle), ff=Math.sin(p.angle), dn=Math.hypot(b.vx,b.vy)||1, dot2=f*b.vx/dn+ff*b.vy/dn; if(dot2>0.5){ dmg=6; inv=30; fxKind='needleCrit'; shake=1.6; } else { p.inv=6; emitTrialsVfx('needleBlock', b.x, b.y, { actor: 2, target: 0, bulletType: 'needle' }); damageShake(p,0.4); bullets.splice(i,1); continue; } }
        else if(b.type==='cannon'){ dmg=4; inv=34; fxKind='cannon'; shake=1.5; }
        else if(b.type==='trick'){ dmg=b.dmg??trickDmgAt(b.bounces??0); inv=26; fxKind='trick'; }
        p.hp = Math.max(0, p.hp - dmg); p.inv = inv; damageShake(p,shake);
        if(fxKind==='needleCrit') emitTrialsVfx('needleCrit', p.x, p.y, { actor: 2, target: 0, bulletType: 'needle', amount: 6 });
        else if(fxKind==='cannon') emitTrialsVfx('cannonHit', p.x, p.y, { actor: 2, target: 0, bulletType: 'cannon', amount: 4 });
        else if(fxKind==='trick') emitTrialsVfx('trickHit', p.x, p.y, { actor: 2, target: 0, bulletType: 'trick', amount: dmg });
        else emitTrialsVfx('hitStandard', b.x, b.y, { actor: 2, target: 0, bulletType: 'standard' });
        awardTrials('botHitPenalty', -(elapsedTotal >= VOID_START_TIME ? 6 : 3));
        bullets.splice(i, 1);
        if(p.hp <= 0) { p.alive=false; emitTrialsVfx('death', p.x, p.y, { actor: 0 }); gameState='gameOver'; clearTrialsState(); if(window.NOX_GAME && window.NOX_GAME.onTrialsLose) window.NOX_GAME.onTrialsLose(trialsFinal(),'BOT HIT'); showTrialsGameOver(trialsFinal(),'KILLED BY THE BOT',false); return; }
        continue;
      }
    } else if(b.owner === 0) {
      if(!bot.alive || bot.inv > 0) continue;
      if(distance(b.x, b.y, bot.x, bot.y) < br + PLAYER_R) {
        if(bot.shield && bot.shieldHp > 0) {
          let sd=1; if(b.type==='cannon') sd=2; else if(b.type==='needle'){ const f=Math.cos(bot.angle), ff=Math.sin(bot.angle), dn=Math.hypot(b.vx,b.vy)||1, dot2=f*b.vx/dn+ff*b.vy/dn; sd=dot2>0.5?2:0; }
          if(sd===0){ bot.inv=8; emitTrialsVfx('needleBlock', b.x, b.y, { actor: 0, target: 'bot', bulletType: 'needle' }); bullets.splice(i,1); continue; }
          bot.shieldHp-=sd; bot.inv=16; damageShake(bot,0.8);
          emitTrialsVfx('shieldHit', b.x, b.y, { actor: 0, target: 'bot', bulletType: b.type, tx: bot.x, ty: bot.y, amount: Math.max(0, bot.shieldHp) });
          if(bot.shieldHp<=0){ bot.shield=false; bot.shieldHp=0; emitTrialsVfx('shieldBreak', bot.x, bot.y, { actor: 'bot' }); }
          bullets.splice(i,1); continue;
        }
        let dmg=b.dmg??2, inv=28, fxKind='standard';
        if(b.type==='needle'){ const f=Math.cos(bot.angle), ff=Math.sin(bot.angle), dn=Math.hypot(b.vx,b.vy)||1, dot2=f*b.vx/dn+ff*b.vy/dn; if(dot2>0.5){ dmg=6; inv=30; fxKind='needleCrit'; } else { bot.inv=6; emitTrialsVfx('needleBlock', b.x, b.y, { actor: 0, target: 'bot', bulletType: 'needle' }); bullets.splice(i,1); continue; } }
        else if(b.type==='cannon'){ dmg=4; inv=34; fxKind='cannon'; }
        else if(b.type==='trick'){ dmg=b.dmg??trickDmgAt(b.bounces??0); inv=26; fxKind='trick'; }
        bot.hp = Math.max(0, bot.hp - dmg); bot.inv = inv; damageShake(bot,1);
        if(fxKind==='needleCrit') emitTrialsVfx('needleCrit', bot.x, bot.y, { actor: 0, target: 'bot', bulletType: 'needle', amount: 6 });
        else if(fxKind==='cannon') emitTrialsVfx('cannonHit', bot.x, bot.y, { actor: 0, target: 'bot', bulletType: 'cannon', amount: 4 });
        else if(fxKind==='trick') emitTrialsVfx('trickHit', bot.x, bot.y, { actor: 0, target: 'bot', bulletType: 'trick', amount: dmg });
        else emitTrialsVfx('hitStandard', b.x, b.y, { actor: 0, target: 'bot', bulletType: 'standard' });
        awardTrials('hitBonus', (elapsedTotal >= VOID_START_TIME ? 50 : 25));
        bullets.splice(i, 1);
        if(bot.hp <= 0) { bot.alive=false; emitTrialsVfx('death', bot.x, bot.y, { actor: 'bot' }); gameState='gameOver'; awardTrials('botKill', 500); clearTrialsState(); if(window.NOX_GAME && window.NOX_GAME.onTrialsWin) window.NOX_GAME.onTrialsWin(trialsFinal()); showTrialsGameOver(trialsFinal(),'BOT DESTROYED',true); return; }
        continue;
      }
    }
  }

  // Save state every 2 seconds (120 frames) - only while actively playing
  if(gameState === 'playing') {
    const frameNum = Math.floor((TRIAL_DURATION - timeLeft) * 60);
    if(frameNum > 0 && frameNum % SAVE_INTERVAL === 0 && lastSaveTime !== frameNum) {
      lastSaveTime = frameNum;
      saveTrialsState();
    }
  }

  // Particles — Trials emits visual events like every other mode; the shared
  // timeline ages them (drain -> ingest -> step -> mirror to the render array).
  for (const ev of drainVfx(trialsVfxState)) trialsFxTimeline.ingest(ev);
  trialsFxTimeline.step(1);
  mirrorTimelineToParticles(trialsFxTimeline);

  updateHUD();
}

// Pause/resume for trials - SINGLE key owner (P0-05). The shell mirrors the
// overlay from the events dispatched here; it never toggles pause itself.
window.addEventListener('keydown', e => {
  if(gameMode !== 'trials') return;
  if(gameState === 'playing' && (e.key === 'p' || e.key === 'P' || e.key === 'Escape')) {
    gameState = 'paused';
    try { localStorage.setItem('nv_trials_paused', '1'); } catch {}
    if(window.NOX_GAME && window.NOX_GAME.onTrialsPause) window.NOX_GAME.onTrialsPause();
    window.dispatchEvent(new CustomEvent('nox:pause'));
  } else if(gameState === 'paused' && (e.key === 'p' || e.key === 'P' || e.key === 'Escape')) {
    gameState = 'playing';
    try { localStorage.removeItem('nv_trials_paused'); } catch {}
    window.dispatchEvent(new CustomEvent('nox:resume'));
  }
});

function forfeitTrials() {
  // Save high score before clearing
  const hs = parseInt(localStorage.getItem('nv_trials_highscore') || '0', 10);
  if(trialsFinal() > hs) {
    try { localStorage.setItem('nv_trials_highscore', String(trialsFinal())); } catch {}
  }
  gameState = 'menu';
  clearPendingTimeouts();
  clearInputState();
  forfeitLock = false;
  clearTrialsState();
  try { localStorage.removeItem('nv_trials_paused'); } catch {}
  // Hard reset trial state so menu is clean — HUD-only, don't touch arena walls (keep preview), just clear dynamic objects
  bullets.length = 0; pickups.length = 0; particles.length = 0;
  simFxTimeline.clear(); trialsFxTimeline.clear();
  if(window.NOX_GAME){ window.NOX_GAME.bullets.length=0; window.NOX_GAME.pickups.length=0; window.NOX_GAME.particles.length=0; }
  trialPoints = 0; trialsLedger = createLedger(); timeLeft = TRIAL_DURATION; voidRect = null; safeRadius = 999; lastSaveTime = 0;
  prevHp[0]=MAX_HP; prevHp[1]=MAX_HP; prevHp[2]=BOT_MAX_HP;
  bot.hp = BOT_MAX_HP; bot.alive = true;
  const voidG=document.getElementById('void'); if(voidG) voidG.setAttribute('opacity','0');
  document.getElementById('gameOverOverlay')?.classList.add('hidden');
  document.getElementById('roundOverlay')?.classList.add('hidden');
  document.getElementById('startOverlay')?.classList.remove('hidden');
  // Notify React to close pause/confirm overlays (HUD-only)
  try{ window.dispatchEvent(new CustomEvent('nox:forfeitDone')); }catch{}
  updateHUD(); render();
}

function shootBotBullet(bot, target) {
  // kept for backwards compat — now delegates to shared shoot()
  const ang = Math.atan2(target.y - bot.y, target.x - bot.x);
  bot.angle = ang;
  shoot(bot);
}

function pickupBotPowerup(bot, pu) {
  // Ammo pickups are separate from POWER_TYPES — handle first
  if(pu.kind && pu.kind.indexOf('ammo_') === 0) {
    const cfg = AMMO_PICKUP_CFG[pu.kind];
    if(cfg) { bot.ammoType = cfg.bullet; bot.ammo = cfg.ammo; }
    emitTrialsVfx('pickup', pu.x, pu.y, { actor: 'bot', pickup: pu.kind, tx: bot.x, ty: bot.y, amount: cfg ? cfg.ammo : undefined });
    bot.squish = 10;
    damageShake(bot, 0.6);
    return;
  }
  const pt = POWER_TYPES[pu.kind];
  if(!pt) return;
  if(pu.kind === 'overcharge') { bot.overcharge = pt.duration; emitTrialsVfx('pickup', pu.x, pu.y, { actor: 'bot', pickup: pu.kind }); bot.squish = 10; damageShake(bot,0.5); }
  else if(pu.kind === 'shield') { bot.shield = true; bot.shieldHp = SHIELD_MAX_HP; emitTrialsVfx('pickup', pu.x, pu.y, { actor: 'bot', pickup: pu.kind }); bot.squish = 10; damageShake(bot,0.5); }
  else if(pu.kind === 'blink') { bot.extraDash = Math.min(2, bot.extraDash + 1); bot.dashCd = 0; bot.speedBoost = pt.duration; emitTrialsVfx('pickup', pu.x, pu.y, { actor: 'bot', pickup: pu.kind }); bot.squish = 10; damageShake(bot,0.5); }
  else if(pu.kind === 'heal') {
    const before = bot.hp;
    bot.hp = Math.min(bot.maxHp, bot.hp + HEAL_AMOUNT);
    emitTrialsVfx('heal', pu.x, pu.y, { actor: 'bot', tx: bot.x, ty: bot.y, amount: bot.hp > before ? bot.hp - before : 0 });
    bot.squish = 10;
  }
}

function saveTrialsState() {
  try {
    // P2-18: small validated snapshot only — particles/cosmetics are omitted
    const state = buildTrialsSaveSnapshot({
      timeLeft, trialPoints, trialHighScore,
      wallData, hazards, players, bot, bullets, pickups,
      voidRect, voidShrinkStart, safeRadius, lastSaveTime,
    });
    localStorage.setItem(TRIALS_SAVE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('nox:trialsStateChanged'));
  } catch (e) {
    // P2-18: never swallow quota/serialization failures silently
    try { window.dispatchEvent(new CustomEvent('nox:trialsSaveFailed', { detail: { reason: 'quota' } })); } catch {}
  }
}

function loadTrialsState() {
  // P2-05: stored state is never trusted — versioned schema validation;
  // invalid/corrupt saves are discarded with a user-visible recovery signal.
  const result = loadTrialsSave();
  if (!result.ok) {
    if (result.reason !== 'no-save' && result.reason !== 'storage-unavailable') {
      try { window.dispatchEvent(new CustomEvent('nox:trialsSaveFailed', { detail: { reason: result.reason } })); } catch {}
    }
    return null;
  }
  return result.state;
}

function hasTrialsState() {
  try { return !!localStorage.getItem('nv_trials_state'); } catch { return false; }
}

function resumeTrials() {
  const state = loadTrialsState();
  if(!state) return false;
  gameMode = 'trials';
  gameState = 'playing';
  timeLeft = state.timeLeft;
  trialPoints = state.trialPoints || 0;
  trialHighScore = state.trialHighScore || 0;
  voidRect = state.voidRect || null;
  voidShrinkStart = state.voidShrinkStart || 0;
  safeRadius = state.safeRadius != null ? state.safeRadius : 999;
  lastSaveTime = state.lastSaveTime || 0;

  // Restore walls + hazards (randomly generated at start, must match saved run)
  wallData = state.wallData || [];
  hazards = state.hazards || [];
  drawWalls();
  drawHazards();

  // Restore entities
  const restorePlayer = (src, dst) => {
    if(!src) return;
    Object.assign(dst, src);
  };
  restorePlayer(state.players && state.players[0], players[0]);
  restorePlayer(state.bot, bot);
  bot.isBot = true;

  bullets.length = 0; state.bullets && state.bullets.forEach(b => bullets.push(b));
  pickups.length = 0; state.pickups && state.pickups.forEach(p => pickups.push(p));
  particles.length = 0; // v2 saves no longer persist particles (P2-18)
  trialsFxTimeline.clear();
  if(window.NOX_GAME) {
    window.NOX_GAME.bullets.length = 0; state.bullets && state.bullets.forEach(b => window.NOX_GAME.bullets.push(b));
    window.NOX_GAME.pickups.length = 0; state.pickups && state.pickups.forEach(p => window.NOX_GAME.pickups.push(p));
    window.NOX_GAME.particles.length = 0;
  }

  // Redraw pickups
  const pickupsG = document.getElementById('pickups');
  if(pickupsG) pickupsG.innerHTML = '';
  pickups.forEach(pu => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    el.setAttribute('cx', pu.x); el.setAttribute('cy', pu.y);
    el.setAttribute('r', '8');
    el.setAttribute('fill', '#c9ff2f');
    pickupsG.appendChild(el);
  });

  // Restore void visual state
  const voidG = document.getElementById('void');
  if(voidG) voidG.setAttribute('opacity', voidRect ? '1' : '0');

  updateHUD();
  return true;
}

function clearTrialsState() {
  try { localStorage.removeItem('nv_trials_state'); } catch {}
  window.dispatchEvent(new CustomEvent('nox:trialsStateChanged'));
}





function endRound(winner, reason, forfeitPid) {
  // prevent re-entry if already handling round end / game over
  if (gameState === 'gameOver') return;
  clearPendingTimeouts();
  gameState = 'roundEnd';
  clearInputState();
  const ro = document.getElementById('roundOverlay');
  const badge = document.getElementById('roundBadge');
  const title = document.getElementById('roundTitle');
  const sub = document.getElementById('roundSub');
  if(!ro) return;
  ro.classList.remove('hidden');
  announce(winner === null ? 'Round drawn.' : `Player ${winner + 1} wins the round. Score ${scores[0]} to ${scores[1]}.`);
  const isForfeit = !!(reason && reason.includes('FORFEIT'));

  if(winner === null) {
    setCyberBadgeText(badge, `ROUND ${round} // DRAW`);
    if (badge) setCyberBadgeVariant(badge, 'lime');
    title.textContent = 'DRAW!';
    title.className = 'result-score winner-draw';
    if(sub) sub.textContent = reason + ' • No points';
  } else if (isForfeit) {
    const loser = forfeitPid != null ? forfeitPid + 1 : (winner === 0 ? 2 : 1);
    setCyberBadgeText(badge, `FORFEIT // P${loser} EXIT -> P${winner+1} WINS`);
    if (badge) setCyberBadgeVariant(badge, winner === 0 ? 'cyan' : 'pink');
    title.textContent = `PLAYER ${winner + 1} WINS BY FORFEIT!`;
    title.className = 'result-score ' + (winner === 0 ? 'winner-p1' : 'winner-p2');
    if(sub) sub.textContent = `P${loser} LEFT THE VOID • ${scores[0]} // ${scores[1]} • First to ${WIN_SCORE}`;
  } else {
    setCyberBadgeText(badge, `ROUND ${round} // ${reason}`);
    if (badge) setCyberBadgeVariant(badge, winner === 0 ? 'cyan' : 'pink');
    title.textContent = `PLAYER ${winner + 1} WINS ROUND!`;
    title.className = 'result-score ' + (winner === 0 ? 'winner-p1' : 'winner-p2');
    if(sub) sub.textContent = `${scores[0]} // ${scores[1]} • First to ${WIN_SCORE}`;
  }

  if(Math.max(...scores) >= WIN_SCORE) {
    // forfeit should show winner clearly before gameOver - give 1.6s on forfeit, 1.4s normal
    const delay = isForfeit ? 1800 : 1400;
    const fr = isForfeit ? reason : undefined;
    const fp = isForfeit ? forfeitPid : undefined;
    trackTimeout(setTimeout(() => showGameOver(fr, fp), delay));
  } else {
    trackTimeout(setTimeout(() => {
      // guard: if forfeit/menu happened during delay, abort
      if (gameState !== 'roundEnd') return;
      round++;
      ro.classList.add('hidden');
      if (simMatch) simAdvanceRound(); else resetRound(true);
      startCountdown();
    }, 1600));
  }
}

function showTrialsGameOver(points, reason, won) {
  clearPendingTimeouts();
  clearInputState();
  announce(`Trial ${won ? 'survived' : 'failed'}. ${reason || ''} Final score ${points.toLocaleString()}.`);
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
  // Exact ledger rows (audit P1-06). Rows are floor(entry); TOTAL is
  // clamp>=0(floor(exact sum)) — see trials-ledger.js rounding contract.
  // No value here is derived from the total or from any other row.
  const L = trialsLedger;
  const fmtBonus = v => '+' + Math.floor(Math.max(0, v) || 0).toLocaleString();
  const fmtPenalty = v => '-' + Math.floor(Math.abs(v) || 0).toLocaleString();
  const scoreTotal = document.getElementById('scoreTotal');
  if(scoreTotal) scoreTotal.textContent = '+' + ledgerTotal(L).toLocaleString();
  const scoreSurvival = document.getElementById('scoreSurvival');
  if(scoreSurvival) scoreSurvival.textContent = fmtBonus(L.survival);
  const scoreHits = document.getElementById('scoreHits');
  if(scoreHits) scoreHits.textContent = fmtBonus(L.hitBonus);
  const scorePickups = document.getElementById('scorePickups');
  if(scorePickups) scorePickups.textContent = fmtBonus(L.pickupBonus);
  const scoreLava = document.getElementById('scoreLava');
  if(scoreLava) scoreLava.textContent = fmtPenalty(L.lavaPenalty);
  const scoreSlime = document.getElementById('scoreSlime');
  if(scoreSlime) scoreSlime.textContent = fmtPenalty(L.slimePenalty);
  const scoreVoid = document.getElementById('scoreVoid');
  if(scoreVoid) scoreVoid.textContent = fmtPenalty(L.voidPenalty);
  const scoreBotKill = document.getElementById('scoreBotKill');
  if(scoreBotKill) scoreBotKill.textContent = fmtBonus(L.botKill);
  const scoreBotHit = document.getElementById('scoreBotHit');
  if(scoreBotHit) scoreBotHit.textContent = fmtPenalty(L.botHitPenalty);
}

function showGameOver(forfeitReason, forfeitPid) {  clearPendingTimeouts();
  announce('Match over.');
  clearInputState();
  const roundOverlay = document.getElementById('roundOverlay');
  const ov = document.getElementById('gameOverOverlay');
  if(roundOverlay) roundOverlay.classList.add('hidden');
  if(ov) ov.classList.remove('hidden');
  // ensure start overlay stays hidden while gameOver is visible
  document.getElementById('startOverlay')?.classList.add('hidden');
  // stop simulation effects
  bullets.length = 0;
  pickups.length = 0;
  // keep particles for death burst
  const w = scores[0] > scores[1] ? 0 : 1;
  const wt = document.getElementById('winnerText');
  const ws = document.getElementById('winnerSub');
  const isForfeit = !!(forfeitReason && forfeitReason.includes('FORFEIT'));
  if(scores[0] === scores[1]) {
    if(wt) { wt.textContent = 'DRAW // VOID CLAIMS ALL'; wt.className = 'result-score winner-draw'; }
    if(ws) ws.textContent = forfeitReason ? `${scores[0]} // ${scores[1]} • ${forfeitReason}` : `${scores[0]} // ${scores[1]} • Perfectly balanced`;
  } else {
    if (isForfeit) {
      if(wt) { wt.textContent = `PLAYER ${w + 1} WINS BY FORFEIT!`; wt.className = 'result-score ' + (w === 0 ? 'winner-p1' : 'winner-p2'); }
      const loser = forfeitPid != null ? forfeitPid + 1 : (w === 0 ? 2 : 1);
      if(ws) ws.textContent = `P${loser} EXITED • ${scores[0]} // ${scores[1]} • PLAYER ${w + 1} CHAMPION • ${round} rounds`;
    } else {
      if(wt) { wt.textContent = `PLAYER ${w + 1} WINS THE VOID!`; wt.className = 'result-score ' + (w === 0 ? 'winner-p1' : 'winner-p2'); }
      if(ws) ws.textContent = `${scores[0]} // ${scores[1]} • ${round} rounds • GG`;
    }
  }
  // badge in gameOver should reflect forfeit variant if provided
  const govBadge = document.querySelector('#gameOverOverlay .cyber-badge');
  if (govBadge && isForfeit) {
    setCyberBadgeVariant(govBadge, w === 0 ? 'cyan' : 'pink');
    // explicit winner vs exiter
    const loser = forfeitPid != null ? forfeitPid + 1 : (w === 0 ? 2 : 1);
    setCyberBadgeText(govBadge, `FORFEIT // P${loser} EXIT -> P${w+1} WINS`);
  } else if (govBadge && isForfeit === false) {
    // restore default badge on normal win
    setCyberBadgeVariant(govBadge, 'amber');
    setCyberBadgeText(govBadge, `🏆 CHAMPION OF THE VOID`);
  }
  // buttons: forfeit shows CONTINUE / RETURN TO MENU clearly, normal shows REMATCH / Menu
  const rematchBtn = document.getElementById('rematchBtn');
  const menuBtn = document.getElementById('menuBtn');
  if (isForfeit) {
    if (rematchBtn) rematchBtn.textContent = '↻ CONTINUE // PLAY AGAIN';
    if (menuBtn) menuBtn.textContent = 'RETURN TO MENU';
  } else {
    if (rematchBtn) rematchBtn.textContent = '↻ REMATCH';
    if (menuBtn) menuBtn.textContent = 'Menu';
  }
  gameState = 'gameOver';
  updateHUD();
  // debug
  try { console.log(`[NOX] showGameOver winner=P${w+1} scores=${scores[0]}//${scores[1]} forfeit=${forfeitReason||'none'}`); } catch {}
}

function startCountdown() {
  clearPendingTimeouts();
  clearInputState();
  gameState = 'countdown';
  const ro = document.getElementById('roundOverlay');
  const badge = document.getElementById('roundBadge');
  const title = document.getElementById('roundTitle');
  const sub = document.getElementById('roundSub');
  if(!ro) return;
  ro.classList.remove('hidden');
  // ensure gameOver hidden during countdown
  document.getElementById('gameOverOverlay')?.classList.add('hidden');
  let c = 3;
  const isTrialsCountdown = gameMode === 'trials';
  if(badge) {
    if (isTrialsCountdown) {
      setCyberBadgeText(badge, 'TRIAL // RUN');
      setCyberBadgeVariant(badge, 'amber');
    } else {
      setCyberBadgeText(badge, `ROUND ${round}`);
      setCyberBadgeVariant(badge, 'cyan');
    }
  }
  const tick = () => {
    if (gameState !== 'countdown') return;
    if(c > 0) {
      if(title) { title.textContent = String(c); title.className = 'result-score winner-draw'; }
      if(sub) sub.textContent = isTrialsCountdown ? 'Survive 10:00 or kill the bot • Stay centered' : 'Get ready...';
      c--;
      trackTimeout(setTimeout(tick, 650));
    } else {
      if(title) { title.textContent = 'FIGHT!'; title.className = 'result-score winner-draw'; }
      if(sub) sub.textContent = isTrialsCountdown ? 'Void crush at 7:30 • Bot fears the void' : 'Dash = invincible • Grab the orb!';
      trackTimeout(setTimeout(() => {
        if (gameState !== 'countdown') return;
        ro.classList.add('hidden');
        gameState = 'playing';
      }, 420));
    }
  };
  tick();
}




// Touch support
function setupTouch(svg) {
  svg.addEventListener('touchstart', e => {
    const rect = svg.getBoundingClientRect();
    for(const t of e.touches) {
      const x = (t.clientX - rect.left) / rect.width * 960;
      if(x < 480) shoot(players[0]); else shoot(players[1]);
    }
  });
}

function init() {
  generateRandomWalls();
  drawWalls();
  drawHazards();

  // Auto-detect trials page so initial HUD never flashes 01:00
  try {
    if (typeof window !== 'undefined' && window.location && window.location.pathname.includes('/play/trials')) {
      gameMode = 'trials';
      timeLeft = TRIAL_DURATION;
      players[1].alive = false;
    }
  } catch {}

  setupInput();

  const svg = document.getElementById('gameSvg');
  if(svg) setupTouch(svg);

  // Speed // GLOBAL single dial (migrates legacy per-player keys)
  const sG = document.getElementById('speedGlobal');
  const sGV = document.getElementById('speedValGlobal');

  function loadSpeeds() {
    let v = BASE_SPEED;
    try {
      const stored = parseFloat(localStorage.getItem('nv_speedGlobal'));
      if (!isNaN(stored)) {
        v = stored;
      } else {
        // migrate legacy dual keys
        const v1 = parseFloat(localStorage.getItem('nv_speedP1'));
        const v2 = parseFloat(localStorage.getItem('nv_speedP2'));
        if (!isNaN(v1) && !isNaN(v2)) v = (v1 + v2) / 2;
        else if (!isNaN(v1)) v = v1;
        else if (!isNaN(v2)) v = v2;
      }
    } catch {}
    v = clamp(v, 2.5, 5.5);
    if (isNaN(v)) v = BASE_SPEED;
    globalSpeed = v;
    if (sG) sG.value = String(v);
    if (sGV) sGV.textContent = v.toFixed(1);
    players[0].baseSpeed = v;
    players[1].baseSpeed = v;
  }
  loadSpeeds();
  if (sG) sG.addEventListener('input', e => {
    const raw = e.target.value;
    const v = clamp(parseFloat(raw), 2.5, 5.5);
    if (isNaN(v)) return;
    globalSpeed = v;
    players[0].baseSpeed = v;
    players[1].baseSpeed = v;
    if (sGV) sGV.textContent = v.toFixed(1);
    try { localStorage.setItem('nv_speedGlobal', String(v)); } catch {}
    try { localStorage.removeItem('nv_speedP1'); localStorage.removeItem('nv_speedP2'); } catch {}
  });
  // Keep legacy elements synced if they still exist in DOM (defensive)
  const legacyP1 = document.getElementById('speedP1');
  const legacyP2 = document.getElementById('speedP2');
  if (legacyP1) legacyP1.addEventListener('input', e => setGlobalSpeed(e.target.value));
  if (legacyP2) legacyP2.addEventListener('input', e => setGlobalSpeed(e.target.value));

  // UI bindings
  const playBtn = document.getElementById('playBtn');
  if(playBtn) playBtn.onclick = () => {
    clearPendingTimeouts();
    clearInputState();
    forfeitLock = false;
    document.getElementById('gameOverOverlay')?.classList.add('hidden');
    document.getElementById('roundOverlay')?.classList.add('hidden');
    document.getElementById('startOverlay')?.classList.add('hidden');
    scores[0]=0; scores[1]=0;
    if (window.NOX_GAME) { window.NOX_GAME.scores[0]=0; window.NOX_GAME.scores[1]=0; }
    round = 1; resetRound(true); startCountdown();
  };

  // howBtn now handled by React modal (GameShell handles showHow state)
  const howBtn = document.getElementById('howBtn');
  if (howBtn) {
    // Keep as fallback: dispatch event for React to open modal if imperative fires first
    howBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('nox:openHow'));
    });
  }

  const rematchBtn = document.getElementById('rematchBtn');
  if(rematchBtn) rematchBtn.onclick = () => {
    clearPendingTimeouts();
    clearInputState();
    forfeitLock = false;
    document.getElementById('gameOverOverlay')?.classList.add('hidden');
    document.getElementById('roundOverlay')?.classList.add('hidden');
    document.getElementById('startOverlay')?.classList.add('hidden');
    scores[0]=0; scores[1]=0;
    if (window.NOX_GAME) { window.NOX_GAME.scores[0]=0; window.NOX_GAME.scores[1]=0; }
    round = 1; resetRound(true); startCountdown();
  };

  const menuBtn = document.getElementById('menuBtn');
  if(menuBtn) menuBtn.onclick = () => {
    clearPendingTimeouts();
    clearInputState();
    forfeitLock = false;
    document.getElementById('gameOverOverlay')?.classList.add('hidden');
    document.getElementById('roundOverlay')?.classList.add('hidden');
    document.getElementById('startOverlay')?.classList.remove('hidden');
    gameState = 'menu';
    scores[0]=0; scores[1]=0;
    if (window.NOX_GAME) { window.NOX_GAME.scores[0]=0; window.NOX_GAME.scores[1]=0; }
    round = 1;
    bullets.length=0; pickups.length=0; particles.length=0;
    if (window.NOX_GAME) { window.NOX_GAME.bullets.length=0; window.NOX_GAME.pickups.length=0; window.NOX_GAME.particles.length=0; }
    resetRound(false);
    // ensure void hidden and HUD clean
    const vg = document.getElementById('void');
    if (vg) vg.setAttribute('opacity','0');
    safeRadius = 999; voidTick = [0,0]; timeLeft = ROUND_TIME;
    updateHUD();
  };

  // Fixed 60 Hz simulation step
  const SIM_STEP = 1000 / 60;
  let simLast = performance.now();
  let simAccum = 0;

  function loop(now) {
    engineRafId = requestAnimationFrame(loop);
    simAccum += now - simLast;
    simLast = now;
    if(simAccum > 250) simAccum = 250;
    while(simAccum >= SIM_STEP) {
      update(1);
      simAccum -= SIM_STEP;
    }
    render();
  }
  engineRafId = requestAnimationFrame(loop);

  updateHUD();
  render();

  function startGame() {
    clearPendingTimeouts();
    clearInputState();
    forfeitLock = false;
    document.getElementById('gameOverOverlay')?.classList.add('hidden');
    document.getElementById('roundOverlay')?.classList.add('hidden');
    document.getElementById('startOverlay')?.classList.add('hidden');
    scores[0]=0; scores[1]=0;
    if (window.NOX_GAME) { window.NOX_GAME.scores[0]=0; window.NOX_GAME.scores[1]=0; }
    round = 1; simStartFresh(); startCountdown();
  }
  function rematchGame() {
    clearPendingTimeouts();
    clearInputState();
    forfeitLock = false;
    document.getElementById('gameOverOverlay')?.classList.add('hidden');
    document.getElementById('roundOverlay')?.classList.add('hidden');
    document.getElementById('startOverlay')?.classList.add('hidden');
    scores[0]=0; scores[1]=0;
    if (window.NOX_GAME) { window.NOX_GAME.scores[0]=0; window.NOX_GAME.scores[1]=0; }
    round = 1; simStartFresh(); startCountdown();
  }
  function backToMenu() {
    clearPendingTimeouts();
    clearInputState();
    forfeitLock = false;
    document.getElementById('gameOverOverlay')?.classList.add('hidden');
    document.getElementById('roundOverlay')?.classList.add('hidden');
    document.getElementById('startOverlay')?.classList.remove('hidden');
    gameState = 'menu';
    scores[0]=0; scores[1]=0;
    if (window.NOX_GAME) { window.NOX_GAME.scores[0]=0; window.NOX_GAME.scores[1]=0; }
    round = 1;
    bullets.length=0; pickups.length=0; particles.length=0;
    if (window.NOX_GAME) { window.NOX_GAME.bullets.length=0; window.NOX_GAME.pickups.length=0; window.NOX_GAME.particles.length=0; }
    resetRound(false);
    const vg2 = document.getElementById('void');
    if (vg2) vg2.setAttribute('opacity','0');
    safeRadius = 999; voidTick=[0,0]; timeLeft=ROUND_TIME; prevHp[0]=MAX_HP; prevHp[1]=MAX_HP; prevHp[2]=BOT_MAX_HP;
    updateHUD();
    render();
  }
  function forfeit(playerId) {
    const pid = playerId === 1 ? 1 : 0;
    if (gameState === 'menu') { backToMenu(); return; }
    if (gameState === 'gameOver') { backToMenu(); return; }
    if (forfeitLock) return;
    if (gameState !== 'playing' && gameState !== 'countdown' && gameState !== 'roundEnd') { backToMenu(); return; }
    forfeitLock = true;
    clearPendingTimeouts();
    clearInputState();
    const other = pid === 0 ? 1 : 0;
    const p = players[pid];
    if (p) {
      for(let k=0;k<14;k++) particles.push({x: p.x, y: p.y, vx: Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*3), vy: Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*3), life:18, max:18, r:2, color: p.color, type:'hit'});
      p.alive = false; p.hp = 0;
      p.dash=0; p.dashCd=0; p.inv=0; p.overcharge=0; p.shield=false; p.shieldHp=0; p.speedBoost=0; p.extraDash=0; p.squish=0; p.lavaCd=0; p.voidCd=0;
      p.ammoType='standard'; p.ammo=Infinity;
    }
    // force decisive match win for opponent - not just +1
    scores[other] = WIN_SCORE;
    if (scores[pid] >= WIN_SCORE) scores[pid] = WIN_SCORE - 1;
    if (window.NOX_GAME) { window.NOX_GAME.scores[other] = WIN_SCORE; window.NOX_GAME.scores[pid] = scores[pid]; }
    bullets.length=0; pickups.length=0;
    if (window.NOX_GAME) { window.NOX_GAME.bullets.length=0; window.NOX_GAME.pickups.length=0; }
    updateHUD();
    try { console.log(`[NOX] forfeit P${pid+1} -> P${other+1} wins ${scores[0]}//${scores[1]}`); } catch {}
    // show who won + who left via round win (1.8s) then full gameOver with CONTINUE/RETURN buttons - not instant menu
    endRound(other, `P${pid+1} EXIT // FORFEIT`, pid);
  }
  window.NOX_GAME = {
    players, bullets, pickups, particles,
    scores, gameState: () => gameState,
    endRound, showGameOver, startCountdown, resetRound, startGame, rematchGame, backToMenu, forfeit,
    startTrials, prepareTrialsMenu, onTrialsWin: null, onTrialsLose: null, onTrialsPause: null,
    forfeitTrials, resumeTrials, hasTrialsState, loadTrialsState, saveTrialsState, clearTrialsState,
    getGlobalSpeed: () => globalSpeed, setGlobalSpeed,
    getTimeLeft: () => timeLeft, getTrialPoints: () => trialsFinal(), getGameMode: () => gameMode,
    getTrialsLedger: () => trialsLedger, trialsTotal: trialsFinal,
    W, H, PLAYER_R, BULLET_R, BULLET_SPEED, MAX_HP, ROUND_TIME, WIN_SCORE,
    POWER_TYPES, BULLET_TYPES, AMMO_PICKUP_CFG, DASH_COOLDOWN, DASH_TIME, SHIELD_MAX_HP, HEAL_AMOUNT
  };
}

// T4 session boundary: the engine boots ONLY via bootEngine() - never at import
// time - so the online lobby can load this module without starting rAF/input.
let engineBooted = false;
let engineRafId = 0;
export function bootEngine() {
  if (engineBooted || typeof document === 'undefined') return;
  engineBooted = true;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
export function isEngineBooted() { return engineBooted; }
export function shutdownEngine() {
  if (engineRafId) cancelAnimationFrame(engineRafId);
  engineRafId = 0;
  engineBooted = false;
  clearInputState();
}

// T3: view layer lives in game-view.js. State below is exported as ESM live
// bindings for the view (view reads only, never writes).
export { players, bot, bullets, pickups, particles, hazards, wallData, scores, round, timeLeft, safeRadius, gameState, gameMode, prevHp, trialPoints };
export { W, H, PLAYER_R, BULLET_SPEED, BASE_SPEED, DASH_TIME, ROUND_TIME, HEAL_AMOUNT, GRID, COLS, ROWS, TRIALS_COLS, TRIALS_ROWS, VOID_SHRINK_DURATION, BOT_MAX_HP, TRIALS_HAZARD_COUNT, TRIALS_WALL_TARGET, REQUIRED_WALL_GAP, BULLET_TYPES, AMMO_KINDS };
export { MAX_HP, SHIELD_MAX_HP, DASH_COOLDOWN, BULLET_R, WIN_SCORE, POWER_TYPES, AMMO_PICKUP_CFG, TRIALS_W, TRIALS_H, TRIAL_DURATION, VOID_START_TIME };
export { isLavaActive };
export { drawWalls, drawHazards, render, setCyberBadgeText, setCyberBadgeVariant, updateHUD };
