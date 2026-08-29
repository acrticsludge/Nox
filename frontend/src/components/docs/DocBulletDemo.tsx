import { useEffect, useRef, useState } from 'react'

// 1:1 — same ship + bullet as game-logic.js (ship M 18 0 ..., r5/3.5/7/4 speeds 7.2/8.5/3.8/6.2 cd 11/14/32/16) — fixed 60Hz step so not 3x on high-refresh
export default function DocBulletDemo() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [type, setType] = useState<'standard' | 'needle' | 'cannon' | 'trick'>('standard')

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const svg = el.querySelector('svg') as SVGSVGElement | null
    if (!svg) return
    const gBul = svg.querySelector('#bd-bullets') as SVGGElement
    const gShip = svg.querySelector('#bd-ship') as SVGGElement
    const gWall = svg.querySelector('#bd-wall') as SVGGElement
    if (!gBul || !gShip || !gWall) return

    gWall.innerHTML = `<rect x="228" y="28" width="12" height="84" rx="6" fill="url(#bd-wallGrad)" stroke="rgba(27,36,39,0.85)" stroke-width="1"/><rect x="229.5" y="29" width="9" height="1.5" rx="1" fill="rgba(255,255,255,0.09)"/>`

    const cfg = {
      standard: { r: 5, speed: 7.2 },
      needle: { r: 3.5, speed: 8.5 },
      cannon: { r: 7, speed: 3.8 },
      trick: { r: 4, speed: 6.2 },
    } as const
    const cds: Record<string, number> = { standard: 11, needle: 14, cannon: 32, trick: 16 }
    const order: ('standard' | 'needle' | 'cannon' | 'trick')[] = ['standard', 'needle', 'cannon', 'trick']
    let idx = 0
    let bullets: { x: number; y: number; vx: number; vy: number; r: number; type: string; trail: { x: number; y: number }[]; bounces: number; life: number }[] = []
    let raf = 0
    let t0 = performance.now()
    let lastFire = t0
    let last = performance.now()
    let accum = 0
    const SIM_STEP = 1000 / 60
    const ship = { x: 44, y: 70 }

    const fire = (tp: string) => {
      const c = cfg[tp as keyof typeof cfg]
      const ang = (Math.random() - 0.5) * 0.02
      const mx = ship.x + 18, my = ship.y
      const life = tp === 'cannon' ? 120 : tp === 'trick' ? 180 : 90
      bullets.push({ x: mx, y: my, vx: Math.cos(ang) * c.speed, vy: Math.sin(ang) * c.speed, r: c.r, type: tp, trail: [], bounces: 0, life })
    }

    const step = () => {
      const cur = order[idx]
      // update bullets at 60Hz
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]
        b.trail.unshift({ x: b.x, y: b.y })
        if (b.trail.length > (cur === 'cannon' ? 6 : cur === 'needle' ? 2 : cur === 'trick' ? 5 : 4)) b.trail.pop()
        b.x += b.vx; b.y += b.vy; b.life--
        const hitWall = b.x + b.r > 228 && b.x - b.r < 240 && b.y > 28 - b.r && b.y < 112 + b.r
        if (hitWall) {
          if (b.type === 'trick' && b.bounces < 5) {
            b.vx *= -0.97
            b.x += b.vx > 0 ? 3 : -3
            b.bounces++
          } else {
            bullets.splice(i, 1); continue
          }
        }
        if (b.life <= 0 || b.x > 360 || b.y < -20 || b.y > 180) bullets.splice(i, 1)
      }
    }

    const draw = () => {
      if (gShip) {
        gShip.setAttribute('transform', `translate(${ship.x},${ship.y})`)
        gShip.innerHTML = `
          <ellipse cx="2" cy="10" rx="14" ry="6" fill="rgba(0,0,0,0.35)" filter="url(#bd-softGlow)"/>
          <path d="M 18 0 L -12 -11 L -8 0 L -12 11 Z" fill="#3ec5f2" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" filter="url(#bd-glowCyan)"/>
          <circle cx="0" cy="0" r="5.5" fill="#fff" opacity="0.95"/><circle cx="0.8" cy="-1" r="2" fill="#58d8ff"/>
        `
      }
      if (gBul) {
        let h = ''
        for (const b of bullets) {
          const col = b.type === 'needle' ? '#a78bfa' : b.type === 'cannon' ? '#ffb23e' : b.type === 'trick' ? '#58d8ff' : '#58d8ff'
          for (let k = 0; k < b.trail.length; k++) {
            const pt = b.trail[k]
            const op = (1 - k / b.trail.length) * 0.35
            const rt = b.type === 'cannon' ? 4.2 - k * 0.5 : b.type === 'needle' ? 2.1 - k * 0.4 : 3 - k * 0.5
            h += `<circle cx="${pt.x}" cy="${pt.y}" r="${Math.max(0.6, rt)}" fill="${col}" opacity="${op}"/>`
          }
          if (b.type === 'trick') {
            h += `<path d="M ${b.x} ${b.y - b.r} L ${b.x + b.r} ${b.y} L ${b.x} ${b.y + b.r} L ${b.x - b.r} ${b.y} Z" fill="#fff" stroke="#58d8ff" stroke-width="1.6" filter="url(#bd-softGlow)"/><circle cx="${b.x}" cy="${b.y}" r="1.2" fill="#a9e9ff"/>`
          } else if (b.type === 'cannon') {
            h += `<rect x="${b.x - b.r}" y="${b.y - b.r * 0.7}" width="${b.r * 2}" height="${b.r * 1.4}" rx="2" fill="#fff" stroke="#ffb23e" stroke-width="2" filter="url(#bd-softGlow)"/><circle cx="${b.x}" cy="${b.y}" r="2.4" fill="#fb923c"/>`
          } else if (b.type === 'needle') {
            h += `<circle cx="${b.x}" cy="${b.y}" r="${b.r}" fill="#fff" stroke="#a78bfa" stroke-width="1.8" filter="url(#bd-softGlow)"/><circle cx="${b.x}" cy="${b.y}" r="1.2" fill="#ede9fe"/>`
          } else {
            h += `<circle cx="${b.x}" cy="${b.y}" r="${b.r}" fill="#fff" stroke="#58d8ff" stroke-width="2" filter="url(#bd-glowCyan)"/><circle cx="${b.x}" cy="${b.y}" r="2" fill="#a9e9ff"/>`
          }
        }
        gBul.innerHTML = h
      }
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const elapsed = now - t0
      const newIdx = Math.floor(elapsed / 2200) % order.length
      if (newIdx !== idx) {
        idx = newIdx
        setType(order[idx])
        bullets = []
      }
      const cur = order[idx]
      const cdMs = (cds[cur] / 60) * 1000
      if (now - lastFire > cdMs) {
        fire(cur)
        lastFire = now
      }
      accum += now - last; last = now
      if (accum > 250) accum = 250
      while (accum >= SIM_STEP) {
        step()
        accum -= SIM_STEP
      }
      draw()
    }
    loop(performance.now())
    return () => cancelAnimationFrame(raf)
  }, [])

  const meta: Record<string, { label: string; note: string }> = {
    standard: { label: 'STANDARD', note: 'Balanced • 183ms • never runs out' },
    needle: { label: 'NEEDLE', note: 'Tiny, very fast • 0 front / 6 rear' },
    cannon: { label: 'CANNON', note: 'Big & slow • 4 damage • 533ms' },
    trick: { label: 'TRICK', note: 'Bounces off walls • gets weaker' },
  }

  return (
    <div ref={wrapRef} className="docs-demo docs-demo--bullet">
      <div className="docs-demo__frame">
        <div className="docs-demo__top">
          <span className="docs-demo__badge">{meta[type].label}</span>
          <span className="docs-demo__note">{meta[type].note}</span>
          <span className="docs-demo__live">● LIVE</span>
        </div>
        <svg viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg" className="docs-demo__svg">
          <defs>
            <filter id="bd-glowCyan" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b1"/><feColorMatrix type="matrix" values="0 0.6 1 0 0  0 0.7 1 0 0  1 1 1 0 0  0 0 0 1 0"/><feMerge><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="bd-softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
            <linearGradient id="bd-wallGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#334155"/><stop offset="100%" stopColor="#0f172a"/></linearGradient>
            <pattern id="bd-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(23,32,36,0.12)" strokeWidth="1"/></pattern>
          </defs>
          <rect x="0" y="0" width="360" height="140" rx="10" fill="#020617" />
          <rect x="0" y="0" width="360" height="140" rx="10" fill="url(#bd-grid)" opacity="0.5" />
          <rect x="0" y="0" width="360" height="140" rx="10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <g id="bd-wall" />
          <g id="bd-bullets" />
          <g id="bd-ship" />
        </svg>
        <div className="docs-demo__cap">Fired from pointer • same speed + size as the real arena</div>
      </div>
    </div>
  )
}
