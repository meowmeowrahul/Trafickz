import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Mini 3D Preview Canvas for uploaded road network
function NetworkPreviewCanvas({ networkData }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current || !networkData) return;
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0A131C');

    const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 3000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    scene.add(new THREE.AmbientLight('#A8C8E8', 1.2));
    const sun = new THREE.DirectionalLight('#FFFFFF', 1.1);
    sun.position.set(50, 100, 50);
    scene.add(sun);

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({ color: '#070C12', roughness: 1.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const roadMat = new THREE.MeshStandardMaterial({ color: '#1B2A38', roughness: 0.9 });
    const curbMat = new THREE.LineBasicMaterial({ color: '#38BDF8', transparent: true, opacity: 0.8 });
    const juncMat = new THREE.MeshStandardMaterial({ color: '#14202B', roughness: 0.95 });

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    // Edges
    (networkData.edges || []).forEach((edge) => {
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
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;

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
        scene.add(new THREE.Mesh(geom, roadMat));

        const curbPts = pts.map(([x, y]) => new THREE.Vector3(x, 0.02, y));
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curbPts), curbMat));
      }
    });

    // Junctions
    (networkData.junctions || []).forEach((junc) => {
      if (!Array.isArray(junc.shape) || junc.shape.length < 3) return;
      const shape = new THREE.Shape();
      junc.shape.forEach(([x, y], idx) => {
        idx === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
      });
      const geo = new THREE.ShapeGeometry(shape);
      const mesh = new THREE.Mesh(geo, juncMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.012;
      scene.add(mesh);
    });

    // Auto-fit camera
    if (isFinite(minX)) {
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      const span = Math.max(maxX - minX, maxZ - minZ, 30);
      camera.position.set(cx, span * 0.9, cz + span * 0.85);
      controls.target.set(cx, 0, cz);
    } else {
      camera.position.set(0, 80, 80);
    }
    controls.update();

    const resize = () => {
      const w = mount.clientWidth || 400;
      const h = mount.clientHeight || 240;
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
  }, [networkData]);

  return <div ref={mountRef} className="preview-3d-canvas" />;
}

export default function AddRoadModal({ isOpen, onClose, onApplyRoadData }) {
  const [dragActive, setDragActive] = useState(false);
  const [fileState, setFileState] = useState('idle'); // 'idle' | 'processing' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file) => {
    if (!file) return;
    setFileState('processing');
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;

        // Try JSON parse
        let data;
        try {
          data = JSON.parse(text);
        } catch (jsonErr) {
          // If XML/OSM
          if (text.includes('<osm') || text.includes('<net')) {
            throw new Error(
              'Raw XML/OSM file detected. XML road files must be compiled into the digital twin network format via the offline map pipeline: "python map_pipeline/osm_to_net.py --osm input.osm". Alternatively, upload a road_network.json schema file.'
            );
          }
          throw new Error('Invalid JSON format: ' + jsonErr.message);
        }

        // Schema validation
        if (!data || typeof data !== 'object') {
          throw new Error('Uploaded file is not a valid JSON object.');
        }

        // Check if edges exist
        let edges = data.edges;
        if (!Array.isArray(edges)) {
          // Check GeoJSON FeatureCollection
          if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
            edges = data.features.map((f, idx) => ({
              id: f.id || `feature_${idx}`,
              width: f.properties?.width || 12,
              centerline: f.geometry?.coordinates || [],
            }));
            data.edges = edges;
          } else {
            throw new Error(
              'Missing "edges" array in road network schema. Expected { edges: [{ id, width, centerline: [[x,y],...] }], junctions: [...] }.'
            );
          }
        }

        if (edges.length === 0) {
          throw new Error('Road network contains 0 edges/road segments.');
        }

        setFileInfo({
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          edgesCount: edges.length,
          junctionsCount: (data.junctions || []).length,
          barricadesCount: (data.barricades || []).length,
          potholesCount: (data.potholes || []).length,
        });
        setParsedData(data);
        setFileState('success');
      } catch (err) {
        setErrorMessage(err.message || 'Failed to process road network file.');
        setFileState('error');
      }
    };

    reader.onerror = () => {
      setErrorMessage('Error reading file from disk.');
      setFileState('error');
    };

    // Simulate minor processing lag for user feedback
    setTimeout(() => {
      reader.readAsText(file);
    }, 400);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleLoadSample = async () => {
    setFileState('processing');
    setErrorMessage('');
    try {
      const res = await fetch('/sample_road_network.json');
      if (!res.ok) throw new Error('Could not fetch sample road network.');
      const data = await res.json();
      setFileInfo({
        name: 'Delhi Arterial Corridor (Ring Road South)',
        size: '2.8 KB',
        edgesCount: data.edges?.length || 0,
        junctionsCount: data.junctions?.length || 0,
        barricadesCount: data.barricades?.length || 0,
        potholesCount: data.potholes?.length || 0,
      });
      setParsedData(data);
      setFileState('success');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load sample network.');
      setFileState('error');
    }
  };

  const handleApply = () => {
    if (!parsedData) return;
    onApplyRoadData(parsedData);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="panel-eyebrow">Spatial Ingestion</span>
            <h2 className="modal-title">Add / Upload Road Network</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Dropzone & Picker */}
          {fileState !== 'success' && (
            <>
              <div
                className={`upload-dropzone active-drop ${dragActive ? 'drag-over' : ''} ${fileState === 'processing' ? 'processing' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept=".json,.geojson,.xml,.osm"
                  onChange={handleFileSelect}
                />

                {fileState === 'processing' ? (
                  <div className="processing-state">
                    <div className="spinner" />
                    <strong>Parsing & Validating Geometry...</strong>
                    <p>Verifying centerline segments, widths, and topology</p>
                  </div>
                ) : (
                  <>
                    <div className="dropzone-icon highlight">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                    </div>
                    <div className="dropzone-text">
                      <strong>Choose a road network file or drag & drop here</strong>
                      <p>Supports .json (Road Schema), .geojson (Features), .osm / .xml</p>
                    </div>
                    <button type="button" className="ctrl-btn ghost" style={{ marginTop: '10px' }}>
                      Browse Local Files
                    </button>
                  </>
                )}
              </div>

              <div className="quick-sample-row">
                <span>Need test data?</span>
                <button type="button" className="quick-sample-btn" onClick={handleLoadSample}>
                  Load Delhi Ring Road Corridor (Sample JSON)
                </button>
              </div>
            </>
          )}

          {/* Error State */}
          {fileState === 'error' && (
            <div className="upload-error-box">
              <div className="error-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Upload Failed</span>
              </div>
              <p className="error-desc">{errorMessage}</p>
              <button
                type="button"
                className="ctrl-btn ghost"
                onClick={() => setFileState('idle')}
                style={{ marginTop: '8px', alignSelf: 'flex-start' }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Success & Preview State */}
          {fileState === 'success' && fileInfo && parsedData && (
            <div className="upload-success-state">
              <div className="success-banner">
                <span className="conn-dot" style={{ background: 'var(--accent-green)' }} />
                <span>Road Network Successfully Parsed & Validated</span>
              </div>

              <div className="preview-details-grid">
                <div className="preview-metadata panel">
                  <span className="panel-eyebrow">Topology Inventory</span>
                  <div className="perf-rows" style={{ marginTop: '8px' }}>
                    <div className="perf-row">
                      <span>File Name</span>
                      <strong className="perf-val">{fileInfo.name}</strong>
                    </div>
                    <div className="perf-row">
                      <span>File Size</span>
                      <span className="perf-val font-mono">{fileInfo.size}</span>
                    </div>
                    <div className="perf-row">
                      <span>Road Segments</span>
                      <span className="perf-val font-mono perf-ok">{fileInfo.edgesCount} edges</span>
                    </div>
                    <div className="perf-row">
                      <span>Intersections</span>
                      <span className="perf-val font-mono">{fileInfo.junctionsCount}</span>
                    </div>
                    <div className="perf-row">
                      <span>Barricades</span>
                      <span className="perf-val font-mono">{fileInfo.barricadesCount}</span>
                    </div>
                    <div className="perf-row">
                      <span>Potholes</span>
                      <span className="perf-val font-mono">{fileInfo.potholesCount}</span>
                    </div>
                  </div>
                </div>

                <div className="preview-canvas-panel panel">
                  <span className="panel-eyebrow">3D Interactive Preview</span>
                  <NetworkPreviewCanvas networkData={parsedData} />
                </div>
              </div>

              <div className="info-banner" style={{ marginTop: '12px' }}>
                <strong>Simulation Notice:</strong> Applying this network will render the new geometry and auto-frame the camera in both the Map view and Live Simulation. The C++ backend simulator is running; to load this network permanently into C++ physics, pass the file to <code>SimConfig.net_xml_path</code> or launch with the map pipeline.
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {fileState === 'success' ? (
            <>
              <button
                type="button"
                className="ctrl-btn ghost"
                onClick={() => {
                  setFileState('idle');
                  setParsedData(null);
                }}
              >
                Upload Different File
              </button>
              <button type="button" className="ctrl-btn primary" onClick={handleApply}>
                Load Network into Simulation & Map View
              </button>
            </>
          ) : (
            <button type="button" className="ctrl-btn ghost" onClick={onClose}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
