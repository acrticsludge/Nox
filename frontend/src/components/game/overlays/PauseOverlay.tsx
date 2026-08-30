import CyberBadge from '../atoms/CyberBadge'

export default function PauseOverlay({ onResume, onExit }: { onResume: () => void; onExit: () => void }) {
  return (
    <div className="overlay" style={{ zIndex: 100 }}>
      <div className="menu-card" style={{ padding: 30 }}>
        <CyberBadge variant="amber">⏸ PAUSED</CyberBadge>
        <h2 className="menu-title" style={{ marginTop: 18 }}>VOID TRIALS // PAUSED</h2>
        <p style={{ color: 'var(--nox-muted)', font: '12px var(--nox-mono)', lineHeight: 1.6 }}>
          Press <strong style={{ color: 'var(--nox-fg)' }}>P</strong> or <strong style={{ color: 'var(--nox-fg)' }}>Esc</strong> to resume. Your state is saved locally.
        </p>
        <div className="btn-row" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={onResume}>▶ RESUME</button>
          <button className="btn btn-ghost" onClick={onExit}>EXIT TRIAL</button>
        </div>
      </div>
    </div>
  )
}
