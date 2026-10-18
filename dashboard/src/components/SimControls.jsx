import { useState, useEffect } from 'react';

export default function SimControls({
  connected,
  isCustomRoad,
  activeAgentCount = 180,
  potholesEnabled = false,
  onTogglePotholes,
  onSendControl,
  onFitView,
  onResetNetwork,
}) {
  const [agentCount, setAgentCount] = useState(activeAgentCount || 180);
  const [idmT, setIdmT] = useState(1.2);
  const [speedMult, setSpeedMult] = useState(1.0);
  const [barricades, setBarricades] = useState(false);
  const [potholes, setPotholes] = useState(Boolean(potholesEnabled));
  const [dirty, setDirty] = useState(false);
  const [appliedFeedback, setAppliedFeedback] = useState(false);

  useEffect(() => {
    setPotholes(Boolean(potholesEnabled));
  }, [potholesEnabled]);

  // Sync with active count when connected and not actively dirty
  useEffect(() => {
    if (!dirty && activeAgentCount > 0) {
      setAgentCount(activeAgentCount);
    }
  }, [activeAgentCount, dirty]);

  const mark = () => {
    setDirty(true);
    setAppliedFeedback(false);
  };

  const handleApply = (overrideParams = {}) => {
    const params = {
      num_agents: overrideParams.num_agents ?? agentCount,
      idm_T: overrideParams.idm_T ?? idmT,
      speed_multiplier: overrideParams.speed_multiplier ?? speedMult,
      barricades_enabled: overrideParams.barricades_enabled ?? barricades,
      potholes_enabled: overrideParams.potholes_enabled ?? potholes,
      ...overrideParams,
    };
    onSendControl(params);
    setDirty(false);
    setAppliedFeedback(true);
    setTimeout(() => setAppliedFeedback(false), 2500);
  };

  const isEnabled = isCustomRoad || connected;

  return (
    <div className="sim-controls">
      <div className="ctrl-group">
        {/* Agent Count Slider */}
        <div className="ctrl-row">
          <label className="ctrl-label">
            <span>Agent Fleet Count</span>
            <strong className="font-mono">{agentCount}</strong>
          </label>
          <input
            type="range"
            min={40}
            max={600}
            step={10}
            value={agentCount}
            onChange={(e) => {
              setAgentCount(Number(e.target.value));
              mark();
            }}
            className="ctrl-slider"
            disabled={!isEnabled}
          />
          <div className="ctrl-range-ticks">
            <span>40 Light</span>
            <span>180 Nominal</span>
            <span>600 Heavy</span>
          </div>
        </div>

        {/* Speed / Pace Multiplier */}
        <div className="ctrl-row">
          <label className="ctrl-label">
            <span>Velocity / Flow Rate</span>
            <strong className="font-mono">{speedMult.toFixed(1)}x</strong>
          </label>
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.1}
            value={speedMult}
            onChange={(e) => {
              setSpeedMult(Number(e.target.value));
              mark();
            }}
            className="ctrl-slider"
            disabled={!isEnabled}
          />
        </div>

        {/* IDM Time Headway */}
        <div className="ctrl-row">
          <label className="ctrl-label">
            <span>IDM Time Headway (T)</span>
            <strong className="font-mono">{idmT.toFixed(1)}s</strong>
          </label>
          <input
            type="range"
            min={0.5}
            max={3.0}
            step={0.1}
            value={idmT}
            onChange={(e) => {
              setIdmT(Number(e.target.value));
              mark();
            }}
            className="ctrl-slider"
            disabled={!isEnabled}
          />
        </div>

        {/* Barricades & Potholes Toggles */}
        <div className="ctrl-toggles">
          <label className="ctrl-toggle-item">
            <input
              type="checkbox"
              checked={barricades}
              onChange={(e) => {
                setBarricades(e.target.checked);
                mark();
              }}
              disabled={!isEnabled}
            />
            <span>Road Barricades</span>
          </label>
          <label className="ctrl-toggle-item">
            <input
              type="checkbox"
              checked={potholes}
              onChange={(e) => {
                const checked = e.target.checked;
                setPotholes(checked);
                if (onTogglePotholes) {
                  onTogglePotholes(checked);
                }
                onSendControl?.({ potholes_enabled: checked });
              }}
              disabled={!isEnabled}
            />
            <span>Potholes & Hazards</span>
          </label>
        </div>
      </div>

      {/* Buttons */}
      <div className="ctrl-buttons" style={{ marginTop: '12px' }}>
        <button
          type="button"
          className={`ctrl-btn primary ${appliedFeedback ? 'applied' : ''} ${dirty ? 'dirty' : ''}`}
          onClick={() => handleApply()}
          disabled={!isEnabled}
          style={{
            background: appliedFeedback ? 'rgba(34, 197, 94, 0.25)' : undefined,
            borderColor: appliedFeedback ? 'var(--accent-green)' : undefined,
            color: appliedFeedback ? 'var(--accent-green)' : undefined,
          }}
          title={isCustomRoad ? 'Apply parameters to custom road simulation' : 'Send parameters to C++ Engine'}
        >
          {appliedFeedback ? '✓ Applied' : dirty ? 'Apply Changes' : 'Update Parameters'}
        </button>
        <button type="button" className="ctrl-btn ghost" onClick={onFitView} title="Frame camera on active road network">
          Fit Camera
        </button>
      </div>

      {!isEnabled && (
        <div className="ctrl-offline-note">
          Backend offline - controls inactive
        </div>
      )}
    </div>
  );
}
