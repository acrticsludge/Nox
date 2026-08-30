export default function GlobalSpeedControl() {
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
