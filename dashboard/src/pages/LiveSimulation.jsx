import { useState } from 'react';
import SimulationCanvas from '../components/SimulationCanvas.jsx';
import AgentInspector from '../components/AgentInspector.jsx';
import SimControls from '../components/SimControls.jsx';

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
  onCountFrame,
  onNavigateToMap,
}) {
  const [rightRailCollapsed, setRightRailCollapsed] = useState(false);
  const hasRoadData = !!roadData;

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
            {hasRoadData && (
              <button type="button" className="ghost-btn" onClick={onFitView} title="Frame all roads and intersections">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
                </svg>
                <span>Fit Corridor</span>
              </button>
            )}
          </div>
        </div>

        {hasRoadData ? (
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
        ) : (
          <div className="sim-empty-state">
            <div className="sim-empty-inner">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35, marginBottom: '16px' }}>
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary, #E2E8F0)' }}>
                No Road Network Loaded
              </h3>
              <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'var(--text-secondary, #94A3B8)', maxWidth: '340px', lineHeight: 1.55 }}>
                Upload a road network file to start the traffic simulation. Supported formats include JSON, GeoJSON, and OpenStreetMap files.
              </p>
              <button
                type="button"
                className="ghost-btn"
                onClick={onNavigateToMap}
                style={{
                  padding: '8px 20px',
                  fontSize: '13px',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: 'var(--accent-cyan, #38BDF8)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.2s ease',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: '-2px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Go to Map &amp; Upload
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Rail Panels */}
      <aside className={`sim-right-rail ${rightRailCollapsed ? 'collapsed' : ''}`}>
        <button
          type="button"
          className="right-rail-toggle"
          onClick={() => setRightRailCollapsed((collapsed) => !collapsed)}
          title={rightRailCollapsed ? 'Expand right menu' : 'Collapse right menu'}
          aria-label={rightRailCollapsed ? 'Expand right menu' : 'Collapse right menu'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {rightRailCollapsed ? (
              <polyline points="15 18 9 12 15 6"></polyline>
            ) : (
              <polyline points="9 18 15 12 9 6"></polyline>
            )}
          </svg>
        </button>
        {!rightRailCollapsed && (
          <>
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
            potholesEnabled={showObstacles}
            onTogglePotholes={setShowObstacles}
            onSendControl={onSendControl}
            onFitView={onFitView}
          />
        </section>

        {/* Selected Agent Inspector */}
        <section className="panel">
          <div className="panel-hdr compact">
            <span className="panel-eyebrow">Agent Telemetry</span>
            <h3>Inspector</h3>
          </div>
          <AgentInspector agent={selectedAgent} onFocusAgent={onFocusAgent} />
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
          </>
        )}
      </aside>
    </div>
  );
}
