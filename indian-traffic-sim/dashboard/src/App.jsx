import React, { useState, useEffect, useRef } from 'react';
import SimulationCanvas from './SimulationCanvas';
import './App.css';

function App() {
  const [connected, setConnected] = useState(false);
  const [agentCount, setAgentCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [roadData, setRoadData] = useState(null);
  const [agents, setAgents] = useState([]);
  const agentsRef = useRef([]);
  const framesRef = useRef(0);
  const wsRef = useRef(null);

  const [numAgents, setNumAgents] = useState(200);
  const [idmT, setIdmT] = useState(0.67);
  const [sfmA, setSfmA] = useState(1.26);
  const [enableBarricades, setEnableBarricades] = useState(true);
  const [enablePotholes, setEnablePotholes] = useState(true);

  const [isControlsOpen, setIsControlsOpen] = useState(true);

  const applyControls = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
            type: "control",
            num_agents: numAgents,
            idm_T: idmT,
            sfm_A: sfmA,
            barricades_enabled: enableBarricades,
            potholes_enabled: enablePotholes
        }));
    }
  };

  useEffect(() => {
    let ws;
    let reconnectTimer;
    let isMounted = true;
    
    const connect = () => {
      ws = new WebSocket('ws://localhost:9001');
      ws.binaryType = 'arraybuffer';
      
      ws.onopen = () => {
        if (!isMounted) return;
        setConnected(true);
        wsRef.current = ws;
      };
      
      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (isMounted) reconnectTimer = setTimeout(connect, 2000);
      };
      
      ws.onmessage = (event) => {
        if (!isMounted) return;
        if (typeof event.data === 'string') {
           const data = JSON.parse(event.data);
           if (data.type === 'road_network') {
               setRoadData(data);
           }
           return;
        }
        
        const buffer = event.data;
        const view = new DataView(buffer);
        const count = buffer.byteLength / 21;
        
        agentsRef.current.length = count;
        for (let i = 0; i < count; i++) {
          const offset = i * 21;
          agentsRef.current[i] = {
            id: view.getUint32(offset, true),
            type: view.getUint8(offset + 4),
            x: view.getFloat32(offset + 5, true),
            y: view.getFloat32(offset + 9, true),
            heading: view.getFloat32(offset + 13, true),
            speed: view.getFloat32(offset + 17, true)
          };
        }
        // Only trigger state updates for the HUD, not the 3D canvas itself
        setAgentCount(count);
        framesRef.current += 1;
      };
    };
    
    connect();
    
    const fpsInterval = setInterval(() => {
      if (!isMounted) return;
      setFps(framesRef.current);
      framesRef.current = 0;
      setAgents(agentsRef.current); // Sync to react tree occasionally if needed, but we pass ref to canvas
    }, 1000);
    
    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      clearInterval(fpsInterval);
      if (ws) ws.close();
    };
  }, []);

  return (
    <>
      <div className="hud">
        <h1>TruTraffic Twin</h1>
        <div className="status-row">
          <div className={`dot ${connected ? 'connected' : ''}`}></div>
          {connected ? 'LIVE STREAM' : 'OFFLINE'}
        </div>
        <div className="status-row">
          <span>Agents:</span>
          <strong>{agentCount}</strong>
        </div>
        <div className="status-row">
          <span>Tick Rate:</span>
          <strong>{fps} Hz</strong>
        </div>
        <div className="status-row" style={{marginTop: 15, display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
          <span style={{color: 'cyan', fontSize: '0.8rem'}}>■ 2W</span>
          <span style={{color: 'orange', fontSize: '0.8rem'}}>■ Auto</span>
          <span style={{color: 'blue', fontSize: '0.8rem'}}>■ Car</span>
          <span style={{color: 'red', fontSize: '0.8rem'}}>■ Bus</span>
          <span style={{color: 'purple', fontSize: '0.8rem'}}>■ Ped</span>
        </div>
      </div>

      <div className="control-panel" style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.8)', padding: 20, borderRadius: 8, color: 'white', zIndex: 100, minWidth: 250 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setIsControlsOpen(!isControlsOpen)}>
          <h3 style={{ margin: 0 }}>Live Controls</h3>
          <span style={{ fontSize: '18px' }}>{isControlsOpen ? '▲' : '▼'}</span>
        </div>
        
        {isControlsOpen && (
          <div style={{ marginTop: 20 }}>
            <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5 }}>Agent Count: {numAgents}</label>
                <input type="range" min="50" max="500" step="10" value={numAgents} onChange={(e) => setNumAgents(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5 }}>IDM Aggressiveness (T): {idmT}</label>
                <input type="range" min="0.5" max="3.0" step="0.1" value={idmT} onChange={(e) => setIdmT(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5 }}>SFM Repulsion (A): {sfmA}</label>
                <input type="range" min="1.0" max="10.0" step="0.5" value={sfmA} onChange={(e) => setSfmA(parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 15, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="chkBarricades" checked={enableBarricades} onChange={(e) => setEnableBarricades(e.target.checked)} />
                <label htmlFor="chkBarricades" style={{ cursor: 'pointer' }}>Enable Barricades</label>
            </div>
            <div style={{ marginBottom: 15, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="chkPotholes" checked={enablePotholes} onChange={(e) => setEnablePotholes(e.target.checked)} />
                <label htmlFor="chkPotholes" style={{ cursor: 'pointer' }}>Enable Potholes</label>
            </div>
            <button onClick={applyControls} style={{ width: '100%', padding: '10px', background: '#007BFF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Apply Changes</button>
          </div>
        )}
      </div>
      
      <SimulationCanvas agentsRef={agentsRef} roadData={roadData} />
    </>
  );
}

export default App;
