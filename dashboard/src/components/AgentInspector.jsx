import {
  AGENT_TYPE_LABELS,
  AGENT_TYPE_COLORS,
  TACTICAL_STATE_LABELS,
  TACTICAL_STATE_COLORS,
} from '../utils/constants.js';

function InfoRow({ label, value, accent, isMono }) {
  return (
    <div className="insp-row">
      <span className="insp-label">{label}</span>
      <span
        className={`insp-value ${isMono ? 'font-mono' : ''}`}
        style={accent ? { color: accent } : undefined}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

export default function AgentInspector({ agent, onFocusAgent }) {
  if (!agent) {
    return (
      <div className="insp-empty">
        <div className="insp-empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <p>Click any vehicle or pedestrian<br />in the viewport to inspect live telemetry</p>
      </div>
    );
  }

  const typeLabel = AGENT_TYPE_LABELS[agent.type] ?? 'Unknown';
  const typeColor = AGENT_TYPE_COLORS[agent.type] ?? '#8D9BA8';

  const tacticalLabel =
    agent.tacticalState !== undefined
      ? TACTICAL_STATE_LABELS[agent.tacticalState] ?? `STATE_${agent.tacticalState}`
      : 'FREE_FLOW';
  const tacticalColor =
    agent.tacticalState !== undefined
      ? TACTICAL_STATE_COLORS[agent.tacticalState] ?? '#22C55E'
      : '#22C55E';

  const headingDeg = Number.isFinite(agent.heading)
    ? `${(((agent.heading * 180) / Math.PI) % 360).toFixed(1)}°`
    : '—';

  const speedMs = Number.isFinite(agent.speed) ? `${agent.speed.toFixed(2)} m/s` : '—';
  const speedKmh = Number.isFinite(agent.speed) ? `${(agent.speed * 3.6).toFixed(1)} km/h` : '—';

  return (
    <div className="agent-inspector">
      <div className="insp-header">
        <div className="insp-id-block">
          <span className="insp-id font-mono">Agent #{agent.id}</span>
        </div>
        <div className="insp-type-pill" style={{ borderColor: typeColor, color: typeColor }}>
          {typeLabel}
        </div>
      </div>

      <div className="insp-section">
        <div className="insp-section-title">World Position</div>
        <InfoRow label="X" value={agent.x != null ? `${agent.x.toFixed(2)} m` : '—'} isMono />
        <InfoRow label="Y (Road plane)" value={agent.y != null ? `${agent.y.toFixed(2)} m` : '—'} isMono />
      </div>

      <div className="insp-section">
        <div className="insp-section-title">Dynamics</div>
        <InfoRow label="Velocity" value={`${speedMs} (${speedKmh})`} isMono />
        <InfoRow label="Heading" value={headingDeg} isMono />
      </div>

      <div className="insp-section">
        <div className="insp-section-title">Tactical State</div>
        <InfoRow label="Behavior" value={tacticalLabel} accent={tacticalColor} />
      </div>

      {onFocusAgent && (
        <button
          type="button"
          className="insp-focus-btn"
          onClick={() => onFocusAgent(agent)}
        >
          Focus Camera on Agent
        </button>
      )}
    </div>
  );
}
