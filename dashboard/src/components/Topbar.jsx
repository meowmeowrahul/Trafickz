export default function Topbar({ connected, roadData, fps, agentCount, simTime }) {
  const wsStatus = connected ? 'CONNECTED' : 'DISCONNECTED';
  const simStatus = connected ? 'LIVE' : 'OFFLINE';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-brand">
          <span className="topbar-brand-name">TRAFICKZ</span>
          <span className="topbar-brand-sub">Real-time Indian Traffic Digital Twin</span>
        </div>
      </div>

      <div className="topbar-status-row">
        <div className={`status-pill ${connected ? 'status-live' : 'status-offline'}`}>
          <span className="status-dot" />
          <span>SIM: {simStatus}</span>
        </div>

        <div className={`status-pill ${connected ? 'status-live' : 'status-offline'}`}>
          <span>WS: {wsStatus}</span>
        </div>

        <div className="topbar-stat-cell">
          <span className="tstat-label">AGENTS</span>
          <span className="tstat-val">{agentCount}</span>
        </div>

        <div className="topbar-stat-cell">
          <span className="tstat-label">FPS</span>
          <span className={`tstat-val ${fps < 20 ? 'tstat-warn' : fps >= 30 ? 'tstat-good' : ''}`}>
            {fps}
          </span>
        </div>

        <div className="topbar-stat-cell">
          <span className="tstat-label">NETWORK</span>
          <span className="tstat-val">{roadData ? 'LOADED' : 'WAITING'}</span>
        </div>

        <div className="topbar-stat-cell">
          <span className="tstat-label">SIM TIME</span>
          <span className="tstat-val font-mono">{simTime}</span>
        </div>

        <div className="topbar-role-badge">
          <span>CONSOLE</span>
        </div>
      </div>
    </header>
  );
}
