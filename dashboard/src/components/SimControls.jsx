import { useState, useEffect } from 'react';

export default function SimControls({
  connected,
  isCustomRoad,
  activeAgentCount = 180,
  onSendControl,
  onFitView,
  onResetNetwork,
}) {
  const [agentCount, setAgentCount] = useState(activeAgentCount || 180);
  const [idmT, setIdmT] = useState(1.2);
  const [speedMult, setSpeedMult] = useState(1.0);
  const [barricades, setBarricades] = useState(false);
  const [potholes, setPotholes] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [appliedFeedback, setAppliedFeedback] = useState(false);

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

  // 1-Click Quick Presets
  const applyPreset = (preset) => {
    if (preset === 'freeflow') {
      const target = isCustomRoad ? 120 : 90;
      setAgentCount(target);
      setIdmT(0.8);
      setSpeedMult(1.3);
      setBarricades(false);
      setPotholes(false);
      handleApply({
        num_agents: target,
        idm_T: 0.8,
        speed_multiplier: 1.3,
        barricades_enabled: false,
        potholes_enabled: false,
      });
    } else if (preset === 'balanced') {
      const target = isCustomRoad ? 200 : 160;
      setAgentCount(target);
      setIdmT(1.2);
      setSpeedMult(1.0);
      setBarricades(false);
      setPotholes(true);
      handleApply({
        num_agents: target,
        idm_T: 1.2,
        speed_multiplier: 1.0,
        barricades_enabled: false,
        potholes_enabled: true,
      });
    } else if (preset === 'congested') {
      const target = isCustomRoad ? 350 : 280;
      setAgentCount(target);
      setIdmT(1.8);
      setSpeedMult(0.8);
      setBarricades(true);
      setPotholes(true);
      handleApply({
        num_agents: target,
        idm_T: 1.8,
        speed_multiplier: 0.8,
        barricades_enabled: true,
        potholes_enabled: true,
      });
    } else if (preset === 'unjam') {
      const target = isCustomRoad ? 150 : 100;
      setAgentCount(target);
      setIdmT(0.8);
      setSpeedMult(1.2);
      setBarricades(false);
      setPotholes(false);
      handleApply({
        num_agents: target,
        idm_T: 0.8,
        speed_multiplier: 1.2,
        barricades_enabled: false,
        potholes_enabled: false,
        reset: true,
      });
    }
  };

  const isEnabled = isCustomRoad || connected;

  return (
    <div className="sim-controls">
      {/* Simulation Mode Badge */}
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)' }}>
          Target Engine
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
            background: isCustomRoad ? 'rgba(56, 189, 248, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            color: isCustomRoad ? 'var(--accent-cyan)' : 'var(--accent-green)',
            border: `1px solid ${isCustomRoad ? 'rgba(56, 189, 248, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
          }}
        >
          {isCustomRoad ? 'Custom Road Network' : 'C++ Engine (Port 9001)'}
        </span>
      </div>

      {/* 1-Click Tuning Presets */}
      <div style={{ marginBottom: '14px' }}>
        <label className="ctrl-label" style={{ marginBottom: '6px' }}>
          <span>Flow Presets</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <button
            type="button"
            className="ctrl-btn ghost"
            style={{ padding: '6px 8px', fontSize: '11px', textAlign: 'center' }}
            onClick={() => applyPreset('freeflow')}
            disabled={!isEnabled}
            title="Free flowing traffic (low headway, no barricades)"
          >
            🟢 Free Flow
          </button>
          <button
            type="button"
            className="ctrl-btn ghost"
            style={{ padding: '6px 8px', fontSize: '11px', textAlign: 'center' }}
            onClick={() => applyPreset('balanced')}
            disabled={!isEnabled}
            title="Balanced urban traffic"
          >
            🟡 Balanced
          </button>
          <button
            type="button"
            className="ctrl-btn ghost"
            style={{ padding: '6px 8px', fontSize: '11px', textAlign: 'center' }}
            onClick={() => applyPreset('congested')}
            disabled={!isEnabled}
            title="Dense rush hour with barricades"
          >
            🔴 Rush Hour
          </button>
          <button
            type="button"
            className="ctrl-btn primary"
            style={{ padding: '6px 8px', fontSize: '11px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.2)', borderColor: 'var(--accent-red)' }}
            onClick={() => applyPreset('unjam')}
            disabled={!isEnabled}
            title="Break gridlocks and immediately unjam motionless vehicles"
          >
            ⚡ Unjam Flow
          </button>
        </div>
      </div>

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
                setPotholes(e.target.checked);
                mark();
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

      {/* Return to Live C++ Backend button if in Custom Road Mode */}
      {isCustomRoad && onResetNetwork && (
        <button
          type="button"
          className="ctrl-btn ghost"
          onClick={onResetNetwork}
          style={{ marginTop: '8px', width: '100%', fontSize: '11px', color: 'var(--text-muted)' }}
        >
          Revert to C++ Backend Stream
        </button>
      )}

      {!isEnabled && (
        <div className="ctrl-offline-note">
          Backend offline — controls inactive
        </div>
      )}
    </div>
  );
}
