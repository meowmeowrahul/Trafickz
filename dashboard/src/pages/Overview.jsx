import { AGENT_TYPE_LABELS, AGENT_TYPE_COLORS } from '../utils/constants.js';

function MetricCard({ label, value, sub, accent, iconSvg }) {
  return (
    <div className="ov-metric-card">
      <div className="ov-metric-icon" style={{ color: accent }}>
        {iconSvg}
      </div>
      <div className="ov-metric-body">
        <div className="ov-metric-value font-mono" style={{ color: accent }}>
          {value}
        </div>
        <div className="ov-metric-label">{label}</div>
        {sub && <div className="ov-metric-sub">{sub}</div>}
      </div>
    </div>
  );
}

export default function Overview({ connected, roadData, trafficMetrics, fps, onGoToSim }) {
  const netEdges = roadData?.edges?.length ?? 0;
  const netJunctions = roadData?.junctions?.length ?? 0;
  const barricades = roadData?.barricades?.length ?? 0;
  const potholes = roadData?.potholes?.length ?? 0;

  return (
    <div className="page-overview">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Traffic Platform</p>
          <h2 className="page-title">Digital Twin Overview</h2>
        </div>
        <div className={`conn-badge ${connected ? 'online' : 'offline'}`}>
          <span className="conn-dot" />
          {connected ? 'C++ Simulation Engine Online' : 'Simulation Engine Offline'}
        </div>
      </div>

      <div className="ov-grid">
        <MetricCard
          label="Active Agents"
          value={trafficMetrics.total || 0}
          sub="live binary telemetry"
          accent="#38BDF8"
          iconSvg={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
            </svg>
          }
        />
        <MetricCard
          label="Corridor Avg Speed"
          value={trafficMetrics.avgSpeed != null ? `${trafficMetrics.avgSpeed.toFixed(1)} m/s` : '—'}
          sub={trafficMetrics.avgSpeed != null ? `${(trafficMetrics.avgSpeed * 3.6).toFixed(1)} km/h` : 'waiting for telemetry'}
          accent="#22C55E"
          iconSvg={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          }
        />
        <MetricCard
          label="Renderer FPS"
          value={fps}
          sub="target: ≥30 FPS"
          accent={fps >= 30 ? '#22C55E' : fps >= 20 ? '#F59E0B' : '#EF4444'}
          iconSvg={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          }
        />
        <MetricCard
          label="Road Segments"
          value={netEdges || '—'}
          sub={netJunctions ? `${netJunctions} junctions loaded` : 'waiting for network'}
          accent="#14B8A6"
          iconSvg={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
            </svg>
          }
        />
      </div>

      <div className="ov-two-col">
        {/* Vehicle Distribution */}
        <section className="panel">
          <div className="panel-hdr">
            <span className="panel-eyebrow">Heterogeneous Composition</span>
            <h3>Vehicle Distribution</h3>
          </div>
          <div className="type-list">
            {Object.entries(AGENT_TYPE_LABELS).map(([type, label]) => {
              const count = trafficMetrics.byType?.[type] ?? 0;
              const total = trafficMetrics.total || 1;
              const pct = ((count / total) * 100).toFixed(0);
              const color = AGENT_TYPE_COLORS[type];
              return (
                <div key={type} className="type-item">
                  <div className="type-item-top">
                    <div className="type-swatch" style={{ background: color }} />
                    <span className="type-name">{label}</span>
                    <span className="type-count font-mono">{count} ({pct}%)</span>
                  </div>
                  <div className="type-bar-track">
                    <div
                      className="type-bar-fill"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Road Network & Environment */}
        <section className="panel">
          <div className="panel-hdr">
            <span className="panel-eyebrow">Network Topology</span>
            <h3>Active Corridor Environment</h3>
          </div>
          {roadData ? (
            <div className="net-info-list">
              <div className="net-info-row">
                <span>Network Status</span>
                <strong className="accent-green">Active in C++ Engine</strong>
              </div>
              <div className="net-info-row">
                <span>Road Segments</span>
                <strong className="font-mono">{netEdges}</strong>
              </div>
              <div className="net-info-row">
                <span>Junctions / Intersections</span>
                <strong className="font-mono">{netJunctions}</strong>
              </div>
              <div className="net-info-row">
                <span>Active Barricades</span>
                <strong className="font-mono">{barricades}</strong>
              </div>
              <div className="net-info-row">
                <span>Detected Potholes</span>
                <strong className="font-mono">{potholes}</strong>
              </div>
              <div className="net-info-row">
                <span>Traffic Flow Pattern</span>
                <strong className="font-mono">Non-lane based lateral squeezing</strong>
              </div>

              <div style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="ctrl-btn primary"
                  onClick={onGoToSim}
                  style={{ width: '100%' }}
                >
                  Open Live 3D Simulation
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>Connecting to backend simulation engine at ws://localhost:9001...</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
