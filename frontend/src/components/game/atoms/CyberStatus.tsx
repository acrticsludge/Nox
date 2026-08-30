export default function CyberStatus({ label }: { label: string }) {
  return (
    <span className="cyber-status" role="status" aria-label={label}>
      <span className="cyber-status__dot" aria-hidden="true" />
      <span className="cyber-status__label">{label}</span>
      <span className="cyber-status__frame" aria-hidden="true">
        <i className="cyber-status__spark" />
      </span>
    </span>
  )
}
