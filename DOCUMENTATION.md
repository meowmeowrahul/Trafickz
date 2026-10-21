# Trafickz System Documentation

## 1. Purpose and scope

Trafickz models a road corridor as a digital twin populated by heterogeneous traffic. Its primary goal is to expose how different Indian traffic participants move, interact, yield, squeeze laterally, encounter hazards, and affect corridor-level measures such as flow and gaps. The project supports interactive visualization for exploration and deterministic-ish headless runs for calibration and validation.

This document describes the current implementation in the repository. It separates production-like runtime behavior from experimental utilities and browser-only behavior so that the system is not mistaken for a deployed traffic-control platform.

## 2. System boundaries

### Included

- A C++20 microscopic simulation engine.
- SUMO network XML ingestion.
- Road graph construction and route generation.
- Agent profiles and heterogeneous vehicle dimensions.
- IDM/SFM-inspired motion, tactical FSM behavior, spatial hashing, and collision handling.
- Obstacle loading/generation.
- A uWebSockets server on port 9001 by default.
- A React/Vite/Three.js dashboard.
- OSM extraction and offline calibration scripts.

### Not included

- A REST or GraphQL API.
- A database, authentication, authorization, or hosted service.
- Persistent dashboard state.
- Server-side processing of browser uploads.
- A complete implementation of every directory marked with `Stub.h`.

## 3. Runtime components

### 3.1 Engine entry point

[`main.cpp`](./indian-traffic-sim/engine/src/main.cpp) installs SIGINT/SIGTERM handlers, parses the command line, loads the selected JSON configuration, applies positive command-line overrides, constructs `Engine`, and calls `run()`.

The positional argument is treated as a configuration path unless it begins with `-`; if omitted, the default is `../config/config.default.json` relative to the process working directory. This makes the launch directory important.

### 3.2 Configuration

[`SimConfig`](./indian-traffic-sim/engine/src/core/SimConfig.h) has compiled defaults and [`load_config`](./indian-traffic-sim/engine/src/core/SimConfig.cpp) selectively replaces them with values present in JSON. Parse/open failures are reported to stderr and leave defaults in place.

| Group | Fields | Role |
|---|---|---|
| Time and world | `dt`, `target_fps`, `world_width`, `world_height`, `duration` | Tick cadence, nominal display rate, world dimensions, and optional headless stop time. |
| Population | `num_agents`, `vehicle_distribution`, `min_route_segments` | Initial/free-running population and type mix. |
| Neighbor search | `K_neighbors`, `grid_cell_size` | Spatial-hash cell size and nearest-neighbor cap. |
| Performance | `max_step_ms` | Interactive tick warning threshold. |
| IDM | `idm_s0`, `idm_T`, `idm_a`, `idm_b`, `idm_delta` | Desired gap, time headway, acceleration, braking, and exponent. |
| SFM | `sfm_A`, `sfm_B`, `sfm_goal_weight`, `sfm_asymmetric_weight`, `sfm_tau` | Social/lateral response terms. |
| Tactics | `fsm_squeeze_speed_factor`, `fsm_yield_distance`, `fsm_turn_max_speed` | Squeeze slowdown, yield distance, and turn speed. |
| Network and obstacles | `net_xml_path`, `obstacles_json_path`, `enable_barricades`, `enable_potholes` | Input files and hazard switches. |
| Runtime | `ws_port`, `headless` | WebSocket listener port and interactive/headless mode. |
| Routing | `route_logit_theta`, `route_density_lambda` | Route choice randomness and optional density penalty. |
| Calibration overrides | `schedule_json_path`, `comf_decel`, `car_width`, `car_length` | Scheduled spawning and profile overrides. |
| Browser/behavior tuning | `lateral_spread_sigma` | Lateral placement/noise magnitude used by the engine. |

The checked-in `config.schema.json` covers only a subset of these fields and requires road-width properties that are not present in the default JSON or loaded by `SimConfig`. It should be treated as an incomplete validation contract until reconciled with the C++ configuration.

### 3.3 Network ingestion and graph

`NetXmlParser` reads SUMO network XML into:

- `NetEdge`: edge ID, junction endpoints, lane count, speed limit, width, lane shapes, and internal-edge flag.
- `NetJunction`: position, type, incoming/outgoing edge IDs, and polygon shape.
- `NetConnection`: legal edge/lane transitions.

`RoadGraph::build_from_net_map` converts this map into `RoadSegment` objects with centerlines, lengths, widths, speed limits, endpoint IDs, and outgoing segment indices. The graph supplies nearest-segment lookup, random routes, and shortest paths with optional route-choice randomness and density penalties. The dedicated `router` directory is currently a future-phase stub; active route logic is in `RoadGraph`.

### 3.4 Agents

The eight `AgentType` values are stable numeric protocol values:

| Value | Type |
|---:|---|
| 0 | Two-wheeler |
| 1 | Auto-rickshaw |
| 2 | Car |
| 3 | Bus |
| 4 | Pedestrian |
| 5 | Bicycle |
| 6 | Truck |
| 7 | Medium vehicle |

Each agent stores position, heading, speed, steering, current segment/waypoint, route, lateral offset, tactical state, a collision hull, randomized capabilities, and current longitudinal/lateral acceleration. Pedestrians use circle-style collision behavior; vehicles use polygon hulls.

For free simulation, agents are initialized on road segments according to the configured count and vehicle distribution. When the count is increased at runtime, new agents are appended; when reduced, state vectors are resized. For a schedule run, each event supplies a stable track ID, spawn time, type, speed, entry point, and exit point.

### 3.5 Tick lifecycle

The engine executes the following sequence:

1. Apply pending count changes and maintain the configured free-simulation population.
2. Spawn due scheduled agents and calculate a route from entry to exit.
3. Apply pending IDM/SFM and obstacle-toggle controls.
4. Clear and repopulate the spatial hash.
5. Query capped nearest neighbors for every agent.
6. Run `update_physics`, which combines route following, IDM-like longitudinal motion, social/lateral behavior, tactical state updates, and obstacle effects.
7. Resolve vehicle-vehicle SAT collisions and vehicle-pedestrian collisions.
8. Apply barricade responses when enabled and remove despawned agents from both buffers.
9. In scheduled headless runs, sample trajectory accumulators at 1 Hz.
10. Swap read/write buffers and advance `sim_time_` by `dt`.

The spatial hash bounds broad-phase work. SAT is the narrow-phase polygon collision test, and circle-polygon checks are used for pedestrians. Collisions separate overlapping bodies and reduce speed rather than terminating agents.

### 3.6 Tactical behavior

The tactical state machine contains:

`FREE_FLOW -> EVALUATE_GAP -> SQUEEZE_LEFT/SQUEEZE_RIGHT/YIELD`, with `TURNING` available for turning behavior.

The FSM examines nearby agents and road-relative positions. It can select a lateral squeeze when a slower leader blocks progress and a side gap is available, or yield when a gap is not safe. Speed and distance thresholds are configurable. The dashboard maps these numeric states to human-readable labels and colors when state data is available locally; the current wire protocol does not transmit tactical state.

### 3.7 Obstacles

Obstacle JSON contains barricade convex hulls and potholes with centers, radii, and severity. If no obstacle file is supplied and the engine is interactive, a small random set is generated. Barricades are handled through polygon collision. Potholes reduce motion response in physics. The dashboard renders potholes and barricades included in its road data; its visualizer may synthesize pothole markers when the dataset has none.

## 4. Dashboard behavior

### Navigation

The dashboard has three pages:

- **Overview**: active agents, average speed, renderer FPS, road segment count, vehicle distribution, and environment inventory.
- **Live Simulation**: Three.js corridor viewport, agent selection, telemetry inspector, engine/browser controls, and display-layer toggles.
- **Map**: network topology preview, inventory, upload workflow, and custom network activation.

### Data ownership

`App.jsx` chooses `customRoadData || backendRoadData` for the active network. A custom upload changes the active network immediately and starts `CustomRoadSimulator`; it does not send a file to the C++ server. Resetting the custom network returns to the backend network if the WebSocket is connected.

### Rendering and metrics

`SimulationCanvas` builds road ribbons, boundaries, center lines, junction shapes, obstacles, and vehicle geometry. It reads agents through a ref so rendering does not require a React render for every incoming frame. `useWebSocket` stores the previous frame by agent ID and exposes it for interpolation.

`App.jsx` samples the active agent list once per second to compute total count, counts by type, average speed, density labels, and displayed FPS. These are presentation metrics; they are not server-side measurements and are not sent back to the engine.

### CustomRoadSimulator

The browser simulator:

1. Converts each edge centerline into linear segments with tangents and normals.
2. Samples initial agents across total network length.
3. Assigns browser type weights and base speeds.
4. Applies lateral offsets, with narrower offsets for buses and trucks.
5. Advances each agent along its selected edge at `speed * speedMultiplier`.
6. Wraps agents to the beginning of an edge and occasionally selects another edge.

It does not implement the C++ engine's IDM, SFM, tactical FSM, collision solver, or route graph. Its purpose is immediate visualization of uploaded geometry.

## 5. Map pipeline

[`extract_map.py`](./indian-traffic-sim/map_pipeline/extract_map.py) accepts a geocoded address/query and an optional radius, requests a drivable OSM graph through OSMnx, writes an intermediate `temp.osm`, invokes SUMO `netconvert`, and writes `map_output/network.net.xml`. It then updates `config.default.json` with the absolute output path.

The pipeline also includes utilities for offset pathing, road-width enrichment, route plotting, and a local `netconvert` wrapper. These utilities are independent scripts rather than a single orchestrated command. Raw XML/OSM files are not accepted by the dashboard upload dialog because the browser expects normalized JSON; convert them offline first.

## 6. Calibration and validation

The calibration scripts consume trajectory CSV data and convert categorical vehicle labels into the engine's eight numeric types. They aggregate speed, tangential acceleration, and lateral acceleration at one-second resolution.

`parse_ground_truth.py` creates:

- `inflow_schedule.json`: timed spawn events with entry/exit coordinates;
- `target_trajectories.json`: per-track target profiles;
- `target_metrics.json`: mean car width and length.

`ga_optimizer.py` evaluates candidate `[idm_T, idm_s0, comf_decel, sfm_A, sfm_B]` vectors by launching headless simulations, comparing speed with dynamic time warping, comparing accelerations with MSE, and minimizing a weighted loss. `validate_del4.py` repeats the process on a validation dataset and writes a text report.

Calibration scripts use absolute Linux paths from the original development environment. Before running them elsewhere, update `CSV_PATH`, `ENGINE_BIN`, network paths, and working-directory assumptions.

## 7. Build, test, and operational checks

The CMake project builds an `engine_core` library, the `traffic_sim` executable, and `unit_tests`. GoogleTest discovery is enabled through CTest. The supplied tests verify core mathematical and behavioral primitives, not end-to-end WebSocket compatibility or visual rendering.

Recommended checks after a change:

```powershell
cmake --build .\indian-traffic-sim\engine\build --config Release
ctest --test-dir .\indian-traffic-sim\engine\build -C Release --output-on-failure
cd dashboard
npm run lint
npm run build
```

For protocol changes, also run an engine and confirm that a browser or WebSocket client receives the road JSON followed by valid 21-byte frames.

## 8. Design decisions and known gaps

The recorded decisions in [`docs/DECISIONS.md`](./docs/DECISIONS.md) establish `K = 16`, a 12 ms step budget, selected road-width mappings, GoogleTest, manual 2D math, and CMake FetchContent. The implementation has several intentional or unfinished surfaces:

- The protocol has no version negotiation or timestamps.
- The dashboard cannot request a road reload through WebSocket.
- `speed_multiplier` and `reset` are meaningful for custom browser simulation but are ignored by the C++ control parser.
- Several module directories contain stubs and are not evidence of active functionality.
- No repository license is present.

These gaps should be addressed before treating the project as a production service or a stable external SDK.
