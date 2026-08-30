// NEON VOID // bullet + ammo + pickup kinds — edit here to change weapon feel
// Single definition used by 1v1, trials, and HeroArenaPreview.

import { BULLET_TYPES as BT, AMMO_PICKUP_CFG as AMMO, POWER_TYPES as PT } from './constants';

export const BULLET_TYPES = BT;
export const AMMO_PICKUP_CFG = AMMO;
export const POWER_TYPES = PT;
export type BulletKind = keyof typeof BT;
export type AmmoKind = keyof typeof AMMO;
export type PowerKind = keyof typeof PT | AmmoKind;

export function pickRandomPowerKind(): PowerKind {
  const r=Math.random();
  if(r<0.22) return 'overcharge';
  if(r<0.40) return 'shield';
  if(r<0.60) return 'blink';
  if(r<0.70) return 'heal';
  if(r<0.80) return 'ammo_needle';
  if(r<0.90) return 'ammo_cannon';
  return 'ammo_trick';
}
