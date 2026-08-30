import CyberBadge from '../atoms/CyberBadge'

export default function GameOverOverlay({
  mode = '1v1',
  onRematch,
  onMenu,
}: {
  mode?: '1v1' | 'trials'
  onRematch: () => void
  onMenu: () => void
}) {
  if (mode === 'trials') {
    return (
      <div className="overlay hidden" id="gameOverOverlay">
        <div className="menu-card" style={{ borderColor: 'rgba(255,178,62,0.35)' }}>
          <CyberBadge variant="amber">⬢ TRIAL COMPLETE</CyberBadge>
          <div className="result-score" id="winnerText">SURVIVED THE VOID</div>
          <p id="winnerSub">10:00 // The void never breaks you</p>
          <div className="btn-row">
            <button className="btn btn-primary" id="rematchBtn" onClick={onRematch}>↻ RUN AGAIN</button>
            <button className="btn btn-ghost" id="menuBtn" onClick={onMenu}>Menu</button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="overlay hidden" id="gameOverOverlay">
      <div className="menu-card">
        <CyberBadge variant="amber">🏆 CHAMPION OF THE VOID</CyberBadge>
        <div className="result-score" id="winnerText">PLAYER 1 WINS!</div>
        <p id="winnerSub">5 // 2 • Flawless dodges</p>
        <div className="btn-row">
          <button className="btn btn-primary" id="rematchBtn" onClick={onRematch}>↻ REMATCH</button>
          <button className="btn btn-ghost" id="menuBtn" onClick={onMenu}>Menu</button>
        </div>
      </div>
    </div>
  )
}
