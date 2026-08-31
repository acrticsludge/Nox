import PowerChip from '../atoms/PowerChip'

// Single reusable HUD — used by 1v1 (P1 + P2) and trials (P1 only). Modify here and both modes stay in sync.
export default function PlayerHUD({ player, onExit, mode = '1v1' }: { player: 1 | 2; onExit?: () => void; mode?: '1v1' | 'trials' | 'online' }) {
  const isP1 = player === 1
  const isTrials = mode === 'trials'
  const isOnline = mode === 'online'
  // online: single self EXIT (forfeit); opponent card has no local exit/keybinds
  const showExit = !isTrials && !(isOnline && !isP1)
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
          {/* In trials the score column is hidden but DOM stays for layout stability */}
          <div className="score" id={`scoreP${player}`} style={isTrials ? { opacity: 0, pointerEvents: 'none', width: 0, minWidth: 0 } : undefined}>
            0
          </div>
        </div>
        {/* Health bar + hearts — MUST stay in DOM for both modes; HUD sync bug was here */}
        <div className="hearts" id={`heartsP${player}`} />
        <div className="status-row" id={`statusP${player}`}>
          <PowerChip variant="ov" label="OVER" fillId={`ovF${player}`} timerId={`ovT${player}`} chipId={`ovP${player}`} />
          <PowerChip variant="sh" label="SHLD" fillId={`shF${player}`} timerId={`shT${player}`} chipId={`shP${player}`} />
          <PowerChip variant="bl" label="BLNK" fillId={`blF${player}`} timerId={`blT${player}`} chipId={`blP${player}`} />
        </div>
        <div className="ammo-chip ammo-chip--standard" id={`ammoP${player}`}>
          <span className="ammo-chip__spark" aria-hidden="true"></span>
          <span id={`ammoT${player}`}>STD INF</span>
        </div>
        {/* trials already has centered EXIT in CenterHUD — hide redundant cyan EXIT to avoid double */}
        {showExit ? (
          <button className={`cyber-exit cyber-exit--${isP1 ? 'cyan' : 'pink'}`} onClick={onExit} aria-label={`Exit game for player ${player}`}>
            <span className="cyber-exit__icon" aria-hidden="true">✕</span>
            <span>EXIT</span>
            <span className="cyber-exit__spark" aria-hidden="true" />
          </button>
        ) : null}
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
