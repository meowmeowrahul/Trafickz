import * as THREE from 'three';

function addBox(pos, cols, x0, y0, z0, x1, y1, z1, [r, g, b]) {
  const faces = [
    // front (+z)
    [x0,y0,z1, x1,y0,z1, x1,y1,z1,  x0,y0,z1, x1,y1,z1, x0,y1,z1],
    // back (-z)
    [x1,y0,z0, x0,y0,z0, x0,y1,z0,  x1,y0,z0, x0,y1,z0, x1,y1,z0],
    // top (+y)
    [x0,y1,z1, x1,y1,z1, x1,y1,z0,  x0,y1,z1, x1,y1,z0, x0,y1,z0],
    // bottom (-y)
    [x0,y0,z0, x1,y0,z0, x1,y0,z1,  x0,y0,z0, x1,y0,z1, x0,y0,z1],
    // right (+x)
    [x1,y0,z1, x1,y0,z0, x1,y1,z0,  x1,y0,z1, x1,y1,z0, x1,y1,z1],
    // left (-x)
    [x0,y0,z0, x0,y0,z1, x0,y1,z1,  x0,y0,z0, x0,y1,z1, x0,y1,z0],
  ];
  for (const f of faces) {
    for (let i = 0; i < f.length; i += 3) {
      pos.push(f[i], f[i+1], f[i+2]);
      cols.push(r, g, b);
    }
  }
}

function finishGeometry(pos, cols) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cols), 3));
  geo.computeVertexNormals();
  return geo;
}

const C_BODY = [1.0, 1.0, 1.0];        // Multiplied by instanced color
const C_GLASS = [0.12, 0.16, 0.24];    // Sleek dark tinted glass
const C_HEADLIGHT = [1.0, 0.95, 0.5];  // Warm white/yellow beam
const C_TAILLIGHT = [0.95, 0.12, 0.12];// Ruby red light
const C_WHEEL = [0.08, 0.08, 0.10];    // Dark rubber
const C_ROOF_WHITE = [0.92, 0.92, 0.94];
const C_AUTO_YELLOW = [0.96, 0.78, 0.12];
const C_AUTO_GREEN = [0.12, 0.55, 0.28];

export function buildCarGeometry() {
  const p = [], c = [];
  // Main chassis & lower body
  addBox(p, c, -0.48, 0.12, -0.48, 0.48, 0.48, 0.48, C_BODY);
  // Hood slope detail
  addBox(p, c, -0.46, 0.38, 0.15, 0.46, 0.48, 0.49, C_BODY);
  // Cabin glass (windshield, side, rear)
  addBox(p, c, -0.42, 0.48, -0.32, 0.42, 0.88, 0.18, C_GLASS);
  // Roof
  addBox(p, c, -0.41, 0.88, -0.30, 0.41, 0.94, 0.15, C_BODY);
  // Headlights (front +Z)
  addBox(p, c, -0.44, 0.25, 0.48, -0.26, 0.42, 0.505, C_HEADLIGHT);
  addBox(p, c,  0.26, 0.25, 0.48,  0.44, 0.42, 0.505, C_HEADLIGHT);
  // Taillights (rear -Z)
  addBox(p, c, -0.44, 0.28, -0.505, -0.26, 0.44, -0.48, C_TAILLIGHT);
  addBox(p, c,  0.26, 0.28, -0.505,  0.44, 0.44, -0.48, C_TAILLIGHT);
  // Wheels (4 corners)
  addBox(p, c, -0.51, 0.0, 0.20, -0.44, 0.24, 0.42, C_WHEEL);
  addBox(p, c,  0.44, 0.0, 0.20,  0.51, 0.24, 0.42, C_WHEEL);
  addBox(p, c, -0.51, 0.0, -0.42, -0.44, 0.24, -0.20, C_WHEEL);
  addBox(p, c,  0.44, 0.0, -0.42,  0.51, 0.24, -0.20, C_WHEEL);
  return finishGeometry(p, c);
}

export function buildBusGeometry() {
  const p = [], c = [];
  // Main bus body
  addBox(p, c, -0.48, 0.14, -0.48, 0.48, 0.52, 0.48, C_BODY);
  // Continuous side windows & panoramic windshield
  addBox(p, c, -0.46, 0.52, -0.46, 0.46, 0.86, 0.49, C_GLASS);
  // Roof cap
  addBox(p, c, -0.48, 0.86, -0.48, 0.48, 0.96, 0.48, C_ROOF_WHITE);
  // Dual headlights (front +Z)
  addBox(p, c, -0.44, 0.20, 0.48, -0.24, 0.36, 0.505, C_HEADLIGHT);
  addBox(p, c,  0.24, 0.20, 0.48,  0.44, 0.36, 0.505, C_HEADLIGHT);
  // Taillights (rear -Z)
  addBox(p, c, -0.44, 0.24, -0.505, -0.24, 0.46, -0.48, C_TAILLIGHT);
  addBox(p, c,  0.24, 0.24, -0.505,  0.44, 0.46, -0.48, C_TAILLIGHT);
  // Wheels (front & dual rear)
  addBox(p, c, -0.51, 0.0, 0.28, -0.43, 0.26, 0.44, C_WHEEL);
  addBox(p, c,  0.43, 0.0, 0.28,  0.51, 0.26, 0.44, C_WHEEL);
  addBox(p, c, -0.51, 0.0, -0.42, -0.43, 0.26, -0.20, C_WHEEL);
  addBox(p, c,  0.43, 0.0, -0.42,  0.51, 0.26, -0.20, C_WHEEL);
  return finishGeometry(p, c);
}

export function buildAutoRickshawGeometry() {
  const p = [], c = [];
  // Lower green body
  addBox(p, c, -0.44, 0.12, -0.44, 0.44, 0.46, 0.18, C_AUTO_GREEN);
  // Tapered front nose
  addBox(p, c, -0.26, 0.12, 0.18, 0.26, 0.42, 0.48, C_AUTO_GREEN);
  // Front windshield
  addBox(p, c, -0.24, 0.42, 0.22, 0.24, 0.82, 0.38, C_GLASS);
  // Yellow canopy / roof
  addBox(p, c, -0.45, 0.82, -0.45, 0.45, 0.94, 0.32, C_AUTO_YELLOW);
  // Cabin pillars / open side interior
  addBox(p, c, -0.42, 0.46, -0.42, 0.42, 0.82, 0.12, [0.18, 0.20, 0.24]);
  // Single central front headlight
  addBox(p, c, -0.12, 0.26, 0.47, 0.12, 0.38, 0.505, C_HEADLIGHT);
  // Rear taillights
  addBox(p, c, -0.40, 0.22, -0.465, -0.22, 0.36, -0.44, C_TAILLIGHT);
  addBox(p, c,  0.22, 0.22, -0.465,  0.40, 0.36, -0.44, C_TAILLIGHT);
  // 3 Wheels (1 front, 2 rear)
  addBox(p, c, -0.08, 0.0, 0.28, 0.08, 0.22, 0.44, C_WHEEL);
  addBox(p, c, -0.48, 0.0, -0.38, -0.40, 0.22, -0.20, C_WHEEL);
  addBox(p, c,  0.40, 0.0, -0.38,  0.48, 0.22, -0.20, C_WHEEL);
  return finishGeometry(p, c);
}

export function buildTwoWheelerGeometry() {
  const p = [], c = [];
  // Bike frame
  addBox(p, c, -0.12, 0.12, -0.44, 0.12, 0.52, 0.44, C_BODY);
  // Rider body & jacket
  addBox(p, c, -0.22, 0.52, -0.18, 0.22, 0.98, 0.12, [0.22, 0.28, 0.36]);
  // Rider helmet
  addBox(p, c, -0.16, 0.98, -0.14, 0.16, 1.25, 0.10, [0.92, 0.25, 0.25]);
  // Front headlight
  addBox(p, c, -0.10, 0.42, 0.44, 0.10, 0.56, 0.48, C_HEADLIGHT);
  // Taillight
  addBox(p, c, -0.08, 0.44, -0.48, 0.08, 0.54, -0.44, C_TAILLIGHT);
  // Two wheels (front and rear)
  addBox(p, c, -0.06, 0.0, 0.24, 0.06, 0.28, 0.46, C_WHEEL);
  addBox(p, c, -0.06, 0.0, -0.46, 0.06, 0.28, -0.24, C_WHEEL);
  return finishGeometry(p, c);
}

export function buildTruckGeometry() {
  const p = [], c = [];
  // Driver cab
  addBox(p, c, -0.46, 0.14, 0.12, 0.46, 0.88, 0.48, C_BODY);
  // Cab windshield
  addBox(p, c, -0.44, 0.52, 0.32, 0.44, 0.84, 0.49, C_GLASS);
  // Large cargo container / bed
  addBox(p, c, -0.48, 0.22, -0.48, 0.48, 0.92, 0.08, [0.82, 0.55, 0.22]);
  // Headlights
  addBox(p, c, -0.42, 0.22, 0.48, -0.24, 0.38, 0.505, C_HEADLIGHT);
  addBox(p, c,  0.24, 0.22, 0.48,  0.42, 0.38, 0.505, C_HEADLIGHT);
  // Taillights
  addBox(p, c, -0.44, 0.24, -0.505, -0.24, 0.42, -0.48, C_TAILLIGHT);
  addBox(p, c,  0.24, 0.24, -0.505,  0.44, 0.42, -0.48, C_TAILLIGHT);
  // Wheels
  addBox(p, c, -0.51, 0.0, 0.24, -0.43, 0.28, 0.42, C_WHEEL);
  addBox(p, c,  0.43, 0.0, 0.24,  0.51, 0.28, 0.42, C_WHEEL);
  addBox(p, c, -0.51, 0.0, -0.44, -0.43, 0.28, -0.16, C_WHEEL);
  addBox(p, c,  0.43, 0.0, -0.44,  0.51, 0.28, -0.16, C_WHEEL);
  return finishGeometry(p, c);
}

export function buildPedestrianGeometry() {
  const p = [], c = [];
  // Legs
  addBox(p, c, -0.20, 0.0, -0.12, -0.04, 0.48, 0.12, [0.15, 0.22, 0.35]);
  addBox(p, c,  0.04, 0.0, -0.12,  0.20, 0.48, 0.12, [0.15, 0.22, 0.35]);
  // Torso
  addBox(p, c, -0.22, 0.48, -0.14, 0.22, 0.82, 0.14, [0.65, 0.45, 0.85]);
  // Head
  addBox(p, c, -0.12, 0.82, -0.12, 0.12, 1.0, 0.12, [0.95, 0.82, 0.72]);
  return finishGeometry(p, c);
}

export const GEO_BUILDERS = {
  0: buildTwoWheelerGeometry,
  1: buildAutoRickshawGeometry,
  2: buildCarGeometry,
  3: buildBusGeometry,
  4: buildPedestrianGeometry,
  5: buildTwoWheelerGeometry,
  6: buildTruckGeometry,
  7: buildCarGeometry,
};
