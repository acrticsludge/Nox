import CyberTimer from '../atoms/CyberTimer'

export default function CenterHUD({ mode = '1v1', onPause }: { mode?: '1v1' | 'trials'; onPause?: () => void }) {
  const isTrials = mode === 'trials'
  return (
    <div className="center-hud">
      <div className="round-label" id="roundLabel" style={isTrials ? { opacity: 0.0, height: 0, overflow: 'hidden', margin: 0, padding: 0 } : undefined}>
        {mode === 'trials' ? 'VOID TRIALS' : 'FIRST TO 5 • ROUND 1'}
      </div>
      <CyberTimer initial={isTrials ? '10:00' : '01:00'} />
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {isTrials && onPause && (
          <button className="cyber-pause-btn" onClick={onPause} aria-label="Pause trial">
            <span>⏸</span> PAUSE <span style={{ opacity: 0.6, fontSize: '9px' }}>[P]</span>
          </button>
        )}
        {isTrials && (
          <button className="cyber-pause-btn" style={{ borderColor: 'rgba(255,92,168,0.28)', color: 'var(--nox-pink)', background: 'rgba(255,92,168,0.08)' }} onClick={() => window.dispatchEvent(new CustomEvent('nox:forfeitTrials'))} aria-label="Exit trial">
            ✕ EXIT
          </button>
        )}
      </div>
    </div>
  )
}
