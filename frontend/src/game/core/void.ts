// NEON VOID // void math + DOM apply — circle (1v1) vs rect (trials) in one place
import { TRIALS_W, TRIALS_H, VOID_START_TIME, VOID_SHRINK_DURATION } from './constants';

export type VoidRect = { x:number; y:number; w:number; h:number } | null;

// 1v1 helper values are handled in game-logic; this file only needs trials rect
export function voidRectForTrials(timeLeft:number): VoidRect {
  const elapsed = 600 - timeLeft; // TRIAL_DURATION
  if (elapsed < VOID_START_TIME) return null;
  const p = Math.min(1, (elapsed - VOID_START_TIME) / VOID_SHRINK_DURATION);
  const sx = 0, sy = 0, sw = TRIALS_W, sh = TRIALS_H;
  const ex = (TRIALS_W - 960)/2, ey=(TRIALS_H-560)/2, ew=960, eh=560;
  return { x: sx + (ex-sx)*p, y: sy + (ey-sy)*p, w: sw + (ew-sw)*p, h: sh + (eh-sh)*p };
}
export function applyVoidRectDOM(rect: VoidRect) {
  const ids = ['voidHole','voidRing','voidRing2','voidInner','voidCore'];
  if (!rect) return;
  ids.forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.setAttribute('x', String(rect.x)); el.setAttribute('y',String(rect.y)); el.setAttribute('width',String(rect.w)); el.setAttribute('height',String(rect.h)); }
  });
}
