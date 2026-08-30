// Solo Trials HUD — right column vs PlayerHUD. Keep DOM ids stable for game-logic HUD updates.
export default function TrialsHUD() {
  return (
    <div className="trials-hud" aria-label="Trial status">
      <div className="trials-hud__points" id="trialPoints">0</div>
      <div className="trials-hud__label">PTS</div>
      <div className="trials-hud__bot" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="trials-hud__bot-name">BOT</span>
        <div className="hearts" style={{ flex: 1, marginTop: 0 }} id="botHearts">
          <div className="hp-fill" id="botHpBar" style={{ background: 'linear-gradient(90deg, var(--nox-pink), #f43f5e)', boxShadow: '0 0 10px rgba(255,92,168,0.55)' }} />
          <div className="hp-text" id="botHp">12 / 12</div>
        </div>
      </div>
      {/* Bot buffs — so you see when it grabbed shield/overcharge/blink */}
      <div className="status-row" style={{ marginTop: 6 }} id="botStatus">
        <div className="power-chip ov" id="botOv"><div className="chip-head"><span className="chip-label">OVER</span><span className="chip-timer" id="botOvT" /></div><div className="chip-bar"><div className="chip-fill" id="botOvF" /></div></div>
        <div className="power-chip sh" id="botSh"><div className="chip-head"><span className="chip-label">SHLD</span><span className="chip-timer" id="botShT" /></div><div className="chip-bar"><div className="chip-fill" id="botShF" /></div></div>
        <div className="power-chip bl" id="botBl"><div className="chip-head"><span className="chip-label">BLNK</span><span className="chip-timer" id="botBlT" /></div><div className="chip-bar"><div className="chip-fill" id="botBlF" /></div></div>
      </div>
      <div className="ammo-chip ammo-chip--standard" id="botAmmo" style={{ marginTop: 6 }}><span className="ammo-chip__spark" aria-hidden="true" /><span id="botAmmoT">STD INF</span></div>
      <div className="trials-hud__void" id="voidWarn" style={{ opacity: 0 }}>⚠ VOID CRUSHING</div>
    </div>
  )
}
