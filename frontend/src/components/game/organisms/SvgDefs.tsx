// All SVG filters/patterns/masks — single source so 1v1 + trials render identically.
// Edit gradients/masks here to change arena look everywhere.

export default function SvgDefs({ isTrials, arenaW, arenaH, cx, cy, voidR }: { isTrials:boolean; arenaW:number; arenaH:number; cx:number; cy:number; voidR:number }) {
  return (
    <defs>
      <filter id="glowCyan" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="b1" />
        <feColorMatrix type="matrix" values="0 0.6 1 0 0  0 0.7 1 0 0  1 1 1 0 0  0 0 0 1 0" />
        <feMerge><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="glowPink" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="b1" />
        <feColorMatrix type="matrix" values="1 0.3 0.5 0 0  0.2 0.2 0.6 0 0  0.8 0.3 0.7 0 0  0 0 0 1 0" />
        <feMerge><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
      <radialGradient id="arenaGrad" cx="50%" cy="40%">
        <stop offset="0%" stopColor="#0f1218" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#020617" stopOpacity="1" />
      </radialGradient>
      <linearGradient id="wallGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <pattern id="gridPat" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(23,32,36,0.12)" strokeWidth="1" />
      </pattern>
      <radialGradient id="lavaGrad" cx="50%" cy="50%">
        <stop offset="0%" stopColor="#fb923c" />
        <stop offset="38%" stopColor="#f97316" />
        <stop offset="70%" stopColor="#dc2626" />
        <stop offset="100%" stopColor="#7c2d12" stopOpacity="0.95" />
      </radialGradient>
      <radialGradient id="slimeGrad" cx="50%" cy="45%">
        <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.92" />
        <stop offset="55%" stopColor="#10b981" stopOpacity="0.75" />
        <stop offset="100%" stopColor="#065f46" stopOpacity="0.95" />
      </radialGradient>
      <radialGradient id="voidEdgeGrad" cx="50%" cy="50%">
        <stop offset="68%" stopColor="transparent" />
        <stop offset="82%" stopColor="rgba(201,255,47,0.16)" />
        <stop offset="91%" stopColor="rgba(201,255,47,0.32)" />
        <stop offset="100%" stopColor="rgba(201,255,47,0.06)" />
      </radialGradient>
      <pattern id="voidStars" width="48" height="48" patternUnits="userSpaceOnUse">
        <circle cx="12" cy="12" r="1" fill="rgba(201,255,47,0.14)" />
        <circle cx="28" cy="18" r="0.7" fill="rgba(88,216,255,0.12)" />
        <circle cx="36" cy="36" r="1.1" fill="rgba(255,92,168,0.09)" />
        <circle cx="8" cy="38" r="0.6" fill="rgba(255,255,255,0.07)" />
        <circle cx="42" cy="10" r="0.5" fill="rgba(201,255,47,0.09)" />
      </pattern>
      <pattern id="voidBlocks" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill="#1a0b2e" opacity="0.52" />
        <rect x="12" y="12" width="12" height="12" fill="#1a0b2e" opacity="0.52" />
        <rect x="12" y="0" width="12" height="12" fill="#0f0f1a" opacity="0.58" />
        <rect x="0" y="12" width="12" height="12" fill="#0f0f1a" opacity="0.58" />
        <rect x="6" y="6" width="12" height="12" fill="rgba(120,40,180,0.09)" />
        <rect width="24" height="24" fill="none" stroke="rgba(120,40,180,0.07)" strokeWidth="0.6" />
      </pattern>
      <filter id="voidGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="b" />
        <feColorMatrix type="matrix" values="1 0.9 0 0 0  0 1 0.9 0 0  0 0 1 0 0  0 0 0 1 0" />
      </filter>
      {isTrials ? (
        <mask id="voidMaskRect">
          <rect x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="white" />
          <rect id="voidHole" x="480" y="280" width="960" height="560" fill="black" />
        </mask>
      ) : (
        <mask id="voidMask">
          <rect x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="white" />
          <circle id="voidHole" cx={cx} cy={cy} r={voidR} fill="black" />
        </mask>
      )}
    </defs>
  )
}
