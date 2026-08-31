// NOX 1v1 pure simulation core (isomorphic: browser + Node).
// Extracted from game-logic.js — zero DOM/window/navigator references.
// Determinism contract: same seed + same input stream => identical state.
// Cosmetic effects are emitted as visual EVENTS (spec:
// docs/reasonix/specs/visual-parity-sync.md) into m.vfx at the exact branch
// where the gameplay effect occurs; clients convert them via vfx/recipes.js.
// Event seeds come from fxRng so the gameplay rng stream is never consumed
// by cosmetics.

import { emitVfx } from '../vfx/events.js';

export const W = 960, H = 560;
export const PLAYER_R = 16;
export const BULLET_R = 5;
export const BULLET_SPEED = 7.2;
export const BASE_SPEED = 3.6;
export const DASH_COOLDOWN = 60;
export const DASH_TIME = 16;
export const MAX_HP = 12;
export const ROUND_TIME = 60;
export const WIN_SCORE = 5;
export const SHIELD_MAX_HP = 5;
export const HEAL_AMOUNT = 2;
export const GRID = 40;
export const COLS = 24;
export const ROWS = 14;
export const REQUIRED_WALL_GAP = PLAYER_R * 2 + 2;
export const HAZARD_RELOCATE_MIN = 480;
export const HAZARD_RELOCATE_MAX = 720;

export const POWER_TYPES = {
  overcharge: { color:'#ffb23e', bg:'#ff9d2e', icon:'⚡', duration:240, life:480 },
  shield:     { color:'#58d8ff', bg:'#3ec5f2', icon:'❄', life:480, hp:5 },
  blink:      { color:'#c9ff2f', bg:'#c9ff2f', icon:'✦', duration:180, life:480 },
  heal:       { color:'#22c55e', bg:'#16a34a', icon:'✚', life:480, heal:2 }
};

export const BULLET_TYPES = {
  standard: { id:'standard', label:'STD', color:'#f1f4f3', bg:'#f1f4f3', icon:'o', speed:7.2, r:5,   dmg:2, cd:11, life:90,  ammo: Infinity, bouncesMax:0, lifeDecay:false },
  needle:   { id:'needle',   label:'NEEDLE', color:'#a78bfa', bg:'#7c3aed', icon:'N', speed:8.5, r:3.5, dmgFront:0, dmgRear:6, cd:14, life:90,  ammo:5, bouncesMax:0 },
  cannon:   { id:'cannon',   label:'CANNON', color:'#ffb23e', bg:'#ff9d2e', icon:'C', speed:3.8, r:7,   dmg:4, cd:32, life:120, ammo:3, bouncesMax:0 },
  trick:    { id:'trick',    label:'TRICK',  color:'#58d8ff', bg:'#3ec5f2', icon:'T', speed:6.2, r:4,   dmg:2.5, cd:16, life:180, ammo:6, bouncesMax:5, decay:0.82 }
};
export const AMMO_KINDS = ['ammo_needle','ammo_cannon','ammo_trick'];
export const AMMO_PICKUP_CFG = {
  ammo_needle: { color:'#a78bfa', bg:'#7c3aed', icon:'N', life:480, ammo:5, bullet:'needle' },
  ammo_cannon: { color:'#ffb23e', bg:'#ff9d2e', icon:'C', life:480, ammo:3, bullet:'cannon' },
  ammo_trick:  { color:'#58d8ff', bg:'#3ec5f2', icon:'T', life:480, ammo:6, bullet:'trick' }
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const len2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return Math.hypot(dx, dy); };
function trickDmgAt(bounces) { const t = [2.5, 2, 1.6, 1.2, 0.8, 0.5]; return t[Math.min(bounces, 5)]; }

// --- FX emission (cosmetic only; seeds from fxRng via emitVfx) ---

// --- Geometry / collision ---
export function wallGap(a, b) {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  if (dx === 0 && dy === 0) return -1;
  if (dx === 0) return dy;
  if (dy === 0) return dx;
  return Math.hypot(dx, dy);
}
function rectCircleCollide(cx, cy, cr, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  return (dx * dx + dy * dy) < cr * cr;
}
function wallsCollide(m, x, y, r) {
  for (const w of m.walls) if (rectCircleCollide(x, y, r, w.x, w.y, w.w, w.h)) return true;
  return false;
}
function pushOutOfWalls(m, p) {
  p.x = clamp(p.x, 10 + PLAYER_R, W - 10 - PLAYER_R);
  p.y = clamp(p.y, 10 + PLAYER_R, H - 10 - PLAYER_R);
  for (let iter = 0; iter < 4; iter++) {
    for (const w of m.walls) {
      if (!rectCircleCollide(p.x, p.y, PLAYER_R, w.x, w.y, w.w, w.h)) continue;
      const closestX = clamp(p.x, w.x, w.x + w.w);
      const closestY = clamp(p.y, w.y, w.y + w.h);
      let dx = p.x - closestX, dy = p.y - closestY, dist = Math.hypot(dx, dy);
      if (dist < 0.01) {
        const dl = p.x - w.x, dr = (w.x + w.w) - p.x, dt = p.y - w.y, db = (w.y + w.h) - p.y;
        const mn = Math.min(dl, dr, dt, db);
        if (mn === dl) { dx = -1; dy = 0; dist = 1; p.x = w.x - PLAYER_R - 1; continue; }
        else if (mn === dr) { dx = 1; dy = 0; dist = 1; p.x = w.x + w.w + PLAYER_R + 1; continue; }
        else if (mn === dt) { dx = 0; dy = -1; dist = 1; p.y = w.y - PLAYER_R - 1; continue; }
        else { dx = 0; dy = 1; dist = 1; p.y = w.y + w.h + PLAYER_R + 1; continue; }
      }
      const need = PLAYER_R - dist + 0.5;
      if (need > 0) { p.x += (dx / dist) * need; p.y += (dy / dist) * need; }
    }
  }
  p.x = clamp(p.x, 10 + PLAYER_R, W - 10 - PLAYER_R);
  p.y = clamp(p.y, 10 + PLAYER_R, H - 10 - PLAYER_R);
}
function tryMove(m, p, nx, ny) {
  if (!wallsCollide(m, nx, ny, PLAYER_R)) { p.x = nx; p.y = ny; return; }
  if (!wallsCollide(m, nx, p.y, PLAYER_R)) p.x = nx;
  if (!wallsCollide(m, p.x, ny, PLAYER_R)) p.y = ny;
  pushOutOfWalls(m, p);
}

// --- Map generation (seeded port of generateRandomWalls) ---
function genMap(m) {
  const walls = [
    {x:0, y:0, w:960, h:10, isBorder: true}, {x:0, y:550, w:960, h:10, isBorder: true},
    {x:0, y:10, w:10, h:540, isBorder: true}, {x:950, y:10, w:10, h:540, isBorder: true},
  ];
  const occ = new Set();
  const key = (c, r) => `${c},${r}`;
  const protectedCells = new Set();
  [[3,7],[4,7],[20,7],[19,7],[11,7],[12,7],[11,6],[12,6],[12,8],[11,8]].forEach(([c, r]) => {
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) protectedCells.add(key(c + dc, r + dr));
  });
  function canPlace(c, r, len, isHoriz) {
    const cells = [];
    for (let k = 0; k < len; k++) {
      const cc = isHoriz ? c + k : c;
      const rr = isHoriz ? r : r + k;
      if (cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS) return null;
      if (protectedCells.has(key(cc, rr))) return null;
      if (occ.has(key(cc, rr))) return null;
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue;
        if (occ.has(key(cc + dc, rr + dr))) return null;
      }
      cells.push([cc, rr]);
    }
    return cells;
  }
  const rng = m.rng;
  const target = 8 + Math.floor(rng() * 4);
  let placed = 0, attempts = 200;
  for (let a = 0; a < attempts && placed < target; a++) {
    const isHoriz = rng() < 0.5;
    const len = 2 + Math.floor(rng() * 4);
    const cMax = COLS - (isHoriz ? len : 1) - 1;
    const rMax = ROWS - (isHoriz ? 1 : len) - 1;
    if (cMax < 2 || rMax < 2) continue;
    const c = 1 + Math.floor(rng() * (cMax - 1 + 1));
    const r = 1 + Math.floor(rng() * (rMax - 1 + 1));
    const cells = canPlace(c, r, len, isHoriz);
    if (!cells) continue;
    let x, y, w, h;
    if (isHoriz) { x = c * GRID; y = r * GRID - 6; w = len * GRID; h = 12; }
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
  if (placed < 6) {
    walls.push(
      {x: 6 * GRID - 6, y: 4 * GRID, w: 12, h: 6 * GRID, rx: 6},
      {x: 18 * GRID - 6, y: 4 * GRID, w: 12, h: 6 * GRID, rx: 6},
      {x: 8 * GRID, y: 4 * GRID - 6, w: 8 * GRID, h: 12, rx: 6},
      {x: 8 * GRID, y: 10 * GRID - 6, w: 8 * GRID, h: 12, rx: 6}
    );
  }
  m.walls = walls;
  m.hazards = [];
  const hCount = 4 + Math.floor(rng() * 3);
  let hAttempts = 0, hPlaced = 0;
  while (hPlaced < hCount && hAttempts < 90) {
    hAttempts++;
    const c = 1 + Math.floor(rng() * (COLS - 2));
    const r = 1 + Math.floor(rng() * (ROWS - 2));
    const k = key(c, r);
    if (occ.has(k) || protectedCells.has(k)) continue;
    let adj = false;
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if (dc === 0 && dr === 0) continue;
      if (occ.has(key(c + dc, r + dr))) { adj = true; break; }
    }
    if (adj) continue;
    const kind = rng() < 0.5 ? 'lava' : 'slime';
    m.hazards.push({c, r, x: c * GRID + 2, y: r * GRID + 2, w: 36, h: 36, kind, t: rng() * 300, lavaCd: 0});
    occ.add(k);
    hPlaced++;
  }
  m._occ = occ; m._protectedCells = protectedCells;
}

function hazardAt(m, x, y) {
  for (const h of m.hazards) if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
  return null;
}
function isLavaActive(h) { return (h.t % 480) < 300; }

// --- Hazards relocate (seeded port of relocateRandomHazards) ---
function relocateRandomHazards(m) {
  if (m.hazards.length === 0) return;
  const count = m.hazards.length <= 3 ? 1 : (m.rng() < 0.5 ? 1 : 2);
  const idxs = m.hazards.map((_, i) => i).sort(() => m.rng() - 0.5).slice(0, count);
  for (const idx of idxs) {
    const h = m.hazards[idx];
    let ok = null;
    for (let a = 0; a < 60 && !ok; a++) {
      const c = 1 + Math.floor(m.rng() * (COLS - 2));
      const r = 1 + Math.floor(m.rng() * (ROWS - 2));
      const k = `${c},${r}`;
      if (m._occ.has(k) || m._protectedCells.has(k)) continue;
      let clash = false;
      for (const oh of m.hazards) if (oh !== h && Math.abs(oh.c - c) <= 1 && Math.abs(oh.r - r) <= 1) { clash = true; break; }
      if (!clash) ok = {c, r};
    }
    if (!ok) continue;
    const fromKind = h.kind;
    if (m.rng() < 0.3) h.kind = m.rng() < 0.5 ? 'lava' : 'slime';
    h.c = ok.c; h.r = ok.r; h.x = ok.c * GRID + 2; h.y = ok.r * GRID + 2;
    h.t = m.rng() * 300; h.lavaCd = 0;
    emitVfx(m, 'hazardMove', h.x + 18, h.y + 18, { tx: h.x + 18, ty: h.y + 18, meta: { from: fromKind, to: h.kind } });
  }
}

// --- Pickups ---
function pickRandomPowerKind(m) {
  const r = m.rng();
  if (r < 0.22) return 'overcharge';
  if (r < 0.40) return 'shield';
  if (r < 0.60) return 'blink';
  if (r < 0.70) return 'heal';
  if (r < 0.80) return 'ammo_needle';
  if (r < 0.90) return 'ammo_cannon';
  return 'ammo_trick';
}
function isValidPickupPos(m, x, y) {
  if (wallsCollide(m, x, y, 28)) return false;
  if (len2(x, y, 140, 280) < 68 || len2(x, y, 820, 280) < 68) return false;
  if (hazardAt(m, x, y)) return false;
  return true;
}
function spawnPickup(m, force = false) {
  if (m.pickups.length > 0 && !force) return;
  const kind = pickRandomPowerKind(m);
  const cfg = POWER_TYPES[kind] || AMMO_PICKUP_CFG[kind];
  const life = cfg ? cfg.life : 480;
  const spots = [
    {x: 480, y: 280}, {x: 320, y: 280}, {x: 640, y: 280},
    {x: 480, y: 180}, {x: 480, y: 380}, {x: 240, y: 140},
    {x: 720, y: 420}, {x: 480, y: 120}, {x: 480, y: 440}
  ];
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(m.rng() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  for (const pos of spots) {
    if (isValidPickupPos(m, pos.x, pos.y) && len2(pos.x, pos.y, m.players[0].x, m.players[0].y) > 64 && len2(pos.x, pos.y, m.players[1].x, m.players[1].y) > 64) {
      m.pickups.push({x: pos.x, y: pos.y, t: 0, life, kind});
      return;
    }
  }
  for (let k = 0; k < 50; k++) {
    const x = 80 + m.rng() * 800;
    const y = 60 + m.rng() * 440;
    if (isValidPickupPos(m, x, y)) { m.pickups.push({x, y, t: 0, life, kind}); return; }
  }
  m.pickups.push({x: 480, y: 280, t: 0, life, kind});
}

// --- Shooting (seeded port of shoot()) ---
function shoot(m, p) {
  if (p.shootCd > 0) return;
  let active = p.ammoType || 'standard';
  if (active !== 'standard' && (!p.ammo || p.ammo <= 0)) { p.ammoType = 'standard'; p.ammo = Infinity; active = 'standard'; }
  const cfg = BULLET_TYPES[active] || BULLET_TYPES.standard;
  const baseCd = cfg.cd ?? 11;
  p.shootCd = p.overcharge > 0 ? Math.max(7, baseCd - 2) : baseCd;
  const speed = cfg.speed ?? BULLET_SPEED;
  const r = cfg.r ?? BULLET_R;
  const life = cfg.life ?? 90;
  const mx = p.x + Math.cos(p.angle) * 18;
  const my = p.y + Math.sin(p.angle) * 18;
  const spread = p.overcharge > 0 ? [-0.22, 0, 0.22] : [0];
  spread.forEach(s => {
    const ang = p.angle + s + (m.rng() - 0.5) * 0.03;
    const dmg = active === 'trick' ? trickDmgAt(0) : (cfg.dmg ?? 2);
    m.bullets.push({
      id: ++m._bulletSeq,
      x: mx, y: my,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      owner: p.id, life, trail: [], type: active, r, dmg, bounces: 0, bouncesMax: cfg.bouncesMax ?? 0
    });
  });
  if (active !== 'standard' && p.ammo !== Infinity) {
    p.ammo--;
    if (p.ammo <= 0) { p.ammoType = 'standard'; p.ammo = Infinity; }
  }
  emitVfx(m, 'muzzle', mx, my, { actor: p.id, bulletType: active });
}

// --- Round flow ---
function endRound(m, winner, reason) {
  if (m.state !== 'playing') return;
  if (winner !== null) m.scores[winner]++;
  m.roundResult = { winner, reason: reason || '' };
  emitVfx(m, 'roundEnd', 480, 280, { actor: winner, meta: { reason: reason || '' } });
  if (Math.max(m.scores[0], m.scores[1]) >= WIN_SCORE) {
    m.state = 'matchEnd';
    m.matchWinner = m.scores[0] > m.scores[1] ? 0 : 1;
  } else {
    m.state = 'roundEnd';
  }
}

function resetPlayerState(p, x, y, angle, speed) {
  p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.angle = angle;
  p.hp = MAX_HP; p.alive = true; p.dash = 0; p.dashCd = 0; p.inv = 0; p.shootCd = 0;
  p.overcharge = 0; p.shield = false; p.shieldHp = 0; p.shieldMax = SHIELD_MAX_HP;
  p.speedBoost = 0; p.extraDash = 0; p.baseSpeed = speed; p.squish = 0; p.inSlime = false;
  p.lavaCd = 0; p.voidCd = 0; p.slimeCd = 0; p.ammoType = 'standard'; p.ammo = Infinity;
}

function makePlayer(id, x, y, angle, color) {
  const p = { id, color };
  resetPlayerState(p, x, y, angle, BASE_SPEED);
  return p;
}

export function simNextRound(m) {
  m.round++;
  const speed = m.players[0].baseSpeed;
  resetPlayerState(m.players[0], 140, 280, 0, speed);
  resetPlayerState(m.players[1], 820, 280, Math.PI, speed);
  pushOutOfWalls(m, m.players[0]);
  pushOutOfWalls(m, m.players[1]);
  let tries = 0;
  while (wallsCollide(m, m.players[0].x, m.players[0].y, PLAYER_R + 4) && tries < 10) {
    m.players[0].y = 120 + m.rng() * 320; pushOutOfWalls(m, m.players[0]); tries++;
  }
  tries = 0;
  while (wallsCollide(m, m.players[1].x, m.players[1].y, PLAYER_R + 4) && tries < 10) {
    m.players[1].y = 120 + m.rng() * 320; pushOutOfWalls(m, m.players[1]); tries++;
  }
  m.bullets.length = 0; m.pickups.length = 0; m.fx.length = 0;
  m.vfx.length = 0;
  m.timeLeft = ROUND_TIME;
  m.hazardRelocateTimer = HAZARD_RELOCATE_MIN + m.rng() * (HAZARD_RELOCATE_MAX - HAZARD_RELOCATE_MIN);
  spawnPickup(m, true);
  m.roundResult = null;
  m.state = 'playing';
}

// --- Match factory ---
export function createMatch(seed, opts = {}) {
  const m = {
    seed: seed >>> 0,
    rng: mulberry32(seed),
    fxRng: mulberry32((seed ^ 0x9E3779B9) >>> 0),
    tick: 0,
    state: 'playing',
    round: 1,
    scores: [0, 0],
    timeLeft: ROUND_TIME,
    players: [
      makePlayer(0, 140, 280, 0, '#58d8ff'),
      makePlayer(1, 820, 280, Math.PI, '#ff5ca8'),
    ],
    bullets: [],
    pickups: [],
    hazards: [],
    walls: [],
    fx: [],
    vfx: [],
    _vfxSeq: 0,
    _bulletSeq: 0,
    safeRadius: 999,
    hazardRelocateTimer: 0,
    roundResult: null,
    matchWinner: null,
    baseSpeed: opts.baseSpeed || BASE_SPEED,
  };
  m.players[0].baseSpeed = m.baseSpeed;
  m.players[1].baseSpeed = m.baseSpeed;
  genMap(m);
  m.hazardRelocateTimer = HAZARD_RELOCATE_MIN + m.rng() * (HAZARD_RELOCATE_MAX - HAZARD_RELOCATE_MIN);
  spawnPickup(m, true);
  return m;
}

// --- Main tick (pure port of update(dt), dt in frames, default 1 = 60fps) ---
export function simTick(m, inputs, dt = 1) {
  if (m.state !== 'playing') return m;
  const [in0, in1] = inputs;
  m.tick += dt;
  m.timeLeft -= dt / 60;

  if (m.timeLeft <= 0) {
    if (m.players[0].hp !== m.players[1].hp) {
      const winner = m.players[0].hp > m.players[1].hp ? 0 : 1;
      endRound(m, winner, 'TIME // HP ADVANTAGE');
    } else {
      endRound(m, null, 'DRAW // TIME UP');
    }
    return m;
  }

  if (m.pickups.length === 0 && m.rng() < 0.008) spawnPickup(m);
  m.pickups.forEach(p => p.t += 0.14);
  {
    const kept = m.pickups.filter(p => p.life-- > 0);
    m.pickups.length = 0; kept.forEach(v => m.pickups.push(v));
  }

  m.hazards.forEach(h => h.t += dt);
  m.hazardRelocateTimer -= dt;
  if (m.hazardRelocateTimer <= 0) {
    relocateRandomHazards(m);
    m.hazardRelocateTimer = HAZARD_RELOCATE_MIN + m.rng() * (HAZARD_RELOCATE_MAX - HAZARD_RELOCATE_MIN);
  }

  const elapsed = ROUND_TIME - m.timeLeft;
  if (elapsed < 45) {
    m.safeRadius = 999;
  } else {
    let sr = 400 - ((elapsed - 45) / 15) * (400 - 110);
    m.safeRadius = Math.max(110, sr);
  }

  const players = m.players;
  for (const p of players) {
    const inp = p.id === 0 ? in0 : in1;
    if (!p.alive) continue;
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.inv > 0) p.inv -= dt;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (p.overcharge > 0) p.overcharge -= dt;
    if (p.speedBoost > 0) p.speedBoost -= dt;
    if (p.squish > 0) p.squish -= dt;
    if (p.lavaCd > 0) p.lavaCd -= dt;
    if (p.voidCd > 0) p.voidCd -= dt;
    if (p.slimeCd > 0) p.slimeCd -= dt;
    if (p.dash > 0) { p.dash -= dt; if (p.dash <= 0) { p.dash = 0; p.inv = 6; } }
    if (wallsCollide(m, p.x, p.y, PLAYER_R)) pushOutOfWalls(m, p);
    p.inSlime = false;

    let mx = 0, my = 0;
    if (inp.left) mx -= 1;
    if (inp.right) mx += 1;
    if (inp.up) my -= 1;
    if (inp.down) my += 1;
    if (inp.dash) {
      const canDash = p.dash === 0 && (p.dashCd <= 0 || p.extraDash > 0);
      if (canDash) {
        if (p.extraDash > 0) p.extraDash--; else p.dashCd = DASH_COOLDOWN;
        p.dash = DASH_TIME; p.inv = DASH_TIME + 4;
        emitVfx(m, 'dash', p.x, p.y, { actor: p.id });
      }
    }
    if (inp.shoot) shoot(m, p);

    const hzPre = hazardAt(m, p.x, p.y);
    if (hzPre && hzPre.kind === 'slime') p.inSlime = true;

    let mag = Math.hypot(mx, my);
    if (mag > 0) { mx /= mag; my /= mag; p.angle = Math.atan2(my, mx); }
    let curSpeed = p.baseSpeed * (p.speedBoost > 0 ? 1.22 : 1);
    if (p.inSlime) curSpeed *= 0.55;
    let dashSpd = p.baseSpeed * 2.35;
    if (p.inSlime) dashSpd *= 0.70;
    let spd = p.dash > 0 ? dashSpd : curSpeed;
    if (p.dash > 0 && mag === 0) { mx = Math.cos(p.angle); my = Math.sin(p.angle); }
    const nx = p.x + mx * spd * dt;
    const ny = p.y + my * spd * dt;
    if (mx || my || p.dash > 0) tryMove(m, p, nx, ny);
    else pushOutOfWalls(m, p);

    const hz = hazardAt(m, p.x, p.y);
    if (hz && hz.kind === 'lava' && isLavaActive(hz) && p.lavaCd <= 0) {
      if (p.shield && p.shieldHp > 0) {
        p.shieldHp--; p.lavaCd = 60; p.inv = Math.max(p.inv, 12);
        emitVfx(m, 'lavaHit', p.x, p.y, { actor: p.id });
        p.squish = Math.max(p.squish, 6 + 0.6 * 4);
        if (p.shieldHp <= 0) {
          p.shield = false; p.shieldHp = 0;
          emitVfx(m, 'shieldBreak', p.x, p.y, { actor: p.id });
        }
      } else if (p.inv <= 0) {
        p.hp = Math.max(0, p.hp - 2); p.lavaCd = 60; p.inv = 26;
        emitVfx(m, 'lavaHit', p.x, p.y, { actor: p.id });
        p.squish = Math.max(p.squish, 10);
        if (p.hp <= 0) {
          p.alive = false;
          emitVfx(m, 'death', p.x, p.y, { actor: p.id });
          endRound(m, p.id === 0 ? 1 : 0, 'LAVA // BURNED');
          return m;
        }
      }
    }

    const dVoid = Math.hypot(p.x - 480, p.y - 280);
    if (m.safeRadius < 900 && dVoid > m.safeRadius - PLAYER_R) {
      if (p.voidCd <= 0) {
        p.voidCd = 54;
        if (p.shield && p.shieldHp > 0) {
          p.shieldHp--; p.inv = Math.max(p.inv, 10);
          emitVfx(m, 'voidHit', p.x, p.y, { actor: p.id });
          p.squish = Math.max(p.squish, 8);
          if (p.shieldHp <= 0) {
            p.shield = false; p.shieldHp = 0;
            emitVfx(m, 'shieldBreak', p.x, p.y, { actor: p.id });
          }
        } else if (p.inv <= 0) {
          p.hp = Math.max(0, p.hp - 1); p.inv = 22;
          emitVfx(m, 'voidHit', p.x, p.y, { actor: p.id });
          p.squish = Math.max(p.squish, 9);
          if (p.hp <= 0) {
            p.alive = false;
            emitVfx(m, 'death', p.x, p.y, { actor: p.id });
            endRound(m, p.id === 0 ? 1 : 0, 'VOID // CRUSHED');
            return m;
          }
        }
      }
    }

    for (let idx = m.pickups.length - 1; idx >= 0; idx--) {
      const pu = m.pickups[idx];
      if (len2(p.x, p.y, pu.x, pu.y) < 24) {
        if (pu.kind && pu.kind.indexOf('ammo_') === 0) {
          const cfg = AMMO_PICKUP_CFG[pu.kind];
          if (cfg) {
            p.ammoType = cfg.bullet;
            p.ammo = cfg.ammo;
            emitVfx(m, 'pickup', pu.x, pu.y, { actor: p.id, pickup: pu.kind, tx: p.x, ty: p.y, amount: cfg.ammo });
            p.squish = 10;
          }
          m.pickups.splice(idx, 1);
          continue;
        }
        const pt = POWER_TYPES[pu.kind];
        if (pu.kind === 'overcharge') {
          p.overcharge = pt.duration;
          emitVfx(m, 'pickup', pu.x, pu.y, { actor: p.id, pickup: pu.kind });
          m.pickups.splice(idx, 1);
        } else if (pu.kind === 'shield') {
          p.shield = true; p.shieldHp = SHIELD_MAX_HP; p.inv = Math.max(p.inv, 8);
          emitVfx(m, 'pickup', pu.x, pu.y, { actor: p.id, pickup: pu.kind });
          m.pickups.splice(idx, 1);
        } else if (pu.kind === 'blink') {
          p.extraDash = Math.min(2, p.extraDash + 1);
          p.dashCd = 0;
          p.speedBoost = pt.duration;
          emitVfx(m, 'pickup', pu.x, pu.y, { actor: p.id, pickup: pu.kind });
          m.pickups.splice(idx, 1);
        } else if (pu.kind === 'heal') {
          let healed = false;
          if (p.hp < MAX_HP) {
            p.hp = Math.min(MAX_HP, p.hp + HEAL_AMOUNT);
            healed = true;
          } else {
            if (p.overcharge < 60) p.overcharge = Math.min(240, p.overcharge + 30);
          }
          emitVfx(m, 'heal', pu.x, pu.y, { actor: p.id, tx: p.x, ty: p.y, amount: healed ? HEAL_AMOUNT : 0 });
          m.pickups.splice(idx, 1);
        }
      }
    }
    if (m.state !== 'playing') return m;
  }

  // player-player separation
  {
    const d = len2(players[0].x, players[0].y, players[1].x, players[1].y);
    const minDist = PLAYER_R * 2 + 2;
    if (d < minDist && d > 0.01) {
      const ang = Math.atan2(players[1].y - players[0].y, players[1].x - players[0].x);
      const overlap = minDist - d;
      const push = overlap / 2 + 0.6;
      players[0].x -= Math.cos(ang) * push; players[0].y -= Math.sin(ang) * push;
      players[1].x += Math.cos(ang) * push; players[1].y += Math.sin(ang) * push;
      players[0].squish = 8; players[1].squish = 8;
      pushOutOfWalls(m, players[0]); pushOutOfWalls(m, players[1]);
      const d2 = len2(players[0].x, players[0].y, players[1].x, players[1].y);
      if (d2 < minDist) {
        const j = 1.2;
        players[0].x -= Math.cos(ang) * j; players[0].y -= Math.sin(ang) * j;
        players[1].x += Math.cos(ang) * j; players[1].y += Math.sin(ang) * j;
      }
    } else if (d <= 0.01) {
      players[0].x -= 5; players[1].x += 5;
      players[0].squish = 10; players[1].squish = 10;
    }
  }

  // bullets
  for (let i = m.bullets.length - 1; i >= 0; i--) {
    const b = m.bullets[i];
    const br = b.r ?? BULLET_R;
    const trailLen = b.type === 'cannon' ? 6 : b.type === 'needle' ? 2 : b.type === 'trick' ? 5 : 4;
    b.trail.unshift({x: b.x, y: b.y});
    if (b.trail.length > trailLen) b.trail.pop();
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;
    let hitWall = null;
    for (const w of m.walls) { if (rectCircleCollide(b.x, b.y, br, w.x, w.y, w.w, w.h)) { hitWall = w; break; } }
      if (hitWall) {
      if (b.type === 'trick' && (b.bounces ?? 0) < (b.bouncesMax ?? 5)) {
        const closestX = clamp(b.x, hitWall.x, hitWall.x + hitWall.w);
        const closestY = clamp(b.y, hitWall.y, hitWall.y + hitWall.h);
        let nx = b.x - closestX, ny = b.y - closestY;
        let nlen = Math.hypot(nx, ny);
        if (nlen < 0.01) {
          const dl = b.x - hitWall.x, dr = (hitWall.x + hitWall.w) - b.x, dt2 = b.y - hitWall.y, db = (hitWall.y + hitWall.h) - b.y;
          const mn = Math.min(dl, dr, dt2, db);
          if (mn === dl) { nx = -1; ny = 0; } else if (mn === dr) { nx = 1; ny = 0; } else if (mn === dt2) { nx = 0; ny = -1; } else { nx = 0; ny = 1; }
          nlen = 1;
        } else { nx /= nlen; ny /= nlen; }
        const dot = b.vx * nx + b.vy * ny;
        b.vx = (b.vx - 2 * dot * nx) * 0.97;
        b.vy = (b.vy - 2 * dot * ny) * 0.97;
        b.x += nx * (br + 2);
        b.y += ny * (br + 2);
        b.bounces = (b.bounces ?? 0) + 1;
        b.dmg = trickDmgAt(b.bounces);
        emitVfx(m, 'trickBounce', b.x, b.y, { actor: b.owner, bulletType: 'trick', amount: b.bounces });
        continue;
      }
      emitVfx(m, 'wallHit', b.x, b.y, { actor: b.owner, bulletType: b.type });
      m.bullets.splice(i, 1); continue;
    }
    if (b.life <= 0 || b.x < -20 || b.x > 980 || b.y < -20 || b.y > 580) {
      m.bullets.splice(i, 1); continue;
    }
    for (const p of players) {
      if (p.id === b.owner) continue;
      if (p.inv > 0) continue;
      if (!p.alive) continue;
      const effR = p.squish > 0 ? PLAYER_R * 0.88 : PLAYER_R;
      if (len2(b.x, b.y, p.x, p.y) < effR + br) {
        if (p.shield) {
          let shieldDmg = 1;
          if (b.type === 'cannon') shieldDmg = 2;
          else if (b.type === 'needle') {
            const f = Math.cos(p.angle), ff = Math.sin(p.angle);
            const dnorm = Math.hypot(b.vx, b.vy) || 1;
            const dotN = f * (b.vx / dnorm) + ff * (b.vy / dnorm);
            shieldDmg = dotN > 0.5 ? 2 : 0;
          } else if (b.type === 'trick') shieldDmg = 1;
          if (shieldDmg === 0) {
            p.inv = 8;
            emitVfx(m, 'needleBlock', b.x, b.y, { actor: b.owner, target: p.id, bulletType: 'needle' });
            m.bullets.splice(i, 1); break;
          }
          p.shieldHp = (p.shieldHp || SHIELD_MAX_HP) - shieldDmg;
          if (p.shieldHp < 0) p.shieldHp = 0;
          p.inv = b.type === 'cannon' ? 18 : 16;
          p.squish = Math.max(p.squish, 6 + (shieldDmg > 1 ? 1.2 : 0.8) * 4);
          emitVfx(m, 'shieldHit', b.x, b.y, { actor: b.owner, target: p.id, bulletType: b.type, tx: p.x, ty: p.y, amount: p.shieldHp });
          if (p.shieldHp <= 0) {
            p.shield = false; p.shieldHp = 0;
            emitVfx(m, 'shieldBreak', p.x, p.y, { actor: p.id });
          }
          m.bullets.splice(i, 1); break;
        }
        let dmg = 2, inv = 28, shake = 1, fxKind = 'standard';
        if (b.type === 'standard') { dmg = 2; inv = 28; shake = 1; fxKind = 'standard'; }
        else if (b.type === 'needle') {
          const f = Math.cos(p.angle), ff = Math.sin(p.angle);
          const dnorm = Math.hypot(b.vx, b.vy) || 1;
          const dot = f * (b.vx / dnorm) + ff * (b.vy / dnorm);
          if (dot > 0.5) { dmg = 6; inv = 30; shake = 1.6; fxKind = 'needleCrit'; }
          else {
            p.inv = 6;
            emitVfx(m, 'needleBlock', b.x, b.y, { actor: b.owner, target: p.id, bulletType: 'needle' });
            p.squish = Math.max(p.squish, 6 + 0.4 * 4);
            m.bullets.splice(i, 1); break;
          }
        }
        else if (b.type === 'cannon') { dmg = 4; inv = 34; shake = 1.5; fxKind = 'cannon'; }
        else if (b.type === 'trick') { dmg = b.dmg ?? trickDmgAt(b.bounces ?? 0); inv = 26; shake = 0.9 + (b.bounces ?? 0) * 0.12; fxKind = 'trick'; }
        else { dmg = b.dmg ?? 2; }
        p.hp = Math.max(0, p.hp - dmg); p.inv = inv;
        p.squish = Math.max(p.squish, 6 + shake * 4);
        if (fxKind === 'needleCrit') emitVfx(m, 'needleCrit', p.x, p.y, { actor: b.owner, target: p.id, bulletType: 'needle', amount: 6 });
        else if (fxKind === 'cannon') emitVfx(m, 'cannonHit', p.x, p.y, { actor: b.owner, target: p.id, bulletType: 'cannon', amount: 4 });
        else if (fxKind === 'trick') emitVfx(m, 'trickHit', p.x, p.y, { actor: b.owner, target: p.id, bulletType: 'trick', amount: dmg });
        else emitVfx(m, 'hitStandard', b.x, b.y, { actor: b.owner, target: p.id, bulletType: 'standard' });
        m.bullets.splice(i, 1);
        if (p.hp <= 0) {
          p.alive = false;
          emitVfx(m, 'death', p.x, p.y, { actor: p.id });
          endRound(m, b.owner, 'ELIMINATION');
        }
        break;
      }
    }
    if (m.state !== 'playing') return m;
  }

  // fx integration (cosmetic) — m.fx is retained for API compatibility but
  // the sim no longer writes particles directly; effects flow as events.
  for (const pt of m.fx) { pt.x += pt.vx; pt.y += pt.vy; pt.vx *= 0.96; pt.vy *= 0.96; pt.life -= dt; }
  {
    const kept = m.fx.filter(pt => pt.life > 0);
    m.fx.length = 0; kept.forEach(v => m.fx.push(v));
  }
  return m;
}
