import { useEffect, useState } from 'react'
import CyberBadge from '../atoms/CyberBadge'
import GlobalSpeedControl from '../atoms/GlobalSpeedControl'

export default function StartOverlay({ mode = '1v1', onPlay, onHow }: { mode?: '1v1' | 'trials'; onPlay: () => void; onHow: () => void }) {
  const [hasSaved, setHasSaved] = useState(false)
  const [highScore, setHighScore] = useState(0)

  useEffect(() => {
    const check = () => {
      try {
        setHasSaved(!!localStorage.getItem('nv_trials_state'))
        setHighScore(parseInt(localStorage.getItem('nv_trials_highscore') || '0', 10))
      } catch {}
    }
    check()
    window.addEventListener('storage', check)
    window.addEventListener('nox:trialsStateChanged', check as EventListener)
    return () => {
      window.removeEventListener('storage', check)
      window.removeEventListener('nox:trialsStateChanged', check as EventListener)
    }
  }, [])

  const handleResume = () => {
    document.getElementById('startOverlay')?.classList.add('hidden')
    window.dispatchEvent(new CustomEvent('nox:resumeTrial'))
  }

  if (mode === 'trials') {
    return (
      <div className="overlay" id="startOverlay">
        <div className="menu-card menu-card--trials" style={{ borderColor: 'rgba(255,178,62,0.35)', gap: 10, padding: '20px 18px' }}>
          <CyberBadge variant="amber">⬢ 1 PLAYER • VS AI • 10:00</CyberBadge>
          <h2 className="menu-title" style={{ fontSize: 'clamp(32px, 6vw, 52px)', lineHeight: 0.9 }}>
            <span style={{ color: 'var(--nox-amber)' }}>VOID</span> TRIALS
          </h2>
          <p className="menu-copy" style={{ fontSize: 13, lineHeight: 1.4, opacity: 0.7 }}>
            Solo on <strong>2x arena</strong> vs bot. Same physics as <strong>1v1</strong> — survive <strong>10:00</strong> or kill the bot. Void crushes at <strong style={{ color: 'var(--nox-amber)' }}>7:30</strong>.
          </p>

          <div className="trials-score-board" style={{ margin: '6px 0', padding: '8px 10px' }}>
            <div className="trials-score-board__row">
              <span>HIGH SCORE</span>
              <strong id="trialsHighScore">{highScore.toLocaleString()}</strong>
            </div>
            {hasSaved && (
              <div className="trials-score-board__row trials-score-board__row--saved">
                <span>SAVED TRIAL FOUND</span>
                <strong style={{ color: 'var(--nox-lime)' }}>READY TO RESUME</strong>
              </div>
            )}
          </div>

          <GlobalSpeedControl />

          <div className="btn-row" style={{ gap: 8 }}>
            <button className="btn btn-primary" id="playBtn" onClick={onPlay} style={{ padding: '10px 18px', fontSize: 13 }}>
              ▶ ENTER THE TRIAL
            </button>
            {hasSaved && (
              <button className="btn btn-ghost" id="resumeBtn" style={{ borderColor: 'var(--nox-lime)', color: 'var(--nox-lime)', padding: '10px 14px', fontSize: 13 }} onClick={handleResume}>
                ↻ RESUME
              </button>
            )}
            <button className="btn btn-ghost" id="howBtn" onClick={onHow} style={{ padding: '10px 14px', fontSize: 13 }}>
              How to play
            </button>
          </div>

          <div className="hint" style={{ color: 'var(--nox-muted)', fontSize: 10, marginTop: 2 }}>
            WASD + SHIFT + SPACE • P pause • EXIT forfeit • Bot shoots back same as P2
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="overlay" id="startOverlay">
      <div className="menu-card">
        <CyberBadge variant="lime">◇ SAME KEYBOARD • 2 PLAYERS • 60 SECONDS</CyberBadge>
        <h2 className="menu-title"><span>NEON</span> VOID</h2>
        <p className="menu-copy">
          Fast arena shooter. Dash through walls, grab orbs. First to <strong>5 wins</strong> takes the void. No bots // just you vs your friend.
        </p>
        <GlobalSpeedControl />
        <div className="btn-row">
          <button className="btn btn-primary" id="playBtn" onClick={onPlay}>▶ START DUEL</button>
          <button className="btn btn-ghost" id="howBtn" onClick={onHow}>How to play</button>
        </div>
        <div className="hint">Walls 1-unit grid • LAVA / SLIME / VOID hazards • Orbs never spawn in hazards</div>
      </div>
    </div>
  )
}
