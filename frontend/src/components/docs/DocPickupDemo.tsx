import { useEffect, useRef } from 'react'

export default function DocPickupDemo() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const svg = el.querySelector('svg') as SVGSVGElement
    const gOrbs = svg.querySelector('#pd-orbs') as SVGGElement
    const gShip = svg.querySelector('#pd-ship') as SVGGElement
    if (!svg || !gOrbs || !gShip) return
    const kinds = [
      { k: 'overcharge', col: '#ffb23e', bg: '#ff9d2e', icon: '⚡', label: 'TRI' },
      { k: 'shield', col: '#58d8ff', bg: '#3ec5f2', icon: '❄', label: 'SHLD' },
      { k: 'blink', col: '#c9ff2f', bg: '#c9ff2f', icon: '✦', label: 'BLNK' },
      { k: 'heal', col: '#22c55e', bg: '#16a34a', icon: '✚', label: 'HEAL' },
      { k: 'ammo_needle', col: '#a78bfa', bg: '#7c3aed', icon: 'N', label: 'NEEDLE' },
      { k: 'ammo_cannon', col: '#ffb23e', bg: '#ff9d2e', icon: 'C', label: 'CANNON' },
      { k: 'ammo_trick', col: '#58d8ff', bg: '#3ec5f2', icon: 'T', label: 'TRICK' },
    ]
    let raf = 0
    let t = 0
    let shipX = 40
    let idx = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      t += 0.14
      shipX += 0.9
      if (shipX > 340) { shipX = 40; idx = (idx + 1) % kinds.length }
      const cur = kinds[idx]
      // orbs: show 3 at different x
      let h = ''
      kinds.slice(0, 4).forEach((k, i) => {
        const x = 120 + i * 68
        const y = 70 + Math.sin(t + i) * 3
        const isTarget = k.k === cur.k
        const sc = isTarget ? 1.08 : 1
        h += `<g transform="translate(${x},${y}) scale(${sc})" opacity="${isTarget ? 1 : 0.45}">`
        h += `<circle r="${18}" fill="${k.col}" opacity="0.18" filter="url(#pd-soft)"/>`
        h += `<circle r="13" fill="${k.bg}" stroke="#fff" stroke-width="2" filter="url(#pd-soft)"/>`
        h += `<text text-anchor="middle" dy="5" font-size="13" font-weight="800" fill="#fff">${k.icon}</text>`
        for (let j = 0; j < 3; j++) {
          const ang = t * 0.85 + j * 2.094
          h += `<circle cx="${Math.cos(ang) * 19}" cy="${Math.sin(ang) * 19}" r="2.5" fill="${k.col}" opacity="0.9"/>`
        }
        h += `</g>`
      })
      gOrbs.innerHTML = h

      // ship collecting
      const targetX = 120 + kinds.findIndex(k => k.k === cur.k) * 68
      const dx = targetX - shipX
      shipX += Math.sign(dx) * Math.min(2.2, Math.abs(dx) * 0.08)
      if (gShip) {
        gShip.setAttribute('transform', `translate(${shipX},70)`)
        gShip.innerHTML = `
          <g transform="rotate(0)">
            <ellipse cx="2" cy="10" rx="14" ry="6" fill="rgba(0,0,0,0.35)"/>
            <path d="M 18 0 L -12 -11 L -8 0 L -12 11 Z" fill="#3ec5f2" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
            <circle cx="0" cy="0" r="5.5" fill="#fff"/><circle cx="0.8" cy="-1" r="2" fill="#58d8ff"/>
          </g>
        `
      }
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div ref={ref} className="docs-demo">
      <div className="docs-demo__frame">
        <div className="docs-demo__top">
          <span className="docs-demo__badge">ORBS</span>
          <span className="docs-demo__note">Touch to pick up • floats + glows</span>
          <span className="docs-demo__live">● LIVE</span>
        </div>
        <svg viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg" className="docs-demo__svg">
          <defs>
            <filter id="pd-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>
            <pattern id="pd-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(23,32,36,0.12)" strokeWidth="1"/></pattern>
          </defs>
          <rect x="0" y="0" width="360" height="140" rx="10" fill="#020617" />
          <rect x="0" y="0" width="360" height="140" rx="10" fill="url(#pd-grid)" opacity="0.5" />
          <rect x="0" y="0" width="360" height="140" rx="10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <g id="pd-orbs" />
          <g id="pd-ship" />
        </svg>
        <div className="docs-demo__cap">Same glow + orbit dots as the arena — try hovering the real orbs</div>
      </div>
    </div>
  )
}
