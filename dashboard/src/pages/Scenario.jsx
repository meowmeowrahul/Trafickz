const SCENARIOS = [
  {
    id: 'normal',
    name: 'Normal Mixed Flow',
    desc: 'Heterogeneous mix with typical two-wheeler filtering and standard IDM gaps.',
    status: 'ACTIVE',
    active: true,
  },
  {
    id: 'dense',
    name: 'High-Density Congestion',
    desc: 'Dense bumper-to-bumper mixed traffic with lateral squeezing.',
    status: 'AVAILABLE VIA TUNING',
    active: false,
  },
  {
    id: 'squeeze',
    name: 'Lateral Bottleneck Squeeze',
    desc: 'Bottleneck constriction triggering non-lane lateral squeezing and overtaking.',
    status: 'AVAILABLE VIA TUNING',
    active: false,
  },
  {
    id: 'obstacles',
    name: 'Obstacle Swerve Zone',
    desc: 'Barricades and potholes causing vehicles to dynamically swerve into gaps.',
    status: 'AVAILABLE VIA TUNING',
    active: false,
  },
  {
    id: 'pedestrian',
    name: 'Mid-Block Pedestrian Crossing',
    desc: 'Pedestrian interaction, yielding, and cross-flow deceleration.',
    status: 'SUPPORTED',
    active: false,
  },
  {
    id: 'intersection',
    name: 'Heavy Uncontrolled Junction',
    desc: 'Uncontrolled non-signalized junction with mixed conflict resolution.',
    status: 'SUPPORTED',
    active: false,
  },
];

export default function Scenario({ onGoToSim }) {
  return (
    <div className="page-scenario">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Simulation Catalogs</p>
          <h2 className="page-title">Traffic Scenarios</h2>
        </div>
      </div>

      <div className="info-banner" style={{ marginBottom: '20px' }}>
        <strong>Simulation Model:</strong> The C++ Engine simulates a continuous corridor with real-time parameter tuning. You can simulate high density or obstacle swerving by adjusting <em>Agent Count</em>, <em>IDM Headway</em>, and <em>Obstacle Toggles</em> in the Live Simulation controls panel.
      </div>

      <div className="scenario-grid">
        {SCENARIOS.map((sc) => (
          <div key={sc.id} className={`scenario-card ${sc.active ? 'active-scenario' : ''}`}>
            <div className="sc-header">
              <h3>{sc.name}</h3>
              <span className={`sc-badge ${sc.active ? 'badge-active' : ''}`}>
                {sc.status}
              </span>
            </div>
            <p className="sc-desc">{sc.desc}</p>
            <button
              type="button"
              className="sc-btn"
              onClick={onGoToSim}
            >
              {sc.active ? 'View in 3D Viewport' : 'Tune in Simulation'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
