import { useEffect, useRef } from 'react'

export default function DocDashDemo() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const svg = el.querySelector('svg') as SVGSVGElement
    const gShip = svg.querySelector('#dd-ship') as SVGGElement
    const gGhost = svg.querySelector('#dd-ghost') as SVGGElement
    if (!gShip) return
    let raf = 0
    let last = performance.now()
    let accum = 0
    const SIM_STEP = 1000 / 60
    let x = 60, dash = 0, cd = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      accum += now - last; last = now
      if (accum > 250) accum = 250
      while (accum >= SIM_STEP) {
        if (cd > 0) cd--
        if (dash > 0) dash--
        // dash every ~120 ticks (2s)
        if (dash === 0 && cd === 0 && Math.random() < 0.008) {
          dash = 16; cd = 60
        }
        const spd = dash > 0 ? 3.6 * 2.35 : 1.8
        x += spd * 0.6
        if (x > 300) x = 60
        accum -= SIM_STEP
      }
      const bob = Math.sin(now * 0.004) * 1.6
      if (gGhost) {
        if (dash > 0) {
          gGhost.setAttribute('opacity', '0.22')
          gGhost.innerHTML = `<g transform="translate(${x - 8},${70 + bob})"><path d="M 18 0 L -12 -11 L -8 0 L -12 11 Z" fill="none" stroke="#58d8ff" stroke-width="1" opacity="0.45"/></g>`
        } else gGhost.innerHTML = ''
      }
      if (gShip) {
        const isInv = dash > 0 && Math.floor(now / 55) % 2 === 0
        gShip.setAttribute('transform', `translate(${x},${70 + bob})`)
        gShip.setAttribute('opacity', isInv ? '0.35' : '1')
        gShip.innerHTML = `
          <ellipse cx="2" cy="10" rx="14" ry="6" fill="rgba(0,0,0,0.35)" filter="url(#dd-soft)"/>
          <path d="M 18 0 L -12 -11 L -8 0 L -12 11 Z" fill="#58d8ff" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" filter="url(#dd-glow)"/>
          <circle cx="0" cy="0" r="5.5" fill="#fff" opacity="0.95"/><circle cx="0.8" cy="-1" r="2" fill="#58d8ff"/>
          ${dash > 0 ? `<path d="M -12 0 L -22 -6 L -26 0 L -22 6 Z" fill="#a9e9ff" opacity="0.9"/>` : ''}
        `
      }
    }
    loop(performance.now())
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div ref={ref} className="docs-demo docs-demo--dash">
      <div className="docs-demo__frame">
        <div className="docs-demo__top">
          <span className="docs-demo__badge">DASH</span>
          <span className="docs-demo__note">Flash forward — can't be hit for a moment</span>
          <span className="docs-demo__live">● LIVE</span>
        </div>
        <svg viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg" className="docs-demo__svg">
          <defs>
            <filter id="dd-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b1"/><feColorMatrix type="matrix" values="0 0.6 1 0 0  0 0.7 1 0 0  1 1 1 0 0  0 0 0 1 0"/><feMerge><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            <filter id="dd-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
            <pattern id="dd-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(23,32,36,0.12)" strokeWidth="1"/></pattern>
          </defs>
          <rect x="0" y="0" width="360" height="140" rx="10" fill="#020617" />
          <rect x="0" y="0" width="360" height="140" rx="10" fill="url(#dd-grid)" opacity="0.5" />
          <rect x="0" y="0" width="360" height="140" rx="10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <g opacity="0.25"><rect x="60" y="68" width="240" height="2" fill="none" stroke="#c9ff2f" strokeWidth="1" strokeDasharray="6 6"/></g>
          <g id="dd-ghost" />
          <g id="dd-ship" />
        </svg>
        <div className="docs-demo__cap">Use it to dodge shots or slip through a tight gap</div>
      </div>
    </div>
  )
}
