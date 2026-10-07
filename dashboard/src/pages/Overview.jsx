import { useEffect, useRef, useState } from 'react';
import { AGENT_TYPE_LABELS, AGENT_TYPE_COLORS } from '../utils/constants.js';

const MAX_HISTORY = 90; // 90 points

function LineChart({ data, color = '#16A34A', label, unit = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const vals = data.filter((v) => v != null && Number.isFinite(v));
    if (vals.length < 2) {
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '11px Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Accumulating real-time telemetry...', W / 2, H / 2);
      return;
    }

    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const range = maxV - minV || 1;
    const padX = 8, padY = 8;

    // Grid lines
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach((f) => {
      const y = padY + (1 - f) * (H - padY * 2);
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(W - padX, y);
      ctx.stroke();
    });

    // Area under line
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = padX + (i / (MAX_HISTORY - 1)) * (W - padX * 2);
      const normalized = v != null ? (v - minV) / range : 0;
      const y = padY + (1 - normalized) * (H - padY * 2);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(W - padX, H - padY);
    ctx.lineTo(padX, H - padY);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, padY, 0, H - padY);
    grad.addColorStop(0, color + '33');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fill();

    // Plot line
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = padX + (i / (MAX_HISTORY - 1)) * (W - padX * 2);
      const normalized = v != null ? (v - minV) / range : 0;
      const y = padY + (1 - normalized) * (H - padY * 2);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Latest value indicator
    const lastVal = data[data.length - 1];
    if (lastVal != null) {
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(
        `${Number.isFinite(lastVal) ? lastVal.toFixed(1) : '—'}${unit}`,
        W - padX,
        16
      );
    }
  }, [data, color, unit]);

  return (
    <div className="chart-card">
      <div className="chart-label">{label}</div>
      <canvas ref={canvasRef} width={420} height={120} className="chart-canvas" />
    </div>
  );
}

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

  const historyRef = useRef({
    agentCount: new Array(MAX_HISTORY).fill(null),
    avgSpeed: new Array(MAX_HISTORY).fill(null),
    fps: new Array(MAX_HISTORY).fill(null),
  });
  const [, setTick] = useState(0);

  useEffect(() => {
    const h = historyRef.current;
    h.agentCount.push(trafficMetrics.total || 0);
    h.agentCount.shift();

    if (trafficMetrics.avgSpeed != null) {
      h.avgSpeed.push(trafficMetrics.avgSpeed);
    } else {
      h.avgSpeed.push(null);
    }
    h.avgSpeed.shift();

    h.fps.push(fps || 0);
    h.fps.shift();

    setTick((t) => t + 1);
  }, [trafficMetrics, fps]);

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
          accent="#16A34A"
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
          accent="#16A34A"
          iconSvg={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          }
        />
        <MetricCard
          label="Renderer FPS"
          value={fps}
          sub="target: ≥ 30 FPS"
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
          accent="#16A34A"
          iconSvg={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
            </svg>
          }
        />
      </div>

      {/* Real-time Telemetry Section */}
      <section className="panel" style={{ padding: '20px' }}>
        <div className="panel-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <span className="panel-eyebrow">Real-Time Telemetry</span>
            <h3 style={{ margin: 0 }}>Corridor Telemetry Feeds & Time-Series</h3>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span className={`conn-badge ${connected ? 'online' : 'offline'}`} style={{ fontSize: '11px', padding: '4px 10px' }}>
              <span className="conn-dot" />
              {connected ? 'Streaming at 50 Hz' : 'Telemetry Disconnected'}
            </span>
          </div>
        </div>

        <div className="charts-grid">
          <LineChart
            data={historyRef.current.agentCount}
            color="#16A34A"
            label="Active Agents Count"
            unit=""
          />
          <LineChart
            data={historyRef.current.avgSpeed}
            color="#15803D"
            label="Corridor Average Velocity"
            unit=" m/s"
          />
          <LineChart
            data={historyRef.current.fps}
            color="#F59E0B"
            label="Frontend Frame Rate"
            unit=" FPS"
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #E5E7EB', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span>Wire Protocol: <strong style={{ color: 'var(--text-primary)' }}>21 Bytes / Agent (Binary WebSocket Stream)</strong></span>
          <span>Physics Delta: <strong style={{ color: 'var(--text-primary)' }}>50 Hz (Δt = 0.02s)</strong></span>
          <span>Traffic Density: <strong style={{ color: trafficMetrics.density === 'Critical' ? 'var(--accent-red)' : trafficMetrics.density === 'High' ? 'var(--accent-amber)' : 'var(--accent-green)' }}>{trafficMetrics.density}</strong></span>
        </div>
      </section>

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
