import sys
import os
import subprocess
import json

try:
    import osmnx as ox
except ImportError:
    print("Please install osmnx: pip install osmnx networkx")
    sys.exit(1)

if len(sys.argv) < 2:
    print("Usage: python extract_map.py '<query_string>'")
    sys.exit(1)

query = sys.argv[1]
dist = int(sys.argv[2]) if len(sys.argv) > 2 else 500

print(f"[MapPipeline] Fetching OSM network for: {query} with dist {dist}m")
try:
    # Use graph_from_address with a radius, which is much more reliable for landmarks
    G = ox.graph_from_address(query, dist=dist, network_type='drive', simplify=False)
except Exception as e:
    print(f"[MapPipeline] Failed to fetch graph: {e}")
    sys.exit(1)

temp_osm = "temp.osm"
out_dir = "map_output"
os.makedirs(out_dir, exist_ok=True)
out_xml = os.path.join(out_dir, "network.net.xml")

print(f"[MapPipeline] Saving intermediate OSM file: {temp_osm}")
ox.settings.all_oneway = True
ox.save_graph_xml(G, filepath=temp_osm)

cmd = [
    "netconvert",
    "--osm-files", temp_osm,
    "-o", out_xml,
    "--geometry.remove",
    "--roundabouts.guess",
    "--ramps.guess",
    "--junctions.join"
]

print(f"[MapPipeline] Running netconvert...")
try:
    subprocess.run(cmd, check=True)
except subprocess.CalledProcessError as e:
    print(f"[MapPipeline] netconvert failed: {e}")
    sys.exit(1)

config_path = os.path.join(os.path.dirname(__file__), "..", "config", "config.default.json")
if os.path.exists(config_path):
    with open(config_path, "r") as f:
        config = json.load(f)
    
    # Needs absolute path for the C++ engine to resolve it easily when run from build/
    config["net_xml_path"] = os.path.abspath(out_xml)
    
    with open(config_path, "w") as f:
        json.dump(config, f, indent=4)
    print(f"[MapPipeline] Updated config.default.json with net_xml_path: {config['net_xml_path']}")
else:
    print(f"[MapPipeline] Warning: Could not find config at {config_path}")

print("[MapPipeline] Success! Map is ready.")
