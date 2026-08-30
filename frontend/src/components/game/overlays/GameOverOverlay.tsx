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
      <div className="overlay hidden" id="gameOverOverlay" role="dialog" aria-modal="true" aria-label="Trial results">
        <div className="menu-card" style={{ borderColor: 'rgba(255,178,62,0.35)', padding: 28 }}>
          <CyberBadge variant="amber" id="govBadge">⬢ TRIAL COMPLETE</CyberBadge>
          <div className="result-score" id="winnerText">SURVIVED THE VOID</div>
          <p id="winnerSub">10:00 // The void never breaks you</p>

          <div className="trials-score-breakdown" id="trialsScoreBreakdown" style={{ marginTop: 20, padding: '16px 12px', background: 'rgba(255,178,62,0.08)', border: '1px solid rgba(255,178,62,0.2)', borderRadius: 4 }} aria-label="Trial score breakdown" role="region">
            <div style={{ font: '11px var(--nox-mono)', color: 'var(--nox-amber)', letterSpacing: '0.1em', marginBottom: 8 }}>FINAL SCORE BREAKDOWN</div>
            <div className="score-row" role="listitem" aria-label="Survival Time" style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', font: '12px var(--nox-mono)' }}>
              <span>Survival Time</span>
              <strong id="scoreTime">10:00</strong>
            </div>
            <div className="score-row" role="listitem" aria-label="Survival Points bonus" style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', font: '12px var(--nox-mono)' }}>
              <span className="flex items-center gap-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg> Survival Points</span>
              <strong id="scoreSurvival" className="text-[var(--nox-lime)]">+0</strong>
            </div>
            <div className="score-row" role="listitem" aria-label="Hit Bonus" style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', font: '12px var(--nox-mono)' }}>
              <span className="flex items-center gap-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg> Hit Bonus</span>
              <strong id="scoreHits" className="text-[var(--nox-lime)]">+0</strong>
            </div>
            <div className="score-row" role="listitem" aria-label="Pickup Bonus" style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', font: '12px var(--nox-mono)' }}>
              <span className="flex items-center gap-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg> Pickup Bonus</span>
              <strong id="scorePickups" className="text-[var(--nox-lime)]">+0</strong>
            </div>
            <div className="score-row" role="listitem" aria-label="Lava Penalty" style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', font: '12px var(--nox-mono)' }}>
              <span className="flex items-center gap-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg> Lava Penalty</span>
              <strong id="scoreLava" className="text-[var(--nox-pink)]">0</strong>
            </div>
            <div className="score-row" role="listitem" aria-label="Slime Penalty" style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', font: '12px var(--nox-mono)' }}>
              <span className="flex items-center gap-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg> Slime Penalty</span>
              <strong id="scoreSlime" className="text-[var(--nox-pink)]">0</strong>
            </div>
            <div className="score-row" role="listitem" aria-label="Bot Kill Bonus" style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', font: '12px var(--nox-mono)' }}>
              <span className="flex items-center gap-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg> Bot Kill Bonus</span>
              <strong id="scoreBotKill" className="text-[var(--nox-amber)]">+0</strong>
            </div>
            <div className="score-row" role="listitem" aria-label="Void Penalty" style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', font: '12px var(--nox-mono)' }}>
              <span className="flex items-center gap-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg> Void Penalty</span>
              <strong id="scoreVoid" className="text-[var(--nox-pink)]">0</strong>
            </div>
            <hr style={{ borderColor: 'rgba(255,178,62,0.3)', margin: '10px 0' }} />
            <div className="score-row" role="listitem" aria-label="Total score" style={{ display: 'flex', justifyContent: 'space-between', font: '14px var(--nox-mono)', fontWeight: 800 }}>
              <span>TOTAL</span>
              <strong id="scoreTotal" className="text-[var(--nox-fg)]">0</strong>
            </div>
            <div style={{ font: '10px var(--nox-mono)', color: 'var(--nox-muted)', marginTop: 6, textAlign: 'right' }} aria-label="High score">
              High Score: <strong id="scoreHigh" className="text-[var(--nox-amber)]">0</strong>
            </div>
          </div>

          <div className="btn-row" style={{ marginTop: 20 }}>
            <button className="btn btn-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2" id="rematchBtn" onClick={onRematch} aria-label="Run trial again">↻ RUN AGAIN</button>
            <button className="btn btn-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2" id="menuBtn" onClick={onMenu} aria-label="Return to menu">Menu</button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="overlay hidden" id="gameOverOverlay" role="dialog" aria-modal="true" aria-label="Game results">
      <div className="menu-card">
        <CyberBadge variant="amber">🏆 CHAMPION OF THE VOID</CyberBadge>
        <div className="result-score" id="winnerText">PLAYER 1 WINS!</div>
        <p id="winnerSub">5 // 2 • Flawless dodges</p>
        <div className="btn-row">
          <button className="btn btn-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2" id="rematchBtn" onClick={onRematch} aria-label="Rematch">↻ REMATCH</button>
          <button className="btn btn-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2" id="menuBtn" onClick={onMenu} aria-label="Return to menu">Menu</button>
        </div>
      </div>
    </div>
  )
}
