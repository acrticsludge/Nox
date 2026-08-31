export default function CyberTimer({ initial = '01:00' }: { initial?: string }) {
  return (
    // P2-08: no aria-live here — this element updates every frame and would
    // spam screen readers. Milestones are announced via #nox-score-announcer.
    <div className="cyber-timer" id="timer" role="timer" aria-label="Game clock (updates visually)">
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
