import { useEffect, useRef } from 'react'

// 1:1 preview of NEON VOID arena — 30s loop, same physics as game-logic.js
// Shows every highlight: dash, 4 bullets, pickups, lava/slime/void, shield/heal FX
export default function HeroArenaPreview() {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    const phaseEl = phaseRef.current
    const barEl = barRef.current
    if (!svg) return

    const W = 960, H = 560
    const PLAYER_R = 16
    const GRID = 40
    const COLS = 24, ROWS = 14

    // Walls — same generation principle as game (border + 8 inners, gap 34)
    const walls: { x: number; y: number; w: number; h: number; rx?: number; isBorder?: boolean }[] = [
      { x: 0, y: 0, w: 960, h: 10, isBorder: true }, { x: 0, y: 550, w: 960, h: 10, isBorder: true },
      { x: 0, y: 10, w: 10, h: 540, isBorder: true }, { x: 950, y: 10, w: 10, h: 540, isBorder: true },
      { x: 320, y: 160, w: 12, h: 120, rx: 6 }, { x: 640, y: 280, w: 12, h: 120, rx: 6 },
      { x: 200, y: 320, w: 160, h: 12, rx: 6 }, { x: 600, y: 180, w: 160, h: 12, rx: 6 },
      { x: 480 - 6, y: 100, w: 12, h: 80, rx: 6 }, { x: 480 - 6, y: 380, w: 12, h: 80, rx: 6 },
      { x: 240, y: 440, w: 120, h: 12, rx: 6 }, { x: 580, y: 440, w: 120, h: 12, rx: 6 },
    ]

    // Hazards
    type Haz = { x: number; y: number; w: number; h: number; kind: 'lava' | 'slime'; t: number }
    const hazards: Haz[] = [
      { x: 12 * GRID + 2, y: 6 * GRID + 2, w: 36, h: 36, kind: 'lava', t: 40 },
      { x: 18 * GRID + 2, y: 9 * GRID + 2, w: 36, h: 36, kind: 'lava', t: 180 },
      { x: 5 * GRID + 2, y: 10 * GRID + 2, w: 36, h: 36, kind: 'slime', t: 0 },
      { x: 17 * GRID - 6, y: 3 * GRID + 2, w: 36, h: 36, kind: 'slime', t: 0 },
    ]
    const isLavaActive = (h: Haz) => { const m = h.t % 300; return m >= 120 && m < 228 }
    const isLavaWarn = (h: Haz) => { const m = h.t % 300; return m < 120 }

    // Players
    type P = { x: number; y: number; ang: number; dash: number; inv: number; hp: number; shield: boolean; speed: number; col: string }
    const players: P[] = [
      { x: 140, y: 280, ang: 0, dash: 0, inv: 0, hp: 12, shield: false, speed: 3.6, col: '#58d8ff' },
      { x: 820, y: 280, ang: Math.PI, dash: 0, inv: 0, hp: 12, shield: false, speed: 3.6, col: '#ff5ca8' },
    ]

    // Pickups — anchors
    type PU = { x: number; y: number; kind: string; t: number; life: number }
    const puKinds = ['overcharge', 'shield', 'blink', 'heal', 'ammo_needle', 'ammo_cannon', 'ammo_trick']
    const anchors = [
      { x: 480, y: 280 }, { x: 320, y: 280 }, { x: 640, y: 280 },
      { x: 480, y: 180 }, { x: 480, y: 380 }, { x: 240, y: 140 }, { x: 720, y: 420 },
    ]
    let pickups: PU[] = []
    let pickupIdx = 0

    // Bullets
    type B = { x: number; y: number; vx: number; vy: number; owner: number; type: string; r: number; life: number; trail: { x: number; y: number }[]; bounces: number }
    const BULLET_CFG: Record<string, { speed: number; r: number; life: number; bounces: number }> = {
      standard: { speed: 7.2, r: 5, life: 90, bounces: 0 },
      needle: { speed: 8.5, r: 3.5, life: 90, bounces: 0 },
      cannon: { speed: 3.8, r: 7, life: 120, bounces: 0 },
      trick: { speed: 6.2, r: 4, life: 180, bounces: 5 },
    }
    let bullets: B[] = []

    // Particles
    type Pt = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; col: string }
    let particles: Pt[] = []

    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
    const len2 = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)
    const rectCircle = (cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number) => {
      const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh)
      const dx = cx - nx, dy = cy - ny
      return dx * dx + dy * dy < cr * cr
    }
    const wallsCollide = (x: number, y: number, r: number) => walls.some(w => rectCircle(x, y, r, w.x, w.y, w.w, w.h))

    const spawnParticles = (x: number, y: number, col: string, n = 8) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3.2
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 14, max: 14, r: 1.6 + Math.random() * 1.4, col })
      }
    }

    const pushOut = (p: P) => {
      p.x = clamp(p.x, 10 + PLAYER_R, 950 - PLAYER_R)
      p.y = clamp(p.y, 10 + PLAYER_R, 550 - PLAYER_R)
      for (let iter = 0; iter < 3; iter++) for (const w of walls) {
        if (!rectCircle(p.x, p.y, PLAYER_R, w.x, w.y, w.w, w.h)) continue
        const cx = clamp(p.x, w.x, w.x + w.w), cy = clamp(p.y, w.y, w.y + w.h)
        let dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy)
        if (d < 0.1) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); d = Math.hypot(dx, dy) }
        const need = PLAYER_R - d + 0.8
        if (need > 0) { p.x += (dx / d) * need; p.y += (dy / d) * need }
      }
    }

    const shoot = (pIdx: number, type: string) => {
      const p = players[pIdx]
      const cfg = BULLET_CFG[type] || BULLET_CFG.standard
      const ang = p.ang + (Math.random() - 0.5) * 0.04
      const mx = p.x + Math.cos(ang) * 18, my = p.y + Math.sin(ang) * 18
      const spread = type === 'over' ? [-0.22, 0, 0.22] : [0]
      // overcharge triple handled via type, but preview uses single
      const toFire = type === 'over' ? 3 : 1
      for (let s = 0; s < toFire; s++) {
        const a = ang + (s - 1) * 0.22 + (Math.random() - 0.5) * 0.02
        bullets.push({ x: mx, y: my, vx: Math.cos(a) * cfg.speed, vy: Math.sin(a) * cfg.speed, owner: pIdx, type, r: cfg.r, life: cfg.life, trail: [], bounces: 0 })
      }
      spawnParticles(mx, my, type === 'needle' ? '#a78bfa' : type === 'cannon' ? '#ffb23e' : type === 'trick' ? '#58d8ff' : p.col, 6)
    }

    // DOM refs for fast imperative draw
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

    // Static walls draw once
    const drawWallsStatic = () => {
      if (!gWalls) return
      gWalls.innerHTML = ''
      // frame as path
      const frame = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      frame.setAttribute('d', 'M0 0 H960 V560 H0 Z M10 10 H950 V550 H10 Z')
      frame.setAttribute('fill', '#0f172a'); frame.setAttribute('fill-rule', 'evenodd')
      frame.setAttribute('stroke', 'rgba(27,36,39,0.9)'); frame.setAttribute('stroke-width', '1')
      gWalls.appendChild(frame)
      walls.forEach(w => {
        if (w.isBorder) return
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        r.setAttribute('x', String(w.x)); r.setAttribute('y', String(w.y))
        r.setAttribute('width', String(w.w)); r.setAttribute('height', String(w.h))
        r.setAttribute('rx', String(w.rx ?? 2)); r.setAttribute('fill', 'url(#pv-wallGrad)')
        r.setAttribute('stroke', 'rgba(27,36,39,0.85)'); r.setAttribute('stroke-width', '1')
        gWalls.appendChild(r)
      })
    }
    drawWallsStatic()

    let raf = 0
    let start = performance.now()
    const LOOP = 30000 // 30s
    const phases = [
      { t: 0, label: 'SPAWN // 2 PLAYERS' },
      { t: 4000, label: 'MOVE + DASH' },
      { t: 8000, label: 'STANDARD FIRE' },
      { t: 12000, label: 'NEEDLE // FLANK' },
      { t: 16000, label: 'CANNON // HEAVY' },
      { t: 19000, label: 'TRICK // BOUNCE' },
      { t: 22000, label: 'ORBS + HAZARDS' },
      { t: 26000, label: 'VOID // CLOSING' },
    ]
    const phaseFor = (ms: number) => {
      for (let i = phases.length - 1; i >= 0; i--) if (ms >= phases[i].t) return phases[i].label
      return phases[0].label
    }

    let shootCd = [0, 0]
    let dashCd = [0, 0]
    let voidR = 420
    let safeR = 999
    let voidTick = 0

    // initial pickups
    pickups = [
      { x: 480, y: 280, kind: 'overcharge', t: 0, life: 480 },
      { x: 320, y: 180, kind: 'shield', t: 0, life: 480 },
      { x: 640, y: 380, kind: 'heal', t: 0, life: 480 },
    ]

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const now = performance.now()
      const loopT = (now - start) % LOOP

      // phase label + progress
      if (phaseEl) phaseEl.textContent = phaseFor(loopT)
      if (barEl) barEl.style.transform = `scaleX(${loopT / LOOP})`

      // reset on loop
      if (loopT < 16) {
        players[0].x = 140; players[0].y = 280; players[0].ang = 0; players[0].shield = false
        players[1].x = 820; players[1].y = 280; players[1].ang = Math.PI; players[1].shield = true
        bullets = []; particles = []; pickups = [
          { x: 480, y: 280, kind: 'overcharge', t: 0, life: 9999 },
          { x: 320, y: 180, kind: 'shield', t: 0, life: 9999 },
          { x: 640, y: 380, kind: 'heal', t: 0, life: 9999 },
        ]
        voidR = 420; safeR = 999
        shootCd = [0, 0]; dashCd = [0, 0]
      }

      // pickups spawn cycle every 5s
      if (Math.floor(loopT / 5000) !== pickupIdx) {
        pickupIdx = Math.floor(loopT / 5000)
        const kind = puKinds[pickupIdx % puKinds.length]
        const a = anchors[(pickupIdx * 3) % anchors.length]
        if (pickups.length < 4 && !pickups.some(p => Math.abs(p.x - a.x) < 30)) {
          pickups.push({ x: a.x + (Math.random() * 20 - 10), y: a.y + (Math.random() * 20 - 10), kind, t: 0, life: 480 })
        }
      }

      // hazards tick
      hazards.forEach(h => { h.t += 1 })
      voidTick += 0.6

      // void closing last 8s
      if (loopT > 22000) {
        const p = (loopT - 22000) / 8000 // 0..1
        voidR = 420 - p * (420 - 110)
        safeR = voidR
        if (gVoid) gVoid.setAttribute('opacity', '1')
      } else {
        voidR = 420; safeR = 999
        if (gVoid) gVoid.setAttribute('opacity', loopT > 20000 ? '0.7' : '0')
      }
      if (hole) hole.setAttribute('r', String(voidR))
      if (ring) { ring.setAttribute('r', String(voidR)); ring.setAttribute('stroke-dashoffset', String((now / 14) % 17)); ring.setAttribute('transform', `rotate(${(now / 28) % 360} 480 280)`) }
      if (ring2) { ring2.setAttribute('r', String(voidR)); ring2.setAttribute('stroke-dashoffset', String((now / 10) % 13)); ring2.setAttribute('transform', `rotate(${-(now / 38) % 360} 480 280)`) }

      // player AI — orbit center with offset, chase
      const t = now * 0.001
      const targets = [
        { x: 480 + Math.cos(t * 0.7) * 220 + Math.sin(t * 0.3) * 40, y: 280 + Math.sin(t * 0.9) * 130 },
        { x: 480 + Math.cos(t * 0.7 + Math.PI) * 200 + Math.cos(t * 0.4) * 30, y: 280 + Math.sin(t * 0.9 + Math.PI) * 120 },
      ]
      players.forEach((p, i) => {
        const other = players[1 - i]
        const tgt = targets[i]
        // aim at other
        p.ang = Math.atan2(other.y - p.y, other.x - p.x)
        // dash occasionally (phase 4-8s and 22s)
        if (dashCd[i] > 0) dashCd[i]--
        if (p.dash > 0) p.dash--
        if (p.inv > 0) p.inv--
        const wantDash = (loopT > 4000 && loopT < 8000 && Math.random() < 0.03) || (loopT > 22000 && Math.random() < 0.02)
        if (wantDash && dashCd[i] === 0 && p.dash === 0) {
          p.dash = 16; p.inv = 20; dashCd[i] = 48
          spawnParticles(p.x, p.y, p.col, 7)
        }
        const spd = p.dash > 0 ? p.speed * 2.35 : p.speed * (loopT > 12000 && loopT < 15000 && i === 1 ? 0.9 : 1)
        let dx = tgt.x - p.x, dy = tgt.y - p.y
        const d = Math.hypot(dx, dy)
        if (d > 2) { dx /= d; dy /= d; p.x += dx * spd; p.y += dy * spd }
        // slime slow check
        const inSlime = hazards.some(h => h.kind === 'slime' && p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h)
        if (inSlime) { p.x -= dx * spd * 0.45; p.y -= dy * spd * 0.45 }
        // void push
        const dVoid = Math.hypot(p.x - 480, p.y - 280)
        if (dVoid > safeR - PLAYER_R) {
          const ang = Math.atan2(p.y - 280, p.x - 280)
          p.x = 480 + Math.cos(ang) * (safeR - PLAYER_R - 1)
          p.y = 280 + Math.sin(ang) * (safeR - PLAYER_R - 1)
          if (Math.random() < 0.04) spawnParticles(p.x, p.y, '#c9ff2f', 5)
        }
        pushOut(p)
        // shooting
        if (shootCd[i] > 0) shootCd[i]--
        let bType: string = 'standard'
        if (loopT > 12000 && loopT < 16000) bType = 'needle'
        else if (loopT > 16000 && loopT < 19000) bType = 'cannon'
        else if (loopT > 19000 && loopT < 22000) bType = 'trick'
        else if (loopT > 8000) bType = 'standard'
        const rate = bType === 'cannon' ? 22 : bType === 'needle' ? 13 : bType === 'trick' ? 15 : 11
        if (shootCd[i] === 0 && loopT > 3000) {
          // only shoot when roughly facing opponent
          const dot = Math.cos(p.ang - Math.atan2(other.y - p.y, other.x - p.x))
          if (dot > 0.2 || Math.random() < 0.2) {
            shoot(i, bType)
            shootCd[i] = rate + (Math.random() * 4 | 0)
          }
        }
        // pickup collect
        for (let k = pickups.length - 1; k >= 0; k--) {
          const pu = pickups[k]
          if (len2(p.x, p.y, pu.x, pu.y) < 26) {
            if (pu.kind === 'shield') p.shield = true
            spawnParticles(pu.x, pu.y, pu.kind === 'overcharge' ? '#ffb23e' : pu.kind === 'shield' ? '#58d8ff' : pu.kind === 'heal' ? '#22c55e' : '#a78bfa', 12)
            pickups.splice(k, 1)
          }
        }
      })

      // bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]
        const trailLen = b.type === 'cannon' ? 6 : b.type === 'needle' ? 2 : b.type === 'trick' ? 5 : 4
        b.trail.unshift({ x: b.x, y: b.y })
        if (b.trail.length > trailLen) b.trail.pop()
        b.x += b.vx; b.y += b.vy; b.life--
        let hitWall = walls.some(w => rectCircle(b.x, b.y, b.r, w.x, w.y, w.w, w.h))
        if (hitWall) {
          if (b.type === 'trick' && b.bounces < 5) {
            // bounce: find closest wall and reflect
            let nx = 0, ny = 0
            let best = Infinity
            for (const w of walls) {
              if (!rectCircle(b.x, b.y, b.r + 1, w.x, w.y, w.w, w.h)) continue
              const cx = clamp(b.x, w.x, w.x + w.w), cy = clamp(b.y, w.y, w.y + w.h)
              const d = Math.hypot(b.x - cx, b.y - cy)
              if (d < best) { best = d; nx = b.x - cx; ny = b.y - cy }
            }
            const nl = Math.hypot(nx, ny) || 1
            nx /= nl; ny /= nl
            const dot = b.vx * nx + b.vy * ny
            b.vx = (b.vx - 2 * dot * nx) * 0.97
            b.vy = (b.vy - 2 * dot * ny) * 0.97
            b.x += nx * 3; b.y += ny * 3
            b.bounces++
            spawnParticles(b.x, b.y, '#58d8ff', 5)
            continue
          }
          spawnParticles(b.x, b.y, b.type === 'cannon' ? '#ffb23e' : b.type === 'needle' ? '#a78bfa' : '#58d8ff', 6)
          bullets.splice(i, 1); continue
        }
        if (b.life <= 0 || b.x < -20 || b.x > 980 || b.y < -20 || b.y > 580) { bullets.splice(i, 1); continue }
        for (const p of players) {
          if (p.inv > 0) continue
          if (b.owner === (p === players[0] ? 0 : 1)) continue
          if (len2(b.x, b.y, p.x, p.y) < PLAYER_R + b.r) {
            if (p.shield) {
              p.shield = false
              spawnParticles(b.x, b.y, '#58d8ff', 10)
              p.inv = 14
            } else {
              spawnParticles(b.x, b.y, b.type === 'cannon' ? '#ffb23e' : b.type === 'needle' ? '#a78bfa' : p.col, 10)
              p.inv = 18
              if (Math.random() < 0.08) {
                p.shield = true // demo shield flicker
                setTimeout(() => p.shield = false, 600)
              }
            }
            bullets.splice(i, 1)
            break
          }
        }
      }

      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i]
        pt.x += pt.vx; pt.y += pt.vy; pt.vx *= 0.96; pt.vy *= 0.96; pt.life--
        if (pt.life <= 0) particles.splice(i, 1)
      }
      pickups.forEach(p => { p.t += 0.14; p.life-- })

      // DRAW
      // hazards
      if (gHaz) {
        let h = ''
        for (const hz of hazards) {
          if (hz.kind === 'slime') {
            h += `<g><rect x="${hz.x}" y="${hz.y}" width="36" height="36" rx="8" fill="url(#pv-slimeGrad)" stroke="rgba(110,231,183,0.22)" stroke-width="1"/><circle cx="${hz.x + 10}" cy="${hz.y + 11}" r="3.2" fill="rgba(255,255,255,0.22)"/><circle cx="${hz.x + 26}" cy="${hz.y + 24}" r="2.1" fill="rgba(255,255,255,0.16)"/></g>`
          } else {
            const active = isLavaActive(hz), warn = isLavaWarn(hz)
            const r = active ? 15.6 : 14
            h += `<circle cx="${hz.x + 18}" cy="${hz.y + 18}" r="${r}" fill="url(#pv-lavaGrad)" opacity="${active ? 1 : warn ? 0.78 : 0.42}" stroke="${active ? '#fff' : '#fb923c'}" stroke-width="${active ? 1.4 : 1}" stroke-opacity="${active ? 0.85 : 0.5}" ${active ? 'filter="url(#pv-softGlow)"' : ''}/>`
            if (warn) h += `<circle cx="${hz.x + 18}" cy="${hz.y + 18}" r="18" fill="none" stroke="#fb923c" stroke-width="1" stroke-dasharray="4 4" opacity="0.55"/>`
          }
        }
        gHaz.innerHTML = h
      }
      // pickups
      if (gPick) {
        let s = ''
        for (const pu of pickups) {
          const bob = Math.sin(pu.t) * 2.2
          const col = pu.kind === 'overcharge' ? '#ffb23e' : pu.kind === 'shield' ? '#58d8ff' : pu.kind === 'blink' ? '#c9ff2f' : pu.kind === 'heal' ? '#22c55e' : pu.kind === 'ammo_needle' ? '#a78bfa' : pu.kind === 'ammo_cannon' ? '#ffb23e' : '#58d8ff'
          const icon = pu.kind === 'overcharge' ? '⚡' : pu.kind === 'shield' ? '❄' : pu.kind === 'blink' ? '✦' : pu.kind === 'heal' ? '✚' : pu.kind === 'ammo_needle' ? '◈' : pu.kind === 'ammo_cannon' ? '■' : '◇'
          const bg = pu.kind.startsWith('ammo_') ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.25)'
          s += `<g transform="translate(${pu.x},${pu.y + bob})"><circle r="16" fill="${bg}" stroke="${col}" stroke-width="1.2" opacity="0.95"/><text text-anchor="middle" dy="5.5" font-size="13" fill="${col}">${icon}</text><circle r="20" fill="none" stroke="${col}" stroke-width="0.8" opacity="0.22" stroke-dasharray="2 6"/></g>`
        }
        gPick.innerHTML = s
      }
      // bullets
      if (gBul) {
        let b = ''
        for (const bl of bullets) {
          const col = bl.type === 'needle' ? '#a78bfa' : bl.type === 'cannon' ? '#ffb23e' : bl.type === 'trick' ? '#58d8ff' : bl.owner === 0 ? '#58d8ff' : '#ff5ca8'
          // trail
          for (let k = 0; k < bl.trail.length; k++) {
            const pt = bl.trail[k]
            const op = (1 - k / bl.trail.length) * 0.35
            b += `<circle cx="${pt.x}" cy="${pt.y}" r="${bl.r * 0.55}" fill="${col}" opacity="${op}"/>`
          }
          if (bl.type === 'trick') b += `<g transform="translate(${bl.x},${bl.y}) rotate(45)"><rect x="-5" y="-5" width="10" height="10" fill="none" stroke="${col}" stroke-width="1.6" opacity="0.95"/><circle r="2.2" fill="${col}"/></g>`
          else if (bl.type === 'cannon') b += `<circle cx="${bl.x}" cy="${bl.y}" r="${bl.r}" fill="${col}" stroke="#fff" stroke-width="0.7" opacity="0.98"/>`
          else if (bl.type === 'needle') b += `<g transform="translate(${bl.x},${bl.y}) rotate(${Math.atan2(bl.vy, bl.vx) * 180 / Math.PI})"><rect x="-7" y="-1.4" width="14" height="2.8" rx="1.2" fill="${col}"/><circle cx="5.5" cy="0" r="1.2" fill="#fff" opacity="0.95"/></g>`
          else b += `<circle cx="${bl.x}" cy="${bl.y}" r="${bl.r}" fill="${col}" stroke="#fff" stroke-width="0.6" opacity="0.96"/>`
        }
        gBul.innerHTML = b
      }
      // players
      if (gPlay) {
        let p = ''
        for (let i = 0; i < players.length; i++) {
          const pl = players[i]
          const isDash = pl.dash > 0
          const isInv = pl.inv > 0 && Math.floor(now / 60) % 2 === 0
          const op = isInv ? 0.45 : 1
          const sc = isDash ? 1.14 : 1
          // shadow
          p += `<g transform="translate(${pl.x},${pl.y}) scale(${sc})" opacity="${op}">`
          if (pl.shield) p += `<circle r="22" fill="none" stroke="#58d8ff" stroke-width="1.6" opacity="0.9" stroke-dasharray="5 4"/><circle r="22" fill="rgba(88,216,255,0.08)"/>`
          // body
          p += `<circle r="${PLAYER_R}" fill="${pl.col}" stroke="#0c1012" stroke-width="1.8"/>`
          // inner pointer
          p += `<g transform="rotate(${pl.ang * 180 / Math.PI})"><rect x="7" y="-2.2" width="10" height="4.4" rx="1.2" fill="#0c1012" opacity="0.92"/><circle cx="11" cy="0" r="1.6" fill="#fff"/></g>`
          // dash trail
          if (isDash) p += `<circle r="${PLAYER_R + 3}" fill="none" stroke="${pl.col}" stroke-width="1" opacity="0.35" stroke-dasharray="2 5"/>`
          p += `</g>`
          // nametag
          p += `<text x="${pl.x}" y="${pl.y - 26}" text-anchor="middle" font-family="Courier New, monospace" font-size="8.5" font-weight="800" letter-spacing="0.08em" fill="${pl.col}" opacity="0.95">P${i + 1}</text>`
        }
        gPlay.innerHTML = p
      }
      // particles
      if (gPart) {
        let s = ''
        for (const pt of particles) {
          const a = pt.life / pt.max
          s += `<circle cx="${pt.x}" cy="${pt.y}" r="${pt.r * a}" fill="${pt.col}" opacity="${a}"/>`
        }
        gPart.innerHTML = s
      }
    }
    frame()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={wrapRef} className="hero-preview-wrap" role="img" aria-label="Live preview of Neon Void arena — two players fighting, 30 second loop">
      <div className="hero-preview-frame">
        <div className="hero-preview-top">
          <span className="hero-preview-badge">▶ PREVIEW // 30S LOOP</span>
          <span ref={phaseRef} className="hero-preview-phase">
            SPAWN // 2 PLAYERS
          </span>
          <span className="hero-preview-live">
            <i className="live-dot" aria-hidden="true" /> LIVE
          </span>
        </div>
        <svg ref={svgRef} viewBox="0 0 960 560" xmlns="http://www.w3.org/2000/svg" className="hero-preview-svg">
          <defs>
            <radialGradient id="pv-arenaGrad" cx="50%" cy="40%">
              <stop offset="0%" stopColor="#0f1218" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#020617" stopOpacity="1" />
            </radialGradient>
            <linearGradient id="pv-wallGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <pattern id="pv-gridPat" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(23,32,36,0.12)" strokeWidth="1" />
            </pattern>
            <radialGradient id="pv-lavaGrad" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="38%" stopColor="#f97316" />
              <stop offset="70%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#7c2d12" stopOpacity="0.95" />
            </radialGradient>
            <radialGradient id="pv-slimeGrad" cx="50%" cy="45%">
              <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.92" />
              <stop offset="55%" stopColor="#10b981" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#065f46" stopOpacity="0.95" />
            </radialGradient>
            <filter id="pv-softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
            <radialGradient id="pv-voidEdge" cx="50%" cy="50%">
              <stop offset="68%" stopColor="transparent" />
              <stop offset="82%" stopColor="rgba(201,255,47,0.16)" />
              <stop offset="91%" stopColor="rgba(201,255,47,0.32)" />
              <stop offset="100%" stopColor="rgba(201,255,47,0.06)" />
            </radialGradient>
            <pattern id="pv-voidStars" width="48" height="48" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1" fill="rgba(201,255,47,0.14)" />
              <circle cx="36" cy="36" r="1.1" fill="rgba(255,92,168,0.09)" />
            </pattern>
            <pattern id="pv-voidBlocks" width="24" height="24" patternUnits="userSpaceOnUse">
              <rect width="12" height="12" fill="#1a0b2e" opacity="0.52" />
              <rect x="12" y="12" width="12" height="12" fill="#1a0b2e" opacity="0.52" />
            </pattern>
            <filter id="pv-voidGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feColorMatrix type="matrix" values="1 0.9 0 0 0  0 1 0.9 0 0  0 0 1 0 0  0 0 0 1 0" />
            </filter>
            <mask id="pv-voidMask">
              <rect x="0" y="0" width="960" height="560" rx="18" fill="white" />
              <circle id="pv-voidHole" cx="480" cy="280" r="420" fill="black" />
            </mask>
          </defs>
          <rect x="0" y="0" width="960" height="560" rx="18" fill="url(#pv-arenaGrad)" />
          <rect x="0" y="0" width="960" height="560" rx="18" fill="url(#pv-gridPat)" opacity="0.9" />
          <rect x="0" y="0" width="960" height="560" rx="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
          <g opacity="0.22">
            <circle cx="480" cy="280" r="120" fill="none" stroke="#c9ff2f" strokeWidth="1" strokeDasharray="6 8" />
            <circle cx="480" cy="280" r="190" fill="none" stroke="#58d8ff" strokeWidth="1" strokeDasharray="2 10" opacity="0.5" />
          </g>
          <g id="pv-walls" />
          <g id="pv-hazards" />
          <g id="pv-void" opacity="0" pointerEvents="none">
            <rect x="0" y="0" width="960" height="560" rx="18" fill="url(#pv-voidBlocks)" mask="url(#pv-voidMask)" opacity="0.72" />
            <rect x="0" y="0" width="960" height="560" rx="18" fill="url(#pv-voidStars)" mask="url(#pv-voidMask)" opacity="0.38" />
            <rect x="0" y="0" width="960" height="560" rx="18" fill="rgba(18,8,32,0.28)" mask="url(#pv-voidMask)" />
            <rect x="0" y="0" width="960" height="560" rx="18" fill="url(#pv-voidEdge)" mask="url(#pv-voidMask)" opacity="0.92" />
            <circle id="pv-ring" cx="480" cy="280" r="420" fill="none" stroke="#c9ff2f" strokeWidth="2.5" strokeDasharray="10 7" opacity="0.95" filter="url(#pv-voidGlow)" />
            <circle id="pv-ring2" cx="480" cy="280" r="420" fill="none" stroke="#58d8ff" strokeWidth="1" strokeDasharray="2 11" opacity="0.45" />
          </g>
          <g id="pv-pickups" />
          <g id="pv-bullets" />
          <g id="pv-players" />
          <g id="pv-particles" />
        </svg>
        <div className="hero-preview-bar" aria-hidden="true">
          <div ref={barRef} className="hero-preview-bar__fill" />
        </div>
        <div className="hero-preview-caption">
          <span>1:1 ARENA // 960×560 • 12 HEALTH • 4 BULLETS</span>
          <span style={{ opacity: 0.7 }}>DASH • WALLS • LAVA • SLIME • VOID</span>
        </div>
      </div>
      <div className="hero-preview-legend">
        <span style={{ color: '#a78bfa' }}>◈ NEEDLE</span>
        <span style={{ color: 'var(--nox-amber)' }}>■ CANNON</span>
        <span style={{ color: 'var(--nox-cyan)' }}>◇ TRICK</span>
        <span style={{ color: '#d6e2e4' }}>● STANDARD</span>
      </div>
    </div>
  )
}
