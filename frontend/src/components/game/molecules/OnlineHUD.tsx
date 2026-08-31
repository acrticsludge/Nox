import { useSyncExternalStore } from 'react'
import CenterHUD from './CenterHUD'
import ControlsStrip from './ControlsStrip'
import PowerChip from '../atoms/PowerChip'
import { getOnlineHud, subscribeOnlineHud, type OnlineConnection } from '../../../game/net/online-hud'

// P1-05: declarative online HUD. Both seats render from the store â€” self
// EXIT always belongs to the local player's card regardless of cyan/pink,
// identity/color/ping come from state, and the page script never mutates
// these nodes.

const CONNECTION_LABEL: Record<OnlineConnection, { text: string; color: string }> = {
  idle: { text: 'OFFLINE', color: 'var(--nox-muted)' },
  connecting: { text: 'CONNECTINGâ€¦', color: 'var(--nox-amber)' },
  live: { text: 'LIVE', color: 'var(--nox-lime)' },
  reconnecting: { text: 'RECONNECTINGâ€¦', color: 'var(--nox-amber)' },
  lost: { text: 'CONNECTION LOST', color: 'var(--nox-pink)' },
}

export default function OnlineHUD() {
  const hud = useSyncExternalStore(subscribeOnlineHud, getOnlineHud, getOnlineHud)
  const conn = CONNECTION_LABEL[hud.connection]
  const selfColor = hud.selfSeat === 0 ? '#58d8ff' : '#ff5ca8'
  const oppColor = hud.selfSeat === 0 ? '#ff5ca8' : '#58d8ff'
  const oppLabel = hud.selfSeat === 0 ? 'PINK' : 'CYAN'

  const handleExit = () => { window.dispatchEvent(new CustomEvent('nox:forfeit')) }

  return (
    <>
      <div className="game-top-bar" style={hud.hudVisible ? undefined : { display: 'none' }}>
        {/* SELF card â€” owns EXIT */}
        <div className="player-hud p1" id="noxSelfCard">
          <div className="avatar">
            â—‡
            <div className="ava-dash" id="dashP1" />
            <div className="ava-extra" id="extraP1" />
          </div>
          <div className="hud-main">
            <div className="hud-topline">
              <div>
                <div className="hud-name">{hud.selfNick || 'YOU'}</div>
                <div className="hud-sub" style={{ color: selfColor }}>YOU // {hud.selfSeat === 0 ? 'CYAN SPECTRE' : 'MAGENTA RIFT'}</div>
              </div>
              <div className="score" id="scoreP1">0</div>
            </div>
            <div className="hearts" id="heartsP1" />
            <div className="status-row" id="statusP1">
              <PowerChip variant="ov" label="OVER" fillId="ovF1" timerId="ovT1" chipId="ovP1" />
              <PowerChip variant="sh" label="SHLD" fillId="shF1" timerId="shT1" chipId="shP1" />
              <PowerChip variant="bl" label="BLNK" fillId="blF1" timerId="blT1" chipId="blP1" />
            </div>
            <div className="ammo-chip ammo-chip--standard" id="ammoP1"><span className="ammo-chip__spark" aria-hidden="true"></span><span id="ammoT1">STD INF</span></div>
            <button className="cyber-exit cyber-exit--cyan" onClick={handleExit} aria-label="Leave the online match (forfeit)">
              <span className="cyber-exit__icon" aria-hidden="true">âœ•</span>
              <span>EXIT</span>
              <span className="cyber-exit__spark" aria-hidden="true" />
            </button>
          </div>
        </div>

        <CenterHUD mode="online" />

        {/* OPPONENT card â€” remote status only, no local exit */}
        <div className="player-hud p2" id="noxOppCard">
          <div className="hud-main">
            <div className="hud-topline">
              <div>
                <div className="hud-name">{hud.oppNick || 'WAITINGâ€¦'}</div>
                <div className="hud-sub" style={{ color: oppColor }}>OPPONENT // {oppLabel}</div>
              </div>
              <div className="score" id="scoreP2">0</div>
            </div>
            <div className="hearts" id="heartsP2" />
            <div className="status-row" id="statusP2">
              <PowerChip variant="ov" label="OVER" fillId="ovF2" timerId="ovT2" chipId="ovP2" />
              <PowerChip variant="sh" label="SHLD" fillId="shF2" timerId="shT2" chipId="shP2" />
              <PowerChip variant="bl" label="BLNK" fillId="blF2" timerId="blT2" chipId="blP2" />
            </div>
            <div className="ammo-chip ammo-chip--standard" id="ammoP2"><span className="ammo-chip__spark" aria-hidden="true"></span><span id="ammoT2">STD INF</span></div>
            <div className="connection-chip" role="status" aria-live="polite">
              <span className="connection-dot" style={{ background: conn.color }} aria-hidden="true" />
              <span style={{ color: conn.color }}>
                {hud.oppNick ? `${conn.text}${hud.pingMs != null && hud.connection === 'live' ? ` ${hud.pingMs}ms` : ''}` : 'WAITING FOR OPPONENTâ€¦'}
              </span>
            </div>
          </div>
          <div className="avatar">
            â¬¢
            <div className="ava-dash" id="dashP2" />
            <div className="ava-extra" id="extraP2" />
          </div>
        </div>
      </div>

      <div id="noxKeysBar" style={hud.hudVisible ? undefined : { display: 'none' }}>
        <ControlsStrip mode="online" />
      </div>
    </>
  )
}
