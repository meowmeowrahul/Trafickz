import { useRef, useEffect, useCallback } from 'react';
import { AGENT_TYPE_COLORS, AGENT_DIMENSIONS } from '../utils/constants.js';

// Sizes as [width, length] matching the reference
const AGENT_SIZES_2D = [
  [0.8, 2.0],   // 0: TWO_WHEELER
  [1.4, 2.6],   // 1: AUTO
  [1.8, 4.5],   // 2: CAR
  [2.5, 10.0],  // 3: BUS
  [0.4, 0.4],   // 4: PEDESTRIAN
  [0.6, 1.8],   // 5: BICYCLE
  [2.5, 12.0],  // 6: TRUCK
  [2.0, 6.0],   // 7: MEDIUM_VEHICLE
];

function resizeCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }
}

function drawRoads(ctx, roadData, showBoundaries) {
  if (!roadData || !showBoundaries) return;

  // Junctions
  if (roadData.junctions) {
    for (const junc of roadData.junctions) {
      if (!junc.shape || junc.shape.length < 3) continue;
      ctx.fillStyle = '#333333';
      ctx.beginPath();
      ctx.moveTo(junc.shape[0][0], junc.shape[0][1]);
      for (let i = 1; i < junc.shape.length; i++) {
        ctx.lineTo(junc.shape[i][0], junc.shape[i][1]);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  if (!roadData.edges) return;

  for (const edge of roadData.edges) {
    if (!edge.centerline || edge.centerline.length < 2) continue;

    // Road surface
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = edge.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(edge.centerline[0][0], edge.centerline[0][1]);
    for (let i = 1; i < edge.centerline.length; i++) {
      ctx.lineTo(edge.centerline[i][0], edge.centerline[i][1]);
    }
    ctx.stroke();

    // Center dashed line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 0.15;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(edge.centerline[0][0], edge.centerline[0][1]);
    for (let i = 1; i < edge.centerline.length; i++) {
      ctx.lineTo(edge.centerline[i][0], edge.centerline[i][1]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawObstacles(ctx, roadData, showObstacles) {
  if (!roadData || !showObstacles) return;

  if (roadData.potholes) {
    for (const p of roadData.potholes) {
      ctx.strokeStyle = 'rgba(255, 165, 0, 0.6)';
      ctx.lineWidth = 0.3;
      ctx.setLineDash([1, 1]);
      ctx.beginPath();
      ctx.arc(p.center[0], p.center[1], p.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(139, 90, 43, 0.3)';
      ctx.fill();
    }
  }

  if (roadData.barricades) {
    for (const b of roadData.barricades) {
      ctx.fillStyle = 'rgba(255, 60, 60, 0.7)';
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.moveTo(b.hull[0][0], b.hull[0][1]);
      for (let i = 1; i < b.hull.length; i++) {
        ctx.lineTo(b.hull[i][0], b.hull[i][1]);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawAgents(ctx, agents, showVehicles, showPedestrians, selectedAgentId) {
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    if (!a) continue;
    const t = Number(a.type ?? 2);

    // Visibility filter
    if (t === 4 && !showPedestrians) continue;
    if (t !== 4 && !showVehicles) continue;

    const [w, l] = AGENT_SIZES_2D[t] || [1, 1];
    const color = AGENT_TYPE_COLORS[t] || '#ffffff';

    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.heading);

    // Body
    ctx.fillStyle = color;
    ctx.fillRect(-l / 2, -w / 2, l, w);

    // Direction indicator
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(l / 2, 0);
    ctx.lineTo(l / 2 - 0.5, -w / 3);
    ctx.lineTo(l / 2 - 0.5, w / 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Selection ring
    if (selectedAgentId !== null && a.id === selectedAgentId) {
      const r = Math.max(w, l) / 2 + 1.5;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

export default function SimulationCanvas2D({
  agentsRef,
  lastTickTimeRef,
  tickIntervalRef,
  roadData,
  selectedAgentId,
  onSelectAgent,
  showPedestrians = true,
  showVehicles = true,
  showRoadBoundaries = true,
  showObstacles = true,
  fitViewKey = 0,
  onCountFrame,
}) {
  const canvasRef = useRef(null);
  const transformRef = useRef({ offsetX: 0, offsetY: 0, scale: 1.0 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const initialFitDone = useRef(false);
  const animFrameRef = useRef(null);

  // Always-current refs to avoid re-renders
  const roadDataRef = useRef(roadData);
  const selectedAgentIdRef = useRef(selectedAgentId);
  const showPedestriansRef = useRef(showPedestrians);
  const showVehiclesRef = useRef(showVehicles);
  const showRoadBoundariesRef = useRef(showRoadBoundaries);
  const showObstaclesRef = useRef(showObstacles);
  const onSelectAgentRef = useRef(onSelectAgent);
  const onCountFrameRef = useRef(onCountFrame);

  roadDataRef.current = roadData;
  selectedAgentIdRef.current = selectedAgentId;
  showPedestriansRef.current = showPedestrians;
  showVehiclesRef.current = showVehicles;
  showRoadBoundariesRef.current = showRoadBoundaries;
  showObstaclesRef.current = showObstacles;
  onSelectAgentRef.current = onSelectAgent;
  onCountFrameRef.current = onCountFrame;

  // Fit camera to road bounds
  const fitCamera = useCallback(() => {
    const rd = roadDataRef.current;
    const canvas = canvasRef.current;
    if (!rd || !rd.edges || rd.edges.length === 0 || !canvas) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    rd.edges.forEach((edge) => {
      if (!edge.centerline) return;
      edge.centerline.forEach((pt) => {
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
      });
    });

    if (!isFinite(minX)) return;

    const rect = canvas.getBoundingClientRect();
    const width = maxX - minX;
    const height = maxY - minY;
    const scaleX = rect.width / (width * 1.1);
    const scaleY = rect.height / (height * 1.1);
    const scale = Math.min(scaleX, scaleY, 20.0);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    transformRef.current = {
      offsetX: -centerX * scale,
      offsetY: centerY * scale,
      scale,
    };
  }, []);

  // Initial fit
  useEffect(() => {
    if (roadData && !initialFitDone.current) {
      initialFitDone.current = true;
      const t = setTimeout(() => fitCamera(), 100);
      return () => clearTimeout(t);
    }
  }, [roadData, fitCamera]);

  // Fit on fitViewKey
  useEffect(() => {
    if (fitViewKey > 0) fitCamera();
  }, [fitViewKey, fitCamera]);

  // Render loop + event handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = () => {
      resizeCanvas(canvas);
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;

      // Clear
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.restore();

      // Apply camera transform (Y-flip like the reference)
      const transform = transformRef.current;
      ctx.save();
      ctx.setTransform(
        transform.scale * dpr, 0, 0,
        -transform.scale * dpr,
        transform.offsetX * dpr + canvas.width / 2,
        transform.offsetY * dpr + canvas.height / 2
      );

      drawRoads(ctx, roadDataRef.current, showRoadBoundariesRef.current);
      drawObstacles(ctx, roadDataRef.current, showObstaclesRef.current);

      const agents = agentsRef?.current || [];
      if (agents.length > 0) {
        drawAgents(
          ctx, agents,
          showVehiclesRef.current,
          showPedestriansRef.current,
          selectedAgentIdRef.current
        );
      }

      ctx.restore();

      onCountFrameRef.current?.();
      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    // Wheel zoom
    const handleWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const transform = transformRef.current;

      let newScale = transform.scale * zoomFactor;
      newScale = Math.max(0.1, Math.min(newScale, 20.0));

      const actualZoom = newScale / transform.scale;
      transform.offsetX = mouseX - (mouseX - transform.offsetX) * actualZoom;
      transform.offsetY = mouseY - (mouseY - transform.offsetY) * actualZoom;
      transform.scale = newScale;
    };

    const handleMouseDown = (e) => {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      transformRef.current.offsetX += dx;
      transformRef.current.offsetY += dy;
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    // Click to select
    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const transform = transformRef.current;
      const dpr = window.devicePixelRatio || 1;

      // Screen pixel to world coordinate conversion
      // The setTransform is: (scale*dpr, 0, 0, -scale*dpr, offX*dpr + w/2, offY*dpr + h/2)
      // So: screenX = worldX * scale * dpr + offsetX * dpr + canvasW/2
      //     screenY = worldY * (-scale * dpr) + offsetY * dpr + canvasH/2
      // Solving for world coords:
      const screenX = (e.clientX - rect.left) * dpr;
      const screenY = (e.clientY - rect.top) * dpr;
      const wx = (screenX - transform.offsetX * dpr - canvas.width / 2) / (transform.scale * dpr);
      const wy = (screenY - transform.offsetY * dpr - canvas.height / 2) / (-transform.scale * dpr);

      const agents = agentsRef?.current || [];
      let bestAgent = null;
      let bestDist = 8 / transform.scale;

      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        if (!a) continue;
        const dx = a.x - wx;
        const dy = a.y - wy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          bestAgent = a;
        }
      }

      if (bestAgent) onSelectAgentRef.current?.(bestAgent.id);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('click', handleClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track selected agent
  useEffect(() => {
    if (selectedAgentId !== null && agentsRef?.current) {
      const agents = agentsRef.current;
      const sel = agents.find((a) => a && a.id === selectedAgentId);
      if (sel) {
        const transform = transformRef.current;
        transform.offsetX = -sel.x * transform.scale;
        transform.offsetY = sel.y * transform.scale;
      }
    }
  }, [selectedAgentId, agentsRef]);

  return (
    <canvas
      ref={canvasRef}
      className="simulation-canvas"
      style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
      onMouseLeave={() => { isDragging.current = false; }}
    />
  );
}
