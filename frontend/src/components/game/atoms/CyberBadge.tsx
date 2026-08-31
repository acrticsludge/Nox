import type { ReactNode } from 'react'

export default function CyberBadge({
  children,
  variant = 'lime',
  id,
}: {
  children: ReactNode
  variant?: 'lime' | 'cyan' | 'amber' | 'pink' | 'secondary'
  id?: string
}) {
  return (
    <span className={`cyber-badge cyber-badge--${variant}`} id={id}>
      <span className="cyber-badge__text">{children}</span>
      <span className="cyber-badge__border" aria-hidden="true" />
      <span className="cyber-badge__spark" aria-hidden="true" />
    </span>
  )
}
