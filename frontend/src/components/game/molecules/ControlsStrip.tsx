export default function ControlsStrip({ mode = '1v1' }: { mode?: '1v1' | 'trials' }) {
  const isTrials = mode === 'trials'
  return (
    <div className="controls-strip" aria-label="Controls">
      <div className="controls-group">
        <span className="controls-label" style={{ color: isTrials ? 'var(--nox-amber)' : 'var(--nox-cyan)' }}>
          {isTrials ? 'P1 // CYAN' : 'P1 // CYAN'}
        </span>
        <span className="keycap">W</span>
        <span className="keycap">A</span>
        <span className="keycap">S</span>
        <span className="keycap">D</span>
        <span className="keycap keycap-accent">SHIFT</span>
        <span className="keycap" style={{ background: '#fff', color: '#07090b', borderColor: '#fff' }}>
          SPACE
        </span>
      </div>
      {isTrials ? null : (
        <div className="controls-group">
          <span className="controls-label" style={{ color: 'var(--nox-pink)' }}>
            P2 // PINK
          </span>
          <span className="keycap">↑</span>
          <span className="keycap">←</span>
          <span className="keycap">↓</span>
          <span className="keycap">→</span>
          <span className="keycap keycap-accent">/</span>
          <span className="keycap" style={{ background: '#fff', color: '#07090b', borderColor: '#fff' }}>
            ENTER
          </span>
        </div>
      )}
    </div>
  )
}
