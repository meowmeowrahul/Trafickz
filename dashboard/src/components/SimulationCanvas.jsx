import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AGENT_TYPE_COLORS, AGENT_DIMENSIONS } from '../utils/constants.js';
import { GEO_BUILDERS } from '../utils/vehicleGeometries.js';

const MAX_AGENTS_PER_TYPE = 2000;

// Camera Auto-Fit - frames the active road network
function fitCameraToRoads(camera, controls, roadData, mode = 'standard') {
  if (!camera) return;
  if (!roadData || !Array.isArray(roadData.edges) || roadData.edges.length === 0) {
    camera.position.set(0, 80, 100);
    if (controls) { controls.target.set(0, 0, 0); controls.update(); }
    return;
  }

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

  roadData.edges.forEach((edge) => {
    if (!Array.isArray(edge.centerline)) return;
    edge.centerline.forEach(([x, y]) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minZ) minZ = y; if (y > maxZ) maxZ = y;
    });
  });

  if (Array.isArray(roadData.junctions)) {
    roadData.junctions.forEach((j) => {
      if (!Array.isArray(j.shape)) return;
      j.shape.forEach(([x, y]) => {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minZ) minZ = y; if (y > maxZ) maxZ = y;
      });
    });
  }

  if (!isFinite(minX)) {
    camera.position.set(0, 80, 100);
    if (controls) { controls.target.set(0, 0, 0); controls.update(); }
    return;
  }

  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const span = Math.max(spanX, spanZ, 40);

  // Closer framing so vehicles and road lanes are crisp and distinct
  const dist = Math.min(Math.max(span * 0.72, 80), 320);

  if (mode === 'topdown') {
    camera.position.set(cx, dist * 1.2, cz + 0.1);
  } else {
    camera.position.set(cx, dist * 0.58, cz + dist * 0.62);
  }

  if (controls) {
    controls.target.set(cx, 0, cz);
    controls.update();
  }
}

// Road Network 3D Builder
function buildRoadNetwork(roadData, options = {}) {
  const group = new THREE.Group();
  if (!roadData) return group;
  const { showRoadBoundaries = true, showObstacles = true } = options;

  const roadMat = new THREE.MeshStandardMaterial({ color: '#131D26', roughness: 0.90, metalness: 0.10 });
  const curbMat = new THREE.LineBasicMaterial({ color: '#334E68', transparent: true, opacity: 0.9 });
  const centerDashedMat = new THREE.LineDashedMaterial({ color: '#627D98', dashSize: 3, gapSize: 2 });
  const junctionMat = new THREE.MeshStandardMaterial({ color: '#101720', roughness: 0.92, metalness: 0.08 });

  if (showRoadBoundaries && Array.isArray(roadData.edges)) {
    roadData.edges.forEach((edge) => {
      if (!Array.isArray(edge.centerline) || edge.centerline.length < 2) return;
      const pts = edge.centerline;
      const halfW = (edge.width || 30) / 2;

      const vertices = [];
      const leftEdgePts = [];
      const rightEdgePts = [];
      const centerPts = [];

      for (let i = 0; i < pts.length; i++) {
        const [x, y] = pts[i];
        centerPts.push(new THREE.Vector3(x, 0.02, y));

        let nx = 0, ny = 1;
        if (i < pts.length - 1) {
          const dx = pts[i + 1][0] - x, dy = pts[i + 1][1] - y;
          const len = Math.hypot(dx, dy) || 1;
          nx = -dy / len; ny = dx / len;
        } else {
          const dx = x - pts[i - 1][0], dy = y - pts[i - 1][1];
          const len = Math.hypot(dx, dy) || 1;
          nx = -dy / len; ny = dx / len;
        }

        const lx = x + nx * halfW, lz = y + ny * halfW;
        const rx = x - nx * halfW, rz = y - ny * halfW;
        leftEdgePts.push(new THREE.Vector3(lx, 0.025, lz));
        rightEdgePts.push(new THREE.Vector3(rx, 0.025, rz));

        if (i < pts.length - 1) {
          const [nxPtX, nxPtY] = pts[i + 1];
          let nnx = 0, nny = 1;
          if (i + 1 < pts.length - 1) {
            const ndx = pts[i + 2][0] - nxPtX, ndy = pts[i + 2][1] - nxPtY;
            const nlen = Math.hypot(ndx, ndy) || 1;
            nnx = -ndy / nlen; nny = ndx / nlen;
          } else {
            nnx = nx; nny = ny;
          }
          const nlx = nxPtX + nnx * halfW, nlz = nxPtY + nny * halfW;
          const nrx = nxPtX - nnx * halfW, nrz = nxPtY - nny * halfW;

          vertices.push(lx, 0.01, lz, rx, 0.01, rz, nlx, 0.01, nlz);
          vertices.push(rx, 0.01, rz, nrx, 0.01, nrz, nlx, 0.01, nlz);
        }
      }

      if (vertices.length > 0) {
        const ribbonGeo = new THREE.BufferGeometry();
        ribbonGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        ribbonGeo.computeVertexNormals();
        group.add(new THREE.Mesh(ribbonGeo, roadMat));

        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(leftEdgePts), curbMat));
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rightEdgePts), curbMat));

        const centerLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(centerPts), centerDashedMat);
        centerLine.computeLineDistances();
        group.add(centerLine);
      }
    });
  }

  if (Array.isArray(roadData.junctions)) {
    roadData.junctions.forEach((junc) => {
      if (!Array.isArray(junc.shape) || junc.shape.length < 3) return;
      const shape = new THREE.Shape();
      junc.shape.forEach(([x, y], idx) => { idx === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y); });
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), junctionMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.012;
      group.add(mesh);
    });
  }

  if (showObstacles) {
    const potholeMat = new THREE.MeshStandardMaterial({ color: '#5A3D1E', roughness: 0.98, metalness: 0.0, transparent: true, opacity: 0.9 });
    const potholeRimMat = new THREE.LineBasicMaterial({ color: '#7C5228', transparent: true, opacity: 0.8 });
    (roadData.potholes || []).forEach((p) => {
      if (!Array.isArray(p.center) || !p.radius) return;
      const r = p.radius;
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), potholeMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.center[0], 0.025, p.center[1]);
      group.add(m);
      const rimPts = [];
      for (let a = 0; a <= Math.PI * 2 + 0.1; a += Math.PI / 10) {
        rimPts.push(new THREE.Vector3(p.center[0] + Math.cos(a) * r, 0.026, p.center[1] + Math.sin(a) * r));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rimPts), potholeRimMat));
    });

    const barricadeMat = new THREE.MeshStandardMaterial({ color: '#DC2626', roughness: 0.45, metalness: 0.2 });
    (roadData.barricades || []).forEach((b) => {
      if (!Array.isArray(b.hull) || b.hull.length < 3) return;
      const shape = new THREE.Shape();
      b.hull.forEach(([x, y], idx) => { idx === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y); });
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.85, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.05, bevelThickness: 0.05 }), barricadeMat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.02;
      group.add(m);
    });
  }

  return group;
}

export default function SimulationCanvas({
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
  const mountRef = useRef(null);
  const roadGroupRef = useRef(null);
  const instanceMeshesRef = useRef([]);
  const agentIndexMapRef = useRef([]);
  const animFrameRef = useRef(null);
  const highlightRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());

  // Always-current refs
  const roadDataRef = useRef(roadData);
  const onSelectAgentRef = useRef(onSelectAgent);
  const onCountFrameRef = useRef(onCountFrame);
  const selectedAgentIdRef = useRef(selectedAgentId);
  const showPedestriansRef = useRef(showPedestrians);
  const showVehiclesRef = useRef(showVehicles);
  const showRoadBoundariesRef = useRef(showRoadBoundaries);
  const showObstaclesRef = useRef(showObstacles);

  roadDataRef.current = roadData;
  onSelectAgentRef.current = onSelectAgent;
  onCountFrameRef.current = onCountFrame;
  selectedAgentIdRef.current = selectedAgentId;
  showPedestriansRef.current = showPedestrians;
  showVehiclesRef.current = showVehicles;
  showRoadBoundariesRef.current = showRoadBoundaries;
  showObstaclesRef.current = showObstacles;

  // Stable refs for camera/controls
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const fitCameraRef = useRef(() => {});

  // THREE.JS SCENE SETUP - runs ONCE on mount
  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070B10');
    scene.fog = new THREE.FogExp2('#070B10', 0.001);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 3000);
    camera.position.set(0, 80, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.minDistance = 6;
    controls.maxDistance = 1200;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lighting
    scene.add(new THREE.AmbientLight('#A8C0D8', 1.2));
    const sun = new THREE.DirectionalLight('#FFFFFF', 1.35);
    sun.position.set(80, 140, 60);
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#3A5C80', 0.5);
    fill.position.set(-60, 40, -40);
    scene.add(fill);

    // Ground plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(5000, 5000),
      new THREE.MeshStandardMaterial({ color: '#090E14', roughness: 0.99, metalness: 0.01 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.0;
    scene.add(ground);

    // Road group
    const roadGroup = new THREE.Group();
    roadGroupRef.current = roadGroup;
    scene.add(roadGroup);

    // Instanced vehicle meshes with vertex colors
    const typeMeshes = [];
    const agentIndexMap = [];
    Object.entries(AGENT_DIMENSIONS).forEach(([typeKey]) => {
      const t = Number(typeKey);
      const builder = GEO_BUILDERS[t] || GEO_BUILDERS[2];
      const geometry = builder();
      const color = AGENT_TYPE_COLORS[t] || '#FFFFFF';
      const material = new THREE.MeshStandardMaterial({
        color,
        vertexColors: true,
        roughness: t === 4 ? 0.8 : 0.32,
        metalness: t === 4 ? 0.0 : 0.22,
        emissive: color,
        emissiveIntensity: 0.06,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, MAX_AGENTS_PER_TYPE);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.userData.agentType = t;
      typeMeshes[t] = mesh;
      agentIndexMap[t] = [];
      scene.add(mesh);
    });
    instanceMeshesRef.current = typeMeshes;
    agentIndexMapRef.current = agentIndexMap;

    // Selection highlight ring
    const hlGeo = new THREE.RingGeometry(1.6, 2.2, 36);
    const hlMat = new THREE.MeshBasicMaterial({ color: '#38BDF8', side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const highlight = new THREE.Mesh(hlGeo, hlMat);
    highlight.rotation.x = -Math.PI / 2;
    highlight.position.y = 0.25;
    highlight.visible = false;
    highlightRef.current = highlight;
    scene.add(highlight);

    fitCameraRef.current = (mode = 'standard') => {
      fitCameraToRoads(cameraRef.current, controlsRef.current, roadDataRef.current, mode);
    };

    // Resize
    const handleResize = () => {
      const w = mount.clientWidth || 800;
      const h = mount.clientHeight || 600;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Click handler for vehicle selection
    const handleClick = (event) => {
      if (event.target !== renderer.domElement) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      let bestHit = null, bestDist = Infinity;
      const meshes = instanceMeshesRef.current;
      const indexMap = agentIndexMapRef.current;
      for (let t = 0; t < meshes.length; t++) {
        const mesh = meshes[t];
        if (!mesh || mesh.count === 0) continue;
        const hits = raycasterRef.current.intersectObject(mesh, false);
        if (hits.length > 0 && hits[0].distance < bestDist) {
          bestDist = hits[0].distance;
          const agentIdx = (indexMap[t] || [])[hits[0].instanceId];
          if (agentIdx !== undefined) bestHit = agentsRef.current[agentIdx];
        }
      }
      if (bestHit) onSelectAgentRef.current?.(bestHit.id);
    };
    renderer.domElement.addEventListener('click', handleClick);

    // Render loop
    const dummy = new THREE.Object3D();

    const renderLoop = () => {
      animFrameRef.current = requestAnimationFrame(renderLoop);
      controls.update();
      onCountFrameRef.current?.();

      const agents = agentsRef.current || [];
      const meshes = instanceMeshesRef.current;
      const indexMap = agentIndexMapRef.current;

      const now = performance.now();
      const lastTick = lastTickTimeRef?.current ?? now;
      const tickInterval = Math.max(tickIntervalRef?.current ?? 20, 10);
      const alpha = Math.min(Math.max((now - lastTick) / tickInterval, 0), 1);

      // Reset counts
      for (let t = 0; t < meshes.length; t++) {
        if (meshes[t]) { meshes[t].count = 0; indexMap[t] = []; }
      }

      const showPed = showPedestriansRef.current;
      const showVeh = showVehiclesRef.current;
      for (let t = 0; t < meshes.length; t++) {
        const mesh = meshes[t];
        if (!mesh) continue;
        mesh.visible = mesh.userData.agentType === 4 ? showPed : showVeh;
      }

      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        if (!agent) continue;
        const t = Number(agent.type ?? 2);
        const mesh = meshes[t];
        if (!mesh || !mesh.visible) continue;

        const [w, h, l] = AGENT_DIMENSIONS[t] || [1.8, 1.45, 4.2];
        const prevX = agent.prevX ?? agent.x, prevY = agent.prevY ?? agent.y;
        const posX = prevX + (agent.x - prevX) * alpha;
        const posY = prevY + (agent.y - prevY) * alpha;

        let diff = agent.heading - (agent.prevHeading ?? agent.heading);
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        const heading = (agent.prevHeading ?? agent.heading) + diff * alpha;
        const rotY = Math.PI / 2 - heading;

        dummy.position.set(posX, 0.04, posY);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(w, h, l);
        dummy.updateMatrix();

        const slot = mesh.count;
        mesh.setMatrixAt(slot, dummy.matrix);
        indexMap[t][slot] = i;
        mesh.count = slot + 1;
      }

      for (let t = 0; t < meshes.length; t++) {
        const mesh = meshes[t];
        if (mesh) mesh.instanceMatrix.needsUpdate = true;
      }

      // Selection highlight
      const hl = highlightRef.current;
      const selId = selectedAgentIdRef.current;
      if (selId !== null) {
        const sel = agents.find((a) => a && a.id === selId);
        if (sel) {
          hl.visible = true;
          const [w, , l] = AGENT_DIMENSIONS[Number(sel.type ?? 2)] || [1.8, 1.45, 4.2];
          hl.scale.setScalar(Math.max(Math.max(w, l) * 0.75, 1.6));
          hl.position.set(sel.x, 0.28, sel.y);
          hl.material.opacity = 0.75 + Math.sin(Date.now() / 250) * 0.2;
        } else {
          hl.visible = false;
        }
      } else {
        hl.visible = false;
      }

      renderer.render(scene, camera);
    };
    renderLoop();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();
      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      typeMeshes.forEach((m) => { if (m) { m.geometry.dispose(); m.material.dispose(); } });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Road network rebuild
  useEffect(() => {
    const rg = roadGroupRef.current;
    if (!rg) return;
    rg.clear();
    if (roadData) {
      rg.add(buildRoadNetwork(roadData, { showRoadBoundaries, showObstacles }));
    }
  }, [roadData, showRoadBoundaries, showObstacles]);

  // Fit Corridor button
  useEffect(() => {
    if (fitViewKey > 0) {
      fitCameraRef.current('standard');
    }
  }, [fitViewKey]);

  // Initial camera fit when road first loads
  const hasAutoFittedRef = useRef(false);
  useEffect(() => {
    if (roadData && !hasAutoFittedRef.current) {
      hasAutoFittedRef.current = true;
      const t = setTimeout(() => fitCameraRef.current('standard'), 120);
      return () => clearTimeout(t);
    }
  }, [roadData]);

  // Smoothly track selected agent when focused
  useEffect(() => {
    if (selectedAgentId !== null && controlsRef.current && cameraRef.current) {
      const agents = agentsRef.current || [];
      const sel = agents.find((a) => a && a.id === selectedAgentId);
      if (sel) {
        const controls = controlsRef.current;
        const camera = cameraRef.current;
        controls.target.set(sel.x, 0, sel.y);
        camera.position.set(sel.x, 28, sel.y + 36);
        controls.update();
      }
    }
  }, [selectedAgentId, agentsRef]);

  return <div ref={mountRef} className="simulation-canvas" />;
}
