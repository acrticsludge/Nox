import CyberBadge from '../atoms/CyberBadge'
import GameDialog from '../atoms/GameDialog'

// P2-08: pause dialog uses the shared dialog primitive. Escape stays owned by
// the engine (trials single-owner pause, P0-05) — the dialog does NOT close
// on Escape to avoid a double toggle; RESUME/EXIT buttons handle it.
export default function PauseOverlay({ onResume, onExit }: { onResume: () => void; onExit: () => void }) {
  return (
    <GameDialog label="Trial paused" escapeCloses={false}>
      <CyberBadge variant="amber">⏸ PAUSED</CyberBadge>
      <h2 className="menu-title" style={{ marginTop: 18 }}>VOID TRIALS // PAUSED</h2>
      <p style={{ color: 'var(--nox-muted)', font: '12px var(--nox-mono)', lineHeight: 1.6 }}>
        Press <strong style={{ color: 'var(--nox-fg)' }}>P</strong> or <strong style={{ color: 'var(--nox-fg)' }}>Esc</strong> to resume. Your state is saved locally.
      </p>
      <div className="btn-row" style={{ marginTop: 20 }}>
        <button className="btn btn-primary" onClick={onResume}>▶ RESUME</button>
        <button className="btn btn-ghost" onClick={onExit}>EXIT TRIAL</button>
      </div>
    </GameDialog>
  )
}
