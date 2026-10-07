import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import AddRoadModal from '../components/AddRoadModal.jsx';

function MapCanvas({ roadData }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#080D12');

    const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 3000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    scene.add(new THREE.AmbientLight('#C0D8F0', 1.3));
    const sun = new THREE.DirectionalLight('#FFFFFF', 1.0);
    sun.position.set(50, 100, 50);
    scene.add(sun);

    // Ground plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(3000, 3000),
      new THREE.MeshStandardMaterial({ color: '#0A121A', roughness: 1.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const roadGroup = new THREE.Group();
    scene.add(roadGroup);

    const roadMat = new THREE.MeshStandardMaterial({ color: '#182430', roughness: 0.9 });
    const curbMat = new THREE.LineBasicMaterial({ color: '#38BDF8', opacity: 0.85, transparent: true });
    const juncMat = new THREE.MeshStandardMaterial({ color: '#14202B', roughness: 0.95 });

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    if (roadData && Array.isArray(roadData.edges)) {
      roadData.edges.forEach((edge) => {
        if (!Array.isArray(edge.centerline) || edge.centerline.length < 2) return;
        const pts = edge.centerline;
        const roadW = Math.max(Number(edge.width) || 12, 4);
        const hw = roadW / 2;
        const vertices = [];

        for (let i = 0; i < pts.length; i++) {
          const [x, y] = pts[i];
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minZ) minZ = y; if (y > maxZ) maxZ = y;
        }

        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i];
          const [x1, y1] = pts[i + 1];
          const dx = x1 - x0;
          const dy = y1 - y0;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;

          const lx0 = x0 + nx * hw, lz0 = y0 + ny * hw;
          const rx0 = x0 - nx * hw, rz0 = y0 - ny * hw;
          const lx1 = x1 + nx * hw, lz1 = y1 + ny * hw;
          const rx1 = x1 - nx * hw, rz1 = y1 - ny * hw;

          vertices.push(
            lx0, 0.01, lz0,
            rx0, 0.01, rz0,
            lx1, 0.01, lz1,
            rx0, 0.01, rz0,
            rx1, 0.01, rz1,
            lx1, 0.01, lz1
          );
        }

        if (vertices.length > 0) {
          const geom = new THREE.BufferGeometry();
          geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
          geom.computeVertexNormals();
          roadGroup.add(new THREE.Mesh(geom, roadMat));

          const linePts = pts.map(([x, y]) => new THREE.Vector3(x, 0.02, y));
          roadGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), curbMat));
        }
      });
    }

    // Junctions
    if (roadData && Array.isArray(roadData.junctions)) {
      roadData.junctions.forEach((junc) => {
        if (!Array.isArray(junc.shape) || junc.shape.length < 3) return;
        const shape = new THREE.Shape();
        junc.shape.forEach(([x, y], idx) => {
          idx === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
        });
        const geo = new THREE.ShapeGeometry(shape);
        const mesh = new THREE.Mesh(geo, juncMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.012;
        roadGroup.add(mesh);
      });
    }

    // Camera auto-framing
    if (isFinite(minX)) {
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const span = Math.max(maxX - minX, maxZ - minZ, 30);
      camera.position.set(cx, span * 0.9, cz + span * 0.85);
      controls.target.set(cx, 0, cz);
    } else {
      camera.position.set(0, 80, 80);
    }
    controls.update();

    const resize = () => {
      const w = mount.clientWidth || 800;
      const h = mount.clientHeight || 500;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    let af;
    const loop = () => {
      af = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(af);
      window.removeEventListener('resize', resize);
      controls.dispose();
      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [roadData]);

  return <div ref={mountRef} className="map-canvas-container" />;
}

export default function MapPage({ roadData, isCustomRoad, onApplyRoadData, onResetRoadData }) {
  const [modalOpen, setModalOpen] = useState(false);
  const edges = roadData?.edges || [];
  const junctions = roadData?.junctions || [];
  const barricades = roadData?.barricades || [];
  const potholes = roadData?.potholes || [];

  return (
    <div className="page-map">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Spatial Infrastructure</p>
          <h2 className="page-title">Road Network & Topology</h2>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isCustomRoad && (
            <button
              type="button"
              className="ctrl-btn ghost"
              onClick={onResetRoadData}
              title="Switch back to live C++ backend corridor network"
            >
              Reset to Backend Live Network
            </button>
          )}
          <button
            type="button"
            className="ctrl-btn primary"
            onClick={() => setModalOpen(true)}
            id="add-road-network-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Road Network
          </button>
        </div>
      </div>

      {isCustomRoad && (
        <div className="info-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <strong>Active Viewport Network:</strong> Custom Uploaded Network ({roadData.name || 'Imported Road Network'} – {edges.length} segments, {junctions.length} junctions).
          </div>
          <button type="button" className="ghost-btn" onClick={onResetRoadData} style={{ padding: '3px 8px', fontSize: '10px' }}>
            Revert to Live C++ Backend
          </button>
        </div>
      )}

      <div className="map-view-grid">
        <div className="map-canvas-panel panel">
          <div className="panel-hdr" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="panel-eyebrow">3D Topology</span>
              <h3>{roadData?.name || 'Corridor Visualization'}</h3>
            </div>
            <span className="count-badge font-mono">{edges.length} segments</span>
          </div>
          <MapCanvas roadData={roadData} />
        </div>

        <div className="map-sidebar-panels">
          <section className="panel">
            <div className="panel-hdr compact">
              <span className="panel-eyebrow">Inventory</span>
              <h3>Network Geometry</h3>
            </div>
            <div className="perf-rows">
              <div className="perf-row">
                <span>Road Segments</span>
                <span className="perf-val font-mono">{edges.length}</span>
              </div>
              <div className="perf-row">
                <span>Junctions / Nodes</span>
                <span className="perf-val font-mono">{junctions.length}</span>
              </div>
              <div className="perf-row">
                <span>Barricades</span>
                <span className="perf-val font-mono">{barricades.length}</span>
              </div>
              <div className="perf-row">
                <span>Potholes</span>
                <span className="perf-val font-mono">{potholes.length}</span>
              </div>
              <div className="perf-row">
                <span>Source</span>
                <span className="perf-val">{isCustomRoad ? 'Uploaded File' : 'C++ Backend (Port 9001)'}</span>
              </div>
            </div>
          </section>

          {/* Road Network Upload Pipeline & Button */}
          <section className="panel">
            <div className="panel-hdr compact">
              <span className="panel-eyebrow">Spatial Ingestion</span>
              <h3>Import & Upload</h3>
            </div>
            <div
              className="upload-dropzone clickable"
              onClick={() => setModalOpen(true)}
              title="Click to open the Add Road Network upload dialog"
            >
              <div className="dropzone-icon highlight">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <div className="dropzone-text">
                <strong>+ Add Road Network File</strong>
                <p>Upload .json, .geojson or OpenStreetMap files</p>
              </div>
              <button type="button" className="ctrl-btn primary" style={{ marginTop: '10px' }} onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}>
                Open Road Upload Dialog
              </button>
            </div>
            <div className="info-banner" style={{ marginTop: '12px' }}>
              <strong>Pipeline Documentation:</strong> To convert raw OpenStreetMap geometries into optimized simulation networks, run <code>python map_pipeline/osm_to_net.py</code> to produce network schemas.
            </div>
          </section>
        </div>
      </div>

      <AddRoadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onApplyRoadData={onApplyRoadData}
      />
    </div>
  );
}
