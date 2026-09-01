import { useSyncExternalStore } from 'react'
import CenterHUD from './CenterHUD'
import ControlsStrip from './ControlsStrip'
import PowerChip from '../atoms/PowerChip'
import { getOnlineHud, subscribeOnlineHud, type OnlineConnection } from '../../../game/net/online-hud'

// P1-05: declarative online HUD. Both seats render from the store — self
// EXIT always belongs to the local player's card regardless of cyan/pink,
// identity/color/ping/health come from state, and the page script never mutates
// these nodes.
//
// Visual-parity fix: the engine writes server player 0 (always CYAN) into
// the *P1 DOM ids and server player 1 (always PINK) into *P2. The SELF card
// therefore carries the P<seat+1> ids so stats land on the correct card no
// matter which seat you were assigned.

const CONNECTION_LABEL: Record<OnlineConnection, { text: string; color: string }> = {
  idle: { text: 'OFFLINE', color: 'var(--nox-muted)' },
  connecting: { text: 'CONNECTING…', color: 'var(--nox-amber)' },
  live: { text: 'LIVE', color: 'var(--nox-lime)' },
  reconnecting: { text: 'RECONNECTING…', color: 'var(--nox-amber)' },
  lost: { text: 'CONNECTION LOST', color: 'var(--nox-pink)' },
}

const MAX_HP = 6

function Hearts({ hp, seat }: { hp: number; seat: 0 | 1 }) {
  const pct = (hp / MAX_HP) * 100
  const isLow = hp <= 2
  const isMid = hp <= 4
  return (
    <div className="hearts">
      <div className="hp-fill" style={{ width: `${pct}%` }} className={isLow ? 'low' : ''} />
      <div className="hp-text">{hp} / {MAX_HP}</div>
      <style jsx>{`
        .hearts { position: relative; width: 100%; height: 28px; }
        .hp-fill { position: absolute; top: 0; left: 0; height: 100%; background: linear-gradient(90deg, var(--nox-pink), var(--nox-red)); border-radius: 4px; transition: width 0.12s linear; }
        .hp-fill.low { background: var(--nox-red); animation: pulse 0.6s infinite; }
        .hp-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font: 600 11px var(--nox-mono); color: var(--nox-text); pointer-events: none; text-shadow: 0 0 4px rgba(0,0,0,0.8); }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>
    </div>
  )
}

export default function OnlineHUD() {
  const hud = useSyncExternalStore(subscribeOnlineHud, getOnlineHud, getOnlineHud)
  const conn = CONNECTION_LABEL[hud.connection]
  const selfColor = hud.selfSeat === 0 ? '#58d8ff' : '#ff5ca8'
  const oppColor = hud.selfSeat === 0 ? '#ff5ca8' : '#58d8ff'
  const oppLabel = hud.selfSeat === 0 ? 'PINK' : 'CYAN'
  const selfN = (hud.selfSeat === 0 ? 1 : 2) as 1 | 2
  const oppN = (selfN === 1 ? 2 : 1) as 1 | 2

  const handleExit = () => { window.dispatchEvent(new CustomEvent('nox:forfeit')) }

  return (
    <>
      <div className="game-top-bar" style={hud.hudVisible ? undefined : { display: 'none' }}>
        {/* SELF card — owns EXIT; ids map to MY server seat */}
        <div className={`player-hud p${selfN}`} id="noxSelfCard">
          <div className="avatar">
            ◇
            <div className="ava-dash" id={`dashP${selfN}`} />
            <div className="ava-extra" id={`extraP${selfN}`} />
          </div>
          <div className="hud-main">
            <div className="hud-topline">
              <div>
                <div className="hud-name">{hud.selfNick || 'YOU'}</div>
                <div className="hud-sub" style={{ color: selfColor }}>YOU // {hud.selfSeat === 0 ? 'CYAN SPECTRE' : 'MAGENTA RIFT'}</div>
              </div>
              <div className="score" id={`scoreP${selfN}`}>0</div>
            </div>
            <Hearts hp={hud.selfHp} seat={hud.selfSeat} />
            <div className="status-row" id={`statusP${selfN}`}>
              <PowerChip variant="ov" label="OVER" fillId={`ovF${selfN}`} timerId={`ovT${selfN}`} chipId={`ovP${selfN}`} />
              <PowerChip variant="sh" label="SHLD" fillId={`shF${selfN}`} timerId={`shT${selfN}`} chipId={`shP${selfN}`} />
              <PowerChip variant="bl" label="BLNK" fillId={`blF${selfN}`} timerId={`blT${selfN}`} chipId={`blP${selfN}`} />
            </div>
            <div className="ammo-chip ammo-chip--standard" id={`ammoP${selfN}`}><span className="ammo-chip__spark" aria-hidden="true"></span><span id={`ammoT${selfN}`}>STD INF</span></div>
            <button className={`cyber-exit ${hud.selfSeat === 0 ? 'cyber-exit--cyan' : 'cyber-exit--pink'}`} onClick={handleExit} aria-label="Leave the online match (forfeit)">
              <span className="cyber-exit__icon" aria-hidden="true">✕</span>
              <span>EXIT</span>
              <span className="cyber-exit__spark" aria-hidden="true" />
            </button>
          </div>
        </div>

        <CenterHUD mode="online" />

        {/* OPPONENT card — remote status only, no local exit */}
        <div className={`player-hud p${oppN}`} id="noxOppCard">
          <div className="hud-main">
            <div className="hud-topline">
              <div>
                <div className="hud-name">{hud.oppNick || 'WAITING…'}</div>
                <div className="hud-sub" style={{ color: oppColor }}>OPPONENT // {oppLabel}</div>
              </div>
              <div className="score" id={`scoreP${oppN}`}>0</div>
            </div>
            <Hearts hp={hud.oppHp} seat={hud.selfSeat === 0 ? 1 : 0} />
            <div className="status-row" id={`statusP${oppN}`}>
              <PowerChip variant="ov" label="OVER" fillId={`ovF${oppN}`} timerId={`ovT${oppN}`} chipId={`ovP${oppN}`} />
              <PowerChip variant="sh" label="SHLD" fillId={`shF${oppN}`} timerId={`shT${oppN}`} chipId={`shP${oppN}`} />
              <PowerChip variant="bl" label="BLNK" fillId={`blF${oppN}`} timerId={`blT${oppN}`} chipId={`blP${oppN}`} />
            </div>
            <div className="ammo-chip ammo-chip--standard" id={`ammoP${oppN}`}><span className="ammo-chip__spark" aria-hidden="true"></span><span id={`ammoT${oppN}`}>STD INF</span></div>
            <div className="connection-chip" role="status" aria-live="polite">
              <span className="connection-dot" style={{ background: conn.color }} aria-hidden="true" />
              <span style={{ color: conn.color }}>
                {hud.oppNick ? `${conn.text}${hud.pingMs != null && hud.connection === 'live' ? ` ${hud.pingMs}ms` : ''}` : 'WAITING FOR OPPONENT…'}
              </span>
            </div>
          </div>
          <div className="avatar">
            ⬢
            <div className="ava-dash" id={`dashP${oppN}`} />
            <div className="ava-extra" id={`extraP${oppN}`} />
          </div>
        </div>
      </div>

      <div id="noxKeysBar" style={hud.hudVisible ? undefined : { display: 'none' }}>
        <ControlsStrip mode="online" />
      </div>
    </>
  )
}
