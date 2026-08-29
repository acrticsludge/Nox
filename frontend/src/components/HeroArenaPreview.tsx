import { useEffect, useRef } from 'react'

export default function HeroArenaPreview() {
  const svgRef = useRef<SVGSVGElement>(null)
  const phaseRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    const phaseEl = phaseRef.current
    const barEl = barRef.current
    if (!svg) return

    const PLAYER_R = 16
    const GRID = 40, COLS = 24, ROWS = 14
    const DASH_TIME = 16, DASH_COOLDOWN = 60
    const POWER_TYPES: Record<string, { color: string; bg: string; icon: string }> = {
      overcharge: { color: '#ffb23e', bg: '#ff9d2e', icon: '⚡' },
      shield: { color: '#58d8ff', bg: '#3ec5f2', icon: '❄' },
      blink: { color: '#c9ff2f', bg: '#c9ff2f', icon: '✦' },
      heal: { color: '#22c55e', bg: '#16a34a', icon: '✚' },
    }
    const BULLET_TYPES: Record<string, { speed: number; r: number; cd: number; life: number; bounces: number }> = {
      standard: { speed: 7.2, r: 5, cd: 11, life: 90, bounces: 0 },
      needle: { speed: 8.5, r: 3.5, cd: 14, life: 90, bounces: 0 },
      cannon: { speed: 3.8, r: 7, cd: 32, life: 120, bounces: 0 },
      trick: { speed: 6.2, r: 4, cd: 16, life: 180, bounces: 5 },
    }
    const AMMO_PICKUP_CFG: Record<string, { color: string; bg: string; icon: string }> = {
      ammo_needle: { color: '#a78bfa', bg: '#7c3aed', icon: 'N' },
      ammo_cannon: { color: '#ffb23e', bg: '#ff9d2e', icon: 'C' },
      ammo_trick: { color: '#58d8ff', bg: '#3ec5f2', icon: 'T' },
    }

    const REQUIRED_WALL_GAP = 34
    const wallGap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
      const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)))
      const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)))
      if (dx === 0 && dy === 0) return -1
      if (dx === 0) return dy
      if (dy === 0) return dx
      return Math.hypot(dx, dy)
    }
    let walls: { x: number; y: number; w: number; h: number; rx?: number; isBorder?: boolean }[] = []
    const genWalls = () => {
      walls = [
        { x: 0, y: 0, w: 960, h: 10, isBorder: true }, { x: 0, y: 550, w: 960, h: 10, isBorder: true },
        { x: 0, y: 10, w: 10, h: 540, isBorder: true }, { x: 950, y: 10, w: 10, h: 540, isBorder: true },
      ]
      const occ = new Set<string>(); const key = (c: number, r: number) => `${c},${r}`
      const protectedCells = new Set<string>()
      ;[[3,7],[4,7],[20,7],[19,7],[11,7],[12,7],[11,6],[12,6],[12,8],[11,8]].forEach(([c,r])=>{for(let dc=-1;dc<=1;dc++)for(let dr=-1;dr<=1;dr++)protectedCells.add(key(c+dc,r+dr))})
      const canPlace = (c: number, r: number, len: number, isHoriz: boolean) => {
        const cells: [number, number][] = []
        for(let k=0;k<len;k++){const cc=isHoriz?c+k:c, rr=isHoriz?r:r+k; if(cc<0||cc>=COLS||rr<0||rr>=ROWS) return null; if(protectedCells.has(key(cc,rr))) return null; if(occ.has(key(cc,rr))) return null; for(let dc=-1;dc<=1;dc++)for(let dr=-1;dr<=1;dr++){if(dc===0&&dr===0)continue; if(occ.has(key(cc+dc,rr+dr))) return null} cells.push([cc,rr])}
        return cells
      }
      const target = 8 + Math.floor(Math.random()*4)
      let placed=0
      for(let a=0;a<200 && placed<target;a++){
        const isHoriz=Math.random()<0.5; const len=2+Math.floor(Math.random()*4)
        const cMax=COLS-(isHoriz?len:1)-1, rMax=ROWS-(isHoriz?1:len)-1
        if(cMax<2||rMax<2) continue
        const c=1+Math.floor(Math.random()*(cMax)), r=1+Math.floor(Math.random()*(rMax))
        const cells=canPlace(c,r,len,isHoriz); if(!cells) continue
        let x,y,w,h
        if(isHoriz){ x=c*GRID; y=r*GRID-6; w=len*GRID; h=12 } else { x=c*GRID-6; y=r*GRID; w=12; h=len*GRID }
        const nw={x,y,w,h}
        if(walls.some(ew=>{const g=wallGap(nw,ew); return g!==-1 && g<REQUIRED_WALL_GAP})) continue
        cells.forEach(([cc,rr])=>occ.add(key(cc,rr)))
        walls.push({x,y,w,h,rx:6}); placed++
      }
      if(placed<6){
        walls.push({x:6*GRID-6,y:4*GRID,w:12,h:6*GRID,rx:6},{x:18*GRID-6,y:4*GRID,w:12,h:6*GRID,rx:6},{x:8*GRID,y:4*GRID-6,w:8*GRID,h:12,rx:6},{x:8*GRID,y:10*GRID-6,w:8*GRID,h:12,rx:6})
      }
    }
    genWalls()

    type Haz = { x: number; y: number; w: number; h: number; kind: 'lava' | 'slime'; t: number }
    const hazards: Haz[] = []
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
    const len2 = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)
    const rectCircle = (cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number) => {
      const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh); const dx = cx - nx, dy = cy - ny; return dx*dx+dy*dy < cr*cr
    }
    const wallsCollide = (x: number, y: number, r: number) => walls.some(w => rectCircle(x,y,r,w.x,w.y,w.w,w.h))
    {
      const kinds: ('lava'|'slime')[] = ['lava','lava','slime','slime','lava']
      const spots = [[12,6],[18,9],[5,10],[17,3],[9,7]]
      spots.forEach(([c,r],i)=>{ hazards.push({ x: c*GRID+2, y: r*GRID+2, w:36, h:36, kind: kinds[i % kinds.length], t: Math.random()*300 }) })
    }
    const isLavaActive = (h: Haz) => { const m=h.t%300; return m>=120 && m<228 }
    const isLavaWarn = (h: Haz) => { const m=h.t%300; return m<120 }

    type P = { x:number; y:number; ang:number; dash:number; inv:number; dashCd:number; shield:boolean; shieldHp:number; overcharge:number; speedBoost:number; extraDash:number; color:string; id:number }
    const players: P[] = [
      { x:140,y:280,ang:0,dash:0,inv:0,dashCd:0,shield:false,shieldHp:0,overcharge:0,speedBoost:0,extraDash:0,color:'#58d8ff',id:0 },
      { x:820,y:280,ang:Math.PI,dash:0,inv:0,dashCd:0,shield:false,shieldHp:0,overcharge:0,speedBoost:0,extraDash:0,color:'#ff5ca8',id:1 },
    ]
    type PU = { x:number; y:number; kind:string; t:number }
    let pickups: PU[] = [
      { x:480,y:280,kind:'overcharge',t:0 },
      { x:320,y:180,kind:'shield',t:1.2 },
      { x:640,y:380,kind:'heal',t:2.4 },
    ]
    const puKinds = ['overcharge','shield','blink','heal','ammo_needle','ammo_cannon','ammo_trick']
    const anchors = [{x:480,y:280},{x:320,y:280},{x:640,y:280},{x:480,y:180},{x:480,y:380},{x:240,y:140},{x:720,y:420}]
    let pickupIdx=0

    type B = { x:number; y:number; vx:number; vy:number; owner:number; type:string; r:number; life:number; trail:{x:number;y:number}[]; bounces:number; dmg?:number }
    let bullets: B[] = []
    type Pt = { x:number; y:number; vx:number; vy:number; life:number; max:number; r:number; col:string }
    let particles: Pt[] = []

    const spawnParticles = (x:number,y:number,col:string,n=8) => {
      for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, s=1+Math.random()*3.2; particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:14,max:14,r:1.6+Math.random()*1.4,col}) }
    }
    const pushOut = (p:P) => {
      p.x=clamp(p.x,10+PLAYER_R,950-PLAYER_R); p.y=clamp(p.y,10+PLAYER_R,550-PLAYER_R)
      for(let iter=0;iter<3;iter++) for(const w of walls){
        if(!rectCircle(p.x,p.y,PLAYER_R,w.x,w.y,w.w,w.h)) continue
        const cx=clamp(p.x,w.x,w.x+w.w), cy=clamp(p.y,w.y,w.y+w.h); let dx=p.x-cx, dy=p.y-cy, d=Math.hypot(dx,dy)
        if(d<0.1){ dx=(Math.random()-0.5); dy=(Math.random()-0.5); d=Math.hypot(dx,dy) }
        const need=PLAYER_R-d+0.8; if(need>0){ p.x+=(dx/d)*need; p.y+=(dy/d)*need }
      }
    }
    const shoot = (pIdx:number, type:string) => {
      const p=players[pIdx]; const cfg=BULLET_TYPES[type] || BULLET_TYPES.standard
      const ang=p.ang + (Math.random()-0.5)*0.04
      const mx=p.x + Math.cos(ang)*18, my=p.y + Math.sin(ang)*18
      bullets.push({ x:mx,y:my, vx:Math.cos(ang)*cfg.speed, vy:Math.sin(ang)*cfg.speed, owner:pIdx, type, r:cfg.r, life:cfg.life, trail:[], bounces:0 })
      spawnParticles(mx,my, type==='needle'?'#a78bfa':type==='cannon'?'#ffb23e':type==='trick'?'#58d8ff':p.color, 6)
    }

    const gWalls = svg.querySelector('#pv-walls') as SVGGElement
    const gHaz = svg.querySelector('#pv-hazards') as SVGGElement
    const gVoid = svg.querySelector('#pv-void') as SVGGElement
    const hole = svg.querySelector('#pv-voidHole') as SVGCircleElement
    const ring = svg.querySelector('#pv-ring') as SVGCircleElement
    const ring2 = svg.querySelector('#pv-ring2') as SVGCircleElement
    const gPick = svg.querySelector('#pv-pickups') as SVGGElement
    const gBul = svg.querySelector('#pv-bullets') as SVGGElement
    const gPlay = svg.querySelector('#pv-players') as SVGGElement
    const gPart = svg.querySelector('#pv-particles') as SVGGElement

    const drawWallsStatic = () => {
      if(!gWalls) return
      gWalls.innerHTML=''
      const frame=document.createElementNS('http://www.w3.org/2000/svg','path')
      frame.setAttribute('d','M0 0 H960 V560 H0 Z M10 10 H950 V550 H10 Z')
      frame.setAttribute('fill','#0f172a'); frame.setAttribute('fill-rule','evenodd')
      frame.setAttribute('stroke','rgba(27,36,39,0.9)'); frame.setAttribute('stroke-width','1')
      gWalls.appendChild(frame)
      const hl=document.createElementNS('http://www.w3.org/2000/svg','path')
      hl.setAttribute('d','M10 11 H950 M10 549 H950 M11 10 V550 M949 10 V550')
      hl.setAttribute('fill','none'); hl.setAttribute('stroke','rgba(255,255,255,0.07)'); hl.setAttribute('stroke-width','1'); hl.setAttribute('opacity','0.9')
      gWalls.appendChild(hl)
      walls.forEach(w=>{
        if(w.isBorder) return
        const r=document.createElementNS('http://www.w3.org/2000/svg','rect')
        r.setAttribute('x',String(w.x)); r.setAttribute('y',String(w.y)); r.setAttribute('width',String(w.w)); r.setAttribute('height',String(w.h))
        r.setAttribute('rx',String(w.rx??2)); r.setAttribute('fill','url(#pv-wallGrad)'); r.setAttribute('stroke','rgba(27,36,39,0.85)'); r.setAttribute('stroke-width','1')
        if(w.w>100||w.h>100) r.setAttribute('opacity','0.96')
        gWalls.appendChild(r)
        const hhl=document.createElementNS('http://www.w3.org/2000/svg','rect')
        hhl.setAttribute('x',String(w.x+1.5)); hhl.setAttribute('y',String(w.y+1)); hhl.setAttribute('width',String(Math.max(0,w.w-3))); hhl.setAttribute('height','1.5')
        hhl.setAttribute('rx','1'); hhl.setAttribute('fill','rgba(255,255,255,0.09)'); hhl.setAttribute('opacity','0.9')
        gWalls.appendChild(hhl)
      })
    }
    drawWallsStatic()

    let raf=0; let start=performance.now(); const LOOP=30000
    const phases=[{t:0,label:'SPAWN // 2 PLAYERS'},{t:4000,label:'MOVE + DASH'},{t:8000,label:'STANDARD FIRE'},{t:12000,label:'NEEDLE // FLANK'},{t:16000,label:'CANNON // HEAVY'},{t:19000,label:'TRICK // BOUNCE'},{t:22000,label:'ORBS + HAZARDS'},{t:26000,label:'VOID // CLOSING'}]
    const phaseFor=(ms:number)=>{ for(let i=phases.length-1;i>=0;i--) if(ms>=phases[i].t) return phases[i].label; return phases[0].label }
    let shootCd=[0,0], dashCd=[0,0]; let voidR=420, safeR=999
    let lastDraw = performance.now()

    const frame = (now: number) => {
      raf=requestAnimationFrame(frame)
      // throttle to ~60fps so it is not 3× on 144Hz - regular speed
      if (now - lastDraw < 15) return
      lastDraw = now
      try {
        const loopT=(now-start)%LOOP
        if(phaseEl) phaseEl.textContent=phaseFor(loopT)
        if(barEl) barEl.style.transform=`scaleX(${loopT/LOOP})`
        if(loopT<16){
          players[0].x=140; players[0].y=280; players[0].ang=0; players[0].shield=false; players[0].shieldHp=0; players[0].dash=0; players[0].inv=0; players[0].overcharge=0
          players[1].x=820; players[1].y=280; players[1].ang=Math.PI; players[1].shield=true; players[1].shieldHp=5; players[1].dash=0; players[1].inv=0
          bullets=[]; particles=[]; pickups=[{x:480,y:280,kind:'overcharge',t:0},{x:320,y:180,kind:'shield',t:0},{x:640,y:380,kind:'heal',t:0}]
          voidR=420; safeR=999; shootCd=[0,0]; dashCd=[0,0]
        }
        if(Math.floor(loopT/5000)!==pickupIdx){
          pickupIdx=Math.floor(loopT/5000)
          const kind=puKinds[pickupIdx%puKinds.length]
          const a=anchors[(pickupIdx*3)%anchors.length]
          if(a && pickups.length<4 && !pickups.some(p=>p && Math.abs(p.x-a.x)<30)){
            pickups.push({x:a.x+(Math.random()*20-10),y:a.y+(Math.random()*20-10),kind,t:0})
          }
        }
        hazards.forEach(h=>{ if(h) h.t+=1 })
        if(loopT>22000){ const p=(loopT-22000)/8000; voidR=420-p*(420-110); safeR=voidR; if(gVoid) gVoid.setAttribute('opacity','1') } else { voidR=420; safeR=999; if(gVoid) gVoid.setAttribute('opacity', loopT>20000?'0.7':'0') }
        if(hole) hole.setAttribute('r',String(voidR))
        if(ring){ ring.setAttribute('r',String(voidR)); ring.setAttribute('stroke-dashoffset',String((now/14)%17)); ring.setAttribute('transform',`rotate(${(now/28)%360} 480 280)`) }
        if(ring2){ ring2.setAttribute('r',String(voidR)); ring2.setAttribute('stroke-dashoffset',String((now/10)%13)); ring2.setAttribute('transform',`rotate(${-(now/38)%360} 480 280)`) }

        const t=now*0.001
        const targets=[{x:480+Math.cos(t*0.7)*220+Math.sin(t*0.3)*40,y:280+Math.sin(t*0.9)*130},{x:480+Math.cos(t*0.7+Math.PI)*200+Math.cos(t*0.4)*30,y:280+Math.sin(t*0.9+Math.PI)*120}]
        players.forEach((p,i)=>{
          if(!p) return
          const other=players[1-i]; if(!other) return
          const tgt=targets[i]
          p.ang=Math.atan2(other.y - p.y, other.x - p.x)
          if(dashCd[i]>0) dashCd[i]--; if(p.dash>0) p.dash--; if(p.inv>0) p.inv--
          const wantDash=(loopT>4000 && loopT<8000 && Math.random()<0.025) || (loopT>22000 && Math.random()<0.02)
          if(wantDash && dashCd[i]===0 && p.dash===0){ p.dash=DASH_TIME; p.inv=DASH_TIME+4; dashCd[i]=DASH_COOLDOWN; spawnParticles(p.x,p.y,p.color,7) }
          const spd=p.dash>0 ? 3.6*2.35 : 3.6
          let dx=tgt.x-p.x, dy=tgt.y-p.y; const d=Math.hypot(dx,dy)
          if(d>2){ dx/=d; dy/=d; p.x+=dx*spd; p.y+=dy*spd }
          const inSlime=hazards.some(h=>h && h.kind==='slime' && p.x>=h.x && p.x<=h.x+h.w && p.y>=h.y && p.y<=h.y+h.h)
          if(inSlime){ p.x-=dx*spd*0.45; p.y-=dy*spd*0.45 }
          const dVoid=Math.hypot(p.x-480,p.y-280)
          if(dVoid>safeR-PLAYER_R){ const ang=Math.atan2(p.y-280,p.x-280); p.x=480+Math.cos(ang)*(safeR-PLAYER_R-1); p.y=280+Math.sin(ang)*(safeR-PLAYER_R-1); if(Math.random()<0.04) spawnParticles(p.x,p.y,'#c9ff2f',5) }
          pushOut(p)
          if(shootCd[i]>0) shootCd[i]--
          let bType='standard'
          if(loopT>12000 && loopT<16000) bType='needle'
          else if(loopT>16000 && loopT<19000) bType='cannon'
          else if(loopT>19000 && loopT<22000) bType='trick'
          else if(loopT>8000) bType='standard'
          const cfg=BULLET_TYPES[bType] || BULLET_TYPES.standard
          if(shootCd[i]===0 && loopT>3000){
            const dot=Math.cos(p.ang - Math.atan2(other.y-p.y, other.x-p.x))
            if(dot>0.2 || Math.random()<0.18){
              shoot(i,bType); shootCd[i]=cfg.cd + (Math.random()*3|0)
            }
          }
          if(loopT>22000 && loopT<24000 && i===0 && p.overcharge===0 && Math.random()<0.015){
            p.overcharge=90; spawnParticles(p.x,p.y,'#ffb23e',10)
          }
          if(p.overcharge>0) p.overcharge--
          for(let k=pickups.length-1;k>=0;k--){
            const pu=pickups[k]
            if(!pu) continue
            if(len2(p.x,p.y,pu.x,pu.y)<26){
              if(pu.kind==='shield'){ p.shield=true; p.shieldHp=5 }
              else if(pu.kind==='overcharge'){ p.overcharge=120 }
              spawnParticles(pu.x,pu.y, pu.kind==='overcharge'?'#ffb23e':pu.kind==='shield'?'#58d8ff':pu.kind==='heal'?'#22c55e':'#a78bfa', 12)
              pickups.splice(k,1)
            }
          }
        })

        for(let i=bullets.length-1;i>=0;i--){
          const b=bullets[i]; if(!b) continue
          const trailLen=b.type==='cannon'?6:b.type==='needle'?2:b.type==='trick'?5:4
          b.trail.unshift({x:b.x,y:b.y}); if(b.trail.length>trailLen) b.trail.pop()
          b.x+=b.vx; b.y+=b.vy; b.life--
          let hitWall=walls.some(w=>w && rectCircle(b.x,b.y,b.r,w.x,w.y,w.w,w.h))
          if(hitWall){
            if(b.type==='trick' && b.bounces<5){
              let nx=0,ny=0, best=Infinity
              for(const w of walls){ if(!w || !rectCircle(b.x,b.y,b.r+1,w.x,w.y,w.w,w.h)) continue; const cx=clamp(b.x,w.x,w.x+w.w), cy=clamp(b.y,w.y,w.y+w.h); const d=Math.hypot(b.x-cx,b.y-cy); if(d<best){best=d; nx=b.x-cx; ny=b.y-cy} }
              const nl=Math.hypot(nx,ny)||1; nx/=nl; ny/=nl; const dot=b.vx*nx+b.vy*ny; b.vx=(b.vx-2*dot*nx)*0.97; b.vy=(b.vy-2*dot*ny)*0.97; b.x+=nx*3; b.y+=ny*3; b.bounces++; spawnParticles(b.x,b.y,'#58d8ff',5); continue
            }
            spawnParticles(b.x,b.y,b.type==='cannon'?'#ffb23e':b.type==='needle'?'#a78bfa':'#58d8ff',6)
            bullets.splice(i,1); continue
          }
          if(b.life<=0 || b.x<-20 || b.x>980 || b.y<-20 || b.y>580){ bullets.splice(i,1); continue }
          for(const p of players){
            if(!p || p.inv>0) continue; if(b.owner===(p===players[0]?0:1)) continue
            if(len2(b.x,b.y,p.x,p.y) < PLAYER_R + b.r){
              if(p.shield){
                p.shieldHp--; if(p.shieldHp<=0){ p.shield=false; p.shieldHp=0 }
                spawnParticles(b.x,b.y,'#58d8ff',10); p.inv=14
              } else {
                spawnParticles(b.x,b.y,b.type==='cannon'?'#ffb23e':b.type==='needle'?'#a78bfa':p.color,10); p.inv=18
                if(Math.random()<0.06){ p.shield=true; p.shieldHp=5; setTimeout(()=>{p.shield=false},700) }
              }
              bullets.splice(i,1); break
            }
          }
        }
        for(let i=particles.length-1;i>=0;i--){ const pt=particles[i]; if(!pt) continue; pt.x+=pt.vx; pt.y+=pt.vy; pt.vx*=0.96; pt.vy*=0.96; pt.life--; if(pt.life<=0) particles.splice(i,1) }
        pickups.forEach(p=>{ if(p) (p as any).t = ((p as any).t || 0) + 0.14 })

        if(gHaz){
          let h=''
          for(const hz of hazards){
            if(!hz) continue
            if(hz.kind==='slime'){
              h+=`<g><rect x="${hz.x}" y="${hz.y}" width="36" height="36" rx="8" fill="url(#pv-slimeGrad)" stroke="rgba(110,231,183,0.22)" stroke-width="1"/><circle cx="${hz.x+10}" cy="${hz.y+11}" r="3.2" fill="rgba(255,255,255,0.22)"/><circle cx="${hz.x+26}" cy="${hz.y+24}" r="2.1" fill="rgba(255,255,255,0.16)"/><ellipse cx="${hz.x+18}" cy="${hz.y+28}" rx="7" ry="3" fill="rgba(16,185,129,0.18)"/><text x="${hz.x+18}" y="${hz.y+33}" text-anchor="middle" font-size="7" font-family="JetBrains Mono, monospace" fill="rgba(255,255,255,0.55)">SLIME</text></g>`
            } else {
              const active=isLavaActive(hz), warn=isLavaWarn(hz); const r=active?15.6:14
              h+=`<circle cx="${hz.x+18}" cy="${hz.y+18}" r="${r}" fill="url(#pv-lavaGrad)" opacity="${active?1:warn?0.78:0.42}" stroke="${active?'#fff':'#fb923c'}" stroke-width="${active?1.4:1}" stroke-opacity="${active?0.85:0.5}" ${active?'filter="url(#pv-softGlow)"':''}/>`
              if(warn) h+=`<circle cx="${hz.x+18}" cy="${hz.y+18}" r="18" fill="none" stroke="#fb923c" stroke-width="1" stroke-dasharray="3 4" opacity="0.55"/>`
              h+=`<text x="${hz.x+18}" y="${active?hz.y+32:hz.y+33}" text-anchor="middle" font-size="7" font-family="JetBrains Mono, monospace" fill="${active?'#fff':'rgba(255,255,255,0.55)'}">${active?'LAVA':'VENT'}</text>`
              if(active) h+=`<circle cx="${hz.x+18+Math.sin(hz.t*0.18)*2}" cy="${hz.y+18+Math.cos(hz.t*0.2)*2}" r="2.1" fill="#fff" opacity="0.9"/>`
            }
          }
          gHaz.innerHTML=h
        }
        if(gPick){
          let s=''
          for(const pu of pickups){
            if(!pu) continue
            const cfg = (POWER_TYPES[pu.kind] || AMMO_PICKUP_CFG[pu.kind] || POWER_TYPES.overcharge) as any
            if(!cfg) continue
            const bob=Math.sin((pu as any).t || 0)*2.2
            s+=`<g transform="translate(${pu.x},${pu.y + bob})">`
            s+=`<circle r="${18 * (1+Math.sin((pu as any).t||0)*0.02)}" fill="${cfg.color}" opacity="0.18" filter="url(#pv-softGlow)"/>`
            s+=`<circle r="13" fill="${cfg.bg}" stroke="#fff" stroke-width="2" filter="url(#pv-softGlow)"/>`
            s+=`<text text-anchor="middle" dy="5" font-size="13" font-weight="800" fill="#fff">${cfg.icon}</text>`
            for(let i=0;i<3;i++){ const ang=(pu as any).t*0.85 + i*2.094; s+=`<circle cx="${Math.cos(ang)*19}" cy="${Math.sin(ang)*19}" r="2.5" fill="${cfg.color}" opacity="0.9"/>` }
            const lab = pu.kind.indexOf('ammo_')===0 ? (pu.kind==='ammo_needle'?'NEEDLE':pu.kind==='ammo_cannon'?'CANNON':'TRICK') : (pu.kind==='overcharge'?'TRI':pu.kind==='shield'?'SHLD':pu.kind==='heal'?'HEAL':'BLNK')
            s+=`<text y="26" text-anchor="middle" font-size="7" font-family="JetBrains Mono, monospace" fill="#fff" opacity="0.7">${lab}</text>`
            s+=`</g>`
          }
          gPick.innerHTML=s
        }
        if(gBul){
          let b=''
          for(const bl of bullets){
            if(!bl) continue
            const type=bl.type||'standard'
            const tcol=type==='needle'?'#a78bfa':type==='cannon'?'#ffb23e':type==='trick'?'#58d8ff':bl.owner===0?'#58d8ff':'#ff5ca8'
            bl.trail.forEach((t,i)=>{
              const rTrail=type==='cannon'?(4.2-i*0.5):type==='needle'?(2.1-i*0.4):(3-i*0.5)
              const op=type==='cannon'?(0.42-i*0.06):(0.35-i*0.07)
              b+=`<circle cx="${t.x}" cy="${t.y}" r="${Math.max(0.6,rTrail)}" fill="${tcol}" opacity="${op}"/>`
            })
            if(type==='trick'){
              const s=bl.r
              b+=`<path d="M ${bl.x} ${bl.y - s} L ${bl.x + s} ${bl.y} L ${bl.x} ${bl.y + s} L ${bl.x - s} ${bl.y} Z" fill="#fff" stroke="#58d8ff" stroke-width="1.6" filter="url(#pv-softGlow)"/>`
              b+=`<circle cx="${bl.x}" cy="${bl.y}" r="1.2" fill="#a9e9ff"/>`
            } else if(type==='cannon'){
              b+=`<rect x="${bl.x - bl.r}" y="${bl.y - bl.r*0.7}" width="${bl.r*2}" height="${bl.r*1.4}" rx="2" fill="#fff" stroke="#ffb23e" stroke-width="2" filter="url(#pv-softGlow)"/>`
              b+=`<circle cx="${bl.x}" cy="${bl.y}" r="2.4" fill="#fb923c"/>`
            } else if(type==='needle'){
              b+=`<circle cx="${bl.x}" cy="${bl.y}" r="${bl.r}" fill="#fff" stroke="#a78bfa" stroke-width="1.8" filter="url(#pv-softGlow)"/>`
              b+=`<circle cx="${bl.x}" cy="${bl.y}" r="1.2" fill="#ede9fe"/>`
            } else {
              b+=`<circle cx="${bl.x}" cy="${bl.y}" r="${bl.r}" fill="#fff" stroke="${bl.owner===0?'#58d8ff':'#ff5ca8'}" stroke-width="2" filter="${bl.owner===0?'url(#pv-glowCyan)':'url(#pv-glowPink)'}"/>`
              b+=`<circle cx="${bl.x}" cy="${bl.y}" r="2" fill="${bl.owner===0?'#a9e9ff':'#ff9ec9'}"/>`
            }
          }
          gBul.innerHTML=b
        }
        if(gPlay){
          let p=''
          for(let i=0;i<players.length;i++){
            const pl=players[i]; if(!pl) continue
            const isInv = pl.inv>0 && Math.floor(pl.inv/4)%2===0
            const op=isInv?0.35:1
            p+=`<g transform="translate(${pl.x},${pl.y}) rotate(${pl.ang*180/Math.PI})" opacity="${op}">`
            p+=`<ellipse cx="2" cy="10" rx="14" ry="6" fill="rgba(0,0,0,0.35)" filter="url(#pv-softGlow)"/>`
            const fill = pl.id===0 ? '#3ec5f2' : '#f43f5e'
            const filt = pl.id===0 ? 'url(#pv-glowCyan)' : 'url(#pv-glowPink)'
            p+=`<path d="M 18 0 L -12 -11 L -8 0 L -12 11 Z" fill="${fill}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" filter="${filt}"/>`
            p+=`<circle cx="0" cy="0" r="5.5" fill="#fff" opacity="0.95"/><circle cx="0.8" cy="-1" r="2" fill="${pl.color}"/>`
            if(pl.dash>0) p+=`<path d="M -12 0 L -22 -6 L -26 0 L -22 6 Z" fill="${pl.id===0?'#a9e9ff':'#ff9ec9'}" opacity="0.9"/>`
            if(pl.overcharge>0) p+=`<circle cx="0" cy="0" r="20" fill="none" stroke="#ffb23e" stroke-width="2" stroke-dasharray="4 4" opacity="0.85" transform="rotate(${(now/12)%360})"/>`
            if(pl.shield){
              const hp=pl.shieldHp||5; let dash='6 3', o='0.92', sw='2.6'
              if(hp===2){dash='6 7'; o='0.68'; sw='2.2'} else if(hp===1){dash='3.5 9'; o='0.42'; sw='1.8'}
              p+=`<circle cx="0" cy="0" r="22" fill="none" stroke="#58d8ff" stroke-width="${sw}" opacity="${o}" stroke-dasharray="${dash}" stroke-linecap="round" ${hp===1?`transform="rotate(${(now/14)%360})"`:''}/>`
              p+=`<circle cx="0" cy="0" r="24" fill="#58d8ff" opacity="${hp===1?0.06:hp===2?0.09:0.13}"/>`
            }
            if(pl.speedBoost>0) p+=`<circle cx="0" cy="0" r="18" fill="none" stroke="#c9ff2f" stroke-width="2" opacity="0.8" stroke-dasharray="2 5" transform="rotate(${(now/8)%360})"/>`
            p+=`</g>`
            const hpTxt = '12♥'
            p+=`<text x="${pl.x}" y="${pl.y+28}" text-anchor="middle" font-size="8" font-family="JetBrains Mono, monospace" fill="#fff" opacity="0.85" transform="rotate(${-pl.ang*180/Math.PI} ${pl.x} ${pl.y+28})">${hpTxt}</text>`
            if(pl.dashCd>0){
              const pct=(1-pl.dashCd/DASH_COOLDOWN)*24
              p+=`<g transform="translate(${pl.x-12},${pl.y-18})"><rect width="24" height="3" rx="2" fill="rgba(255,255,255,0.18)"/><rect width="${pct}" height="3" rx="2" fill="${pl.dashCd<10?'#22c55e':'#ff9d2e'}"/></g>`
            }
          }
          gPlay.innerHTML=p
        }
        if(gPart){
          let s=''
          for(const pt of particles){ if(!pt) continue; const a=pt.life/pt.max; s+=`<circle cx="${pt.x}" cy="${pt.y}" r="${pt.r*a}" fill="${pt.col}" opacity="${a}"/>` }
          gPart.innerHTML=s
        }
      } catch (e) {
        console.error('[PV] frame error', e)
      }
    }
    frame(performance.now())
    return ()=>cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="hero-preview-wrap" role="img" aria-label="Live preview of Neon Void arena - two players fighting, 30 second loop">
      <div className="hero-preview-frame">
        <div className="hero-preview-top">
          <span className="hero-preview-badge">▶ PREVIEW // 30S LOOP</span>
          <span ref={phaseRef} className="hero-preview-phase">SPAWN // 2 PLAYERS</span>
          <span className="hero-preview-live"><i className="live-dot" aria-hidden="true" /> LIVE</span>
        </div>
        <svg ref={svgRef} viewBox="0 0 960 560" xmlns="http://www.w3.org/2000/svg" className="hero-preview-svg">
          <defs>
            <filter id="pv-glowCyan" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b1"/><feColorMatrix type="matrix" values="0 0.6 1 0 0  0 0.7 1 0 0  1 1 1 0 0  0 0 0 1 0"/><feMerge><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="pv-glowPink" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b1"/><feColorMatrix type="matrix" values="1 0.3 0.5 0 0  0.2 0.2 0.6 0 0  0.8 0.3 0.7 0 0  0 0 0 1 0"/><feMerge><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="pv-softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
            <radialGradient id="pv-arenaGrad" cx="50%" cy="40%"><stop offset="0%" stopColor="#0f1218" stopOpacity="0.9"/><stop offset="100%" stopColor="#020617" stopOpacity="1"/></radialGradient>
            <linearGradient id="pv-wallGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#334155"/><stop offset="100%" stopColor="#0f172a"/></linearGradient>
            <pattern id="pv-gridPat" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(23,32,36,0.12)" strokeWidth="1"/></pattern>
            <radialGradient id="pv-lavaGrad" cx="50%" cy="50%"><stop offset="0%" stopColor="#fb923c"/><stop offset="38%" stopColor="#f97316"/><stop offset="70%" stopColor="#dc2626"/><stop offset="100%" stopColor="#7c2d12" stopOpacity="0.95"/></radialGradient>
            <radialGradient id="pv-slimeGrad" cx="50%" cy="45%"><stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.92"/><stop offset="55%" stopColor="#10b981" stopOpacity="0.75"/><stop offset="100%" stopColor="#065f46" stopOpacity="0.95"/></radialGradient>
            <radialGradient id="pv-voidEdge" cx="50%" cy="50%"><stop offset="68%" stopColor="transparent"/><stop offset="82%" stopColor="rgba(201,255,47,0.16)"/><stop offset="91%" stopColor="rgba(201,255,47,0.32)"/><stop offset="100%" stopColor="rgba(201,255,47,0.06)"/></radialGradient>
            <pattern id="pv-voidStars" width="48" height="48" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1" fill="rgba(201,255,47,0.14)"/><circle cx="28" cy="18" r="0.7" fill="rgba(88,216,255,0.12)"/><circle cx="36" cy="36" r="1.1" fill="rgba(255,92,168,0.09)"/><circle cx="8" cy="38" r="0.6" fill="rgba(255,255,255,0.07)"/></pattern>
            <pattern id="pv-voidBlocks" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#1a0b2e" opacity="0.52"/><rect x="12" y="12" width="12" height="12" fill="#1a0b2e" opacity="0.52"/><rect x="12" y="0" width="12" height="12" fill="#0f0f1a" opacity="0.58"/><rect x="0" y="12" width="12" height="12" fill="#0f0f1a" opacity="0.58"/></pattern>
            <filter id="pv-voidGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feColorMatrix type="matrix" values="1 0.9 0 0 0  0 1 0.9 0 0  0 0 1 0 0  0 0 0 1 0"/></filter>
            <mask id="pv-voidMask"><rect x="0" y="0" width="960" height="560" rx="18" fill="white"/><circle id="pv-voidHole" cx="480" cy="280" r="420" fill="black"/></mask>
          </defs>
          <rect x="0" y="0" width="960" height="560" rx="18" fill="url(#pv-arenaGrad)"/>
          <rect x="0" y="0" width="960" height="560" rx="18" fill="url(#pv-gridPat)" opacity="0.9"/>
          <rect x="0" y="0" width="960" height="560" rx="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2"/>
          <g opacity="0.22"><circle cx="480" cy="280" r="120" fill="none" stroke="#c9ff2f" strokeWidth="1" strokeDasharray="6 8"/><circle cx="480" cy="280" r="190" fill="none" stroke="#58d8ff" strokeWidth="1" strokeDasharray="2 10" opacity="0.5"/></g>
          <g id="pv-walls"/><g id="pv-hazards"/>
          <g id="pv-void" opacity="0" pointerEvents="none">
            <rect x="0" y="0" width="960" height="560" rx="18" fill="url(#pv-voidBlocks)" mask="url(#pv-voidMask)" opacity="0.72"/>
            <rect x="0" y="0" width="960" height="560" rx="18" fill="url(#pv-voidStars)" mask="url(#pv-voidMask)" opacity="0.38"/>
            <rect x="0" y="0" width="960" height="560" rx="18" fill="rgba(18,8,32,0.28)" mask="url(#pv-voidMask)"/>
            <rect x="0" y="0" width="960" height="560" rx="18" fill="url(#pv-voidEdge)" mask="url(#pv-voidMask)" opacity="0.92"/>
            <circle id="pv-ring" cx="480" cy="280" r="420" fill="none" stroke="#c9ff2f" strokeWidth="2.5" strokeDasharray="10 7" opacity="0.95" filter="url(#pv-voidGlow)"/>
            <circle id="pv-ring2" cx="480" cy="280" r="420" fill="none" stroke="#58d8ff" strokeWidth="1" strokeDasharray="2 11" opacity="0.45"/>
          </g>
          <g id="pv-pickups"/><g id="pv-bullets"/><g id="pv-players"/><g id="pv-particles"/>
        </svg>
        <div className="hero-preview-bar" aria-hidden="true"><div ref={barRef} className="hero-preview-bar__fill"/></div>
        <div className="hero-preview-caption"><span>Real match - no bots, just you vs a friend</span><span style={{opacity:0.7}}>Watch the dash, shots and hazards</span></div>
      </div>
      <div className="hero-preview-legend"><span style={{color:'#a78bfa'}}>◈ NEEDLE</span><span style={{color:'var(--nox-amber)'}}>■ CANNON</span><span style={{color:'var(--nox-cyan)'}}>◇ TRICK</span><span style={{color:'#d6e2e4'}}>● STANDARD</span></div>
    </div>
  )
}
