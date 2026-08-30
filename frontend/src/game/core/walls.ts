// NEON VOID // wall + hazard generators — reusable for 1v1, trials, preview
import { GRID, COLS, ROWS, TRIALS_COLS, TRIALS_ROWS, TRIALS_W, TRIALS_H, TRIALS_HAZARD_COUNT, TRIALS_WALL_TARGET, REQUIRED_WALL_GAP } from './constants';
import { wallGap } from './physics';
import type { Wall } from './physics';

export type Hazard = { c:number; r:number; x:number; y:number; w:number; h:number; kind:'lava'|'slime'; t:number; lavaCd?:number };

export function generateWalls1v1(): { walls: Wall[]; hazards: Hazard[] } {
  const walls: Wall[] = [
    {x:0, y:0, w:960, h:10, isBorder: true}, {x:0, y:550, w:960, h:10, isBorder: true},
    {x:0, y:10, w:10, h:540, isBorder: true}, {x:950, y:10, w:10, h:540, isBorder: true},
  ];
  const occ = new Set<string>(); const key=(c:number,r:number)=>`${c},${r}`;
  const protectedCells = new Set<string>();
  [[3,7],[4,7],[20,7],[19,7],[11,7],[12,7],[11,6],[12,6],[12,8],[11,8]].forEach(([c,r])=>{for(let dc=-1;dc<=1;dc++) for(let dr=-1;dr<=1;dr++) protectedCells.add(key(c+dc,r+dr))});

  function canPlace(c:number,r:number,len:number,isHoriz:boolean){
    const cells:[number,number][]=[];
    for(let k=0;k<len;k++){
      const cc=isHoriz?c+k:c, rr=isHoriz?r:r+k;
      if(cc<0||cc>=COLS||rr<0||rr>=ROWS) return null;
      if(protectedCells.has(key(cc,rr))) return null;
      if(occ.has(key(cc,rr))) return null;
      for(let dc=-1;dc<=1;dc++) for(let dr=-1;dr<=1;dr++){
        if(dc===0&&dr===0) continue;
        if(occ.has(key(cc+dc,rr+dr))) return null;
      }
      cells.push([cc,rr]);
    }
    return cells;
  }
  const target = 8 + Math.floor(Math.random()*4);
  let placed=0;
  for(let a=0;a<200 && placed<target;a++){
    const isHoriz=Math.random()<0.5; const len=2+Math.floor(Math.random()*4);
    const cMax=COLS-(isHoriz?len:1)-1, rMax=ROWS-(isHoriz?1:len)-1;
    if(cMax<2||rMax<2) continue;
    const c=1+Math.floor(Math.random()*(cMax-1+1)), r=1+Math.floor(Math.random()*(rMax-1+1));
    const cells=canPlace(c,r,len,isHoriz); if(!cells) continue;
    let x,y,w,h;
    if(isHoriz){ x=c*GRID; y=r*GRID-6; w=len*GRID; h=12; } else { x=c*GRID-6; y=r*GRID; w=12; h=len*GRID; }
    const nw={x,y,w,h} as Wall;
    if(!walls.every(ew=>{const g=wallGap(nw,ew); return g===-1 || g>=REQUIRED_WALL_GAP;})) continue;
    cells.forEach(([cc,rr])=>occ.add(key(cc,rr)));
    walls.push({x,y,w,h,rx:6}); placed++;
  }
  if(placed<6) walls.push(
    {x:6*GRID-6,y:4*GRID,w:12,h:6*GRID,rx:6},
    {x:18*GRID-6,y:4*GRID,w:12,h:6*GRID,rx:6},
    {x:8*GRID,y:4*GRID-6,w:8*GRID,h:12,rx:6},
    {x:8*GRID,y:10*GRID-6,w:8*GRID,h:12,rx:6}
  );

  const hazards: Hazard[] = [];
  const hCount = 4 + Math.floor(Math.random()*3);
  let hAttempts=0, hPlaced=0;
  while(hPlaced<hCount && hAttempts<90){
    hAttempts++;
    const c=1+Math.floor(Math.random()*(COLS-2)), r=1+Math.floor(Math.random()*(ROWS-2));
    const k=key(c,r);
    if(occ.has(k)||protectedCells.has(k)) continue;
    let adj=false;
    for(let dc=-1;dc<=1;dc++) for(let dr=-1;dr<=1;dr++){
      if(dc===0&&dr===0) continue;
      if(occ.has(key(c+dc,r+dr))){ adj=true; break; }
    }
    if(adj) continue;
    const kind=Math.random()<0.5?'lava':'slime';
    hazards.push({c,r,x:c*GRID+2,y:r*GRID+2,w:36,h:36,kind,t:Math.random()*300,lavaCd:0} as Hazard);
    occ.add(k); hPlaced++;
  }
  return { walls, hazards };
}

export function generateWallsTrials(): { walls: Wall[]; hazards: Hazard[] } {
  const walls: Wall[] = [
    {x:0, y:0, w:TRIALS_W, h:10, isBorder:true}, {x:0,y:TRIALS_H-10,w:TRIALS_W,h:10,isBorder:true},
    {x:0,y:10,w:10,h:TRIALS_H-20,isBorder:true}, {x:TRIALS_W-10,y:10,w:10,h:TRIALS_H-20,isBorder:true},
  ];
  const occ = new Set<string>(); const key=(c:number,r:number)=>`${c},${r}`;
  const protectedCells = new Set<string>();
  [[6,14],[7,14],[40,14],[41,14],[23,14],[24,14],[23,13],[24,13],[24,15],[23,15]].forEach(([c,r])=>{for(let dc=-1;dc<=1;dc++) for(let dr=-1;dr<=1;dr++) protectedCells.add(key(c+dc,r+dr))});
  function canPlace(c:number,r:number,len:number,isHoriz:boolean){
    const cells:[number,number][]=[];
    for(let k=0;k<len;k++){
      const cc=isHoriz?c+k:c, rr=isHoriz?r:r+k;
      if(cc<0||cc>=TRIALS_COLS||rr<0||rr>=TRIALS_ROWS) return null;
      if(protectedCells.has(key(cc,rr))) return null;
      if(occ.has(key(cc,rr))) return null;
      for(let dc=-1;dc<=1;dc++) for(let dr=-1;dr<=1;dr++){
        if(dc===0&&dr===0) continue;
        if(occ.has(key(cc+dc,rr+dr))) return null;
      }
      cells.push([cc,rr]);
    }
    return cells;
  }
  let placed=0;
  for(let a=0;a<400 && placed<TRIALS_WALL_TARGET;a++){
    const isHoriz=Math.random()<0.5; const len=2+Math.floor(Math.random()*5);
    const cMax=TRIALS_COLS-(isHoriz?len:1)-1, rMax=TRIALS_ROWS-(isHoriz?1:len)-1;
    if(cMax<2||rMax<2) continue;
    const c=1+Math.floor(Math.random()*(cMax-1+1)), r=1+Math.floor(Math.random()*(rMax-1+1));
    const cells=canPlace(c,r,len,isHoriz); if(!cells) continue;
    let x,y,w,h;
    if(isHoriz){x=c*GRID;y=r*GRID-6;w=len*GRID;h=12;} else {x=c*GRID-6;y=r*GRID;w=12;h=len*GRID;}
    const nw={x,y,w,h} as Wall;
    if(!walls.every(ew=>{const g=wallGap(nw,ew); return g===-1||g>=REQUIRED_WALL_GAP;})) continue;
    cells.forEach(([cc,rr])=>occ.add(key(cc,rr)));
    walls.push({x,y,w,h,rx:6}); placed++;
  }
  if(placed<12) walls.push(
    {x:12*GRID-6,y:8*GRID,w:12,h:12*GRID,rx:6},
    {x:36*GRID-6,y:8*GRID,w:12,h:12*GRID,rx:6},
    {x:16*GRID,y:8*GRID-6,w:16*GRID,h:12,rx:6},
    {x:16*GRID,y:20*GRID-6,w:16*GRID,h:12,rx:6},
    {x:8*GRID-6,y:14*GRID,w:12,h:8*GRID,rx:6},
    {x:40*GRID-6,y:14*GRID,w:12,h:8*GRID,rx:6},
  );

  // hazards for trials (separate to keep occ)
  const hazards: Hazard[] = [];
  const occ2 = new Set(occ);
  // add wall occ for hazards check
  walls.forEach(w=>{ if(!w.isBorder){ for(let cx=Math.floor(w.x/GRID);cx<=Math.floor((w.x+w.w)/GRID);cx++) for(let cy=Math.floor(w.y/GRID);cy<=Math.floor((w.y+w.h)/GRID);cy++) occ2.add(`${cx},${cy}`); }});
  const prot2 = new Set<string>();
  [[6,14],[7,14],[40,14],[41,14],[23,14],[24,14],[23,13],[24,13],[24,15],[23,15]].forEach(([c,r])=>{for(let dc=-2;dc<=2;dc++) for(let dr=-2;dr<=2;dr++) prot2.add(key(c+dc,r+dr))});
  let p2=0, att2=0;
  while(p2<TRIALS_HAZARD_COUNT && att2<200){
    att2++;
    const c=2+Math.floor(Math.random()*(TRIALS_COLS-4)), r=2+Math.floor(Math.random()*(TRIALS_ROWS-4));
    const k=key(c,r);
    if(occ2.has(k)||prot2.has(k)) continue;
    let adj=false; for(let dc=-1;dc<=1;dc++) for(let dr=-1;dr<=1;dr++){ if(dc===0&&dr===0) continue; if(occ2.has(key(c+dc,r+dr))){adj=true;break;} } if(adj) continue;
    const kind=Math.random()<0.5?'lava':'slime';
    hazards.push({c,r,x:c*GRID+2,y:r*GRID+2,w:36,h:36,kind,t:Math.random()*300,lavaCd:0} as Hazard);
    occ2.add(k); p2++;
  }
  return { walls, hazards };
}
