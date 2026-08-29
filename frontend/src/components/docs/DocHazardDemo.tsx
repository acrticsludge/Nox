import { useEffect, useRef } from 'react'

export function DocWallDemo() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const svg = el.querySelector('svg') as SVGSVGElement
    const gBul = svg.querySelector('#wd-bul') as SVGGElement
    const gWall = svg.querySelector('#wd-wall') as SVGGElement
    if (!svg || !gBul || !gWall) return
    gWall.innerHTML = `<rect x="168" y="18" width="12" height="104" rx="6" fill="url(#hd-wallGrad)" stroke="rgba(27,36,39,0.85)" stroke-width="1"/><rect x="169.5" y="19" width="9" height="1.5" rx="1" fill="rgba(255,255,255,0.09)"/>`
    let bullets: { x: number; y: number; vx: number; bounces: number; type: string }[] = []
    let raf = 0, last = performance.now(), accum = 0, lastFire = performance.now()
    const SIM_STEP = 1000 / 60
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      accum += now - last; last = now
      if (accum > 250) accum = 250
      while (accum >= SIM_STEP) {
        if (now - lastFire > 900) {
          const isTrick = Math.random() > 0.5
          bullets.push({ x: 44, y: 70 + (Math.random() * 18 - 9), vx: isTrick ? 6.2 : 7.2, bounces: 0, type: isTrick ? 'trick' : 'standard' })
          lastFire = now
        }
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i]
          b.x += b.vx
          const hit = b.x + 4 > 168 && b.x - 4 < 180
          if (hit) {
            if (b.type === 'trick' && b.bounces < 5) {
              b.vx *= -0.97
              b.bounces++
              b.x = 164
            } else {
              bullets.splice(i, 1)
            }
          }
          if (b.x > 360 || b.x < -20) bullets.splice(i, 1)
        }
        accum -= SIM_STEP
      }
      let h = ''
      for (const b of bullets) {
        if (b.type === 'trick') h += `<path d="M ${b.x} ${b.y - 4} L ${b.x + 4} ${b.y} L ${b.x} ${b.y + 4} L ${b.x - 4} ${b.y} Z" fill="#fff" stroke="#58d8ff" stroke-width="1.6" filter="url(#hd-soft)"/>`
        else h += `<circle cx="${b.x}" cy="${b.y}" r="5" fill="#fff" stroke="#58d8ff" stroke-width="2" filter="url(#hd-glowCyan)"/><circle cx="${b.x}" cy="${b.y}" r="2" fill="#a9e9ff"/>`
      }
      gBul.innerHTML = h
    }
    loop(performance.now())
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div ref={ref} className="docs-demo">
      <div className="docs-demo__frame">
        <div className="docs-demo__top">
          <span className="docs-demo__badge">WALLS</span>
          <span className="docs-demo__note">Blocks shots - trick shots bounce</span>
        </div>
        <svg viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg" className="docs-demo__svg">
          <defs>
            <filter id="hd-glowCyan" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b1"/><feColorMatrix type="matrix" values="0 0.6 1 0 0  0 0.7 1 0 0  1 1 1 0 0  0 0 0 1 0"/><feMerge><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="hd-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
            <linearGradient id="hd-wallGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#334155"/><stop offset="100%" stopColor="#0f172a"/></linearGradient>
          </defs>
          <rect x="0" y="0" width="360" height="140" rx="10" fill="#020617" />
          <g id="wd-wall" /><g id="wd-bul" />
          <g transform="translate(44,70)"><path d="M 18 0 L -12 -11 L -8 0 L -12 11 Z" fill="#3ec5f2" stroke="#fff" strokeWidth="1.4"/></g>
        </svg>
      </div>
    </div>
  )
}

export function DocLavaDemo() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const g = el.querySelector('#ld-g') as SVGGElement
    if (!g) return
    let raf = 0
    let t = 0
    let last = performance.now()
    let accum = 0
    const SIM_STEP = 1000 / 60
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      accum += now - last; last = now
      if (accum > 250) accum = 250
      while (accum >= SIM_STEP) {
        t += 1
        accum -= SIM_STEP
      }
      const m = t % 300
      const active = m >= 120 && m < 228
      const warn = m < 120
      const r = active ? 15.6 : 14
      g.innerHTML = `
        <circle cx="180" cy="70" r="${r}" fill="url(#ld-lava)" opacity="${active ? 1 : warn ? 0.78 : 0.42}" stroke="${active ? '#fff' : '#fb923c'}" stroke-width="${active ? 1.4 : 1}" stroke-opacity="${active ? 0.85 : 0.5}" ${active ? 'filter="url(#ld-soft)"' : ''}/>
        ${warn ? `<circle cx="180" cy="70" r="18" fill="none" stroke="#fb923c" stroke-width="1" stroke-dasharray="3 4" opacity="0.55"/>` : ''}
        <text x="180" y="${active ? 102 : 103}" text-anchor="middle" font-size="7" font-family="JetBrains Mono, monospace" fill="${active ? '#fff' : 'rgba(255,255,255,0.55)'}">${active ? 'LAVA' : 'VENT'}</text>
        ${active ? `<circle cx="${180 + Math.sin(t * 0.18) * 2}" cy="${70 + Math.cos(t * 0.2) * 2}" r="2.1" fill="#fff" opacity="0.9"/>` : ''}
        <g transform="translate(180,118)"><text text-anchor="middle" font-size="7" font-family="JetBrains Mono, monospace" fill="${active ? '#fb923c' : warn ? '#ffb23e' : 'rgba(255,255,255,0.45)'}">${active ? 'STAY OFF • BURNS' : warn ? 'WATCH OUT • BLINKS' : 'COOLING...'}</text></g>
      `
    }
    loop(performance.now())
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div ref={ref} className="docs-demo">
      <div className="docs-demo__frame">
        <div className="docs-demo__top">
          <span className="docs-demo__badge" style={{ background: '#fb923c', borderColor: '#fb923c', color: '#07090b' }}>LAVA VENT</span>
          <span className="docs-demo__note">Blinks first, then burns</span>
        </div>
        <svg viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg" className="docs-demo__svg">
          <defs>
            <radialGradient id="ld-lava" cx="50%" cy="50%"><stop offset="0%" stopColor="#fb923c"/><stop offset="38%" stopColor="#f97316"/><stop offset="70%" stopColor="#dc2626"/><stop offset="100%" stopColor="#7c2d12"/></radialGradient>
            <filter id="ld-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
          </defs>
          <rect x="0" y="0" width="360" height="140" rx="10" fill="#020617" />
          <g id="ld-g" />
        </svg>
      </div>
    </div>
  )
}

export function DocSlimeDemo() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const gShip = el.querySelector('#sd-ship') as SVGGElement
    if (!gShip) return
    let raf = 0
    let x = 40
    let last = performance.now()
    let accum = 0
    const SIM_STEP = 1000 / 60
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      accum += now - last; last = now
      if (accum > 250) accum = 250
      while (accum >= SIM_STEP) {
        const inSlime = x > 120 && x < 240
        const spd = inSlime ? 3.6 * 0.55 * 0.6 : 3.6 * 0.6
        x += spd * 0.25
        if (x > 320) x = 40
        accum -= SIM_STEP
      }
      const inSlime = x > 120 && x < 240
      gShip.setAttribute('transform', `translate(${x},70)`)
      gShip.innerHTML = `
        <ellipse cx="2" cy="10" rx="14" ry="6" fill="rgba(0,0,0,0.35)" filter="url(#sd-soft)"/>
        <path d="M 18 0 L -12 -11 L -8 0 L -12 11 Z" fill="${inSlime ? '#6ee7b7' : '#3ec5f2'}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" filter="url(#sd-glow)"/>
        <circle cx="0" cy="0" r="5.5" fill="#fff"/><circle cx="0.8" cy="-1" r="2" fill="${inSlime ? '#10b981' : '#58d8ff'}"/>
        ${inSlime ? `<text x="0" y="28" text-anchor="middle" font-size="7" font-family="JetBrains Mono, monospace" fill="#6ee7b7">SLOW</text>` : ''}
      `
      const txt = el.querySelector('#sd-label') as HTMLDivElement | null
      if (txt) txt.textContent = inSlime ? 'INSIDE SLIME - YOU ARE SLOW' : 'Move freely'
    }
    loop(performance.now())
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div ref={ref} className="docs-demo">
      <div className="docs-demo__frame">
        <div className="docs-demo__top">
          <span className="docs-demo__badge" style={{ background: '#6ee7b7', borderColor: '#6ee7b7', color: '#07090b' }}>SLIME</span>
          <span id="sd-label" className="docs-demo__note">Move freely</span>
        </div>
        <svg viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg" className="docs-demo__svg">
          <defs>
            <filter id="sd-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b1"/><feColorMatrix type="matrix" values="0 0.6 1 0 0  0 0.7 1 0 0  1 1 1 0 0  0 0 0 1 0"/><feMerge><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="sd-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
            <radialGradient id="sd-grad" cx="50%" cy="45%"><stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.92"/><stop offset="55%" stopColor="#10b981" stopOpacity="0.75"/><stop offset="100%" stopColor="#065f46" stopOpacity="0.95"/></radialGradient>
          </defs>
          <rect x="0" y="0" width="360" height="140" rx="10" fill="#020617" />
          <rect x="120" y="34" width="120" height="72" rx="10" fill="url(#sd-grad)" stroke="rgba(110,231,183,0.22)" strokeWidth="1" />
          <circle cx="150" cy="55" r="3.2" fill="rgba(255,255,255,0.22)" />
          <text x="180" y="104" textAnchor="middle" fontSize="7" fontFamily="JetBrains Mono, monospace" fill="rgba(255,255,255,0.55)">SLIME • NO DAMAGE</text>
          <g id="sd-ship" />
        </svg>
      </div>
    </div>
  )
}

export function DocVoidDemo() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const hole = el.querySelector('#vd-hole') as SVGCircleElement
    const ring = el.querySelector('#vd-ring') as SVGCircleElement
    const ring2 = el.querySelector('#vd-ring2') as SVGCircleElement
    const gVoid = el.querySelector('#vd-void') as SVGGElement
    const gShip = el.querySelector('#vd-ship') as SVGGElement
    if (!hole || !ring || !gVoid || !gShip) return
    let raf = 0
    const t0 = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const loopT = (now - t0) % 10000
      const p = loopT / 10000
      const r = 160 - p * (160 - 52)
      hole.setAttribute('r', String(r))
      ring.setAttribute('r', String(r))
      ring2.setAttribute('r', String(r))
      ring.setAttribute('stroke-dashoffset', String((now / 14) % 17))
      ring.setAttribute('transform', `rotate(${(now / 28) % 360} 180 70)`)
      ring2.setAttribute('stroke-dashoffset', String((now / 10) % 13))
      ring2.setAttribute('transform', `rotate(${-(now / 38) % 360} 180 70)`)
      gVoid.setAttribute('opacity', p > 0.15 ? '1' : '0.3')
      const x = 180 + Math.cos(now * 0.0006) * 22
      gShip.setAttribute('transform', `translate(${x},70)`)
      gShip.innerHTML = `<path d="M 18 0 L -12 -11 L -8 0 L -12 11 Z" fill="${loopT > 7000 ? '#c9ff2f' : '#3ec5f2'}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>`
    }
    loop(performance.now())
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div ref={ref} className="docs-demo">
      <div className="docs-demo__frame">
        <div className="docs-demo__top">
          <span className="docs-demo__badge" style={{ background: '#c9ff2f', borderColor: '#c9ff2f', color: '#07090b' }}>THE VOID</span>
          <span className="docs-demo__note">Closes in - stay in the middle</span>
        </div>
        <svg viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg" className="docs-demo__svg">
          <defs>
            <radialGradient id="vd-edge" cx="50%" cy="50%"><stop offset="68%" stopColor="transparent"/><stop offset="82%" stopColor="rgba(201,255,47,0.16)"/><stop offset="91%" stopColor="rgba(201,255,47,0.32)"/><stop offset="100%" stopColor="rgba(201,255,47,0.06)"/></radialGradient>
            <pattern id="vd-blocks" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#1a0b2e" opacity="0.52"/><rect x="12" y="12" width="12" height="12" fill="#1a0b2e" opacity="0.52"/><rect x="12" y="0" width="12" height="12" fill="#0f0f1a" opacity="0.58"/><rect x="0" y="12" width="12" height="12" fill="#0f0f1a" opacity="0.58"/></pattern>
            <filter id="vd-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feColorMatrix type="matrix" values="1 0.9 0 0 0  0 1 0.9 0 0  0 0 1 0 0  0 0 0 1 0"/></filter>
            <mask id="vd-mask"><rect x="0" y="0" width="360" height="140" rx="10" fill="white"/><circle id="vd-hole" cx="180" cy="70" r="160" fill="black"/></mask>
          </defs>
          <rect x="0" y="0" width="360" height="140" rx="10" fill="#0f1218" />
          <g id="vd-void" opacity="0">
            <rect x="0" y="0" width="360" height="140" rx="10" fill="url(#vd-blocks)" mask="url(#vd-mask)" opacity="0.72" />
            <rect x="0" y="0" width="360" height="140" rx="10" fill="rgba(18,8,32,0.28)" mask="url(#vd-mask)" />
            <rect x="0" y="0" width="360" height="140" rx="10" fill="url(#vd-edge)" mask="url(#vd-mask)" opacity="0.92" />
            <circle id="vd-ring" cx="180" cy="70" r="160" fill="none" stroke="#c9ff2f" strokeWidth="2" strokeDasharray="10 7" opacity="0.95" filter="url(#vd-glow)" />
            <circle id="vd-ring2" cx="180" cy="70" r="160" fill="none" stroke="#58d8ff" strokeWidth="1" strokeDasharray="2 11" opacity="0.45" />
          </g>
          <g id="vd-ship" />
          <text x="180" y="128" textAnchor="middle" fontSize="7" fontFamily="JetBrains Mono, monospace" fill="#c9ff2f" opacity="0.8">STAY IN THE MIDDLE</text>
        </svg>
      </div>
    </div>
  )
}
