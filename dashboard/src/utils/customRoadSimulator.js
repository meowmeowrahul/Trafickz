// Custom Road Traffic Simulator
// Generates and advances heterogeneous Indian traffic agents along any uploaded road network
import { AGENT_DIMENSIONS } from './constants.js';

const TYPE_WEIGHTS = [
  { type: 0, weight: 0.32, speed: 12.5 }, // Two-wheeler
  { type: 1, weight: 0.22, speed: 9.0 },  // Auto-rickshaw
  { type: 2, weight: 0.28, speed: 13.0 }, // Car
  { type: 3, weight: 0.08, speed: 8.0 },  // Bus
  { type: 6, weight: 0.05, speed: 7.5 },  // Truck
  { type: 7, weight: 0.05, speed: 10.5 }, // Medium vehicle
];

function pickType() {
  const r = Math.random();
  let acc = 0;
  for (const item of TYPE_WEIGHTS) {
    acc += item.weight;
    if (r <= acc) return item;
  }
  return TYPE_WEIGHTS[2];
}

export class CustomRoadSimulator {
  constructor(roadData, options = {}) {
    this.roadData = roadData;
    this.agentCount = options.agentCount || 180;
    this.speedMultiplier = options.speedMultiplier || 1.0;
    this.paused = false;
    this.edgePaths = [];
    this.agents = [];
    this.nextId = 1000;

    this.buildPaths();
    this.spawnAgents();
  }

  buildPaths() {
    if (!this.roadData || !Array.isArray(this.roadData.edges) || this.roadData.edges.length === 0) {
      this.edgePaths = [];
      return;
    }

    this.edgePaths = this.roadData.edges.map((edge) => {
      let totalLen = 0;
      const segs = [];
      const pts = edge.centerline || [];
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const len = Math.hypot(dx, dy);
        if (len < 0.01) continue;
        const tangent = { x: dx / len, y: dy / len };
        const normal = { x: -tangent.y, y: tangent.x };
        segs.push({ startDist: totalLen, len, p1, p2, tangent, normal });
        totalLen += len;
      }
      return {
        id: edge.id,
        width: Math.max(edge.width || 30, 10),
        segs,
        totalLen: Math.max(totalLen, 1),
      };
    }).filter((p) => p.segs.length > 0);
  }

  getPoint(path, s, laneOffset) {
    if (!path || path.segs.length === 0) return { x: 0, y: 0, heading: 0 };
    let seg = path.segs[0];
    for (let i = 0; i < path.segs.length; i++) {
      const cur = path.segs[i];
      if (s >= cur.startDist && s <= cur.startDist + cur.len) {
        seg = cur;
        break;
      }
    }
    const sub = Math.max(0, Math.min(s - seg.startDist, seg.len));
    const cx = seg.p1[0] + seg.tangent.x * sub;
    const cy = seg.p1[1] + seg.tangent.y * sub;
    return {
      x: cx + seg.normal.x * laneOffset,
      y: cy + seg.normal.y * laneOffset,
      heading: Math.atan2(seg.tangent.y, seg.tangent.x),
    };
  }

  spawnAgents() {
    if (this.edgePaths.length === 0) {
      this.agents = [];
      return;
    }

    const agents = [];
    const totalNetworkLen = this.edgePaths.reduce((acc, p) => acc + p.totalLen, 0);

    for (let i = 0; i < this.agentCount; i++) {
      let r = Math.random() * totalNetworkLen;
      let pathIdx = 0;
      for (let p = 0; p < this.edgePaths.length; p++) {
        r -= this.edgePaths[p].totalLen;
        if (r <= 0) { pathIdx = p; break; }
      }
      const path = this.edgePaths[pathIdx];
      const typeInfo = pickType();

      const maxOffset = (path.width * 0.40);
      let laneOffset = (Math.random() * 2 - 1) * maxOffset;
      if (typeInfo.type === 3 || typeInfo.type === 6) {
        laneOffset *= 0.55;
      }

      const s = Math.random() * path.totalLen;
      const pt = this.getPoint(path, s, laneOffset);
      const speed = typeInfo.speed * (0.85 + Math.random() * 0.3);

      agents.push({
        id: this.nextId++,
        type: typeInfo.type,
        pathIdx,
        s,
        laneOffset,
        speed,
        baseSpeed: speed,
        x: pt.x,
        y: pt.y,
        heading: pt.heading,
        prevX: pt.x,
        prevY: pt.y,
        prevHeading: pt.heading,
      });
    }

    this.agents = agents;
  }

  setAgentCount(count) {
    const target = Math.max(20, Math.min(count, 800));
    this.agentCount = target;
    if (this.agents.length < target) {
      const needed = target - this.agents.length;
      const totalNetworkLen = this.edgePaths.reduce((acc, p) => acc + p.totalLen, 0);
      for (let i = 0; i < needed; i++) {
        let r = Math.random() * totalNetworkLen;
        let pathIdx = 0;
        for (let p = 0; p < this.edgePaths.length; p++) {
          r -= this.edgePaths[p].totalLen;
          if (r <= 0) { pathIdx = p; break; }
        }
        const path = this.edgePaths[pathIdx];
        const typeInfo = pickType();
        const maxOffset = path.width * 0.40;
        let laneOffset = (Math.random() * 2 - 1) * maxOffset;
        if (typeInfo.type === 3 || typeInfo.type === 6) laneOffset *= 0.55;
        const s = Math.random() * path.totalLen;
        const pt = this.getPoint(path, s, laneOffset);
        const speed = typeInfo.speed * (0.85 + Math.random() * 0.3);
        this.agents.push({
          id: this.nextId++,
          type: typeInfo.type,
          pathIdx,
          s,
          laneOffset,
          speed,
          baseSpeed: speed,
          x: pt.x,
          y: pt.y,
          heading: pt.heading,
          prevX: pt.x,
          prevY: pt.y,
          prevHeading: pt.heading,
        });
      }
    } else if (this.agents.length > target) {
      this.agents = this.agents.slice(0, target);
    }
  }

  setSpeedMultiplier(mult) {
    this.speedMultiplier = Math.max(0.1, Math.min(mult, 3.0));
  }

  setPaused(paused) {
    this.paused = paused;
  }

  reset() {
    this.spawnAgents();
  }

  step(dt = 0.02) {
    if (this.paused || this.edgePaths.length === 0) return this.agents;

    const effDt = Math.min(dt, 0.1);
    const paths = this.edgePaths;

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      const path = paths[a.pathIdx];
      if (!path) continue;

      a.prevX = a.x;
      a.prevY = a.y;
      a.prevHeading = a.heading;

      a.s += a.speed * this.speedMultiplier * effDt;
      if (a.s >= path.totalLen) {
        a.s = a.s % path.totalLen;
        if (paths.length > 1 && Math.random() < 0.25) {
          a.pathIdx = Math.floor(Math.random() * paths.length);
        }
      }

      const pt = this.getPoint(path, a.s, a.laneOffset);
      a.x = pt.x;
      a.y = pt.y;
      a.heading = pt.heading;
    }

    return this.agents;
  }

  getAgents() {
    return this.agents;
  }
}
