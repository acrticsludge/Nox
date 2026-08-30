// Solo Trials HUD — right column vs PlayerHUD. Keep DOM ids stable for game-logic HUD updates.
export default function TrialsHUD() {
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
