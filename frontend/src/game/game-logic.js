// NEON VOID // 2P Duel Game Logic
// Extracted from play.astro to separate concerns

const W = 960, H = 560;
const PLAYER_R = 16;
const BULLET_R = 5;
const BULLET_SPEED = 7.2;
const BASE_SPEED = 3.6;
const DASH_COOLDOWN = 60;
const DASH_TIME = 16;
const MAX_HP = 5;
const ROUND_TIME = 60;
const WIN_SCORE = 5;
const SHIELD_MAX_HP = 3;
const HEAL_AMOUNT = 1;
const GRID = 40;
const COLS = 24;
const ROWS = 14;

const POWER_TYPES = {
  overcharge: { color:'#ffb23e', bg:'#ff9d2e', icon:'⚡', duration:240, life:480 },
  shield:     { color:'#58d8ff', bg:'#3ec5f2', icon:'❄', life:480, hp:3 },
  blink:      { color:'#c9ff2f', bg:'#c9ff2f', icon:'✦', duration:180, life:480 },
  heal:       { color:'#22c55e', bg:'#16a34a', icon:'✚', life:480, heal:1 }
};

let wallData = [];
let hazards = [];
let safeRadius = 999;
let voidTick = [0, 0];

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
  let placed = 0, attempts = 120;
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
    cells.forEach(([cc, rr]) => occ.add(key(cc, rr)));
    let x, y, w, h;
    if(isHoriz) {
      x = c * GRID; y = r * GRID - 6; w = len * GRID; h = 12;
    } else {
      x = c * GRID - 6; y = r * GRID; w = 12; h = len * GRID;
    }
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

function hazardAt(x, y) {
  for(const h of hazards) if(x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
  return null;
}

function isLavaActive(h) {
  const mod = h.t % 300;
  return mod >= 120 && mod < 228;
}

function isLavaWarning(h) {
  const mod = h.t % 300;
  return mod < 120;
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
  p.x = clamp(p.x, 10 + PLAYER_R, 950 - PLAYER_R);
  p.y = clamp(p.y, 10 + PLAYER_R, 550 - PLAYER_R);
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
  p.x = clamp(p.x, 10 + PLAYER_R, 950 - PLAYER_R);
  p.y = clamp(p.y, 10 + PLAYER_R, 550 - PLAYER_R);
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

let globalSpeed = BASE_SPEED;
const players = [
  { id: 0, x: 160, y: 280, vx: 0, vy: 0, angle: 0, hp: MAX_HP, dash: 0, dashCd: 0, inv: 0, shootCd: 0, overcharge: 0, shield: false, shieldHp: 0, shieldMax: SHIELD_MAX_HP, speedBoost: 0, extraDash: 0, baseSpeed: BASE_SPEED, squish: 0, inSlime: false, lavaCd: 0, voidCd: 0, color: '#58d8ff', alive: true },
  { id: 1, x: 800, y: 280, vx: 0, vy: 0, angle: 0, hp: MAX_HP, dash: 0, dashCd: 0, inv: 0, shootCd: 0, overcharge: 0, shield: false, shieldHp: 0, shieldMax: SHIELD_MAX_HP, speedBoost: 0, extraDash: 0, baseSpeed: BASE_SPEED, squish: 0, inSlime: false, lavaCd: 0, voidCd: 0, color: '#ff5ca8', alive: true },
];
// Early event queue so React can trigger start/forfeit even before init finishes
if (typeof window !== 'undefined') {
  window.addEventListener('nox:startGame', () => {
    const tryStart = () => {
      if (window.NOX_GAME && window.NOX_GAME.startGame) window.NOX_GAME.startGame();
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
  window.addEventListener('nox:backToMenu', () => {
    const tryMenu = () => {
      if (window.NOX_GAME && window.NOX_GAME.backToMenu) window.NOX_GAME.backToMenu();
      else setTimeout(tryMenu, 30);
    };
    tryMenu();
  });
}
function setGlobalSpeed(v) {
  const clamped = clamp(parseFloat(v), 2.5, 5.5);
  if (isNaN(clamped)) return;
  globalSpeed = clamped;
  players[0].baseSpeed = clamped;
  players[1].baseSpeed = clamped;
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
let prevHp = [MAX_HP, MAX_HP];
let pendingTimeouts = [];
let forfeitLock = false;
function trackTimeout(id) { pendingTimeouts.push(id); return id; }
function clearPendingTimeouts() { pendingTimeouts.forEach(clearTimeout); pendingTimeouts.length = 0; }
function clearInputState() { keys = {}; }
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
    // keep exposed refs in sync if they were rebound earlier
    window.NOX_GAME.scores[0] = 0; window.NOX_GAME.scores[1] = 0;
  }
  round = 1;
  timeLeft = ROUND_TIME;
  prevHp[0] = MAX_HP; prevHp[1] = MAX_HP;
  safeRadius = 999;
  voidTick = [0, 0];
  const voidG = document.getElementById('void');
  if (voidG) voidG.setAttribute('opacity', '0');
  // reset void radii immediately
  ['voidHole','voidRing','voidInner','voidRing2','voidCore'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('r', '420');
  });
}

// Input handling
function setupInput() {
  window.addEventListener('keydown', e => {
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

  window.addEventListener('keydown', e => {
    if(e.key.toLowerCase() === 'r' && gameState === 'gameOver') document.getElementById('rematchBtn')?.click();
  });
}

function isDown(...ks) { return ks.some(k => !!keys[k]); }
function isDownCode(code) { return !!keys[code]; }

function shoot(p) {
  if(p.shootCd > 0) return;
  p.shootCd = p.overcharge > 0 ? 9 : 11;
  const speed = BULLET_SPEED;
  const mx = p.x + Math.cos(p.angle) * 18;
  const my = p.y + Math.sin(p.angle) * 18;
  const spread = p.overcharge > 0 ? [-0.22, 0, 0.22] : [0];
  spread.forEach(s => {
    const ang = p.angle + s + (Math.random() - 0.5) * 0.03;
    bullets.push({
      x: mx, y: my,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      owner: p.id, life: 120, trail: []
    });
  });
  particles.push(...spawnMuzzle(mx, my, p.color, p.angle));
  if(navigator.vibrate) navigator.vibrate(10);
}

function isValidPickupPos(x, y) {
  if(wallsCollide(x, y, 28)) return false;
  if(len2(x, y, 140, 280) < 68 || len2(x, y, 820, 280) < 68) return false;
  if(hazardAt(x, y)) return false;
  return true;
}

function pickRandomPowerKind() {
  const r = Math.random();
  if(r < 0.35) return 'overcharge';
  if(r < 0.55) return 'shield';
  if(r < 0.80) return 'blink';
  return 'heal';
}

function spawnPickupSoon(force = false) {
  if(pickups.length > 0 && !force) return;
  const kind = pickRandomPowerKind();
  const life = POWER_TYPES[kind].life;
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

  players[1].x = 820; players[1].y = 280; players[1].hp = MAX_HP; players[1].alive = true;
  players[1].dash = 0; players[1].dashCd = 0; players[1].inv = 0; players[1].overcharge = 0;
  players[1].shield = false; players[1].shieldHp = 0; players[1].speedBoost = 0;
  players[1].extraDash = 0; players[1].squish = 0; players[1].inSlime = false;
  players[1].lavaCd = 0; players[1].voidCd = 0; players[1].baseSpeed = preservedSpeed; players[1].angle = Math.PI;

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
  // keep NOX_GAME refs in sync
  if (window.NOX_GAME) {
    window.NOX_GAME.bullets.length = 0;
    window.NOX_GAME.pickups.length = 0;
    window.NOX_GAME.particles.length = 0;
  }
  timeLeft = ROUND_TIME;
  prevHp[0] = MAX_HP; prevHp[1] = MAX_HP;
  spawnPickupSoon(true);
  updateHUD();
}

function update(dt) {
  if(gameState !== 'playing') return;
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
    if(mx || my || p.dash > 0) tryMove(p, nx, ny);
    else { pushOutOfWalls(p); }

    const hz = hazardAt(p.x, p.y);
    if(hz && hz.kind === 'lava' && isLavaActive(hz) && p.lavaCd === 0) {
      if(p.shield && p.shieldHp > 0) {
        p.shieldHp--; p.lavaCd = 60; p.inv = Math.max(p.inv, 12);
        particles.push(...spawnHit(p.x, p.y, '#ffb23e'));
        if(p.shieldHp <= 0) {
          p.shield = false; p.shieldHp = 0;
          for(let k = 0; k < 10; k++) particles.push({x: p.x, y: p.y, vx: Math.cos(Math.random() * Math.PI * 2) * (2 + Math.random() * 2.5), vy: Math.sin(Math.random() * Math.PI * 2) * (2 + Math.random() * 2.5), life: 18, max: 18, r: 1.9, color: '#ffd9a6', type: 'star'});
        }
      } else if(p.inv === 0) {
        p.hp--; p.lavaCd = 60; p.inv = 26;
        particles.push(...spawnHit(p.x, p.y, '#ffb23e'));
        particles.push({x: p.x, y: p.y - 18, vx: 0, vy: -0.6, life: 30, max: 30, r: 0, color: '#ffb23e', type: 'healText', text: '-1 LAVA'});
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
          particles.push(...spawnHit(p.x, p.y, '#c9ff2f'));
          if(p.shieldHp <= 0) { p.shield = false; p.shieldHp = 0; }
        } else if(p.inv === 0) {
          p.hp--; p.inv = 22;
          particles.push(...spawnHit(p.x, p.y, '#c9ff2f'));
          particles.push({x: p.x, y: p.y - 18, vx: 0, vy: -0.6, life: 30, max: 30, r: 0, color: '#c9ff2f', type: 'healText', text: 'VOID'});
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
            particles.push({x: p.x, y: p.y - 26, vx: 0, vy: -0.9, life: 42, max: 42, r: 0, color: '#22c55e', type: 'healText', text: '+1'});
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
    b.trail.unshift({x: b.x, y: b.y});
    if(b.trail.length > 4) b.trail.pop();
    b.x += b.vx; b.y += b.vy;
    b.life--;
    let hitWall = false;
    for(const w of wallData) { if(rectCircleCollide(b.x, b.y, BULLET_R, w.x, w.y, w.w, w.h)) { hitWall = true; break; } }
    if(hitWall || b.life <= 0 || b.x < 0 || b.x > 960 || b.y < 0 || b.y > 560) {
      if(hitWall) particles.push(...spawnHit(b.x, b.y, b.owner === 0 ? '#58d8ff' : '#ff5ca8'));
      bullets.splice(i, 1); continue;
    }
    for(const p of players) {
      if(p.id === b.owner) continue;
      if(p.inv > 0) continue;
      if(!p.alive) continue;
      const effR = p.squish > 0 ? PLAYER_R * 0.88 : PLAYER_R;
      if(len2(b.x, b.y, p.x, p.y) < effR + BULLET_R) {
        if(p.shield) {
          p.shieldHp = (p.shieldHp || SHIELD_MAX_HP) - 1;
          p.inv = 16;
          particles.push(...spawnHit(b.x, b.y, '#58d8ff'));
          const crackCount = p.shieldHp === 2 ? 8 : p.shieldHp === 1 ? 10 : 14;
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
        p.hp--; p.inv = 28;
        particles.push(...spawnHit(p.x, p.y, p.color));
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

function drawWalls() {
  const wallsG = document.getElementById('walls');
  if(!wallsG) return;
  wallsG.innerHTML = '';
  // Outer frame as single merged path so corners don't overlap
  const hasBorder = wallData.some(d => d.isBorder);
  if (hasBorder) {
    const frame = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    // outer 960x560 with 10px thick frame (inner hole 10 inset)
    frame.setAttribute('d', 'M0 0 H960 V560 H0 Z M10 10 H950 V550 H10 Z');
    frame.setAttribute('fill', '#0f172a');
    frame.setAttribute('fill-rule', 'evenodd');
    frame.setAttribute('stroke', 'rgba(27,36,39,0.9)');
    frame.setAttribute('stroke-width', '1');
    wallsG.appendChild(frame);
    const frameHi = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    frameHi.setAttribute('d', 'M10 11 H950 M10 549 H950 M11 10 V550 M949 10 V550');
    frameHi.setAttribute('fill', 'none');
    frameHi.setAttribute('stroke', 'rgba(255,255,255,0.07)');
    frameHi.setAttribute('stroke-width', '1');
    frameHi.setAttribute('opacity', '0.9');
    wallsG.appendChild(frameHi);
  }
  wallData.forEach(d => {
    if (d.isBorder) return; // already drawn as frame
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', d.x); r.setAttribute('y', d.y);
    r.setAttribute('width', d.w); r.setAttribute('height', d.h);
    r.setAttribute('rx', d.rx != null ? d.rx : 2);
    r.setAttribute('fill', 'url(#wallGrad)');
    r.setAttribute('stroke', 'rgba(27,36,39,0.85)');
    r.setAttribute('stroke-width', '1');
    if(d.w > 100 || d.h > 100) r.setAttribute('opacity', '0.96');
    wallsG.appendChild(r);
    // subtle top highlight for depth - inset 2px, no overlap on merged corners
    const hl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hl.setAttribute('x', d.x + 1.5); hl.setAttribute('y', d.y + 1);
    hl.setAttribute('width', Math.max(0, d.w - 3)); hl.setAttribute('height', '1.5');
    hl.setAttribute('rx', '1');
    hl.setAttribute('fill', 'rgba(255,255,255,0.09)');
    hl.setAttribute('opacity', '0.9');
    wallsG.appendChild(hl);
  });
}

function drawHazards() {
  const hazardsG = document.getElementById('hazards');
  if(!hazardsG) return;
  hazardsG.innerHTML = '';
  hazards.forEach(h => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    if(h.kind === 'slime') {
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', h.x); bg.setAttribute('y', h.y);
      bg.setAttribute('width', h.w); bg.setAttribute('height', h.h);
      bg.setAttribute('rx', '8');
      bg.setAttribute('fill', 'url(#slimeGrad)'); bg.setAttribute('opacity', '0.92');
      bg.setAttribute('stroke', 'rgba(110,231,183,0.22)'); bg.setAttribute('stroke-width', '1');
      g.appendChild(bg);
      const b1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      b1.setAttribute('cx', h.x + 10); b1.setAttribute('cy', h.y + 11); b1.setAttribute('r', '3.2');
      b1.setAttribute('fill', 'rgba(255,255,255,0.22)'); g.appendChild(b1);
      const b2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      b2.setAttribute('cx', h.x + 26); b2.setAttribute('cy', h.y + 24); b2.setAttribute('r', '2.1');
      b2.setAttribute('fill', 'rgba(255,255,255,0.16)'); g.appendChild(b2);
      const b3 = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      b3.setAttribute('cx', h.x + 18); b3.setAttribute('cy', h.y + 28); b3.setAttribute('rx', '7'); b3.setAttribute('ry', '3');
      b3.setAttribute('fill', 'rgba(16,185,129,0.18)'); g.appendChild(b3);
      const lab = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lab.setAttribute('x', h.x + 18); lab.setAttribute('y', h.y + 33);
      lab.setAttribute('text-anchor', 'middle');
      lab.setAttribute('font-size', '7');
      lab.setAttribute('font-family', 'JetBrains Mono, monospace');
      lab.setAttribute('fill', 'rgba(255,255,255,0.55)'); lab.textContent = 'SLIME';
      g.appendChild(lab);
    } else {
      const active = isLavaActive(h), warn = isLavaWarning(h);
      const r = 14 + (active ? 1.6 : 0);
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', h.x + 18); c.setAttribute('cy', h.y + 18); c.setAttribute('r', r);
      c.setAttribute('fill', 'url(#lavaGrad)');
      c.setAttribute('opacity', active ? '1' : warn ? '0.78' : '0.42');
      c.setAttribute('stroke', active ? '#fff' : '#fb923c');
      c.setAttribute('stroke-width', active ? '1.4' : '1');
      c.setAttribute('stroke-opacity', active ? '0.85' : '0.5');
      if(active) c.setAttribute('filter', 'url(#softGlow)');
      g.appendChild(c);
      if(warn) {
        const w = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        w.setAttribute('cx', h.x + 18); w.setAttribute('cy', h.y + 18); w.setAttribute('r', '18');
        w.setAttribute('fill', 'none'); w.setAttribute('stroke', '#fb923c');
        w.setAttribute('stroke-width', '1');
        w.setAttribute('stroke-dasharray', '3 4'); w.setAttribute('opacity', '0.55');
        g.appendChild(w);
      }
      const lab = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lab.setAttribute('x', h.x + 18); lab.setAttribute('y', active ? h.y + 32 : h.y + 33);
      lab.setAttribute('text-anchor', 'middle');
      lab.setAttribute('font-size', '7');
      lab.setAttribute('font-family', 'JetBrains Mono, monospace');
      lab.setAttribute('fill', active ? '#fff' : 'rgba(255,255,255,0.55)');
      lab.textContent = active ? 'LAVA' : 'VENT';
      g.appendChild(lab);
      if(active) {
        const e = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        e.setAttribute('cx', h.x + 18 + Math.sin(h.t * 0.18) * 2);
        e.setAttribute('cy', h.y + 18 + Math.cos(h.t * 0.2) * 2);
        e.setAttribute('r', '2.1');
        e.setAttribute('fill', '#fff'); e.setAttribute('opacity', '0.9');
        g.appendChild(e);
      }
    }
    hazardsG.appendChild(g);
  });
}

function render() {
  const playersG = document.getElementById('players');
  const bulletsG = document.getElementById('bullets');
  const pickupsG = document.getElementById('pickups');
  const particlesG = document.getElementById('particles');
  if(!playersG || !bulletsG || !pickupsG || !particlesG) return;

  playersG.innerHTML = '';
  players.forEach(p => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${p.x},${p.y}) rotate(${p.angle * 180 / Math.PI})`);
    g.setAttribute('opacity', p.inv > 0 && Math.floor(p.inv / 4) % 2 === 0 ? '0.35' : '1');

    const sh = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    sh.setAttribute('cx', '2'); sh.setAttribute('cy', '10');
    sh.setAttribute('rx', '14'); sh.setAttribute('ry', '6');
    sh.setAttribute('fill', 'rgba(0,0,0,0.35)'); sh.setAttribute('filter', 'url(#softGlow)');
    g.appendChild(sh);

    const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    body.setAttribute('d', 'M 18 0 L -12 -11 L -8 0 L -12 11 Z');
    body.setAttribute('fill', p.id === 0 ? '#3ec5f2' : '#f43f5e');
    body.setAttribute('stroke', '#fff'); body.setAttribute('stroke-width', '1.6');
    body.setAttribute('stroke-linejoin', 'round');
    body.setAttribute('filter', p.id === 0 ? 'url(#glowCyan)' : 'url(#glowPink)');
    g.appendChild(body);

    const cock = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    cock.setAttribute('cx', '0'); cock.setAttribute('cy', '0'); cock.setAttribute('r', '5.5');
    cock.setAttribute('fill', '#fff'); cock.setAttribute('opacity', '0.95');
    g.appendChild(cock);
    const cock2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    cock2.setAttribute('cx', '0.8'); cock2.setAttribute('cy', '-1'); cock2.setAttribute('r', '2');
    cock2.setAttribute('fill', p.color);
    g.appendChild(cock2);

    if(p.dash > 0) {
      const flame = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      flame.setAttribute('d', 'M -12 0 L -22 -6 L -26 0 L -22 6 Z');
      flame.setAttribute('fill', p.id === 0 ? '#a9e9ff' : '#ff9ec9');
      flame.setAttribute('opacity', '0.9');
      g.appendChild(flame);
    }

    if(p.overcharge > 0) {
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', '0'); ring.setAttribute('cy', '0'); ring.setAttribute('r', '20');
      ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#ffb23e');
      ring.setAttribute('stroke-width', '2');
      ring.setAttribute('stroke-dasharray', '4 4'); ring.setAttribute('opacity', '0.85');
      ring.setAttribute('transform', `rotate(${(Date.now() / 12) % 360})`);
      g.appendChild(ring);
    }

    if(p.shield) {
      const hp = p.shieldHp || 0;
      const ratio = hp / (p.shieldMax || SHIELD_MAX_HP);
      let dash = '6 3', op = '0.92', sw = '2.6';
      if(hp === 2) { dash = '6 7'; op = '0.68'; sw = '2.2'; }
      else if(hp === 1) { dash = '3.5 9'; op = '0.42'; sw = '1.8'; }
      const sr = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      sr.setAttribute('cx', '0'); sr.setAttribute('cy', '0'); sr.setAttribute('r', '22');
      sr.setAttribute('fill', 'none'); sr.setAttribute('stroke', '#58d8ff');
      sr.setAttribute('stroke-width', sw);
      sr.setAttribute('opacity', op); sr.setAttribute('stroke-dasharray', dash);
      sr.setAttribute('stroke-linecap', 'round');
      if(hp === 1) sr.setAttribute('transform', `rotate(${(Date.now() / 14) % 360})`);
      g.appendChild(sr);
      const sr2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      sr2.setAttribute('cx', '0'); sr2.setAttribute('cy', '0'); sr2.setAttribute('r', '24');
      sr2.setAttribute('fill', '#58d8ff');
      sr2.setAttribute('opacity', hp === 1 ? '0.06' : hp === 2 ? '0.09' : '0.13');
      g.appendChild(sr2);
      if(hp <= 2) {
        const crack1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        crack1.setAttribute('d', 'M 0 -18 L 4 -10 L -2 -2 L 5 6 L -1 14');
        crack1.setAttribute('fill', 'none'); crack1.setAttribute('stroke', '#a9e9ff');
        crack1.setAttribute('stroke-width', '1.1');
        crack1.setAttribute('opacity', hp === 1 ? '0.85' : '0.55');
        crack1.setAttribute('stroke-linecap', 'round'); crack1.setAttribute('stroke-linejoin', 'round');
        g.appendChild(crack1);
      }
      if(hp === 1) {
        const crack2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        crack2.setAttribute('d', 'M -14 -4 L -6 0 L -10 7 L -2 11');
        crack2.setAttribute('fill', 'none'); crack2.setAttribute('stroke', '#a9e9ff');
        crack2.setAttribute('stroke-width', '1'); crack2.setAttribute('opacity', '0.5');
        crack2.setAttribute('stroke-linecap', 'round');
        g.appendChild(crack2);
        const crack3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        crack3.setAttribute('d', 'M 10 -12 L 13 -4 L 8 2');
        crack3.setAttribute('fill', 'none'); crack3.setAttribute('stroke', '#a9e9ff');
        crack3.setAttribute('stroke-width', '0.9'); crack3.setAttribute('opacity', '0.45');
        g.appendChild(crack3);
      }
    }

    if(p.speedBoost > 0) {
      const br = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      br.setAttribute('cx', '0'); br.setAttribute('cy', '0'); br.setAttribute('r', '18');
      br.setAttribute('fill', 'none'); br.setAttribute('stroke', '#c9ff2f');
      br.setAttribute('stroke-width', '2');
      br.setAttribute('opacity', '0.8'); br.setAttribute('stroke-dasharray', '2 5');
      br.setAttribute('transform', `rotate(${(Date.now() / 8) % 360})`);
      g.appendChild(br);
    }

    if(p.extraDash > 0) {
      const ed = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      ed.setAttribute('x', '14'); ed.setAttribute('y', '-14');
      ed.setAttribute('font-size', '10'); ed.setAttribute('font-weight', '800');
      ed.setAttribute('fill', '#c9ff2f');
      ed.textContent = '◆'.repeat(p.extraDash);
      g.appendChild(ed);
    }

    const hpArc = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    hpArc.setAttribute('x', '0'); hpArc.setAttribute('y', '28');
    hpArc.setAttribute('text-anchor', 'middle');
    hpArc.setAttribute('font-size', '9');
    hpArc.setAttribute('font-family', 'JetBrains Mono, monospace');
    hpArc.setAttribute('fill', '#fff'); hpArc.setAttribute('opacity', '0.85');
    hpArc.setAttribute('transform', `rotate(${-p.angle * 180 / Math.PI})`);
    hpArc.textContent = '♥'.repeat(p.hp);
    g.appendChild(hpArc);

    if(p.dashCd > 0) {
      const cd = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      cd.setAttribute('x', '-12'); cd.setAttribute('y', '-18');
      cd.setAttribute('width', '24'); cd.setAttribute('height', '3');
      cd.setAttribute('rx', '2');
      cd.setAttribute('fill', 'rgba(255,255,255,0.18)');
      g.appendChild(cd);
      const fill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      fill.setAttribute('x', '-12'); fill.setAttribute('y', '-18');
      fill.setAttribute('width', String(24 * (1 - p.dashCd / DASH_COOLDOWN)));
      fill.setAttribute('height', '3');
      fill.setAttribute('rx', '2');
      fill.setAttribute('fill', p.dashCd < 10 ? '#22c55e' : '#ff9d2e');
      g.appendChild(fill);
    }

    playersG.appendChild(g);
  });

  bulletsG.innerHTML = '';
  bullets.forEach(b => {
    b.trail.forEach((t, i) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', t.x); c.setAttribute('cy', t.y);
      c.setAttribute('r', String(3 - i * 0.5));
      c.setAttribute('fill', b.owner === 0 ? '#58d8ff' : '#ff5ca8');
      c.setAttribute('opacity', String(0.35 - i * 0.07));
      bulletsG.appendChild(c);
    });
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', b.x); circle.setAttribute('cy', b.y);
    circle.setAttribute('r', String(BULLET_R));
    circle.setAttribute('fill', '#fff');
    circle.setAttribute('stroke', b.owner === 0 ? '#58d8ff' : '#ff5ca8');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('filter', b.owner === 0 ? 'url(#glowCyan)' : 'url(#glowPink)');
    bulletsG.appendChild(circle);
    const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    core.setAttribute('cx', b.x); core.setAttribute('cy', b.y);
    core.setAttribute('r', '2');
    core.setAttribute('fill', b.owner === 0 ? '#a9e9ff' : '#ff9ec9');
    bulletsG.appendChild(core);
  });

  pickupsG.innerHTML = '';
  pickups.forEach(pu => {
    const kind = pu.kind || 'overcharge';
    const cfg = POWER_TYPES[kind] || POWER_TYPES.overcharge;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${pu.x},${pu.y})`);
    const pulse = 1 + Math.sin(pu.t) * 0.13;
    const flicker = pu.life < 90 ? (Math.floor(pu.life / 6) % 2 === 0 ? 0.3 : 1) : 1;
    g.setAttribute('opacity', flicker);

    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    glow.setAttribute('r', String(18 * pulse));
    glow.setAttribute('fill', cfg.color); glow.setAttribute('opacity', '0.18');
    glow.setAttribute('filter', 'url(#softGlow)');
    g.appendChild(glow);

    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('r', '13');
    c.setAttribute('fill', cfg.bg);
    c.setAttribute('stroke', '#fff'); c.setAttribute('stroke-width', '2');
    c.setAttribute('filter', 'url(#softGlow)');
    g.appendChild(c);

    const inner = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    inner.setAttribute('text-anchor', 'middle'); inner.setAttribute('dy', '5');
    inner.setAttribute('font-size', '13'); inner.setAttribute('font-weight', '800');
    inner.setAttribute('fill', '#fff');
    inner.textContent = cfg.icon;
    g.appendChild(inner);

    for(let i = 0; i < 3; i++) {
      const ang = pu.t * 0.85 + i * 2.094;
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', String(Math.cos(ang) * 19));
      dot.setAttribute('cy', String(Math.sin(ang) * 19));
      dot.setAttribute('r', '2.5');
      dot.setAttribute('fill', cfg.color); dot.setAttribute('opacity', '0.9');
      g.appendChild(dot);
    }

    const lab = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lab.setAttribute('y', '26'); lab.setAttribute('text-anchor', 'middle');
    lab.setAttribute('font-size', '7');
    lab.setAttribute('font-family', 'JetBrains Mono, monospace');
    lab.setAttribute('fill', '#fff'); lab.setAttribute('opacity', '0.7');
    lab.textContent = kind === 'overcharge' ? 'TRI' : kind === 'shield' ? 'SHLD' : kind === 'heal' ? 'HEAL' : 'BLNK';
    g.appendChild(lab);
    pickupsG.appendChild(g);
  });

  particlesG.innerHTML = '';
  particles.forEach(pt => {
    if(pt.type === 'healText') {
      const a = pt.life / pt.max;
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      el.setAttribute('x', pt.x); el.setAttribute('y', pt.y);
      el.setAttribute('text-anchor', 'middle'); el.setAttribute('font-size', '11');
      el.setAttribute('font-weight', '800');
      el.setAttribute('font-family', 'JetBrains Mono, monospace');
      el.setAttribute('fill', pt.color); el.setAttribute('opacity', String(a));
      el.setAttribute('stroke', 'rgba(0,0,0,0.35)'); el.setAttribute('stroke-width', '0.4');
      el.textContent = pt.text || '+1';
      particlesG.appendChild(el);
      return;
    }
    const a = pt.life / pt.max;
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    el.setAttribute('cx', pt.x); el.setAttribute('cy', pt.y);
    el.setAttribute('r', String(pt.r * a));
    el.setAttribute('fill', pt.color); el.setAttribute('opacity', String(a));
    if(pt.type === 'star') el.setAttribute('stroke', '#fff');
    particlesG.appendChild(el);
  });
}

function setCyberBadgeText(el, text) {
  if (!el) return;
  const inner = el.querySelector('.cyber-badge__text');
  if (inner) inner.textContent = text;
  else el.textContent = text;
}
function setCyberBadgeVariant(el, variant) {
  if (!el) return;
  // preserve cyber-badge base, swap variant
  el.className = `cyber-badge cyber-badge--${variant}`;
  if (el.id) el.id = el.id; // keep id
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
  const isForfeit = !!(reason && reason.includes('FORFEIT'));

  if(winner === null) {
    setCyberBadgeText(badge, `ROUND ${round} // DRAW`);
    if (badge) setCyberBadgeVariant(badge, 'lime');
    title.textContent = 'DRAW!';
    title.className = 'result-score winner-draw';
    if(sub) sub.textContent = reason + ' • No points';
  } else if (isForfeit) {
    const loser = forfeitPid != null ? forfeitPid + 1 : (winner === 0 ? 2 : 1);
    setCyberBadgeText(badge, `FORFEIT // P${loser} EXIT → P${winner+1} WINS`);
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
      resetRound(true);
      startCountdown();
    }, 1600));
  }
}

function showGameOver(forfeitReason, forfeitPid) {
  clearPendingTimeouts();
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
    setCyberBadgeText(govBadge, `FORFEIT // P${loser} EXIT → P${w+1} WINS`);
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
  if(badge) {
    setCyberBadgeText(badge, `ROUND ${round}`);
    setCyberBadgeVariant(badge, 'cyan');
  }
  const tick = () => {
    if (gameState !== 'countdown') return;
    if(c > 0) {
      if(title) { title.textContent = String(c); title.className = 'result-score winner-draw'; }
      if(sub) sub.textContent = 'Get ready...';
      c--;
      trackTimeout(setTimeout(tick, 650));
    } else {
      if(title) { title.textContent = 'FIGHT!'; title.className = 'result-score winner-draw'; }
      if(sub) sub.textContent = 'Dash = invincible • Grab the orb!';
      trackTimeout(setTimeout(() => {
        if (gameState !== 'countdown') return;
        ro.classList.add('hidden');
        gameState = 'playing';
      }, 420));
    }
  };
  tick();
}

function updateHUD() {
  const scoreP1 = document.getElementById('scoreP1');
  const scoreP2 = document.getElementById('scoreP2');
  if(scoreP1) scoreP1.textContent = scores[0];
  if(scoreP2) scoreP2.textContent = scores[1];

  const rl = document.getElementById('roundLabel');
  if(rl) {
    if(safeRadius < 900) {
      rl.textContent = `⚠ VOID ${Math.round(safeRadius)} • ROUND ${round}`;
      rl.style.color = '#d9ff7a';
      rl.style.opacity = '0.95';
    } else {
      rl.textContent = `FIRST TO ${WIN_SCORE} • ROUND ${round}`;
      rl.style.color = '';
      rl.style.opacity = '0.5';
    }
  }

  const m = Math.floor(Math.max(0, timeLeft) / 60).toString().padStart(2, '0');
  const s = Math.floor(Math.max(0, timeLeft) % 60).toString().padStart(2, '0');
  const timerEl = document.getElementById('timer');
  if(timerEl) {
    const inner = timerEl.querySelector('.cyber-timer__inner');
    if (inner) inner.textContent = `${m}:${s}`;
    else timerEl.textContent = `${m}:${s}`;
    if(safeRadius < 900) {
      timerEl.classList.add('timer-warning');
      timerEl.classList.remove('timer-critical');
    } else if(timeLeft < 10) {
      timerEl.classList.add('timer-critical');
      timerEl.classList.remove('timer-warning');
    } else {
      timerEl.classList.remove('timer-warning', 'timer-critical');
    }
  }

  for(let pi = 0; pi < 2; pi++) {
    const p = players[pi];
    const hEl = document.getElementById(pi === 0 ? 'heartsP1' : 'heartsP2');
    const justDamaged = prevHp[pi] > p.hp;
    const pct = (p.hp / MAX_HP) * 100;
    if(hEl) {
      hEl.innerHTML = '';
      const fill = document.createElement('div');
      fill.className = 'hp-fill';
      fill.style.width = pct + '%';
      if(p.hp === 1) fill.classList.add('low');
      hEl.appendChild(fill);
      const txt = document.createElement('div');
      txt.className = 'hp-text';
      txt.textContent = `${p.hp} / ${MAX_HP}`;
      hEl.appendChild(txt);
      if(justDamaged) {
        hEl.classList.remove('damage');
        void hEl.offsetWidth;
        hEl.classList.add('damage');
        setTimeout(() => hEl.classList.remove('damage'), 300);
      }
      if(p.hp === 1) hEl.style.filter = pi === 0 ? 'brightness(1.15)' : 'brightness(1.12)';
      else if(p.hp === 2) hEl.style.filter = 'brightness(1.05)';
      else hEl.style.filter = 'none';
      prevHp[pi] = p.hp;
    }

    const ov = document.getElementById(`ovP${pi + 1}`);
    const ovF = document.getElementById(`ovF${pi + 1}`);
    const ovT = document.getElementById(`ovT${pi + 1}`);
    if(ov) {
      const active = p.overcharge > 0;
      ov.classList.toggle('active', active);
      if(ovF) ovF.style.width = active ? (p.overcharge / 240 * 100) + '%' : '0%';
      if(ovT) ovT.textContent = active ? (p.overcharge / 60).toFixed(1) + 's' : '';
    }

    const sh = document.getElementById(`shP${pi + 1}`);
    const shF = document.getElementById(`shF${pi + 1}`);
    const shT = document.getElementById(`shT${pi + 1}`);
    if(sh) {
      const active = !!p.shield && p.shieldHp > 0;
      sh.classList.toggle('active', active);
      const max = p.shieldMax || SHIELD_MAX_HP;
      const pct = active ? (p.shieldHp / max * 100) : 0;
      if(shF) shF.style.width = pct + '%';
      if(active) {
        if(p.shieldHp === 1) { sh.style.animation = 'crackShake 0.35s infinite'; }
        else if(p.shieldHp === 2) { sh.style.animation = 'none'; }
        else { sh.style.animation = 'shieldPulse 1.3s infinite'; }
      } else {
        if(shF) shF.style.filter = 'none';
        sh.style.animation = 'none';
      }
      if(shT) shT.textContent = active ? `${p.shieldHp}/${max}` : '';
      const lab = sh.querySelector('.chip-label');
      if(lab) lab.textContent = active && p.shieldHp === 1 ? 'CRACK' : 'SHLD';
    }

    const bl = document.getElementById(`blP${pi + 1}`);
    const blF = document.getElementById(`blF${pi + 1}`);
    const blT = document.getElementById(`blT${pi + 1}`);
    if(bl) {
      const hasDash = p.extraDash > 0;
      const hasBoost = p.speedBoost > 0;
      const active = hasDash || hasBoost;
      bl.classList.toggle('active', active);
      let pct = 0, txt = '';
      if(hasBoost) { pct = p.speedBoost / 180 * 100; txt = (p.speedBoost / 60).toFixed(1) + 's'; }
      else if(hasDash) { pct = 100; txt = '×' + p.extraDash; }
      if(blF) blF.style.width = pct + '%';
      if(blT) blT.textContent = txt;
    }

    const dashEl = document.getElementById(`dashP${pi + 1}`);
    if(dashEl) {
      const ready = p.dashCd === 0;
      const pct = ready ? 100 : (1 - p.dashCd / DASH_COOLDOWN) * 100;
      dashEl.style.width = pct + '%';
      dashEl.style.background = ready ? '#22c55e' : (pct > 65 ? '#ff9d2e' : '#ef4444');
      dashEl.style.opacity = p.dash > 0 ? '0.95' : '1';
      dashEl.style.boxShadow = p.dash > 0 ? '0 0 6px #22c55e' : 'none';
    }

    const extraEl = document.getElementById(`extraP${pi + 1}`);
    if(extraEl) {
      extraEl.innerHTML = '';
      for(let k = 0; k < p.extraDash; k++) {
        const i = document.createElement('i');
        extraEl.appendChild(i);
      }
    }

    const card = document.getElementById(`cardP${pi + 1}`);
    if(card) {
      const anyActive = p.overcharge > 0 || p.shield || p.speedBoost > 0 || p.extraDash > 0;
      card.classList.toggle('hud-active', anyActive);
    }
  }
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
    simAccum += now - simLast;
    simLast = now;
    if(simAccum > 250) simAccum = 250;
    while(simAccum >= SIM_STEP) {
      update(1);
      simAccum -= SIM_STEP;
    }
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

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
    round = 1; resetRound(true); startCountdown();
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
    round = 1; resetRound(true); startCountdown();
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
    safeRadius = 999; voidTick=[0,0]; timeLeft=ROUND_TIME; prevHp[0]=MAX_HP; prevHp[1]=MAX_HP;
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
    }
    // force decisive match win for opponent - not just +1
    scores[other] = WIN_SCORE;
    if (scores[pid] >= WIN_SCORE) scores[pid] = WIN_SCORE - 1;
    if (window.NOX_GAME) { window.NOX_GAME.scores[other] = WIN_SCORE; window.NOX_GAME.scores[pid] = scores[pid]; }
    bullets.length=0; pickups.length=0;
    if (window.NOX_GAME) { window.NOX_GAME.bullets.length=0; window.NOX_GAME.pickups.length=0; }
    updateHUD();
    try { console.log(`[NOX] forfeit P${pid+1} → P${other+1} wins ${scores[0]}//${scores[1]}`); } catch {}
    // show who won + who left via round win (1.8s) then full gameOver with CONTINUE/RETURN buttons - not instant menu
    endRound(other, `P${pid+1} EXIT // FORFEIT`, pid);
  }
  window.NOX_GAME = {
    players, bullets, pickups, particles,
    scores, gameState: () => gameState,
    endRound, showGameOver, startCountdown, resetRound, startGame, rematchGame, backToMenu, forfeit,
    getGlobalSpeed: () => globalSpeed, setGlobalSpeed,
    W, H, PLAYER_R, BULLET_R, BULLET_SPEED, MAX_HP, ROUND_TIME, WIN_SCORE,
    POWER_TYPES, DASH_COOLDOWN, DASH_TIME
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
}
