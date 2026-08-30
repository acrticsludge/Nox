// NEON VOID // shared constants — single source for 1v1 + trials (2x)
// Modify here to tune gameplay across both modes.

export const W = 960;
export const H = 560;
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

// Void Trials (2x arena)
export const TRIALS_W = 1920;
export const TRIALS_H = 1120;
export const TRIALS_COLS = 48;
export const TRIALS_ROWS = 28;
export const TRIAL_DURATION = 600;
export const VOID_START_TIME = 450;
export const VOID_SHRINK_DURATION = 30;
export const BOT_MAX_HP = 12;
export const TRIALS_HAZARD_COUNT = 10;
export const TRIALS_WALL_TARGET = 16;
export const REQUIRED_WALL_GAP = PLAYER_R * 2 + 2; // 34px

// Powers / ammo
export const POWER_TYPES = {
  overcharge: { color: '#ffb23e', bg: '#ff9d2e', icon: '⚡', duration: 240, life: 480 },
  shield:     { color: '#58d8ff', bg: '#3ec5f2', icon: '❄', life: 480, hp: 5 },
  blink:      { color: '#c9ff2f', bg: '#c9ff2f', icon: '✦', duration: 180, life: 480 },
  heal:       { color: '#22c55e', bg: '#16a34a', icon: '✚', life: 480, heal: 2 },
} as const;

export const BULLET_TYPES = {
  standard: { id:'standard', label:'STD', color:'#f1f4f3', bg:'#f1f4f3', icon:'o', speed:7.2, r:5,   dmg:2, cd:11, life:90,  ammo: Infinity, bouncesMax:0, lifeDecay:false },
  needle:   { id:'needle',   label:'NEEDLE', color:'#a78bfa', bg:'#7c3aed', icon:'N', speed:8.5, r:3.5, dmgFront:0, dmgRear:6, cd:14, life:90,  ammo:5, bouncesMax:0 },
  cannon:   { id:'cannon',   label:'CANNON', color:'#ffb23e', bg:'#ff9d2e', icon:'C', speed:3.8, r:7,   dmg:4, cd:32, life:120, ammo:3, bouncesMax:0 },
  trick:    { id:'trick',    label:'TRICK',  color:'#58d8ff', bg:'#3ec5f2', icon:'T', speed:6.2, r:4,   dmg:2.5, cd:16, life:180, ammo:6, bouncesMax:5, decay:0.82 }
} as const;

export type BulletKind = keyof typeof BULLET_TYPES;

export const AMMO_PICKUP_CFG = {
  ammo_needle: { color:'#a78bfa', bg:'#7c3aed', icon:'N', life:480, ammo:5, bullet:'needle' as BulletKind },
  ammo_cannon: { color:'#ffb23e', bg:'#ff9d2e', icon:'C', life:480, ammo:3, bullet:'cannon' as BulletKind },
  ammo_trick:  { color:'#58d8ff', bg:'#3ec5f2', icon:'T', life:480, ammo:6, bullet:'trick'  as BulletKind },
} as const;

// For arena scaling helpers
export function arenaSize(mode: '1v1' | 'trials') {
  return mode === 'trials' ? { w: TRIALS_W, h: TRIALS_H, cols: TRIALS_COLS, rows: TRIALS_ROWS }
                            : { w: W, h: H, cols: COLS, rows: ROWS };
}
