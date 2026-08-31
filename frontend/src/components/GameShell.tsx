import { useEffect, useRef, useState } from 'react'
import CyberStatus from './game/atoms/CyberStatus'
import PlayerHUD from './game/molecules/PlayerHUD'
import CenterHUD from './game/molecules/CenterHUD'
import TrialsHUD from './game/molecules/TrialsHUD'
import ControlsStrip from './game/molecules/ControlsStrip'
import GameStage from './game/organisms/GameStage'
import HowToPlayModal from './game/overlays/HowToPlayModal'
import CyberBadge from './game/atoms/CyberBadge'

// Reusable GameShell — thin composer. All HUD/SVG/overlay pieces are in ./game/*
// Edit those files to change look/feel; 1v1 and trials both import the same components so they stay in sync.

export default function GameShell({ mode = '1v1' }: { mode?: '1v1' | 'trials' | 'online' }) {
  const isTrials = mode === 'trials'
  const isOnline = mode === 'online'
  const gameReady = useRef<Promise<void> | null>(null)
  const [showHow, setShowHow] = useState(false)
  const [showPause, setShowPause] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  useEffect(() => {
    // P0-01: online must NOT import/boot the local engine, its rAF loop, or its
    // input handlers — the online page loads the engine lazily at match start.
    if (mode === 'online') return;
    gameReady.current = import('../game/game-logic.js')
      .then((g) => { g.bootEngine(); console.log('[NOX] game-logic loaded') })
      .catch((e) => console.error('[NOX] game-logic load failed', e))
  }, [mode])

  const [showFPS, setShowFPS] = useState(false)

  // QX-09 — Alt+F FPS debug toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setShowFPS(prev => !prev);
        // Sync with game-logic display element
        const el = document.getElementById('fpsDisplay');
        if (el) el.style.display = (el.style.display === 'none' || !el.style.display) ? 'block' : 'none';
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [])

  // P0-05: game-logic is the SINGLE owner of P/Escape pause toggling (it guards
  // on its own gameState). This shell only mirrors overlay visibility from the
  // nox:pause / nox:resume events the engine dispatches — no key handling here.
  useEffect(() => {
    if (!isTrials) return
    const onPause = () => setShowPause(true)
    const onResume = () => setShowPause(false)
    window.addEventListener('nox:pause', onPause)
    window.addEventListener('nox:resume', onResume)
    return () => {
      window.removeEventListener('nox:pause', onPause)
      window.removeEventListener('nox:resume', onResume)
    }
  }, [isTrials])

  useEffect(() => {
    const onPause = () => setShowPause(true)
    const onResume = () => setShowPause(false)
    const onForfeitDone = () => { setShowPause(false); setShowExitConfirm(false); }
    window.addEventListener('nox:pause', onPause)
    window.addEventListener('nox:resume', onResume)
    window.addEventListener('nox:forfeitDone', onForfeitDone as EventListener)
    window.addEventListener('nox:forfeitTrials', onForfeitDone as EventListener)
    return () => {
      window.removeEventListener('nox:pause', onPause)
      window.removeEventListener('nox:resume', onResume)
      window.removeEventListener('nox:forfeitDone', onForfeitDone as EventListener)
      window.removeEventListener('nox:forfeitTrials', onForfeitDone as EventListener)
    }
  }, [])

  useEffect(() => {
    if (!showHow) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowHow(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [showHow])

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
        if (gg?.startTrials && overlay && !overlay.classList.contains('hidden') && !inCountdown) gg.startTrials()
      }, 60)
    } else {
      window.dispatchEvent(new CustomEvent('nox:startGame'))
      setTimeout(() => {
        const gg = (window as unknown as { NOX_GAME?: { startGame?: () => void } }).NOX_GAME
        if (gg?.startGame && document.getElementById('startOverlay') && !document.getElementById('startOverlay')?.classList.contains('hidden')) gg.startGame()
      }, 60)
    }
  }
  const handleHow = () => setShowHow(true)
  const handleCloseHow = () => setShowHow(false)
  const handleRematch = () => {
    document.getElementById('gameOverOverlay')?.classList.add('hidden')
    if (isOnline) { window.dispatchEvent(new CustomEvent('nox:onlineRematch')); return }
    if (isTrials) {
      const g = (window as unknown as { NOX_GAME?: { startTrials?: () => void } }).NOX_GAME
      if (g?.startTrials) g.startTrials()
      else window.dispatchEvent(new CustomEvent('nox:startTrials'))
    } else window.dispatchEvent(new CustomEvent('nox:startGame'))
  }
  const handleMenu = () => { window.dispatchEvent(new CustomEvent('nox:backToMenu')) }
  const handleExit = (player: 1 | 2) => {
    if (isTrials) window.dispatchEvent(new CustomEvent('nox:forfeitTrials'))
    else window.dispatchEvent(new CustomEvent('nox:forfeit', { detail: { playerId: player - 1 } }))
  }

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
      <main id="main" className="nox-shell">
        <div id="nox-score-announcer" aria-live="polite" aria-atomic="true" className="sr-only" style={{ position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}></div>
        {/* QX-09 — Hidden FPS / resolution debug display (Alt+F toggles) */}
        <div id="fpsDisplay" style={{ position: 'absolute', top: 8, left: 8, zIndex: 50, background: 'rgba(0,0,0,0.85)', color: '#c9ff2f', padding: '6px 10px', fontFamily: 'var(--nox-mono)', fontSize: 11, border: '1px solid #c9ff2f', borderRadius: 4, display: 'none', pointerEvents: 'none' }} aria-hidden="true">FPS -- / RES 1920x1120</div>
        <div className="grid-noise" aria-hidden="true" />

        <header className="nox-header">
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-amber-400 focus:text-black focus:px-3 focus:py-1 focus:rounded focus:text-sm focus:font-mono">Skip to game</a>
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="diamond-mark"><span /></div>
            <a href="/" className="brand-lockup" style={{ textDecoration: 'none' }}>NOX</a>
            <span style={{ color: 'var(--nox-muted)', opacity: 0.5, font: '10px var(--nox-mono)', letterSpacing: '0.1em' }}>//</span>
            <a href="/play" className="brand-lockup" style={{ textDecoration: 'none' }}>PLAY</a>
            <span style={{ color: 'var(--nox-muted)', opacity: 0.5, font: '10px var(--nox-mono)', letterSpacing: '0.1em' }}>//</span>
            <span className="brand-lockup" style={{ color: isTrials ? 'var(--nox-amber)' : isOnline ? '#58d8ff' : 'var(--nox-lime)' }}>{isTrials ? 'TRIALS' : isOnline ? 'ONLINE' : '1V1'}</span>
          </div>
          <CyberStatus label={isTrials ? 'NEON VOID // TRIALS' : isOnline ? 'NEON VOID // ONLINE' : 'NEON VOID // 1V1'} />
        </header>

        <div className="nox-content game-layout">
          {/* online: removed from layout until matchmaking assigns seats (no dead gap) */}
          <div className="game-top-bar" id="noxHudBar" style={isOnline ? { display: 'none' } : undefined}>
            <PlayerHUD player={1} onExit={() => handleExit(1)} mode={mode} />
            <CenterHUD mode={mode} onPause={() => { setShowPause(true); window.dispatchEvent(new CustomEvent('nox:pause')) }} />
            {isTrials ? <TrialsHUD /> : <PlayerHUD player={2} onExit={() => handleExit(2)} mode={mode} />}
          </div>

          <div id="noxKeysBar" style={isOnline ? { display: 'none' } : undefined} >
            <ControlsStrip mode={mode} />
          </div>

          <GameStage mode={mode} onPlay={handlePlay} onHow={handleHow} onRematch={handleRematch} onMenu={handleMenu} />
        </div>

        <footer className="nox-footer">
          <span>BUILT WITH SVG • NO CANVAS • 60FPS • <a href="/docs" style={{ color: 'var(--nox-lime)', textDecoration: 'none', borderBottom: '1px solid rgba(201,255,47,0.3)' }}>MANUAL // DOCS</a></span>
          <span>MADE FOR BORED LEGENDS AT 2AM</span>
        </footer>
      </main>

      {isTrials && showPause && (
        <div className="overlay" style={{ zIndex: 100 }}>
          <div className="menu-card" style={{ padding: 30 }}>
            <CyberBadge variant="amber">⏸ PAUSED</CyberBadge>
            <h2 className="menu-title" style={{ marginTop: 18 }}>VOID TRIALS // PAUSED</h2>
            <p style={{ color: 'var(--nox-muted)', font: '12px var(--nox-mono)', lineHeight: 1.6 }}>
              Press <strong style={{ color: 'var(--nox-fg)' }}>P</strong> or <strong style={{ color: 'var(--nox-fg)' }}>Esc</strong> to resume. Your state is saved locally.
            </p>
            <div className="btn-row" style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => { setShowPause(false); const g = (window as unknown as { NOX_GAME?: { resumeTrials?: () => void } }).NOX_GAME; if ((g as unknown as { gameState?: () => string })?.gameState?.() === 'paused') window.dispatchEvent(new CustomEvent('nox:resume')) }}>
                ▶ RESUME
              </button>
              <button className="btn btn-ghost" onClick={() => setShowExitConfirm(true)}>EXIT TRIAL</button>
            </div>
          </div>
        </div>
      )}

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
              <button className="btn btn-ghost" onClick={() => setShowExitConfirm(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {showHow && <HowToPlayModal mode={mode} onClose={handleCloseHow} />}
    </>
  )
}
