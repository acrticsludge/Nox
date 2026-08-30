import { useEffect, useRef, useState, type ReactNode } from 'react'

export default function GameShell({ mode = '1v1' }: { mode?: '1v1' | 'trials' }) {
  const isTrials = mode === 'trials'
  const gameReady = useRef<Promise<void> | null>(null)
  const [showHow, setShowHow] = useState(false)
  const [showPause, setShowPause] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  useEffect(() => {
    gameReady.current = import('../game/game-logic.js')
      .then(() => {
        console.log('[NOX] game-logic loaded')
      })
      .catch((e) => console.error('[NOX] game-logic load failed', e))
  }, [])

  // Pause/Resume key handler (trials only)
  useEffect(() => {
    if (!isTrials) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        const g = (window as unknown as { NOX_GAME?: { gameState?: () => string } }).NOX_GAME
        if (!g || !g.gameState) return
        const state = g.gameState()
        if (state === 'playing') {
          setShowPause(true)
          window.dispatchEvent(new CustomEvent('nox:pause'))
        } else if (state === 'paused') {
          setShowPause(false)
          window.dispatchEvent(new CustomEvent('nox:resume'))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isTrials])

  // Listen for pause state changes from game logic
  useEffect(() => {
    const onPause = () => setShowPause(true)
    const onResume = () => setShowPause(false)
    window.addEventListener('nox:pause', onPause)
    window.addEventListener('nox:resume', onResume)
    return () => {
      window.removeEventListener('nox:pause', onPause)
      window.removeEventListener('nox:resume', onResume)
    }
  }, [])

  // Lock body scroll when modal open + ESC to close
  useEffect(() => {
    if (!showHow) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowHow(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [showHow])

  // Fallback: imperative howBtn (from game-logic) can open modal via custom event
  useEffect(() => {
    const onOpen = () => setShowHow(true)
    window.addEventListener('nox:openHow', onOpen as EventListener)
    return () => window.removeEventListener('nox:openHow', onOpen as EventListener)
  }, [])

  const handlePlay = () => {
    const g = (window as unknown as { NOX_GAME?: { startTrials?: () => void; startGame?: () => void } }).NOX_GAME
    if (isTrials) {
      if (g?.startTrials) g.startTrials()
      else window.dispatchEvent(new CustomEvent('nox:startTrials'))
      setTimeout(() => {
        const gg = (window as unknown as { NOX_GAME?: { startTrials?: () => void } }).NOX_GAME
        const overlay = document.getElementById('startOverlay')
        const inCountdown = (gg as unknown as { gameState?: () => string })?.gameState?.() === 'countdown'
        if (gg?.startTrials && overlay && !overlay.classList.contains('hidden') && !inCountdown) {
          gg.startTrials()
        }
      }, 60)
    } else {
      window.dispatchEvent(new CustomEvent('nox:startGame'))
      setTimeout(() => {
        const gg = (window as unknown as { NOX_GAME?: { startGame?: () => void } }).NOX_GAME
        if (gg?.startGame && document.getElementById('startOverlay') && !document.getElementById('startOverlay')?.classList.contains('hidden')) {
          gg.startGame()
        }
      }, 60)
    }
  }
  const handleHow = () => setShowHow(true)
  const handleCloseHow = () => setShowHow(false)
  const handleRematch = () => {
    document.getElementById('gameOverOverlay')?.classList.add('hidden')
    if (isTrials) {
      const g = (window as unknown as { NOX_GAME?: { startTrials?: () => void } }).NOX_GAME
      if (g?.startTrials) g.startTrials()
      else window.dispatchEvent(new CustomEvent('nox:startTrials'))
    } else {
      window.dispatchEvent(new CustomEvent('nox:startGame'))
    }
  }
  const handleMenu = () => {
    window.dispatchEvent(new CustomEvent('nox:backToMenu'))
  }
  const handleExit = (player: 1 | 2) => {
    if (isTrials) {
      window.dispatchEvent(new CustomEvent('nox:forfeitTrials'))
    } else {
      window.dispatchEvent(new CustomEvent('nox:forfeit', { detail: { playerId: player - 1 } }))
    }
  }

  // Sync global speed dial with game logic after load
  useEffect(() => {
    const sync = async () => {
      if (gameReady.current) await gameReady.current
      const g = (window as unknown as { NOX_GAME?: { getGlobalSpeed?: () => number } }).NOX_GAME
      const v = g?.getGlobalSpeed?.()
      if (v != null) {
        const el = document.getElementById('speedGlobal') as HTMLInputElement | null
        const val = document.getElementById('speedValGlobal')
        if (el) el.value = String(v)
        if (val) val.textContent = Number(v).toFixed(1)
      }
    }
    const id = setTimeout(sync, 300)
    return () => clearTimeout(id)
  }, [])

  return (
    <>
      <main className="nox-shell">
        <div className="grid-noise" aria-hidden="true" />

        {/* Header */}
        <header className="nox-header">
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="diamond-mark">
              <span />
            </div>
            <a href="/" className="brand-lockup" style={{ textDecoration: 'none' }}>
              NOX
            </a>
            <span style={{ color: 'var(--nox-muted)', opacity: 0.5, font: '10px var(--nox-mono)', letterSpacing: '0.1em' }}>//</span>
            <a href="/play" className="brand-lockup" style={{ textDecoration: 'none' }}>
              PLAY
            </a>
            <span style={{ color: 'var(--nox-muted)', opacity: 0.5, font: '10px var(--nox-mono)', letterSpacing: '0.1em' }}>//</span>
            <span className="brand-lockup" style={{ color: isTrials ? 'var(--nox-amber)' : 'var(--nox-lime)' }}>
              {isTrials ? 'TRIALS' : '1V1'}
            </span>
          </div>
          <CyberStatus label={isTrials ? 'NEON VOID // TRIALS' : 'NEON VOID // 1V1'} />
        </header>

        <div className="nox-content game-layout">
          {/* Top bar: player HUD + round info */}
          <div className="game-top-bar">
            <PlayerHUD player={1} onExit={() => handleExit(1)} mode={mode} />
            <CenterHUD mode={mode} onPause={() => { setShowPause(true); window.dispatchEvent(new CustomEvent('nox:pause')) }} />
            {isTrials ? <TrialsHUD onPause={() => { setShowPause(true); window.dispatchEvent(new CustomEvent('nox:pause')) }} /> : <PlayerHUD player={2} onExit={() => handleExit(2)} mode={mode} />}
          </div>

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

          {/* Game stage */}
          <GameStage
            mode={mode}
            onPlay={handlePlay}
            onHow={handleHow}
            onRematch={handleRematch}
            onMenu={handleMenu}
          />
        </div>

        {/* Footer */}
        <footer className="nox-footer">
          <span>
            BUILT WITH SVG • NO CANVAS • 60FPS • <a href="/docs" style={{ color: 'var(--nox-lime)', textDecoration: 'none', borderBottom: '1px solid rgba(201,255,47,0.3)' }}>MANUAL // DOCS</a>
          </span>
          <span>MADE FOR BORED LEGENDS AT 2AM</span>
        </footer>
      </main>

      {/* Pause overlay (trials only) */}
      {isTrials && showPause && (
        <div className="overlay" style={{ zIndex: 100 }}>
          <div className="menu-card" style={{ padding: 30 }}>
            <CyberBadge variant="amber">⏸ PAUSED</CyberBadge>
            <h2 className="menu-title" style={{ marginTop: 18 }}>VOID TRIALS // PAUSED</h2>
            <p style={{ color: 'var(--nox-muted)', font: '12px var(--nox-mono)', lineHeight: 1.6 }}>
              Press <strong style={{ color: 'var(--nox-fg)' }}>P</strong> or <strong style={{ color: 'var(--nox-fg)' }}>Esc</strong> to resume. Your state is saved locally.
            </p>
            <div className="btn-row" style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => { setShowPause(false); const g = (window as unknown as { NOX_GAME?: { resumeTrials?: () => void } }).NOX_GAME; if ((g as unknown as { gameState?: () => string })?.gameState?.() === 'paused') { window.dispatchEvent(new CustomEvent('nox:resume')) } }}>
                ▶ RESUME
              </button>
              <button className="btn btn-ghost" onClick={() => setShowExitConfirm(true)}>
                EXIT TRIAL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit confirmation (trials only) */}
      {isTrials && showExitConfirm && (
        <div className="overlay" style={{ zIndex: 101 }}>
          <div className="menu-card" style={{ padding: 30, borderColor: 'var(--nox-amber)' }}>
            <CyberBadge variant="amber">⚠ FORFEIT</CyberBadge>
            <h2 className="menu-title" style={{ marginTop: 18, color: 'var(--nox-amber)' }}>EXIT VOID TRIAL?</h2>
            <p style={{ color: 'var(--nox-muted)', font: '12px var(--nox-mono)', lineHeight: 1.6 }}>
              Your progress and high score will be saved. Are you sure you want to leave the trial?
            </p>
            <div className="btn-row" style={{ marginTop: 20 }}>
              <button className="btn btn-primary" style={{ background: 'var(--nox-amber)', color: 'var(--nox-bg)' }} onClick={() => { setShowExitConfirm(false); setShowPause(false); window.dispatchEvent(new CustomEvent('nox:forfeitTrials')) }}>
                YES // EXIT
              </button>
              <button className="btn btn-ghost" onClick={() => setShowExitConfirm(false)}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {showHow && <HowToPlayModal mode={mode} onClose={handleCloseHow} />}
    </>
  )
}

/* ── Cyberpunk replacements for pill components ── */

function CyberStatus({ label }: { label: string }) {
  return (
    <span className="cyber-status" role="status" aria-label={label}>
      <span className="cyber-status__dot" aria-hidden="true" />
      <span className="cyber-status__label">{label}</span>
      <span className="cyber-status__frame" aria-hidden="true">
        <i className="cyber-status__spark" />
      </span>
    </span>
  )
}

function CyberBadge({
  children,
  variant = 'lime',
  id,
}: {
  children: ReactNode
  variant?: 'lime' | 'cyan' | 'amber' | 'pink'
  id?: string
}) {
  return (
    <span className={`cyber-badge cyber-badge--${variant}`} id={id}>
      <span className="cyber-badge__text">{children}</span>
      <span className="cyber-badge__border" aria-hidden="true" />
      <span className="cyber-badge__spark" aria-hidden="true" />
    </span>
  )
}

function CyberTimer({ initial = '01:00' }: { initial?: string }) {
  return (
    <div className="cyber-timer" id="timer" aria-live="polite">
      <span className="cyber-timer__inner">{initial}</span>
      <span className="cyber-timer__brackets" aria-hidden="true">
        <span className="bracket bracket--tl" />
        <span className="bracket bracket--tr" />
        <span className="bracket bracket--bl" />
        <span className="bracket bracket--br" />
      </span>
      <span className="cyber-timer__spark" aria-hidden="true" />
    </div>
  )
}

function PlayerHUD({ player, onExit, mode = '1v1' }: { player: 1 | 2; onExit?: () => void; mode?: '1v1' | 'trials' }) {
  const isP1 = player === 1
  const isTrials = mode === 'trials'
  return (
    <div className={`player-hud ${isP1 ? 'p1' : 'p2'}`} id={`cardP${player}`}>
      {isP1 && (
        <div className="avatar">
          ◇
          <div className="ava-dash" id="dashP1" />
          <div className="ava-extra" id="extraP1" />
        </div>
      )}
      <div className="hud-main">
        <div className="hud-topline">
          <div>
            <div className="hud-name">PLAYER {player}</div>
            <div className="hud-sub">{isP1 ? 'CYAN SPECTRE' : 'MAGENTA RIFT'}</div>
          </div>
          <div className="score" id={`scoreP${player}`} style={isTrials ? { opacity: 0, pointerEvents: 'none', width: 0, minWidth: 0 } : undefined}>
            0
          </div>
        </div>
        <div className="hearts" id={`heartsP${player}`} />
        <div className="status-row" id={`statusP${player}`}>
          <PowerChip
            variant="ov"
            label="OVER"
            fillId={`ovF${player}`}
            timerId={`ovT${player}`}
            chipId={`ovP${player}`}
          />
          <PowerChip
            variant="sh"
            label="SHLD"
            fillId={`shF${player}`}
            timerId={`shT${player}`}
            chipId={`shP${player}`}
          />
          <PowerChip
            variant="bl"
            label="BLNK"
            fillId={`blF${player}`}
            timerId={`blT${player}`}
            chipId={`blP${player}`}
          />
        </div>
        <div className="ammo-chip ammo-chip--standard" id={`ammoP${player}`}>
          <span className="ammo-chip__spark" aria-hidden="true"></span>
          <span id={`ammoT${player}`}>STD INF</span>
        </div>
        <button className={`cyber-exit cyber-exit--${isP1 ? 'cyan' : 'pink'}`} onClick={onExit} aria-label={`Exit game for player ${player}`}>
          <span className="cyber-exit__icon" aria-hidden="true">
            ✕
          </span>
          <span>EXIT</span>
          <span className="cyber-exit__spark" aria-hidden="true" />
        </button>
      </div>
      {!isP1 && (
        <div className="avatar">
          ⬢
          <div className="ava-dash" id="dashP2" />
          <div className="ava-extra" id="extraP2" />
        </div>
      )}
    </div>
  )
}

function PowerChip({
  variant,
  label,
  fillId,
  timerId,
  chipId,
}: {
  variant: 'ov' | 'sh' | 'bl'
  label: string
  fillId: string
  timerId: string
  chipId: string
}) {
  const icons: Record<typeof variant, ReactNode> = {
    ov: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
      </svg>
    ),
    sh: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M12 22s7-4 7-10V6l-7-4-7 4v6c0 6 7 10 7 10z" />
      </svg>
    ),
    bl: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.4 6.6L22 12l-6.6 3.4L12 22l-3.4-6.6L2 12l6.6-3.4z" />
        <circle cx="19" cy="5" r="1.6" opacity="0.9" />
        <circle cx="20.5" cy="8.2" r="0.9" opacity="0.6" />
      </svg>
    ),
  }
  return (
    <div className={`power-chip ${variant}`} id={chipId}>
      <div className="chip-head">
        {icons[variant]}
        <span className="chip-label">{label}</span>
        <span className="chip-timer" id={timerId} />
      </div>
      <div className="chip-bar">
        <div className="chip-fill" id={fillId} />
      </div>
    </div>
  )
}

function CenterHUD({ mode = '1v1', onPause }: { mode?: '1v1' | 'trials'; onPause?: () => void }) {
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

function TrialsHUD() {
  return (
    <div className="trials-hud" aria-label="Trial status">
      <div className="trials-hud__points" id="trialPoints">0</div>
      <div className="trials-hud__label">PTS</div>
      <div className="trials-hud__bot">
        <span className="trials-hud__bot-name">BOT</span>
        <div className="trials-hud__bot-bar"><div className="trials-hud__bot-fill" id="botHpBar" /></div>
        <span className="trials-hud__bot-hp" id="botHp">12 / 12</span>
      </div>
      <div className="trials-hud__void" id="voidWarn" style={{ opacity: 0 }}>⚠ VOID CRUSHING</div>
    </div>
  )
}

function GameStage({
  mode = '1v1',
  onPlay,
  onHow,
  onRematch,
  onMenu,
}: {
  mode?: '1v1' | 'trials'
  onPlay: () => void
  onHow: () => void
  onRematch: () => void
  onMenu: () => void
}) {
  const isTrials = mode === 'trials'
  const arenaW = isTrials ? 1920 : 960
  const arenaH = isTrials ? 1120 : 560
  const cx = arenaW / 2
  const cy = arenaH / 2
  const voidR = isTrials ? 900 : 420
  return (
    <div className="stage" id="stage" style={isTrials ? { width: 'min(1180px, calc(100vw - 24px))', aspectRatio: '1920 / 1120', maxHeight: 'min(640px, calc(100vh - 210px))' } as React.CSSProperties : undefined}>
      <svg
        id="gameSvg"
        viewBox={`0 0 ${arenaW} ${arenaH}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Game arena"
      >
        <defs>
          <filter id="glowCyan" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b1" />
            <feColorMatrix type="matrix" values="0 0.6 1 0 0  0 0.7 1 0 0  1 1 1 0 0  0 0 0 1 0" />
            <feMerge>
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowPink" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b1" />
            <feColorMatrix type="matrix" values="1 0.3 0.5 0 0  0.2 0.2 0.6 0 0  0.8 0.3 0.7 0 0  0 0 0 1 0" />
            <feMerge>
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <radialGradient id="arenaGrad" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#0f1218" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#020617" stopOpacity="1" />
          </radialGradient>
          <linearGradient id="wallGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <pattern id="gridPat" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(23,32,36,0.12)" strokeWidth="1" />
          </pattern>
          <radialGradient id="lavaGrad" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="38%" stopColor="#f97316" />
            <stop offset="70%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#7c2d12" stopOpacity="0.95" />
          </radialGradient>
          <radialGradient id="slimeGrad" cx="50%" cy="45%">
            <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.92" />
            <stop offset="55%" stopColor="#10b981" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#065f46" stopOpacity="0.95" />
          </radialGradient>
          <radialGradient id="voidEdgeGrad" cx="50%" cy="50%">
            <stop offset="68%" stopColor="transparent" />
            <stop offset="82%" stopColor="rgba(201,255,47,0.16)" />
            <stop offset="91%" stopColor="rgba(201,255,47,0.32)" />
            <stop offset="100%" stopColor="rgba(201,255,47,0.06)" />
          </radialGradient>
          <pattern id="voidStars" width="48" height="48" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="1" fill="rgba(201,255,47,0.14)" />
            <circle cx="28" cy="18" r="0.7" fill="rgba(88,216,255,0.12)" />
            <circle cx="36" cy="36" r="1.1" fill="rgba(255,92,168,0.09)" />
            <circle cx="8" cy="38" r="0.6" fill="rgba(255,255,255,0.07)" />
            <circle cx="42" cy="10" r="0.5" fill="rgba(201,255,47,0.09)" />
          </pattern>
          <pattern id="voidBlocks" width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="#1a0b2e" opacity="0.52" />
            <rect x="12" y="12" width="12" height="12" fill="#1a0b2e" opacity="0.52" />
            <rect x="12" y="0" width="12" height="12" fill="#0f0f1a" opacity="0.58" />
            <rect x="0" y="12" width="12" height="12" fill="#0f0f1a" opacity="0.58" />
            <rect x="6" y="6" width="12" height="12" fill="rgba(120,40,180,0.09)" />
            <rect width="24" height="24" fill="none" stroke="rgba(120,40,180,0.07)" strokeWidth="0.6" />
          </pattern>
          <filter id="voidGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feColorMatrix type="matrix" values="1 0.9 0 0 0  0 1 0.9 0 0  0 0 1 0 0  0 0 0 1 0" />
          </filter>
          {isTrials ? (
            <mask id="voidMaskRect">
              <rect x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="white" />
              <rect id="voidHole" x="480" y="280" width="960" height="560" fill="black" />
            </mask>
          ) : (
            <mask id="voidMask">
              <rect x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="white" />
              <circle id="voidHole" cx={cx} cy={cy} r={voidR} fill="black" />
            </mask>
          )}
        </defs>

        <rect x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="url(#arenaGrad)" />
        <rect x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="url(#gridPat)" opacity="0.9" />
        <rect x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />

        <g opacity="0.25">
          <circle cx={cx} cy={cy} r={isTrials ? 240 : 120} fill="none" stroke="#c9ff2f" strokeWidth="1" strokeDasharray="6 8" />
          <circle cx={cx} cy={cy} r={isTrials ? 380 : 190} fill="none" stroke="#58d8ff" strokeWidth="1" strokeDasharray="2 10" opacity="0.5" />
        </g>

        <g id="walls" />
        <g id="hazards" />
        <g id="void" opacity="0" pointerEvents="none">
          {/* Minecraft void - block / purple mix, transparent so arena behind shows */}
          <rect id="voidBlocksRect" x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="url(#voidBlocks)" mask={isTrials ? 'url(#voidMaskRect)' : 'url(#voidMask)'} opacity="0.72" />
          {/* Subtle star drift */}
          <rect id="voidStarsRect" x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="url(#voidStars)" mask={isTrials ? 'url(#voidMaskRect)' : 'url(#voidMask)'} opacity="0.38" />
          {/* Purple void matter - transparent */}
          <rect id="voidPurpleRect" x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="rgba(18,8,32,0.28)" mask={isTrials ? 'url(#voidMaskRect)' : 'url(#voidMask)'} />
          {/* Edge glow - void rim */}
          <rect id="voidEdgeRect" x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="url(#voidEdgeGrad)" mask={isTrials ? 'url(#voidMaskRect)' : 'url(#voidMask)'} opacity="0.92" />
          {/* Primary electric ring */}
          {isTrials ? (
            <>
              <rect id="voidRing" x="480" y="280" width="960" height="560" fill="none" stroke="#c9ff2f" strokeWidth="2.5" strokeDasharray="10 7" opacity="0.95" filter="url(#voidGlow)" />
              <rect id="voidRing2" x="480" y="280" width="960" height="560" fill="none" stroke="#58d8ff" strokeWidth="1" strokeDasharray="2 11" opacity="0.45" />
              <rect id="voidInner" x="480" y="280" width="960" height="560" fill="none" stroke="#c9ff2f" strokeWidth="14" opacity="0.08" />
              <rect id="voidCore" x="480" y="280" width="960" height="560" fill="none" stroke="#c9ff2f" strokeWidth="1" opacity="0.0" />
            </>
          ) : (
            <>
              <circle id="voidRing" cx={cx} cy={cy} r={voidR} fill="none" stroke="#c9ff2f" strokeWidth="2.5" strokeDasharray="10 7" opacity="0.95" filter="url(#voidGlow)" />
              <circle id="voidRing2" cx={cx} cy={cy} r={voidR} fill="none" stroke="#58d8ff" strokeWidth="1" strokeDasharray="2 11" opacity="0.45" />
              <circle id="voidInner" cx={cx} cy={cy} r={voidR} fill="none" stroke="#c9ff2f" strokeWidth="14" opacity="0.08" />
              <circle id="voidCore" cx={cx} cy={cy} r={voidR} fill="none" stroke="#c9ff2f" strokeWidth="1" opacity="0.0" />
            </>
          )}
        </g>
        <g id="pickups" />
        <g id="bullets" />
        <g id="players" />
        <g id="particles" />
        <g id="centerMark" opacity="0.35">
          <circle cx={cx} cy={cy} r="3" fill="#fff" />
        </g>
      </svg>

      <StartOverlay mode={mode} onPlay={onPlay} onHow={onHow} />
      <RoundOverlay mode={mode} />
      <GameOverOverlay mode={mode} onRematch={onRematch} onMenu={onMenu} />
    </div>
  )
}

function StartOverlay({ mode = '1v1', onPlay, onHow }: { mode?: '1v1' | 'trials'; onPlay: () => void; onHow: () => void }) {
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
        <h2 className="menu-title">
          <span>NEON</span> VOID
        </h2>
        <p className="menu-copy">
          Fast arena shooter. Dash through walls, grab orbs. First to <strong>5 wins</strong> takes the void. No
          bots // just you vs your friend.
        </p>

        <GlobalSpeedControl />

        <div className="btn-row">
          <button className="btn btn-primary" id="playBtn" onClick={onPlay}>
            ▶ START DUEL
          </button>
          <button className="btn btn-ghost" id="howBtn" onClick={onHow}>
            How to play
          </button>
        </div>

        <div className="hint">Walls 1-unit grid • LAVA / SLIME / VOID hazards • Orbs never spawn in hazards</div>
      </div>
    </div>
  )
}

function GlobalSpeedControl() {
  return (
    <div className="global-speed">
      <div className="global-speed__header">
        <span className="global-speed__label">◇ GLOBAL SPEED</span>
        <span className="global-speed__value" id="speedValGlobal">
          3.6
        </span>
        <span className="global-speed__unit">x</span>
      </div>
      <input type="range" id="speedGlobal" min="2.5" max="5.5" step="0.1" defaultValue="3.6" />
      <div className="global-speed__scale">
        <span>SLOW</span>
        <span>NORMAL</span>
        <span>FAST</span>
      </div>
    </div>
  )
}

function HowToPlayModal({ mode = '1v1', onClose }: { mode?: '1v1' | 'trials'; onClose: () => void }) {
  const isTrials = mode === 'trials'
  return (
    <div className="how-modal" role="dialog" aria-modal="true" aria-labelledby="how-modal-title">
      <div className="how-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="how-modal__card" role="document">
        <button className="how-modal__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
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
                <span className="keycap">W</span>
                <span className="keycap">A</span>
                <span className="keycap">S</span>
                <span className="keycap">D</span>
                <span className="keycap keycap-accent">SHIFT</span>
                <span className="keycap" style={{ background: '#fff', color: '#07090b' }}>
                  SPACE
                </span>
                {isTrials && <span className="keycap" style={{ marginLeft: 8, borderColor: 'var(--nox-amber)', color: 'var(--nox-amber)' }}>P / ESC = PAUSE</span>}
              </div>
              {!isTrials && (
                <div className="how-row">
                  <span className="how-player" style={{ color: 'var(--nox-pink)' }}>
                    P2 // PINK
                  </span>
                  <span className="keycap">↑</span>
                  <span className="keycap">←</span>
                  <span className="keycap">↓</span>
                  <span className="keycap">→</span>
                  <span className="keycap keycap-accent">/</span>
                  <span className="keycap" style={{ background: '#fff', color: '#07090b' }}>
                    ENTER
                  </span>
                </div>
              )}
              <p className="how-desc">
                {isTrials ? (
                  <>Use <strong>WASD</strong> to run. Hold <strong>Shift</strong> to <strong>dash</strong> - you flash forward and cannot be hit. Hold <strong>Space</strong> to shoot. The bot uses the same arena and rules, but it has <strong>no void sense</strong> - use that.</>
                ) : (
                  <>Use the move keys to run around. Hold <strong>Shift</strong> or <strong>/</strong> to <strong>dash</strong> - you flash forward and cannot get hit for a moment. Hold <strong>Space</strong> or <strong>Enter</strong> to keep shooting.</>
                )}
              </p>
              {isTrials && <p className="how-desc" style={{ marginTop: 6, opacity: 0.7 }}>Press <strong>P</strong> or <strong>Esc</strong> to pause - your run saves locally and you can resume.</p>}
            </div>
          </section>

          <section className="how-section">
            <h3 className="how-section__title" style={{ color: 'var(--nox-pink)' }}>
              <span className="how-section__index">02</span> POWER-UPS
            </h3>
            <div className="how-card how-card--pink">
              <div className="orb-grid">
                <span className="how-orb how-orb--over">⚡</span>
                <span className="how-orb how-orb--shield">❄</span>
                <span className="how-orb how-orb--blink">✦</span>
                <span className="how-orb how-orb--heal">✚</span>
              </div>
              <ul className="how-list">
                <li>
                  <strong style={{ color: 'var(--nox-amber)' }}>⚡ Triple shot</strong> - shoots three bullets at once for a little while.
                </li>
                <li>
                  <strong style={{ color: 'var(--nox-cyan)' }}>❄ Shield</strong> - puts a bubble around you. It cracks when hit and breaks after a few hits.
                </li>
                <li>
                  <strong style={{ color: 'var(--nox-lime)' }}>✦ Dash boost</strong> - lets you dash again right away and makes you a bit faster.
                </li>
                <li>
                  <strong style={{ color: 'var(--success)' }}>✚ Heart</strong> - heals you a little.
                </li>
                <li style={{ marginTop: 8, opacity: 0.95 }}>
                  <strong style={{ color: '#a78bfa' }}>Needle</strong> - tiny and very fast. Weak from the front, super strong from behind. &nbsp;•&nbsp; <strong style={{ color: '#ffb23e' }}>Cannon</strong> - big and slow but hits really hard. &nbsp;•&nbsp; <strong style={{ color: '#58d8ff' }}>Trick</strong> - bounces off walls.
                </li>
              </ul>
              <p className="how-desc" style={{ opacity: 0.7, marginTop: 8 }}>
                {isTrials ? 'Both you and the bot can pick them up. The bot loves shield when hurt and triple when healthy.' : 'Special bullets come from pickups. You get a few shots, then you go back to your normal bullet.'}
              </p>
            </div>
          </section>

          <section className="how-section">
            <h3 className="how-section__title" style={{ color: 'var(--nox-amber)' }}>
              <span className="how-section__index">03</span> WATCH OUT
            </h3>
            <div className="how-card how-card--amber">
              <ul className="how-list">
                <li>
                  <strong>Walls</strong> - dark blocks. They stop you and stop most bullets. Trick bullets bounce off them.
                </li>
                <li>
                  <strong style={{ color: '#fb923c' }}>Lava</strong> - orange circle on the floor. It blinks first to warn you, then turns red and burns you if you stay on it.
                </li>
                <li>
                  <strong style={{ color: '#10b981' }}>Slime</strong> - green goo that makes you move slow while you are inside. It does not hurt you.
                </li>
                <li>
                  <strong style={{ color: 'var(--nox-amber)' }}>The Void {isTrials ? '// RECTANGLE' : ''}</strong> - {isTrials ? 'At 7:30 a rectangular border starts shrinking from the 2× edges toward the 1× center over 30 seconds. Damage outside is exponential - deeper = deadlier. Stay inside the amber line.' : 'after a while the edge of the arena starts closing in. Green blocks crumble at the border. Stay in the middle or you will lose health.'}
                </li>
              </ul>
            </div>
          </section>

          <section className="how-section">
            <h3 className="how-section__title" style={{ color: 'var(--nox-lime)' }}>
              <span className="how-section__index">04</span> {isTrials ? 'HOW TO SURVIVE' : 'HOW TO WIN'}
            </h3>
            <div className="how-card how-card--lime">
              {isTrials ? (
                <>
                  <p className="how-desc">
                    Survive <strong>10:00</strong> or <strong>kill the bot</strong> (12 HP). You earn <strong>+1/s</strong> for living, <strong>+25</strong> per hit, <strong>+75</strong> per pickup. Lava <strong>-30</strong>, slime <strong>-15</strong>. After <strong>7:30</strong> gains <strong>×2</strong> and losses <strong>×3</strong>.
                  </p>
                  <p className="how-desc" style={{ marginTop: 8 }}>
                    The bot has <strong>no void sense</strong> - it will walk into the crush. Use the center. Pause with <strong>P</strong>, exit with confirmation saves your high score. Your run auto-saves every 2 seconds.
                  </p>
                </>
              ) : (
                <>
                  <p className="how-desc">
                    Knock out the other player to win a round. If no one is knocked out when the timer runs out, the player with more health wins. Tied health is a draw.
                  </p>
                  <p className="how-desc" style={{ marginTop: 8 }}>
                    First to <strong>5 round wins</strong> wins the whole game.
                  </p>
                </>
              )}
            </div>
          </section>
        </div>

        <div className="how-modal__footer">
          <button className="btn btn-primary" onClick={onClose}>
            {isTrials ? 'ENTER THE VOID // READY' : 'GOT IT // FIGHT!'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RoundOverlay({ mode = '1v1' }: { mode?: '1v1' | 'trials' }) {
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

function GameOverOverlay({
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
          <div className="result-score" id="winnerText">
            SURVIVED THE VOID
          </div>
          <p id="winnerSub">10:00 // The void never breaks you</p>
          <div className="btn-row">
            <button className="btn btn-primary" id="rematchBtn" onClick={onRematch}>
              ↻ RUN AGAIN
            </button>
            <button className="btn btn-ghost" id="menuBtn" onClick={onMenu}>
              Menu
            </button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="overlay hidden" id="gameOverOverlay">
      <div className="menu-card">
        <CyberBadge variant="amber">🏆 CHAMPION OF THE VOID</CyberBadge>
        <div className="result-score" id="winnerText">
          PLAYER 1 WINS!
        </div>
        <p id="winnerSub">5 // 2 • Flawless dodges</p>
        <div className="btn-row">
          <button className="btn btn-primary" id="rematchBtn" onClick={onRematch}>
            ↻ REMATCH
          </button>
          <button className="btn btn-ghost" id="menuBtn" onClick={onMenu}>
            Menu
          </button>
        </div>
      </div>
    </div>
  )
}
