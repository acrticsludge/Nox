import type { ReactNode } from 'react'

export default function PowerChip({
  variant,
  label,
  fillId,
  timerId,
  chipId,
}: {
  variant: 'ov' | 'sh' | 'bl'
  label: string
  fillId: string
  timerId: string
  chipId: string
}) {
  const icons: Record<typeof variant, ReactNode> = {
    ov: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
      </svg>
    ),
    sh: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M12 22s7-4 7-10V6l-7-4-7 4v6c0 6 7 10 7 10z" />
      </svg>
    ),
    bl: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.4 6.6L22 12l-6.6 3.4L12 22l-3.4-6.6L2 12l6.6-3.4z" />
        <circle cx="19" cy="5" r="1.6" opacity="0.9" />
        <circle cx="20.5" cy="8.2" r="0.9" opacity="0.6" />
      </svg>
    ),
  }
  return (
    <div className={`power-chip ${variant}`} id={chipId}>
      <div className="chip-head">
        {icons[variant]}
        <span className="chip-label">{label}</span>
        <span className="chip-timer" id={timerId} />
      </div>
      <div className="chip-bar">
        <div className="chip-fill" id={fillId} />
      </div>
    </div>
  )
}
