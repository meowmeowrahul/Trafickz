export default function Settings({
  showVehicles,
  setShowVehicles,
  showPedestrians,
  setShowPedestrians,
  showRoadBoundaries,
  setShowRoadBoundaries,
  showObstacles,
  setShowObstacles,
}) {
  return (
    <div className="page-settings">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Preferences & Configuration</p>
          <h2 className="page-title">System Settings</h2>
        </div>
      </div>

      <div className="settings-grid">
        <section className="panel">
          <div className="panel-hdr">
            <span className="panel-eyebrow">Viewport Display</span>
            <h3>Layer Visibility</h3>
          </div>
          <div className="settings-rows">
            <label className="setting-row">
              <div>
                <div className="setting-name">Vehicles</div>
                <div className="setting-desc">Render cars, auto-rickshaws, bikes, buses, and trucks</div>
              </div>
              <input
                type="checkbox"
                checked={showVehicles}
                onChange={(e) => setShowVehicles(e.target.checked)}
                className="toggle-check"
              />
            </label>
            <label className="setting-row">
              <div>
                <div className="setting-name">Pedestrians</div>
                <div className="setting-desc">Render pedestrian agents in the road corridor</div>
              </div>
              <input
                type="checkbox"
                checked={showPedestrians}
                onChange={(e) => setShowPedestrians(e.target.checked)}
                className="toggle-check"
              />
            </label>
            <label className="setting-row">
              <div>
                <div className="setting-name">Road Surfaces & Curbs</div>
                <div className="setting-desc">Render asphalt meshes, road boundaries, and lane markings</div>
              </div>
              <input
                type="checkbox"
                checked={showRoadBoundaries}
                onChange={(e) => setShowRoadBoundaries(e.target.checked)}
                className="toggle-check"
              />
            </label>
            <label className="setting-row">
              <div>
                <div className="setting-name">Obstacles (Barricades & Potholes)</div>
                <div className="setting-desc">Show physical obstacles and road distress spots</div>
              </div>
              <input
                type="checkbox"
                checked={showObstacles}
                onChange={(e) => setShowObstacles(e.target.checked)}
                className="toggle-check"
              />
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="panel-hdr">
            <span className="panel-eyebrow">System Manifest</span>
            <h3>Platform Specs</h3>
          </div>
          <div className="perf-rows">
            <div className="perf-row">
              <span>Platform Name</span>
              <span className="perf-val">TRAFICKZ Digital Twin</span>
            </div>
            <div className="perf-row">
              <span>Frontend Architecture</span>
              <span className="perf-val">React 19 + Three.js 0.186</span>
            </div>
            <div className="perf-row">
              <span>Physics Engine</span>
              <span className="perf-val">C++20 Microscopic Simulation</span>
            </div>
            <div className="perf-row">
              <span>WebSocket Port</span>
              <span className="perf-val font-mono">ws://localhost:9001</span>
            </div>
            <div className="perf-row">
              <span>License / Build</span>
              <span className="perf-val">v0.1.0-alpha · Research Build</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
