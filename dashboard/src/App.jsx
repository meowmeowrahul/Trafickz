import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Overview from './pages/Overview.jsx';
import LiveSimulation from './pages/LiveSimulation.jsx';
import Scenario from './pages/Scenario.jsx';
import Agents from './pages/Agents.jsx';
import MapPage from './pages/MapPage.jsx';
import Telemetry from './pages/Telemetry.jsx';
import Calibration from './pages/Calibration.jsx';
import Performance from './pages/Performance.jsx';
import Settings from './pages/Settings.jsx';
import { useWebSocket } from './hooks/useWebSocket.js';
import { CustomRoadSimulator } from './utils/customRoadSimulator.js';
import './App.css';

export default function App() {
  const [activeNav, setActiveNav] = useState('Live Simulation');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [agentsSnapshot, setAgentsSnapshot] = useState([]);
  const [fitViewToken, setFitViewToken] = useState(0);

  // Custom uploaded road network state
  const [customRoadData, setCustomRoadData] = useState(null);

  // Layer toggles
  const [showPedestrians, setShowPedestrians] = useState(true);
  const [showVehicles, setShowVehicles] = useState(true);
  const [showRoadBoundaries, setShowRoadBoundaries] = useState(true);
  const [showObstacles, setShowObstacles] = useState(true);

  const [fps, setFps] = useState(0);
  const [simTime, setSimTime] = useState('00:00:00');
  const [trafficMetrics, setTrafficMetrics] = useState({
    total: 0,
    byType: {},
    avgSpeed: null,
    density: 'Waiting',
  });

  const {
    connected,
    roadData: backendRoadData,
    agentsRef: backendAgentsRef,
    lastTickTimeRef: backendLastTickTimeRef,
    tickIntervalRef: backendTickIntervalRef,
    sendControl,
  } = useWebSocket();

  const isCustomRoad = !!customRoadData;
  const activeRoadData = customRoadData || backendRoadData;

  // Custom road traffic simulator refs
  const customAgentsRef = useRef([]);
  const customLastTickTimeRef = useRef(performance.now());
  const customTickIntervalRef = useRef(20);
  const simulatorRef = useRef(null);

  // Initialize and run custom road simulator when custom road is active
  useEffect(() => {
    if (!isCustomRoad || !customRoadData) {
      simulatorRef.current = null;
      return;
    }

    const sim = new CustomRoadSimulator(customRoadData, { agentCount: 180, speedMultiplier: 1.0 });
    simulatorRef.current = sim;
    customAgentsRef.current = sim.getAgents();

    let running = true;
    let lastTime = performance.now();

    const loop = () => {
      if (!running) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      if (simulatorRef.current) {
        customAgentsRef.current = simulatorRef.current.step(dt);
        customLastTickTimeRef.current = now;
      }
      requestAnimationFrame(loop);
    };

    const af = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(af);
    };
  }, [isCustomRoad, customRoadData]);

  // Active agents ref based on mode
  const activeAgentsRef = isCustomRoad ? customAgentsRef : backendAgentsRef;
  const activeLastTickTimeRef = isCustomRoad ? customLastTickTimeRef : backendLastTickTimeRef;
  const activeTickIntervalRef = isCustomRoad ? customTickIntervalRef : backendTickIntervalRef;

  const framesRef = useRef(0);

  // Clock
  useEffect(() => {
    const tick = () => setSimTime(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleCountFrame = useCallback(() => {
    framesRef.current += 1;
  }, []);

  // Metrics at 1 Hz
  useEffect(() => {
    const id = setInterval(() => {
      const agents = activeAgentsRef.current || [];
      let speedSum = 0, validSpeedCount = 0;
      const byType = {};
      for (let i = 0; i < agents.length; i++) {
        const a = agents[i];
        if (!a) continue;
        const t = String(a.type ?? 2);
        byType[t] = (byType[t] || 0) + 1;
        if (Number.isFinite(a.speed)) { speedSum += a.speed; validSpeedCount++; }
      }
      const total = agents.length;
      const avgSpeed = validSpeedCount > 0 ? speedSum / validSpeedCount : null;
      let density = 'Low';
      if (total > 350) density = 'Critical';
      else if (total > 220) density = 'High';
      else if (total > 80) density = 'Moderate';
      setTrafficMetrics({ total, byType, avgSpeed, density });
      setAgentsSnapshot([...agents]);
      setFps(framesRef.current);
      framesRef.current = 0;
    }, 1000);
    return () => clearInterval(id);
  }, [activeAgentsRef]);

  // Deselect if agent removed
  useEffect(() => {
    if (selectedAgentId !== null && !agentsSnapshot.some((a) => a.id === selectedAgentId)) {
      setSelectedAgentId(null);
    }
  }, [agentsSnapshot, selectedAgentId]);

  const selectedAgent = useMemo(
    () => agentsSnapshot.find((a) => a.id === selectedAgentId) ?? null,
    [agentsSnapshot, selectedAgentId]
  );

  const handleNav = useCallback((id) => {
    setActiveNav(id);
  }, []);

  const handleSelectAgent = useCallback((id) => {
    setSelectedAgentId(id);
    setActiveNav('Live Simulation');
  }, []);

  const handleFitView = useCallback(() => {
    setFitViewToken((t) => t + 1);
  }, []);

  const handleApplyCustomRoad = useCallback((newRoadData) => {
    setCustomRoadData(newRoadData);
    setFitViewToken((t) => t + 1);
  }, []);

  const handleResetCustomRoad = useCallback(() => {
    setCustomRoadData(null);
    setFitViewToken((t) => t + 1);
  }, []);

  const handleSendControl = useCallback((msg) => {
    if (isCustomRoad) {
      if (msg.num_agents != null) {
        simulatorRef.current?.setAgentCount(msg.num_agents);
      }
      if (msg.speed_multiplier != null) {
        simulatorRef.current?.setSpeedMultiplier(msg.speed_multiplier);
      }
      if (msg.reset) {
        simulatorRef.current?.reset();
      }
    } else {
      sendControl(msg);
    }
  }, [isCustomRoad, sendControl]);

  const commonLayerProps = {
    showPedestrians,
    setShowPedestrians,
    showVehicles,
    setShowVehicles,
    showRoadBoundaries,
    setShowRoadBoundaries,
    showObstacles,
    setShowObstacles,
  };

  return (
    <div className="trafickz-app">
      <Sidebar
        active={activeNav}
        onNav={handleNav}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />

      <div className="main-panel">
        <Topbar
          connected={connected || isCustomRoad}
          roadData={activeRoadData}
          fps={fps}
          agentCount={trafficMetrics.total}
          simTime={simTime}
        />

        <main className="page-area">
          {activeNav === 'Overview' && (
            <Overview
              connected={connected || isCustomRoad}
              roadData={activeRoadData}
              trafficMetrics={trafficMetrics}
              fps={fps}
              onGoToSim={() => setActiveNav('Live Simulation')}
            />
          )}

          {activeNav === 'Live Simulation' && (
            <LiveSimulation
              connected={connected}
              isCustomRoad={isCustomRoad}
              roadData={activeRoadData}
              agentsRef={activeAgentsRef}
              lastTickTimeRef={activeLastTickTimeRef}
              tickIntervalRef={activeTickIntervalRef}
              selectedAgent={selectedAgent}
              selectedAgentId={selectedAgentId}
              onSelectAgent={handleSelectAgent}
              onFocusAgent={handleFitView}
              trafficMetrics={trafficMetrics}
              fitViewToken={fitViewToken}
              onFitView={handleFitView}
              onSendControl={handleSendControl}
              onResetNetwork={handleResetCustomRoad}
              onCountFrame={handleCountFrame}
              {...commonLayerProps}
            />
          )}

          {activeNav === 'Scenario' && (
            <Scenario onGoToSim={() => setActiveNav('Live Simulation')} />
          )}

          {activeNav === 'Agents' && (
            <Agents
              agentsSnapshot={agentsSnapshot}
              onSelectAgent={handleSelectAgent}
            />
          )}

          {activeNav === 'Map' && (
            <MapPage
              roadData={activeRoadData}
              isCustomRoad={isCustomRoad}
              onApplyRoadData={handleApplyCustomRoad}
              onResetRoadData={handleResetCustomRoad}
            />
          )}

          {activeNav === 'Telemetry' && (
            <Telemetry
              trafficMetrics={trafficMetrics}
              fps={fps}
              connected={connected || isCustomRoad}
            />
          )}

          {activeNav === 'Calibration' && <Calibration />}

          {activeNav === 'Performance' && (
            <Performance
              fps={fps}
              trafficMetrics={trafficMetrics}
              connected={connected || isCustomRoad}
            />
          )}

          {activeNav === 'Settings' && <Settings {...commonLayerProps} />}
        </main>
      </div>
    </div>
  );
}
