# Trafickz API and Protocol Reference

## 1. API status

Trafickz currently exposes **one network API: a WebSocket protocol** implemented by the C++ engine with uWebSockets. It does not expose HTTP REST endpoints, GraphQL, authentication, or a persistence API.

The default connection endpoint is:

```text
ws://localhost:9001/
```

The server registers the WebSocket route as `/*`, so the client currently connects to the root URL. The port is configurable with `ws_port` in the engine configuration. The dashboard hard-codes `ws://localhost:9001` in [`constants.js`](./dashboard/src/utils/constants.js); changing the engine port requires changing the dashboard URL as well.

## 2. Connection lifecycle

1. The dashboard opens a WebSocket and requests binary frames by setting `binaryType = "arraybuffer"`.
2. When the connection opens, the dashboard marks the backend as connected.
3. The engine sends the cached road-network JSON to the newly opened client.
4. On every interactive simulation tick, the engine broadcasts one binary frame to all connected clients.
5. The client decodes JSON text as a road message and all non-text frames as agent frames.
6. If the socket closes, the dashboard marks it disconnected and retries after two seconds.

The server accepts up to a 16 MiB payload and sends frames with uWebSockets' default native byte ordering. The current client and implementation both use little-endian numeric decoding.

## 3. Server-to-client messages

### 3.1 Road network message

**Transport:** WebSocket text frame  
**Frequency:** Once per connection  
**Envelope:**

```json
{
  "type": "road_network",
  "edges": [],
  "junctions": [],
  "barricades": [],
  "potholes": []
}
```

The C++ engine builds this message from its loaded SUMO network and obstacle set. A custom browser upload uses the same conceptual shape but is not sent through this API.

#### `edges`

Each edge is serialized as:

```json
{
  "id": "edge_id",
  "width": 12.0,
  "centerline": [[0.0, 0.0], [100.0, 0.0]]
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Road segment/edge identifier. |
| `width` | number | Segment width in meters. |
| `centerline` | array of `[number, number]` | World-plane points used by the dashboard to construct road geometry. |

#### `junctions`

```json
{
  "id": "junction_id",
  "position": [50.0, 0.0],
  "shape": [[45.0, -5.0], [55.0, -5.0], [55.0, 5.0], [45.0, 5.0]]
}
```

The current engine includes `id`, `position`, and polygon `shape`. Incoming/outgoing edge IDs are internal to the C++ network representation and are not exposed in this message.

#### `barricades`

```json
{
  "id": "barricade_1",
  "hull": [[1, 1], [3, 1], [3, 2], [1, 2]]
}
```

`hull` is a convex polygon in world coordinates.

#### `potholes`

```json
{
  "id": "pothole_1",
  "center": [40.0, 1.0],
  "radius": 2.0,
  "severity": 0.5
}
```

`severity` is intended to range from 0.0 to 1.0. The dashboard uses `center` and `radius` for rendering and preserves the inventory for overview counts.

### 3.2 Agent state frame

**Transport:** WebSocket binary frame  
**Frequency:** Every interactive simulation tick (50 Hz by default)  
**Frame size:** `21 * agent_count` bytes  
**Record order:** Current engine state vector order  
**Byte order:** Little-endian

Each 21-byte record is:

| Byte offset | Size | Encoding | Field |
|---:|---:|---|---|
| 0 | 4 | `uint32` | Agent ID. |
| 4 | 1 | `uint8` | Agent type, listed below. |
| 5 | 4 | IEEE-754 `float32` | X position in meters. |
| 9 | 4 | IEEE-754 `float32` | Y position in meters. |
| 13 | 4 | IEEE-754 `float32` | Heading in radians. |
| 17 | 4 | IEEE-754 `float32` | Speed in meters/second. |

There is no frame header, timestamp, count field, checksum, or protocol version. The count is inferred as `floor(byteLength / 21)`. A receiver must reject or log a non-multiple-of-21 frame rather than interpreting a partial record.

#### Agent type values

| Value | Label |
|---:|---|
| 0 | Two-wheelers |
| 1 | Auto-rickshaws |
| 2 | Cars |
| 3 | Buses |
| 4 | Pedestrians |
| 5 | Bicycles |
| 6 | Trucks |
| 7 | Medium vehicles |

The wire frame does not include tactical state, route, acceleration, dimensions, neighbors, or obstacle status. The dashboard inspector can display only fields present in the frame (and defaults tactical state to `FREE_FLOW` when absent).

## 4. Client-to-server messages

### 4.1 Control message

**Transport:** WebSocket text frame  
**Required envelope:**

```json
{
  "type": "control"
}
```

Optional accepted fields:

| Field | Type | Accepted condition | Effect |
|---|---|---|---|
| `num_agents` | integer | `> 0` | Adds or removes free-running agents to reach the requested count. |
| `idm_T` | number | `> 0` | Changes IDM time headway for subsequent ticks. |
| `sfm_A` | number | `> 0` | Changes social-force acceleration for subsequent ticks. |
| `barricades_enabled` | boolean | Present | Enables/disables barricade collision response. |
| `potholes_enabled` | boolean | Present | Enables/disables pothole effects in physics. |

Example:

```json
{
  "type": "control",
  "num_agents": 240,
  "idm_T": 1.6,
  "sfm_A": 4.5,
  "barricades_enabled": true,
  "potholes_enabled": false
}
```

The dashboard sends this envelope from `sendControl`. Unknown fields are parsed but ignored by the C++ server.

### 4.2 Fields that are browser-only

The dashboard's shared controls also create `speed_multiplier` and may send `reset`. These fields are handled only when a custom road is active:

- `speed_multiplier`: clamped to 0.1–3.0 by `CustomRoadSimulator`.
- `reset`: respawns browser-local agents.

When connected to the C++ backend, these fields are included in the JSON sent by the dashboard but are not read by `WebSocketServer.cpp` and have no engine effect. The C++ engine also does not support a reset command over the current protocol.

## 5. Error behavior

- Malformed control JSON is caught by the server, logged to stderr as a control parse error, and ignored.
- Valid JSON without `type: "control"` is ignored.
- A failed listener bind is logged and the engine continues its normal process flow; clients cannot connect until the port is available.
- The dashboard ignores malformed text messages and reconnects after socket closure.
- There is no structured error response, close-code contract, request ID, or acknowledgement message.

## 6. Browser upload API (local file contract)

This is not a network endpoint. `AddRoadModal` reads a user-selected file with `FileReader`, parses it locally, validates that it contains at least one edge, and passes the object to `App.jsx`.

### Native road JSON

Minimum shape:

```json
{
  "name": "My corridor",
  "edges": [
    {
      "id": "e1",
      "width": 12,
      "centerline": [[0, 0], [10, 0]]
    }
  ],
  "junctions": [],
  "barricades": [],
  "potholes": []
}
```

`edges` must be a non-empty array. Each usable edge needs a `centerline` with at least two points. `width` defaults to renderer/simulator fallbacks when omitted. `junctions`, `barricades`, and `potholes` are optional arrays.

### GeoJSON

A `FeatureCollection` is converted to edges:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "id": "segment-1",
      "properties": { "width": 12 },
      "geometry": {
        "type": "LineString",
        "coordinates": [[0, 0], [10, 0]]
      }
    }
  ]
}
```

The browser assigns an edge ID from `feature.id` or `feature_<index>`, uses `properties.width` or `12`, and copies `geometry.coordinates` into `centerline`. The importer does not implement arbitrary GeoJSON geometry normalization.

Raw OSM/XML is rejected with an instruction to use the offline map pipeline first.

## 7. Command-line API

The executable accepts a positional config path and the following options:

```text
traffic_sim [config-path]
  --headless
  --duration <seconds>
  --num_agents <count>
  --idm_T <seconds>
  --idm_s0 <meters>
  --sfm_A <value>
  --sfm_B <value>
  --comf_decel <value>
  --car_width <meters>
  --car_length <meters>
  --schedule <json-path>
  --net_xml <xml-path>
```

Positive numeric overrides are applied after JSON configuration. `--net_xml ""` explicitly clears the configured network path, which is used by the calibration scripts for their schedule-based test setup.

## 8. Headless output API

Headless mode does not use WebSocket. With `--duration`, the engine prints one final JSON object to stdout after simulated time reaches the requested duration.

### Free-running output

```json
{
  "flow": 12.34,
  "avg_gap": 8.7,
  "gaps_timeseries": [7.9, 8.1, 8.7],
  "deadlocked_percent": 1.5,
  "deadlocked_count": 3
}
```

- `flow`: estimated vehicles per minute from population density and average speed.
- `avg_gap`: accumulated average distance to a detected forward neighbor.
- `gaps_timeseries`: sampled gap aggregates.
- `deadlocked_percent` and `deadlocked_count`: agents below 0.1 m/s at completion.

### Scheduled trajectory output

When `--schedule` is used:

```json
{
  "congestion_failures": 1,
  "trajectories": {
    "42": {
      "speed": [8.1, 8.4],
      "tan_acc": [0.2, 0.1],
      "lat_acc": [0.0, -0.03]
    }
  }
}
```

Trajectory arrays are sampled at 1 Hz from the accumulated per-tick values. `congestion_failures` counts scheduled spawns that overlap an occupied location at spawn time; the engine still inserts the agent.

## 9. Offline pipeline interfaces

### Map extraction

```bash
python map_pipeline/extract_map.py "<address or query>" [radius_meters]
```

The script obtains a drivable graph from OSMnx, writes `temp.osm`, runs `netconvert`, writes `map_output/network.net.xml`, and updates `config/config.default.json`.

### Convenience map change

```bash
./change_map.sh "<location_query>" [radius_meters]
```

This activates `map_pipeline/venv` and delegates to `extract_map.py`.

### Calibration files

The calibration scripts exchange JSON files:

- schedule entries: `track_id`, `time`, `type`, `speed`, `entry: [x,y]`, `exit: [x,y]`;
- target trajectories: `trajectories[track_id].speed`, `.tan_acc`, `.lat_acc`;
- optimized parameters: `idm_T`, `idm_s0`, `comf_decel`, `sfm_A`, `sfm_B`.

These scripts are batch tools, not network endpoints, and currently contain machine-specific paths.

## 10. Compatibility guidance

Clients should:

1. Read the initial text message and verify `type === "road_network"`.
2. Decode binary records with little-endian reads.
3. Treat unknown agent types as displayable but unsupported.
4. Use frame length to derive agent count.
5. Tolerate reconnects and the absence of optional arrays.
6. Avoid assuming timestamps, tactical states, or stable frame cadence.
7. Avoid sending browser-only fields when implementing an independent C++ client.

For a versioned external API, the protocol needs an explicit version/header, timestamps, a structured error/acknowledgement message, and a documented capability handshake.
