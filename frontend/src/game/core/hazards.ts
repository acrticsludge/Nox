// NEON VOID // hazard helpers — single impl for 1v1 + trials + preview
import type { Hazard } from './walls';

export function isLavaActive(h: Hazard){ const m=h.t%300; return m>=120 && m<228; }
export function isLavaWarning(h: Hazard){ const m=h.t%300; return m<120; }
export function hazardAt(x:number,y:number,hazards: Hazard[]): Hazard | null {
  for(const h of hazards) if(x>=h.x && x<=h.x+h.w && y>=h.y && y<=h.y+h.h) return h;
  return null;
}
