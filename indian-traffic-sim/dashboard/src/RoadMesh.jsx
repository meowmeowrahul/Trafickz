import React, { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export default function RoadMesh({ roadData }) {
  const edgeMesh = useMemo(() => {
    if (!roadData || !roadData.edges) return null;
    const geometries = [];
    roadData.edges.forEach(edge => {
      if (edge.centerline.length < 2) return;
      const pts = edge.centerline.map(p => new THREE.Vector3(p[0], 0.1, p[1]));
      const path = new THREE.CatmullRomCurve3(pts, false, 'chordal');
      const geom = new THREE.TubeGeometry(path, Math.max(2, pts.length), edge.width / 2.0, 8, false);
      geom.scale(1, 0.05, 1); // squash into a flat ribbon
      geometries.push(geom);
    });
    if (geometries.length === 0) return null;
    return mergeGeometries(geometries);
  }, [roadData]);

  const juncMesh = useMemo(() => {
    if (!roadData || !roadData.junctions) return null;
    const geometries = [];
    roadData.junctions.forEach(junc => {
      if (!junc.shape || junc.shape.length < 3) return;
      const shape = new THREE.Shape();
      shape.moveTo(junc.shape[0][0], junc.shape[0][1]);
      for (let i=1; i<junc.shape.length; i++) {
        shape.lineTo(junc.shape[i][0], junc.shape[i][1]);
      }
      const geom = new THREE.ShapeGeometry(shape);
      geom.rotateX(Math.PI / 2); // XY to XZ
      geom.translate(0, 0.05, 0); // slight z-fighting prevention
      geometries.push(geom);
    });
    if (geometries.length === 0) return null;
    return mergeGeometries(geometries);
  }, [roadData]);

  return (
    <group>
      {edgeMesh && (
        <mesh geometry={edgeMesh}>
          <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
        </mesh>
      )}
      {juncMesh && (
        <mesh geometry={juncMesh}>
          <meshStandardMaterial color="#333333" roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}
