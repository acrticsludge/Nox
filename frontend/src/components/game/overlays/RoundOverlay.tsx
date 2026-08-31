import CyberBadge from '../atoms/CyberBadge'

export default function RoundOverlay({ mode = '1v1' }: { mode?: '1v1' | 'trials' | 'online' }) {
  return (
    <div className="overlay hidden" id="roundOverlay">
      <div className="menu-card" style={{ padding: 22 }}>
        <CyberBadge variant={mode === 'trials' ? 'amber' : 'cyan'} id="roundBadge">
          {mode === 'trials' ? 'TRIAL // RUN' : 'ROUND 1'}
        </CyberBadge>
        <div className="result-score" id="roundTitle" style={{ fontSize: 28 }}>
          GET READY
        </div>
        <p id="roundSub" style={{ margin: 0 }}>
          {mode === 'trials' ? 'Survive 10:00 or kill the bot' : 'First to 5 • Dash is invincible'}
        </p>
      </div>
    </div>
  )
}
