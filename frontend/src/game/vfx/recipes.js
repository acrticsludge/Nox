// Pure seeded effect recipes (spec: docs/reasonix/specs/visual-parity-sync.md).
// One canonical recipe per event kind, shared by local 1v1, Trials and online.
// Particle parameters replicate the legacy/sim fx helpers 1:1 so the visual
// baseline (local same-PC 1v1) is preserved; randomness is derived from the
// event seed via mulberry32, never Math.random().

import { mulberry32 } from '../sim/game-sim.js';
import { POWER_TYPES, AMMO_PICKUP_CFG } from '../core/constants.js';

// One visual actor recipe for P1, P2 and the Trials bot — inputs differ only
// through a visual profile.
export const PROFILES = {
  0: { id: 0, color: '#58d8ff', glow: 'cyan', shape: 'player' },
  1: { id: 1, color: '#ff5ca8', glow: 'pink', shape: 'player' },
  bot: { id: 'bot', color: '#ffb23e', glow: 'amber', shape: 'bot' },
};

export function profileOf(actor) {
  return PROFILES[actor] || PROFILES[0];
}

const TAU = Math.PI * 2;
const part = (x, y, vx, vy, life, r, color, type) => ({ x, y, vx, vy, life, max: life, r, color: color ?? '#58d8ff', type });
const text = (x, y, color, t) => ({ x, y: y - 18, vx: 0, vy: -0.7, life: 26, max: 26, r: 0, color, type: 'healText', text: t });
function fxN(r, n, build) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(build(r));
  return out;
}
const trickDmgAt = bounces => { const t = [2.5, 2, 1.6, 1.2, 0.8, 0.5]; return t[Math.min(bounces, 5)]; };

function muzzleColorFor(ev, actorColor) {
  if (ev.bulletType === 'needle') return '#a78bfa';
  if (ev.bulletType === 'cannon') return '#ffb23e';
  if (ev.bulletType === 'trick') return '#58d8ff';
  return actorColor;
}

function bulletColorFor(ev, targetColor) {
  switch (ev.bulletType) {
    case 'needle': return '#a78bfa';
    case 'cannon': return '#ffb23e';
    case 'trick': return '#58d8ff';
    case 'standard': return targetColor;
    default: return targetColor;
  }
}

// Returns an array of display particles for one event. Deterministic for the
// same event (id-agnostic; same fields + seed => same output).
export function spawnForEvent(ev) {
  const r = mulberry32((ev.seed ?? 0) >>> 0);
  const actorColor = profileOf(ev.actor).color;
  const targetColor = profileOf(ev.target).color;
  const x = ev.x, y = ev.y;

  switch (ev.kind) {
    case 'muzzle':
      return fxN(r, 6, r => {
        const a = r() * TAU, s = 2 + r() * 3;
        return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 12, 2, muzzleColorFor(ev, actorColor), 'spark');
      });

    case 'dash':
      return fxN(r, 8, r => part(x, y, (r() - 0.5) * 3, (r() - 0.5) * 3, 10, 2, actorColor, 'dash'));

    case 'wallHit': {
      if (ev.bulletType === 'cannon') return cannonParts(r, x, y, '#ffb23e');
      if (ev.bulletType === 'needle') return hitParts(r, x, y, '#a78bfa');
      if (ev.bulletType === 'trick') return bounceParts(r, x, y, '#58d8ff');
      return hitParts(r, x, y, actorColor);
    }

    case 'trickBounce':
      return bounceParts(r, x, y, '#58d8ff');

    case 'hitStandard':
      return fxN(r, 10, r => {
        const a = r() * TAU, s = 1 + r() * 3.8;
        return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 16, 1.6 + r() * 1.8, targetColor, 'hit');
      });

    case 'needleBlock':
      return fxN(r, 6, i => {
        const a = i * 1.047, s = 1 + r() * 1.2;
        return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 10, 1.1 + r() * 0.8, '#a78bfa', 'hit');
      }).concat([text(x, y, '#a78bfa', 'BLOCK')]);

    case 'needleCrit':
      return fxN(r, 12, r => {
        const a = r() * TAU, s = 1.2 + r() * 4.2;
        return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 20, 1.8 + r() * 1.6, '#a78bfa', 'star');
      }).concat(
        fxN(r, 4, r => part(x, y, (r() - 0.5) * 1.2, (r() - 0.5) * 1.2, 14, 3.2, '#ede9fe', 'hit')),
        [text(x, y, '#a78bfa', 'CRIT +6')],
      );

    case 'cannonHit':
      return cannonParts(r, x, y, targetColor);

    case 'trickHit':
      return fxN(r, 8, r => {
        const a = r() * TAU, s = 1 + r() * 3.2;
        return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 16, 1.5 + r() * 1.2, targetColor, 'hit');
      }).concat([text(x, y, '#58d8ff', `-${ev.amount != null ? ev.amount : trickDmgAt(0)}`)]);

    case 'shieldHit': {
      // impact burst at the bullet point + crack shards on the target hull
      const impact = hitParts(r, x, y, '#58d8ff');
      const remaining = ev.amount != null ? ev.amount : 5;
      const crackCount = remaining <= 1 ? 10 : remaining <= 2 ? 8 : 14;
      const shard = remaining <= 0 ? '#a9e9ff' : '#58d8ff';
      const tx = ev.tx != null ? ev.tx : x, ty = ev.ty != null ? ev.ty : y;
      return impact.concat(fxN(r, crackCount, r => {
        const a = r() * TAU, s = 1.5 + r() * 3.2;
        return part(tx, ty, Math.cos(a) * s, Math.sin(a) * s, 16 + Math.floor(r() * 8), remaining <= 0 ? 2.4 : 1.9, shard, 'hit');
      }));
    }

    case 'shieldBreak':
      return fxN(r, 12, r => {
        const a = r() * TAU, s = 2 + r() * 4;
        return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 20, 2.2, '#a9e9ff', 'star');
      });

    case 'pickup': {
      const kind = ev.pickup || 'overcharge';
      const cfg = POWER_TYPES[kind] || AMMO_PICKUP_CFG[kind];
      const color = cfg ? cfg.color : '#ffb23e';
      const stars = fxN(r, 16, r => {
        const a = r() * TAU, s = 2 + r() * 3;
        return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 22, 2.2, color, 'star');
      });
      if (cfg && cfg.bullet) {
        const tx = ev.tx != null ? ev.tx : x, ty = ev.ty != null ? ev.ty : y;
        stars.push(text(tx, ty, color, cfg.bullet.toUpperCase() + ` x${ev.amount != null ? ev.amount : cfg.ammo}`));
      }
      return stars;
    }

    case 'heal': {
      const stars = fxN(r, 16, r => {
        const a = r() * TAU, s = 2 + r() * 3;
        return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 22, 2.2, '#22c55e', 'star');
      });
      const burst = fxN(r, 8, r => {
        const a = r() * TAU, s = 1 + r() * 2.2;
        return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 18, 1.8, '#22c55e', 'hit');
      });
      const out = stars.concat(burst);
      if (ev.amount) {
        const tx = ev.tx != null ? ev.tx : x, ty = ev.ty != null ? ev.ty : y;
        out.push(text(tx, ty, '#22c55e', `+${ev.amount}`));
      }
      return out;
    }

    case 'lavaHit':
      return fxN(r, 10, r => {
        const a = r() * TAU, s = 1 + r() * 3;
        return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 18, 1.7 + r() * 1.4, '#fb923c', 'hit');
      }).concat([text(x, y, '#fb923c', '-2 LAVA')]);

    case 'voidHit':
      return fxN(r, 9, r => {
        const a = r() * TAU, s = 1 + r() * 2.8;
        return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 18, 1.5 + r() * 1.2, '#c9ff2f', 'hit');
      }).concat([text(x, y, '#c9ff2f', 'VOID -1')]);

    case 'death':
      return fxN(r, 18, r => {
        const a = r() * TAU, s = 1 + r() * 5;
        return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 24, 2 + r() * 2, actorColor, 'hit');
      });

    case 'hazardMove': {
      const from = ev.meta && ev.meta.from === 'lava' ? '#fb923c' : '#6ee7b7';
      const to = ev.meta && ev.meta.to === 'lava' ? '#f97316' : '#10b981';
      const tx = ev.tx != null ? ev.tx : x, ty = ev.ty != null ? ev.ty : y;
      return fxN(r, 12, r => {
        const a = r() * TAU, s = 1 + r() * 2.5;
        return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 16, 1.8, from, 'hit');
      }).concat(fxN(r, 14, r => {
        const a = r() * TAU, s = 1 + r() * 2.2;
        return part(tx, ty, Math.cos(a) * s, Math.sin(a) * s, 18, 2, to, 'star');
      }));
    }

    case 'roundEnd':
      return [];

    default:
      return [];
  }
}

function hitParts(r, x, y, color) {
  return fxN(r, 10, r => {
    const a = r() * TAU, s = 1 + r() * 4;
    return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 18 + Math.floor(r() * 10), 1.5 + r() * 2, color, 'hit');
  });
}

function bounceParts(r, x, y, color) {
  return fxN(r, 6, r => {
    const a = r() * TAU, s = 1 + r() * 2.2;
    return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 12, 1.4, color || '#58d8ff', 'spark');
  });
}

function cannonParts(r, x, y, color) {
  return fxN(r, 14, r => {
    const a = r() * TAU, s = 1 + r() * 4.6;
    return part(x, y, Math.cos(a) * s, Math.sin(a) * s, 22, 2.2 + r() * 1.8, color || '#ffb23e', 'hit');
  }).concat(
    fxN(r, 4, r => part(x, y, (r() - 0.5) * 1.6, -1.2 - r() * 1.4, 18, 1.4, '#fb923c', 'spark')),
    [text(x, y, '#ffb23e', 'BOOM -4')],
  );
}

export const TRICK_DMG = [2.5, 2, 1.6, 1.2, 0.8, 0.5];
export { trickDmgAt };
