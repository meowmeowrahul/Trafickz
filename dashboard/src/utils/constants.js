// Agent type definitions from C++ AgentType enum
export const AGENT_TYPE_LABELS = {
  0: 'Two-wheelers',
  1: 'Auto-rickshaws',
  2: 'Cars',
  3: 'Buses',
  4: 'Pedestrians',
  5: 'Bicycles',
  6: 'Trucks',
  7: 'Medium vehicles',
};

// PRD color system
export const AGENT_TYPE_COLORS = {
  0: '#22C55E', // Two-wheeler (green)
  1: '#F59E0B', // Auto-rickshaw (amber)
  2: '#38BDF8', // Car (cyan)
  3: '#EF4444', // Bus (red)
  4: '#A78BFA', // Pedestrian (purple)
  5: '#14B8A6', // Bicycle (teal)
  6: '#F97316', // Truck (orange)
  7: '#94A3B8', // Medium vehicle (slate)
};

// Dimensions in meters: [width, height, length]
export const AGENT_DIMENSIONS = {
  0: [0.7,  1.35, 1.8],   // Two-wheeler (0.7m x 1.8m)
  1: [1.3,  1.70, 2.6],   // Auto-rickshaw (1.3m x 2.6m)
  2: [1.8,  1.45, 4.2],   // Car (1.8m x 4.2m)
  3: [2.5,  3.20, 10.5],  // Bus (2.5m x 10.5m)
  4: [0.5,  1.75, 0.5],   // Pedestrian (0.5m x 0.5m x 1.75m)
  5: [0.65, 1.20, 1.65],  // Bicycle
  6: [2.5,  3.20, 8.8],   // Truck
  7: [1.8,  1.65, 3.6],   // Medium vehicle
};

export const TACTICAL_STATE_LABELS = {
  0: 'FREE_FLOW',
  1: 'EVALUATE_GAP',
  2: 'SQUEEZE_LEFT',
  3: 'SQUEEZE_RIGHT',
  4: 'YIELD',
  5: 'TURNING',
};

export const TACTICAL_STATE_COLORS = {
  0: '#22C55E',
  1: '#F59E0B',
  2: '#38BDF8',
  3: '#38BDF8',
  4: '#EF4444',
  5: '#A78BFA',
};

export const WS_URL = 'ws://localhost:9001';

// Real calibration data loaded from project validation run
export const REAL_CALIBRATION_RESULTS = {
  dataset: 'DEL_4.csv',
  comparisons: 65,
  congestionFailures: 1,
  averageDtw: 11.9657,
  tanAccMse: 4.0153,
  latAccMse: 0.1764,
  weightedLoss: 12.2153,
  weights: { w1: 1.0, w2: 0.055, w3: 0.163 },
  status: 'Validated',
};
