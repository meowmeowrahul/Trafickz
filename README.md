# Trafickz

Trafickz is an interactive digital twin for heterogeneous Indian traffic. It combines a real-time C++ traffic simulation engine with a React/Three.js dashboard, an OpenStreetMap-to-SUMO map preparation pipeline, and offline calibration utilities. The system is designed to make traffic behavior visible and tunable while retaining a headless mode for repeatable experiments and trajectory validation.

The repository contains two runtime paths:

1. **Live engine path** - the C++ engine loads a SUMO `.net.xml` road network, simulates agents at a configurable time step, and streams the road network and agent states over WebSocket.
2. **Custom-road browser path** - the dashboard can load a compatible JSON or GeoJSON file locally and run its lightweight JavaScript road-following simulator without replacing the C++ engine's map.

The dashboard is therefore useful both as a live client for the C++ engine and as a self-contained visualizer for uploaded road networks.

## What the project provides

- Heterogeneous agents: two-wheelers, auto-rickshaws, cars, buses, pedestrians, bicycles, trucks, and medium vehicles.
- A C++20 simulation loop with configurable IDM longitudinal behavior, social-force-style lateral behavior, tactical state transitions, spatial-hash neighbor queries, polygon/circle collision checks, road obstacles, and route selection.
- SUMO network XML parsing and conversion into an internal road graph.
- WebSocket streaming at 50 Hz by default:
  - one JSON `road_network` message on connection;
  - compact binary frames containing each agent's ID, type, position, heading, and speed.
- Runtime controls for agent count, IDM time headway, SFM acceleration, barricades, and potholes.
- A Three.js dashboard with Overview, Live Simulation, and Map pages, agent inspection, camera fitting, display layers, and custom road import.
- An offline OSM extraction pipeline using OSMnx and SUMO `netconvert`.
- Headless output for flow, gaps, deadlocks, congestion failures, and per-agent speed/acceleration trajectories.
- GoogleTest coverage for vector math, hull construction, spatial hashing, SAT collision checks, tactical transitions, route generation, and pothole response.

## Architecture

```text
OSM address/query
       |
       v
map_pipeline/extract_map.py ---> SUMO network.net.xml
       |                                |
       |                                v
       +------------------------> C++ traffic_sim
                                         |
                              uWebSockets on port 9001
                                         |
                                         v
                              React/Vite + Three.js dashboard

Uploaded road_network.json / GeoJSON ---> browser CustomRoadSimulator
```

### C++ simulation engine

The executable is `traffic_sim`. At startup it:

1. Loads `SimConfig` from JSON and applies command-line overrides.
2. Parses `net_xml_path` into a `NetMap`.
3. Builds a `RoadGraph` from network edges and junction connections.
4. Loads configured obstacles or generates random obstacles in interactive mode.
5. Serializes the road graph and obstacle inventory as the initial WebSocket message.
6. Creates agents on the graph, or schedules agents from a calibration schedule.
7. Repeats the simulation tick at `dt`, broadcasting state frames in interactive mode.

Each tick applies pending controls, updates the spatial hash, finds capped nearest neighbors, advances physics, resolves collisions, removes completed agents, and swaps the read/write state buffers. Interactive ticks target the configured `dt` and warn when the step exceeds `max_step_ms`.

### Dashboard

The Vite application in [`dashboard/`](./dashboard) uses React 19 and Three.js. `useWebSocket` owns the connection and decodes the binary stream. `App.jsx` selects the active data source:

- backend road data and backend agent frames when no custom network is loaded;
- a browser-local `CustomRoadSimulator` when a custom network is active.

The dashboard computes display metrics once per second, while the Three.js canvas interpolates between incoming agent frames for smoother rendering. Custom networks are not uploaded to the C++ server; they remain in browser state until the page is refreshed.

## Prerequisites

### Engine

- CMake 3.20 or newer.
- A C++20 compiler with OpenMP support.
- Git, because CMake FetchContent obtains pugixml, GoogleTest, nlohmann/json, uSockets, and uWebSockets.
- A network connection during the first CMake configure if those dependencies are not already cached.

### Dashboard

- Node.js and npm.
- A browser with WebGL support for the Three.js views.

### Map pipeline and calibration

- Python 3.
- Python packages listed in [`indian-traffic-sim/map_pipeline/requirements.txt`](./indian-traffic-sim/map_pipeline/requirements.txt). The calibration scripts additionally use pandas, NumPy, SciPy, fastdtw, and related scientific packages.
- SUMO's `netconvert` executable on `PATH` for OSM conversion.
- The calibration scripts expect external trajectory CSV files at the paths defined in each script; update those paths for a different machine.

## Quick start

### 1. Build and test the engine

From `indian-traffic-sim/`, the supplied shell script configures CMake, builds, and runs CTest:

```bash
./build.sh
```

On Windows, run the equivalent commands from a Developer PowerShell or use CMake directly:

```powershell
cmake -S engine -B engine/build
cmake --build engine/build --config Release
ctest --test-dir engine/build -C Release --output-on-failure
```

The first configure may download the CMake FetchContent dependencies.

### 2. Start the engine

The engine's default configuration is `indian-traffic-sim/config/config.default.json`. The default WebSocket port is `9001`.

```powershell
.\engine\build\Release\traffic_sim.exe .\config\config.default.json
```

The exact binary location depends on the generator. If using a single-configuration generator, it may be `engine/build/traffic_sim`.

The engine resolves paths as supplied. Prefer absolute `net_xml_path` and `obstacles_json_path` values when launching from a different working directory. The map extraction script writes an absolute network path into the default configuration.

### 3. Start the dashboard

```powershell
cd dashboard
npm install
npm run dev
```

Open the Vite URL shown in the terminal. The dashboard attempts to connect to `ws://localhost:9001`. Start the engine first to see its network and live agents.

Useful dashboard commands:

```powershell
npm run lint
npm run build
npm run preview
```

### 4. Use a custom road network

Open **Map > Import & Upload**, choose a compatible JSON/GeoJSON file, inspect its preview, and apply it. The custom simulator starts in the browser with 180 agents. Its controls affect only the browser simulation; they do not mutate the C++ engine.

The included [`sample_road_network.json`](./dashboard/public/sample_road_network.json) is a working example.

## Engine command-line options

The executable accepts a positional configuration path and these options:

| Option | Meaning |
|---|---|
| `--headless` | Disable WebSocket output and run for metrics/output instead. |
| `--duration <seconds>` | Stop headless execution after this simulated duration. |
| `--num_agents <count>` | Override the initial/free-running agent count. |
| `--idm_T <seconds>` | Override IDM time headway. |
| `--idm_s0 <meters>` | Override minimum IDM gap. |
| `--sfm_A <value>` | Override social-force acceleration. |
| `--sfm_B <value>` | Override social-force interaction range parameter. |
| `--comf_decel <value>` | Override comfortable deceleration. |
| `--car_width <meters>` | Override the car profile width. |
| `--car_length <meters>` | Override the car profile length. |
| `--schedule <path>` | Load a timed spawn schedule for trajectory experiments. |
| `--net_xml <path>` | Override the network XML path; an empty value is useful for schedule-based test corridors. |

Example headless run:

```powershell
.\engine\build\Release\traffic_sim.exe .\config\config.default.json --headless --duration 60 --num_agents 200
```

## Road and obstacle data

The C++ engine consumes SUMO network XML. The dashboard consumes the normalized JSON shape below:

```json
{
  "type": "road_network",
  "name": "Example corridor",
  "edges": [
    {
      "id": "edge_1",
      "width": 12,
      "centerline": [[0, 0], [100, 0]]
    }
  ],
  "junctions": [],
  "barricades": [],
  "potholes": [
    { "id": "p1", "center": [40, 1], "radius": 2, "severity": 0.5 }
  ]
}
```

`centerline` coordinates are `[x, y]` world-plane coordinates in meters. `width` is the road width used for rendering and browser agent offsets. GeoJSON `FeatureCollection` uploads are converted in the browser to edges using each feature's coordinates and optional `properties.width`.

## Configuration and simulation model

Important defaults include `dt = 0.02` seconds, `target_fps = 50`, `num_agents = 200`, `K_neighbors = 16`, `grid_cell_size = 10`, and `max_step_ms = 12`. IDM parameters control longitudinal following. SFM parameters control lateral/social response. FSM parameters govern yielding, squeezing, and turning transitions. `vehicle_distribution` stores eight type weights in the enum order documented in [`API.md`](./API.md).

The configuration loader is permissive: missing files or malformed JSON produce a diagnostic and fall back to compiled defaults. The JSON schema is useful documentation, but it does not currently enumerate every field loaded by `SimConfig`; consult [`DOCUMENTATION.md`](./DOCUMENTATION.md) for the complete runtime field list.

## Headless experiments and calibration

Headless mode prints a final JSON object to stdout:

- free simulation: `flow`, `avg_gap`, `gaps_timeseries`, `deadlocked_percent`, and `deadlocked_count`;
- scheduled simulation: `congestion_failures` and `trajectories`, with per-agent `speed`, `tan_acc`, and `lat_acc` arrays sampled at 1 Hz.

The calibration workflow is:

1. `scripts/calibrate/parse_ground_truth.py` converts a trajectory CSV into `inflow_schedule.json`, `target_trajectories.json`, and vehicle metrics.
2. `scripts/calibrate/ga_optimizer.py` runs differential evolution over IDM/SFM parameters and writes `optimized_params.json`.
3. `scripts/calibrate/validate_del4.py` runs a validation schedule and writes `validation_results.txt`.

The checked-in validation result records 65 comparisons, one congestion failure, average DTW of 11.9657, tangential acceleration MSE of 4.0153, lateral acceleration MSE of 0.1764, and weighted loss of 12.2153. These are historical project results, not a guarantee for every map or machine.

## Repository layout

| Path | Responsibility |
|---|---|
| [`dashboard/`](./dashboard) | React/Vite/Three.js user interface and browser custom-road simulator. |
| [`indian-traffic-sim/engine/`](./indian-traffic-sim/engine) | C++20 engine, WebSocket server, parser, graph, physics, collision, obstacles, and tests. |
| [`indian-traffic-sim/config/`](./indian-traffic-sim/config) | Default runtime configuration and partial JSON schema. |
| [`indian-traffic-sim/map_pipeline/`](./indian-traffic-sim/map_pipeline) | OSM extraction and map preparation utilities. |
| [`indian-traffic-sim/scripts/`](./indian-traffic-sim/scripts) | Distribution analysis and trajectory calibration/validation. |
| [`docs/DECISIONS.md`](./docs/DECISIONS.md) | Recorded architectural and parameter decisions. |
| [`DOCUMENTATION.md`](./DOCUMENTATION.md) | Detailed system and implementation documentation. |
| [`API.md`](./API.md) | WebSocket protocol, file contracts, CLI, and headless output reference. |

## Current limitations

- There is no HTTP REST API, authentication layer, persistence service, or multi-user session service.
- WebSocket messages use native little-endian binary layout and do not include a protocol version or timestamp.
- The C++ server broadcasts road geometry once per connection and then broadcasts agent frames; it does not send JSON telemetry for the dashboard metrics.
- Custom uploads are browser-local and use a simplified path-following simulator rather than the full C++ physics stack.
- Raw OSM/XML uploads are intentionally rejected by the dashboard; convert them offline first.
- Some scripts contain machine-specific absolute dataset paths and should be parameterized before reuse.
- The `router` and several source directories contain stubs for future phases; route selection currently lives in `RoadGraph`.

## License and project status

No license file is currently present in the repository. Add an appropriate license before distributing the project. The engine identifies itself as version 1.5 / Phase 1 while the dashboard footer identifies version 0.1.0; treat both as implementation labels rather than a formal release contract.
