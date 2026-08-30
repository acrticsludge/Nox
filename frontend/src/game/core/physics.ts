// NEON VOID // pure physics helpers — no DOM, reusable anywhere
import { PLAYER_R, REQUIRED_WALL_GAP } from './constants';

export function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
export function len2(ax: number, ay: number, bx: number, by: number) { return Math.hypot(ax - bx, ay - by); }
export function distance(ax: number, ay: number, bx: number, by: number) { return Math.hypot(ax - bx, ay - by); }

export type Wall = { x:number; y:number; w:number; h:number; rx?:number; isBorder?:boolean };

export function rectCircleCollide(cx:number, cy:number, cr:number, rx:number, ry:number, rw:number, rh:number) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny; return (dx*dx + dy*dy) < cr*cr;
}
export function wallsCollide(x:number, y:number, r:number, walls: Wall[]) {
  for (const w of walls) if (rectCircleCollide(x,y,r,w.x,w.y,w.w,w.h)) return true;
  return false;
}
export function wallGap(a: Wall, b: Wall) {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  if (dx === 0 && dy === 0) return -1;
  if (dx === 0) return dy;
  if (dy === 0) return dx;
  return Math.hypot(dx, dy);
}
export function wallsGapOk(newWall: Wall, existing: Wall[]) {
  for (const ew of existing) {
    const g = wallGap(newWall, ew);
    if (g !== -1 && g < REQUIRED_WALL_GAP) return false;
  }
  return true;
}

// Move + clamp, shared by player AND bot (bot was previously forked via tryMoveBot)
export function pushOutOfWalls(p:{x:number;y:number}, walls: Wall[], mode: '1v1'|'trials') {
  const maxW = mode === 'trials' ? 1920 : 960;
  const maxH = mode === 'trials' ? 1120 : 560;
  p.x = clamp(p.x, 10 + PLAYER_R, maxW - 10 - PLAYER_R);
  p.y = clamp(p.y, 10 + PLAYER_R, maxH - 10 - PLAYER_R);
  for (let iter=0; iter<4; iter++) {
    for (const w of walls) {
      if (!rectCircleCollide(p.x,p.y,PLAYER_R,w.x,w.y,w.w,w.h)) continue;
      const closestX = clamp(p.x, w.x, w.x+w.w);
      const closestY = clamp(p.y, w.y, w.y+w.h);
      let dx = p.x - closestX, dy = p.y - closestY;
      let dist = Math.hypot(dx,dy);
      if (dist < 0.01) {
        const dl=p.x-w.x, dr=(w.x+w.w)-p.x, dt=p.y-w.y, db=(w.y+w.h)-p.y;
        const m = Math.min(dl,dr,dt,db);
        if (m===dl){ p.x=w.x-PLAYER_R-1; continue; }
        else if(m===dr){ p.x=w.x+w.w+PLAYER_R+1; continue; }
        else if(m===dt){ p.y=w.y-PLAYER_R-1; continue; }
        else { p.y=w.y+w.h+PLAYER_R+1; continue; }
      }
      const need = PLAYER_R - dist + 0.5;
      if (need>0){ p.x += (dx/dist)*need; p.y += (dy/dist)*need; }
    }
  }
  p.x = clamp(p.x, 10 + PLAYER_R, maxW - 10 - PLAYER_R);
  p.y = clamp(p.y, 10 + PLAYER_R, maxH - 10 - PLAYER_R);
}
export function tryMove(p:{x:number;y:number}, nx:number, ny:number, walls: Wall[], mode: '1v1'|'trials') {
  if (!wallsCollide(nx,ny,PLAYER_R,walls)) { p.x=nx; p.y=ny; return; }
  if (!wallsCollide(nx,p.y,PLAYER_R,walls)) p.x=nx;
  if (!wallsCollide(p.x,ny,PLAYER_R,walls)) p.y=ny;
  pushOutOfWalls(p, walls, mode);
}
