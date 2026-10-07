import SimulationCanvas from '../components/SimulationCanvas.jsx';
import AgentInspector from '../components/AgentInspector.jsx';
import SimControls from '../components/SimControls.jsx';
import { AGENT_TYPE_LABELS, AGENT_TYPE_COLORS } from '../utils/constants.js';

export default function LiveSimulation({
  connected,
  isCustomRoad,
  roadData,
  agentsRef,
  lastTickTimeRef,
  tickIntervalRef,
  selectedAgent,
  selectedAgentId,
  onSelectAgent,
  onFocusAgent,
  trafficMetrics,
  showPedestrians,
  setShowPedestrians,
  showVehicles,
  setShowVehicles,
  showRoadBoundaries,
  setShowRoadBoundaries,
  showObstacles,
  setShowObstacles,
  fitViewToken,
  onFitView,
  onSendControl,
  onResetNetwork,
  onCountFrame,
}) {
  const density = trafficMetrics.density || 'Waiting';

  return (
    <div className="live-sim-layout">
      {/* Main Viewport */}
      <div className="sim-viewport-wrap">
        <div className="viewport-header">
          <div>
            <span className="vp-eyebrow">Digital Twin Viewport</span>
            <span className="vp-title">
              {isCustomRoad ? (roadData?.name || 'Uploaded Road Network Corridor') : 'Heterogeneous Indian Traffic Corridor'}
            </span>
          </div>
          <div className="vp-actions">
            {isCustomRoad && (
              <span
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: 'var(--accent-cyan)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  marginRight: '6px',
                }}
              >
                Custom Road Active
              </span>
            )}
            <button type="button" className="ghost-btn" onClick={onFitView} title="Frame all roads and intersections">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
              </svg>
              <span>Fit Corridor</span>
            </button>
          </div>
        </div>

        <SimulationCanvas
          agentsRef={agentsRef}
          lastTickTimeRef={lastTickTimeRef}
          tickIntervalRef={tickIntervalRef}
          roadData={roadData}
          selectedAgentId={selectedAgentId}
          onSelectAgent={onSelectAgent}
          showPedestrians={showPedestrians}
          showVehicles={showVehicles}
          showRoadBoundaries={showRoadBoundaries}
          showObstacles={showObstacles}
          fitViewKey={fitViewToken}
          onCountFrame={onCountFrame}
        />
      </div>

      {/* Right Rail Panels */}
      <aside className="sim-right-rail">
        {/* Real-time Traffic Overview */}
        <section className="panel">
          <div className="panel-hdr compact">
            <span className="panel-eyebrow">Real-time Stream</span>
            <h3>Corridor Telemetry</h3>
          </div>
          <div className="metric-stack">
            <div className="mrow">
              <span>Active Agents</span>
              <strong className="font-mono">{trafficMetrics.total || 0}</strong>
            </div>
            <div className="mrow">
              <span>Average Speed</span>
              <strong className="font-mono">
                {trafficMetrics.avgSpeed != null ? `${trafficMetrics.avgSpeed.toFixed(1)} m/s` : '—'}
              </strong>
            </div>
            <div className="mrow">
              <span>Density Rating</span>
              <strong className={`density-tag ${density.toLowerCase()}`}>
                {density}
              </strong>
            </div>
          </div>

          <div className="legend-list">
            {Object.entries(AGENT_TYPE_LABELS).map(([type, label]) => (
              <div key={type} className="legend-item">
                <span className="legend-dot" style={{ background: AGENT_TYPE_COLORS[type] }} />
                <span>{label}</span>
                <strong className="font-mono">{trafficMetrics.byType?.[type] ?? 0}</strong>
              </div>
            ))}
          </div>
        </section>

        {/* Selected Agent Inspector */}
        <section className="panel">
          <div className="panel-hdr compact">
            <span className="panel-eyebrow">Agent Telemetry</span>
            <h3>Inspector</h3>
          </div>
          <AgentInspector agent={selectedAgent} onFocusAgent={onFocusAgent} />
        </section>

        {/* Simulation Controls (connected to C++ backend or Custom Simulator) */}
        <section className="panel">
          <div className="panel-hdr compact">
            <span className="panel-eyebrow">Engine Controls</span>
            <h3>Tuning & Controls</h3>
          </div>
          <SimControls
            connected={connected}
            isCustomRoad={isCustomRoad}
            activeAgentCount={trafficMetrics.total}
            onSendControl={onSendControl}
            onFitView={onFitView}
            onResetNetwork={onResetNetwork}
          />
        </section>

        {/* Display Layers */}
        <section className="panel">
          <div className="panel-hdr compact">
            <span className="panel-eyebrow">Rendering</span>
            <h3>Display Layers</h3>
          </div>
          <div className="toggle-list">
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={showVehicles}
                onChange={(e) => setShowVehicles(e.target.checked)}
              />
              <span>Vehicles (Cars, Autos, Bikes, Buses)</span>
            </label>
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={showPedestrians}
                onChange={(e) => setShowPedestrians(e.target.checked)}
              />
              <span>Pedestrians</span>
            </label>
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={showRoadBoundaries}
                onChange={(e) => setShowRoadBoundaries(e.target.checked)}
              />
              <span>Road Surfaces & Markings</span>
            </label>
            <label className="toggle-item">
              <input
                type="checkbox"
                checked={showObstacles}
                onChange={(e) => setShowObstacles(e.target.checked)}
              />
              <span>Barricades & Potholes</span>
            </label>
          </div>
        </section>
      </aside>
    </div>
  );
}
