import { useEffect } from 'react'
import CyberBadge from '../atoms/CyberBadge'
import GameDialog from '../atoms/GameDialog'

// P2-08: dialog lifecycle (initial focus, trap, Escape, focus restore) is
// delegated to GameDialog; this component stays presentation-only.
export default function HowToPlayModal({ mode = '1v1', onClose }: { mode?: '1v1' | 'trials' | 'online'; onClose: () => void }) {
  const isTrials = mode === 'trials'
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="how-modal">
      <GameDialog label={isTrials ? 'Void Trials field manual' : 'How to play'} onClose={onClose} escapeCloses={false} className="how-modal__card">
        <button className="how-modal__close" onClick={onClose} aria-label="Close how-to-play manual">✕</button>
        <div className="how-modal__header">
          <CyberBadge variant={isTrials ? 'amber' : 'cyan'}>{isTrials ? 'VOID TRIALS // SOLO' : 'HOW TO PLAY'}</CyberBadge>
          <h2 id="how-modal-title" className="how-modal__title">
            {isTrials ? 'VOID TRIALS // FIELD MANUAL' : 'NEON VOID // QUICK GUIDE'}
          </h2>
          <p className="how-modal__subtitle">{isTrials ? 'One keyboard. You vs the bot. 10 minutes. The void crushes at 7:30.' : 'Same keyboard, two players - first to 5 wins.'}</p>
        </div>

        <div className="how-modal__body">
          <section className="how-section">
            <h3 className="how-section__title" style={{ color: 'var(--nox-cyan)' }}>
              <span className="how-section__index">01</span> {isTrials ? 'MOVE // SOLO' : 'MOVE & SHOOT'}
            </h3>
            <div className="how-card how-card--cyan">
              <div className="how-row">
                <span className="how-player">P1 // CYAN</span>
                <span className="keycap">W</span><span className="keycap">A</span><span className="keycap">S</span><span className="keycap">D</span>
                <span className="keycap keycap-accent">SHIFT</span>
                <span className="keycap" style={{ background: '#fff', color: '#07090b' }}>SPACE</span>
                {isTrials && <span className="keycap" style={{ marginLeft: 8, borderColor: 'var(--nox-amber)', color: 'var(--nox-amber)' }}>P / ESC = PAUSE</span>}
              </div>
              {!isTrials && (
                <div className="how-row">
                  <span className="how-player" style={{ color: 'var(--nox-pink)' }}>P2 // PINK</span>
                  <span className="keycap">↑</span><span className="keycap">←</span><span className="keycap">↓</span><span className="keycap">→</span>
                  <span className="keycap keycap-accent">/</span>
                  <span className="keycap" style={{ background: '#fff', color: '#07090b' }}>ENTER</span>
                </div>
              )}
              <p className="how-desc">
                {isTrials ? <>Use <strong>WASD</strong> to run. Hold <strong>Shift</strong> to <strong>dash</strong> — you flash forward and cannot be hit. Hold <strong>Space</strong> to shoot. The bot uses the same arena and rules, but it <strong>fears the void</strong> — when the border closes in, it runs for safety.</> : <>Use the move keys to run around. Hold <strong>Shift</strong> or <strong>/</strong> to <strong>dash</strong> — you flash forward and cannot get hit for a moment. Hold <strong>Space</strong> or <strong>Enter</strong> to keep shooting.</>}
              </p>
              {isTrials && <p className="how-desc" style={{ marginTop: 6, opacity: 0.7 }}>Press <strong>P</strong> or <strong>Esc</strong> to pause — your run saves locally and you can resume.</p>}
            </div>
          </section>

          <section className="how-section">
            <h3 className="how-section__title" style={{ color: 'var(--nox-pink)' }}><span className="how-section__index">02</span> POWER-UPS</h3>
            <div className="how-card how-card--pink">
              <div className="orb-grid">
                <span className="how-orb how-orb--over">⚡</span><span className="how-orb how-orb--shield">❄</span><span className="how-orb how-orb--blink">✦</span><span className="how-orb how-orb--heal">✚</span>
              </div>
              <ul className="how-list">
                <li><strong style={{ color: 'var(--nox-amber)' }}>⚡ Triple shot</strong> — shoots three bullets at once for a little while.</li>
                <li><strong style={{ color: 'var(--nox-cyan)' }}>❄ Shield</strong> — puts a bubble around you. It cracks when hit and breaks after a few hits.</li>
                <li><strong style={{ color: 'var(--nox-lime)' }}>✦ Dash boost</strong> — lets you dash again right away and makes you a bit faster.</li>
                <li><strong style={{ color: 'var(--success)' }}>✚ Heart</strong> — heals you a little.</li>
                <li style={{ marginTop: 8, opacity: 0.95 }}><strong style={{ color: '#a78bfa' }}>Needle</strong> — tiny and very fast. Weak from the front, super strong from behind.  •  <strong style={{ color: '#ffb23e' }}>Cannon</strong> — big and slow but hits really hard.  •  <strong style={{ color: '#58d8ff' }}>Trick</strong> — bounces off walls.</li>
              </ul>
              <p className="how-desc" style={{ opacity: 0.7, marginTop: 8 }}>{isTrials ? 'Both you and the bot can pick them up. The bot loves shield when hurt and triple when healthy.' : 'Special bullets come from pickups. You get a few shots, then you go back to your normal bullet.'}</p>
            </div>
          </section>

          <section className="how-section">
            <h3 className="how-section__title" style={{ color: 'var(--nox-amber)' }}><span className="how-section__index">03</span> WATCH OUT</h3>
            <div className="how-card how-card--amber">
              <ul className="how-list">
                <li><strong>Walls</strong> — dark blocks. They stop you and stop most bullets. Trick bullets bounce off them.</li>
                <li><strong style={{ color: '#fb923c' }}>Lava</strong> — orange circle on the floor. It blinks first to warn you, then turns red and burns you if you stay on it.</li>
                <li><strong style={{ color: '#10b981' }}>Slime</strong> — green goo that makes you move slow while you are inside. It does not hurt you.</li>
                <li><strong style={{ color: 'var(--nox-amber)' }}>The Void {isTrials ? '// RECTANGLE' : ''}</strong> — {isTrials ? 'At 7:30 a rectangular border starts shrinking from the 2× edges toward the 1× center over 30 seconds. Damage outside is exponential — deeper = deadlier. Stay inside the amber line.' : 'after a while the edge of the arena starts closing in. Green blocks crumble at the border. Stay in the middle or you will lose health.'}</li>
              </ul>
            </div>
          </section>

          <section className="how-section">
            <h3 className="how-section__title" style={{ color: 'var(--nox-lime)' }}><span className="how-section__index">04</span> {isTrials ? 'HOW TO SURVIVE' : 'HOW TO WIN'}</h3>
            <div className="how-card how-card--lime">
              {isTrials ? (
                <>
                  <p className="how-desc">Survive <strong>10:00</strong> or <strong>kill the bot</strong> (12 HP). You earn <strong>+1/s</strong> for living, <strong>+25</strong> per hit, <strong>+75</strong> per pickup. Lava <strong>-30</strong>, slime <strong>-15</strong>, getting shot <strong>-3</strong>, void damage <strong>-1</strong> per point lost. After <strong>7:30</strong> gains <strong>×2</strong> and losses <strong>×3</strong>.</p>
                  <p className="how-desc" style={{ marginTop: 8 }}>The bot <strong>dreads the void</strong> — when the border closes in it will run for the amber line instead of chasing you. Use that window. Pause with <strong>P</strong>, exit with confirmation saves your high score. Your run auto-saves every 2 seconds.</p>
                </>
              ) : (
                <>
                  <p className="how-desc">Knock out the other player to win a round. If no one is knocked out when the timer runs out, the player with more health wins. Tied health is a draw.</p>
                  <p className="how-desc" style={{ marginTop: 8 }}>First to <strong>5 round wins</strong> wins the whole game.</p>
                </>
              )}
            </div>
          </section>
        </div>

        <div className="how-modal__footer">
          <button className="btn btn-primary" onClick={onClose}>{isTrials ? 'ENTER THE VOID // READY' : 'GOT IT // FIGHT!'}</button>
        </div>
      </GameDialog>
    </div>
  )
}
