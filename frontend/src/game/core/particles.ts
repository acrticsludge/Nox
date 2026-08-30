// NEON VOID // FX primitives — every bullet/void/hazard/pickup effect lives here
// Import this to change look/feel in one place; both modes call the same functions.

export type Particle = { x:number; y:number; vx:number; vy:number; life:number; max:number; r:number; color:string; type:string; text?:string };

export function spawnMuzzle(x:number,y:number,color:string,ang:number): Particle[] {
  return Array.from({length:6},()=>({x,y,vx:Math.cos(ang+(Math.random()-0.5)*0.9)*(2+Math.random()*3), vy:Math.sin(ang+(Math.random()-0.5)*0.9)*(2+Math.random()*3), life:12, max:12, r:2, color, type:'spark'}));
}
export function spawnHit(x:number,y:number,color:string): Particle[] {
  return Array.from({length:10},()=>({x,y,vx:Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*4), vy:Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*4), life:18+(Math.random()*10|0), max:18, r:1.5+Math.random()*2, color, type:'hit'}));
}
export function spawnPickupEffect(x:number,y:number,color:string): Particle[] {
  return Array.from({length:16},()=>({x,y,vx:Math.cos(Math.random()*Math.PI*2)*(2+Math.random()*3), vy:Math.sin(Math.random()*Math.PI*2)*(2+Math.random()*3), life:22, max:22, r:2.2, color:color||'#ffb23e', type:'star'}));
}
export function spawnHitStandard(x:number,y:number,color:string): Particle[] {
  return Array.from({length:10},()=>({x,y,vx:Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*3.8), vy:Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*3.8), life:16, max:16, r:1.6+Math.random()*1.8, color, type:'hit'}));
}
export function spawnHitNeedleBlock(x:number,y:number): Particle[] {
  return Array.from({length:6},(_,i)=>({x,y,vx:Math.cos(i*1.047)*(1+Math.random()*1.2), vy:Math.sin(i*1.047)*(1+Math.random()*1.2), life:10, max:10, r:1.1+Math.random()*0.8, color:'#a78bfa', type:'hit'}))
    .concat([{x,y,vx:0,vy:-0.7,life:18,max:18,r:0,color:'#a78bfa',type:'healText',text:'BLOCK'}] as Particle[]);
}
export function spawnHitNeedleCrit(x:number,y:number): Particle[] {
  const a = Array.from({length:12},()=>({x,y,vx:Math.cos(Math.random()*Math.PI*2)*(1.2+Math.random()*4.2), vy:Math.sin(Math.random()*Math.PI*2)*(1.2+Math.random()*4.2), life:20, max:20, r:1.8+Math.random()*1.6, color:'#a78bfa', type:'star'}));
  a.push(...Array.from({length:4},()=>({x,y,vx:(Math.random()-0.5)*1.2, vy:(Math.random()-0.5)*1.2, life:14, max:14, r:3.2, color:'#ede9fe', type:'hit'})) as Particle[]);
  a.push({x, y:y-18, vx:0, vy:-0.9, life:28, max:28, r:0, color:'#a78bfa', type:'healText', text:'CRIT +6'} as Particle);
  return a as Particle[];
}
export function spawnHitCannon(x:number,y:number,color:string): Particle[] {
  const b = Array.from({length:14},()=>({x,y,vx:Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*4.6), vy:Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*4.6), life:22, max:22, r:2.2+Math.random()*1.8, color:color||'#ffb23e', type:'hit'}));
  b.push(...Array.from({length:4},()=>({x,y,vx:(Math.random()-0.5)*1.6, vy:-1.2-Math.random()*1.4, life:18, max:18, r:1.4, color:'#fb923c', type:'spark'})) as Particle[]);
  b.push({x, y:y-20, vx:0, vy:-0.8, life:26, max:26, r:0, color:'#ffb23e', type:'healText', text:'BOOM -4'} as Particle);
  return b as Particle[];
}
export function spawnHitTrick(x:number,y:number,color:string,bounces:number): Particle[] {
  const c = Array.from({length:8},()=>({x,y,vx:Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*3.2), vy:Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*3.2), life:16, max:16, r:1.5+Math.random()*1.2, color:color||'#58d8ff', type:'hit'}));
  const dmg = trickDmgAt(bounces); c.push({x, y:y-16, vx:0, vy:-0.7, life:22, max:22, r:0, color:'#58d8ff', type:'healText', text:`-${dmg}`} as Particle);
  return c as Particle[];
}
export function spawnHitLava(x:number,y:number): Particle[] {
  return Array.from({length:10},()=>({x,y,vx:Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*3), vy:Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*3), life:18, max:18, r:1.7+Math.random()*1.4, color:'#fb923c', type:'hit'}))
    .concat([{x,y:y-18,vx:0,vy:-0.6,life:26,max:26,r:0,color:'#fb923c',type:'healText',text:'-2 LAVA'}] as Particle[]);
}
export function spawnHitVoid(x:number,y:number): Particle[] {
  return Array.from({length:9},()=>({x,y,vx:Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*2.8), vy:Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*2.8), life:18, max:18, r:1.5+Math.random()*1.2, color:'#c9ff2f', type:'hit'}))
    .concat([{x,y:y-18,vx:0,vy:-0.6,life:26,max:26,r:0,color:'#c9ff2f',type:'healText',text:'VOID -1'}] as Particle[]);
}
export function spawnBounceSpark(x:number,y:number,color?:string): Particle[] {
  return Array.from({length:6},()=>({x,y,vx:Math.cos(Math.random()*Math.PI*2)*(1+Math.random()*2.2), vy:Math.sin(Math.random()*Math.PI*2)*(1+Math.random()*2.2), life:12, max:12, r:1.4, color:color||'#58d8ff', type:'spark'}));
}
export function trickDmgAt(bounces:number){ const t=[2.5,2,1.6,1.2,0.8,0.5]; return t[Math.min(bounces,5)]; }
export function damageShake(p:{squish:number}, intensity=1){ p.squish = Math.max(p.squish, 6 + intensity*4); }
