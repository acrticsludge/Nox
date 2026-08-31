// Trials save validation (audit P2-05 / P2-18).
// Persisted state is NEVER trusted: every field is type/range checked,
// reconstructable cosmetics (particles, bullet visuals) are not saved, and
// unsupported versions are discarded with a user-visible recovery message.
// localStorage score/highscore data is never treated as leaderboard data.

export const TRIALS_SAVE_VERSION = 2;
export const TRIALS_SAVE_KEY = 'nv_trials_state';
export const TRIALS_SAVE_LEGACY_KEYS = ['nv_trials_state']; // v1 shared this key

const LIMITS = {
  timeLeft: { min: 0, max: 600 },
  trialPoints: { min: 0, max: 1000000 },
  trialHighScore: { min: 0, max: 1000000 },
  voidShrinkStart: { min: 0, max: 600 },
  safeRadius: { min: 16, max: 999 },
  lastSaveTime: { min: 0, max: 100000000 },
  x: { min: -64, max: 1984 },
  y: { min: -64, max: 1184 },
  hp: { min: 0, max: 12 },
  maxHp: { min: 1, max: 12 },
  shieldHp: { min: 0, max: 5 },
  ammo: { min: -1, max: 1000 },
  angle: { min: -Math.PI * 4, max: Math.PI * 4 },
  w: { min: 0, max: 1920 },
  h: { min: 0, max: 1120 },
  life: { min: 0, max: 100000 },
  t: { min: -100000, max: 100000 },
};

function num(v, key) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const lim = LIMITS[key];
  if (lim && (v < lim.min || v > lim.max)) return null;
  return v;
}

function clampEntity(e, allowedKeys) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const out = {};
  for (const [k, v] of Object.entries(e)) {
    if (allowedKeys && !allowedKeys.includes(k)) continue;
    if (typeof v === 'number') {
      const n = num(v, k);
      if (n === null) return null; // out-of-range or non-finite numeric field
      out[k] = n;
    } else if (typeof v === 'boolean' || (typeof v === 'string' && v.length <= 64)) {
      out[k] = v;
    }
    // other types (nested objects/functions) are dropped — never stored
  }
  return Object.keys(out).length ? out : null;
}

function validateRect(r) {
  if (r === null || r === undefined) return null;
  if (typeof r !== 'object') return 'invalid';
  const x = num(r.x, 'x'), y = num(r.y, 'y'), w = num(r.w, 'w'), h = num(r.h, 'h');
  if (x === null || y === null || w === null || h === null || w <= 0 || h <= 0) return 'invalid';
  return { x, y, w, h };
}

/**
 * Validate a parsed Trials save. Returns { ok, state?, reason? }.
 * Never throws. reason is a stable machine string for UI messaging.
 */
export function validateTrialsSave(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'malformed' };
  }
  const v = num(parsed.version, 'version');
  if (v === null) return { ok: false, reason: 'malformed' };
  if (v !== TRIALS_SAVE_VERSION) {
    return { ok: false, reason: v < TRIALS_SAVE_VERSION ? 'unsupported-version' : 'newer-version' };
  }

  const timeLeft = num(parsed.timeLeft, 'timeLeft');
  if (timeLeft === null || timeLeft <= 0) return { ok: false, reason: 'invalid-field' };
  const trialPoints = num(parsed.trialPoints, 'trialPoints');
  if (trialPoints === null || trialPoints < 0) return { ok: false, reason: 'invalid-field' };
  const trialHighScore = num(parsed.trialHighScore, 'trialHighScore');
  if (trialHighScore === null) return { ok: false, reason: 'invalid-field' };

  const wallData = parsed.wallData;
  if (!Array.isArray(wallData) || wallData.length === 0 || wallData.length > 64) return { ok: false, reason: 'invalid-field' };
  const walls = [];
  for (const w of wallData) {
    const clean = clampEntity(w, ['x', 'y', 'w', 'h']);
    if (!clean) return { ok: false, reason: 'invalid-field' };
    walls.push(clean);
  }

  const hazards = [];
  if (!Array.isArray(parsed.hazards) || parsed.hazards.length > 64) return { ok: false, reason: 'invalid-field' };
  for (const h of parsed.hazards) {
    const clean = clampEntity(h, ['x', 'y', 'w', 'h', 't', 'lavaCd']);
    if (!clean || (h.kind !== 'lava' && h.kind !== 'slime')) return { ok: false, reason: 'invalid-field' };
    clean.kind = h.kind;
    hazards.push(clean);
  }

  if (!Array.isArray(parsed.players) || parsed.players.length !== 1) return { ok: false, reason: 'invalid-field' };
  const player = clampEntity(parsed.players[0], null);
  if (!player) return { ok: false, reason: 'invalid-field' };
  const botEntity = clampEntity(parsed.bot, null);
  if (!botEntity) return { ok: false, reason: 'invalid-field' };
  botEntity.isBot = true;

  const bullets = [];
  if (!Array.isArray(parsed.bullets) || parsed.bullets.length > 128) return { ok: false, reason: 'invalid-field' };
  for (const b of parsed.bullets) {
    const clean = clampEntity(b, null);
    if (!clean) return { ok: false, reason: 'invalid-field' };
    bullets.push(clean);
  }

  const pickups = [];
  if (!Array.isArray(parsed.pickups) || parsed.pickups.length > 32) return { ok: false, reason: 'invalid-field' };
  for (const pu of parsed.pickups) {
    const clean = clampEntity(pu, ['x', 'y', 't', 'life']);
    if (!clean || typeof pu.kind !== 'string' || pu.kind.length > 24) return { ok: false, reason: 'invalid-field' };
    clean.kind = pu.kind;
    pickups.push(clean);
  }

  const voidRect = validateRect(parsed.voidRect);
  if (voidRect === 'invalid') return { ok: false, reason: 'invalid-field' };
  const safeRadius = num(parsed.safeRadius, 'safeRadius');
  if (safeRadius === null) return { ok: false, reason: 'invalid-field' };

  return {
    ok: true,
    state: {
      version: TRIALS_SAVE_VERSION,
      timeLeft,
      trialPoints,
      trialHighScore,
      wallData: walls,
      hazards,
      players: [player],
      bot: botEntity,
      bullets,
      pickups,
      voidRect,
      voidShrinkStart: num(parsed.voidShrinkStart, 'voidShrinkStart') || 0,
      safeRadius,
      lastSaveTime: num(parsed.lastSaveTime, 'lastSaveTime') || 0,
    },
  };
}

/**
 * Build the persistable snapshot from live game state (v2 schema).
 * Deliberately omits particles and other reconstructable cosmetics (P2-18).
 */
export function buildTrialsSaveSnapshot(src) {
  return {
    version: TRIALS_SAVE_VERSION,
    timeLeft: src.timeLeft,
    trialPoints: src.trialPoints,
    trialHighScore: src.trialHighScore,
    wallData: src.wallData.map(w => pick(w, ['x', 'y', 'w', 'h'])),
    hazards: src.hazards.map(h => ({ ...pick(h, ['x', 'y', 'w', 'h', 't', 'lavaCd']), kind: h.kind })),
    players: src.players.map(p => ({ ...p })),
    bot: { ...src.bot },
    bullets: src.bullets.map(b => ({ ...b })),
    pickups: src.pickups.map(pu => ({ ...pu })),
    voidRect: src.voidRect ? { ...src.voidRect } : null,
    voidShrinkStart: src.voidShrinkStart,
    safeRadius: src.safeRadius,
    lastSaveTime: src.lastSaveTime,
  };
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && typeof obj[k] === 'number' && Number.isFinite(obj[k])) out[k] = obj[k];
  return out;
}

/**
 * Read + validate the stored save. Returns { ok, state?, reason? } and always
 * REMOVES the stored blob when it fails validation (self-healing discard).
 */
export function loadTrialsSave(storage = localStorage) {
  let raw = null;
  try { raw = storage.getItem(TRIALS_SAVE_KEY); } catch { return { ok: false, reason: 'storage-unavailable' }; }
  if (!raw) return { ok: false, reason: 'no-save' };
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch {
    try { storage.removeItem(TRIALS_SAVE_KEY); } catch {}
    return { ok: false, reason: 'corrupt-json' };
  }
  const result = validateTrialsSave(parsed);
  if (!result.ok) {
    try { storage.removeItem(TRIALS_SAVE_KEY); } catch {}
    return result;
  }
  return result;
}
