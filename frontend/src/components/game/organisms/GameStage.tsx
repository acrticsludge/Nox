import SvgDefs from './SvgDefs'
import StartOverlay from '../overlays/StartOverlay'
import RoundOverlay from '../overlays/RoundOverlay'
import GameOverOverlay from '../overlays/GameOverOverlay'

export default function GameStage({
  mode = '1v1',
  onPlay,
  onHow,
  onRematch,
  onMenu,
}: {
  mode?: '1v1' | 'trials' | 'online'
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
    <div className="stage" id="stage" style={isTrials ? { width: '100%', maxWidth: '100vw', height: 'auto', aspectRatio: '1920 / 1120', maxHeight: 'min(640px, calc(100vh - 210px))', touchAction: 'manipulation' } as React.CSSProperties : undefined}>
        <svg id="gameSvg" viewBox={`0 0 ${arenaW} ${arenaH}`} xmlns="http://www.w3.org/2000/svg" role="application" aria-label="NOX arena game" aria-describedby="game-desc">
        <SvgDefs isTrials={isTrials} arenaW={arenaW} arenaH={arenaH} cx={cx} cy={cy} voidR={voidR} />

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
          <rect id="voidBlocksRect" x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="url(#voidBlocks)" mask={isTrials ? 'url(#voidMaskRect)' : 'url(#voidMask)'} opacity="0.72" />
          <rect id="voidStarsRect" x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="url(#voidStars)" mask={isTrials ? 'url(#voidMaskRect)' : 'url(#voidMask)'} opacity="0.38" />
          <rect id="voidPurpleRect" x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="rgba(18,8,32,0.28)" mask={isTrials ? 'url(#voidMaskRect)' : 'url(#voidMask)'} />
          <rect id="voidEdgeRect" x="0" y="0" width={arenaW} height={arenaH} rx="18" fill="url(#voidEdgeGrad)" mask={isTrials ? 'url(#voidMaskRect)' : 'url(#voidMask)'} opacity="0.92" />
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

      {/* online: the start overlay is never server-rendered — the lobby mounts here (no 1v1 flash on refresh) */}
      {mode === 'online' ? (
        <div id="noxLobbyMount" />
      ) : (
        <StartOverlay mode={mode} onPlay={onPlay} onHow={onHow} />
      )}
      <RoundOverlay mode={mode} />
      <GameOverOverlay mode={mode} onRematch={onRematch} onMenu={onMenu} />
    </div>
  )
}
