export default function Performance({ fps, trafficMetrics, connected }) {
  const frameMs = fps > 0 ? (1000 / fps).toFixed(1) : '—';
  const agentCount = trafficMetrics.total || 0;
  const mvpTargetFps = 30;
  const mvpTargetAgents = 300;
  const stretchTargetAgents = 2000;

  const fpsOk = fps >= mvpTargetFps;
  const agentsOk = agentCount >= mvpTargetAgents;

  return (
    <div className="page-perf">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Engineering Diagnostics</p>
          <h2 className="page-title">Performance Monitor</h2>
        </div>
      </div>

      <div className="perf-three-col">
        {/* GPU & Rendering */}
        <section className="panel">
          <div className="panel-hdr">
            <span className="panel-eyebrow">GPU / WebGL</span>
            <h3>Frontend Rendering</h3>
          </div>
          <div className="perf-rows">
            <div className="perf-row">
              <span>Measured FPS</span>
              <span className={`perf-val font-mono ${fpsOk ? 'perf-ok' : 'perf-warn'}`}>
                {fps} FPS
              </span>
            </div>
            <div className="perf-row">
              <span>Frame Render Time</span>
              <span className="perf-val font-mono">{frameMs} ms</span>
            </div>
            <div className="perf-row">
              <span>Target Standard</span>
              <span className="perf-val font-mono perf-target">≥ {mvpTargetFps} FPS</span>
            </div>
            <div className="perf-row">
              <span>Draw Strategy</span>
              <span className="perf-val perf-ok">THREE.InstancedMesh</span>
            </div>
            <div className="perf-row">
              <span>Interpolation</span>
              <span className="perf-val perf-ok">Sub-frame Spline / Linear</span>
            </div>
          </div>
        </section>

        {/* C++ Simulation Engine */}
        <section className="panel">
          <div className="panel-hdr">
            <span className="panel-eyebrow">C++20 Engine</span>
            <h3>Simulation Physics</h3>
          </div>
          <div className="perf-rows">
            <div className="perf-row">
              <span>Active Agents</span>
              <span className={`perf-val font-mono ${agentsOk ? 'perf-ok' : 'perf-warn'}`}>
                {agentCount}
              </span>
            </div>
            <div className="perf-row">
              <span>MVP Capacity</span>
              <span className="perf-val font-mono perf-target">300 – 800 agents</span>
            </div>
            <div className="perf-row">
              <span>Stretch Capacity</span>
              <span className="perf-val font-mono perf-target">{stretchTargetAgents}+ agents</span>
            </div>
            <div className="perf-row">
              <span>Tick Frequency</span>
              <span className="perf-val font-mono">50 Hz (Δt = 0.02s)</span>
            </div>
            <div className="perf-row">
              <span>Physics Step Budget</span>
              <span className="perf-val font-mono perf-target">&lt; 12.0 ms</span>
            </div>
          </div>
        </section>

        {/* WebSocket Connection */}
        <section className="panel">
          <div className="panel-hdr">
            <span className="panel-eyebrow">Network Bus</span>
            <h3>WebSocket Protocol</h3>
          </div>
          <div className="perf-rows">
            <div className="perf-row">
              <span>Connection Status</span>
              <span className={`perf-val ${connected ? 'perf-ok' : 'perf-err'}`}>
                {connected ? 'ESTABLISHED' : 'OFFLINE'}
              </span>
            </div>
            <div className="perf-row">
              <span>Host & Port</span>
              <span className="perf-val font-mono">ws://localhost:9001</span>
            </div>
            <div className="perf-row">
              <span>Wire Protocol</span>
              <span className="perf-val font-mono">21 Bytes / Agent (Binary)</span>
            </div>
            <div className="perf-row">
              <span>Control Protocol</span>
              <span className="perf-val font-mono">JSON Bidirectional</span>
            </div>
            <div className="perf-row">
              <span>Data Ingestion</span>
              <span className={`perf-val ${connected ? 'perf-ok' : 'perf-err'}`}>
                {connected ? 'Active Stream' : 'Awaiting Server'}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="info-banner" style={{ marginTop: '20px' }}>
        <strong>Benchmarking Note:</strong> Frame rates and agent counts are measured in real time on this browser execution thread. Simulation physics time budgets match the PRD criteria.
      </div>
    </div>
  );
}
