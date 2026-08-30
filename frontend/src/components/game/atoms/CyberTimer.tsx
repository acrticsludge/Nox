export default function CyberTimer({ initial = '01:00' }: { initial?: string }) {
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
