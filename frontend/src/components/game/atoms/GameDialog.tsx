import { useEffect, useRef, type ReactNode } from 'react'

// P2-08/P3-01: one dialog primitive for all game overlays — dialog semantics,
// initial focus, focus trap, explicit Escape policy, and focus restore.
// Escape ownership is deliberate: pass escapeCloses={false} when the engine
// already owns Escape (e.g. trials pause) to avoid double toggling.
export default function GameDialog({
  label,
  children,
  onClose,
  escapeCloses = true,
  className = 'menu-card',
  style,
  zIndex = 100,
}: {
  label: string
  children: ReactNode
  onClose?: () => void
  escapeCloses?: boolean
  className?: string
  style?: React.CSSProperties
  zIndex?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    // initial focus: first focusable element inside the dialog
    const focusables = () => Array.from(
      dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.hasAttribute('disabled'))
    const first = focusables()[0]
    first?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escapeCloses) {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return
      // focus trap
      const items = focusables()
      if (items.length === 0) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault(); lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault(); firstEl.focus()
      }
    }
    dialog.addEventListener('keydown', onKeyDown)
    return () => {
      dialog.removeEventListener('keydown', onKeyDown)
      // restore focus to whatever invoked the dialog
      previouslyFocused?.focus?.()
    }
  }, [escapeCloses, onClose])

  return (
    <div className="overlay" style={{ zIndex }} onKeyDown={e => e.stopPropagation()}>
      <div ref={ref} className={className} style={style} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {children}
      </div>
    </div>
  )
}
