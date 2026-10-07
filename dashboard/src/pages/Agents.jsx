import { useMemo, useState } from 'react';
import { AGENT_TYPE_LABELS, AGENT_TYPE_COLORS } from '../utils/constants.js';

const TYPE_FILTERS = ['All', ...Object.values(AGENT_TYPE_LABELS)];

export default function Agents({ agentsSnapshot, onSelectAgent }) {
  const [filter, setFilter] = useState('All');
  const [sortBy, setSortBy] = useState('id');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = agentsSnapshot || [];

    if (search.trim()) {
      const q = search.trim();
      list = list.filter((a) => String(a.id).includes(q));
    }

    if (filter !== 'All') {
      const typeKey = Object.entries(AGENT_TYPE_LABELS).find(([, v]) => v === filter)?.[0];
      if (typeKey !== undefined) {
        list = list.filter((a) => String(a.type) === typeKey);
      }
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'speed') return (b.speed ?? 0) - (a.speed ?? 0);
      if (sortBy === 'type') return (a.type ?? 0) - (b.type ?? 0);
      return (a.id ?? 0) - (b.id ?? 0);
    });
  }, [agentsSnapshot, filter, sortBy, search]);

  return (
    <div className="page-agents">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Real-time Entities</p>
          <h2 className="page-title">Agents Directory</h2>
        </div>
        <div className="agents-controls">
          <input
            type="text"
            placeholder="Search Agent ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="sel-input"
          >
            {TYPE_FILTERS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sel-input"
          >
            <option value="id">Sort by ID</option>
            <option value="speed">Sort by Speed (High → Low)</option>
            <option value="type">Sort by Vehicle Type</option>
          </select>
          <span className="count-badge font-mono">{filtered.length} active</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>
            {agentsSnapshot?.length
              ? 'No agents match current filters.'
              : 'Connecting to WebSocket binary stream for agents telemetry...'}
          </p>
        </div>
      ) : (
        <div className="agents-table-wrap">
          <table className="agents-table">
            <thead>
              <tr>
                <th>Agent ID</th>
                <th>Vehicle Type</th>
                <th>Position X (m)</th>
                <th>Position Y (m)</th>
                <th>Speed (m/s)</th>
                <th>Speed (km/h)</th>
                <th>Heading</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 150).map((agent) => {
                const color = AGENT_TYPE_COLORS[agent.type] ?? '#8D9BA8';
                const label = AGENT_TYPE_LABELS[agent.type] ?? 'Unknown';
                const speedKmh = Number.isFinite(agent.speed) ? (agent.speed * 3.6).toFixed(1) : '—';
                const headingDeg = Number.isFinite(agent.heading)
                  ? `${(((agent.heading * 180) / Math.PI) % 360).toFixed(0)}°`
                  : '—';

                return (
                  <tr key={agent.id} onClick={() => onSelectAgent?.(agent.id)}>
                    <td className="td-id font-mono">#{agent.id}</td>
                    <td>
                      <span className="type-tag" style={{ borderColor: color, color }}>
                        {label}
                      </span>
                    </td>
                    <td className="font-mono">{agent.x?.toFixed(2)}</td>
                    <td className="font-mono">{agent.y?.toFixed(2)}</td>
                    <td className="font-mono">{agent.speed?.toFixed(2) ?? '—'}</td>
                    <td className="font-mono">{speedKmh}</td>
                    <td className="font-mono">{headingDeg}</td>
                    <td>
                      <button
                        type="button"
                        className="row-inspect-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAgent?.(agent.id);
                        }}
                      >
                        Inspect in 3D
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > 150 && (
            <div className="table-note">
              Showing first 150 of {filtered.length} active agents. Use filters to narrow down.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
