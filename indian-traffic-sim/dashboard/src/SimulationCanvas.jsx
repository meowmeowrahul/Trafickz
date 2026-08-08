import React, { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import RoadMesh from "./RoadMesh";

function CameraController({ position }) {
  const { camera } = useThree();
  useEffect(() => {
    if (position) {
      camera.position.set(position[0], position[1], position[2]);
      camera.updateProjectionMatrix();
    }
  }, [position, camera]);
  return null;
}

const AGENT_COLORS = [
  new THREE.Color("cyan"), // 0: TWO_WHEELER
  new THREE.Color("orange"), // 1: AUTO_RICKSHAW
  new THREE.Color("blue"), // 2: CAR
  new THREE.Color("red"), // 3: BUS
  new THREE.Color("purple"), // 4: PEDESTRIAN
];

const AGENT_SCALES = [
  [0.8, 2.0, 1.0], // TWO_WHEELER (w, l, h)
  [1.4, 2.6, 1.5], // AUTO_RICKSHAW
  [1.8, 4.5, 1.2], // CAR
  [2.5, 10.0, 3.0], // BUS
  [0.5, 0.5, 1.8], // PEDESTRIAN
];

function AgentInstancedMesh({ type, agents, maxAgents = 2000 }) {
  const meshRef = useRef();
  const color = AGENT_COLORS[type];
  const scale = AGENT_SCALES[type];
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (!meshRef.current) return;

    let count = 0;
    for (let i = 0; i < agents.length; i++) {
      if (agents[i].type === type) {
        const a = agents[i];
        // 2D X/Y -> 3D X/Z
        dummy.position.set(a.x, scale[2] / 2, a.y);
        dummy.rotation.set(0, -a.heading, 0);
        dummy.scale.set(scale[0], scale[2], scale[1]); // width(X), height(Y), length(Z)
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(count, dummy.matrix);
        count++;
      }
    }
    meshRef.current.count = count;
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, maxAgents]}>
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.8} />
    </instancedMesh>
  );
}

export default function SimulationCanvas({ agents, roadData, cameraPos }) {
  return (
    <Canvas camera={{ position: [500, 800, 800], fov: 45, near: 1, far: 5000 }}>
      <CameraController position={cameraPos} />
      <color attach="background" args={["#0a0a0f"]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[100, 200, 50]} intensity={1.5} />

      <Grid
        infiniteGrid
        fadeDistance={800}
        sectionColor="#444"
        cellColor="#222"
      />
      <RoadMesh roadData={roadData} />

      <AgentInstancedMesh type={0} agents={agents} />
      <AgentInstancedMesh type={1} agents={agents} />
      <AgentInstancedMesh type={2} agents={agents} />
      <AgentInstancedMesh type={3} agents={agents} />
      <AgentInstancedMesh type={4} agents={agents} />

      <OrbitControls makeDefault target={[500, 0, 500]} />
    </Canvas>
  );
}
