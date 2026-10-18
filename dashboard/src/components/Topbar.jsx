export default function Topbar({ connected, roadData, fps, agentCount, simTime, onNavigate }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-brand">
          <span className="topbar-brand-name">TRAFICKZ</span>
          <span className="topbar-brand-sub">Real-time Indian Traffic Digital Twin</span>
        </div>
      </div>

      <div className="topbar-status-row">
        <button
          type="button"
          className="topbar-create-btn"
          onClick={() => onNavigate && onNavigate('Map')}
        >
          + Create
        </button>
      </div>
    </header>
  );
}
