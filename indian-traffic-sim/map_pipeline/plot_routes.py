import os
import sys
import random
import matplotlib.pyplot as plt

try:
    import osmnx as ox
    import networkx as nx
except ImportError:
    print("Please install osmnx and networkx")
    sys.exit(1)

# Path to the temporary OSM file saved during extraction
osm_path = "temp.osm"
if not os.path.exists(osm_path):
    print(f"File {osm_path} not found. Please run the map extraction first.")
    sys.exit(1)

print("Loading graph from OSM...")
# Load the graph
G = ox.graph_from_xml(osm_path, simplify=False)

# Get a list of all nodes
nodes = list(G.nodes())

routes = []
route_colors = []
colors = ['red', 'blue', 'green', 'orange', 'purple', 'cyan', 'magenta', 'yellow', 'brown', 'pink']

print("Calculating 10 random routes...")
random.seed(42) # for reproducibility
for i in range(10):
    # Try a few times to find a valid path
    for attempt in range(10):
        origin = random.choice(nodes)
        destination = random.choice(nodes)
        if origin == destination:
            continue
        try:
            route = nx.shortest_path(G, origin, destination, weight='length')
            if len(route) > 5: # ensure it's not a trivial 1-node path
                routes.append(route)
                route_colors.append(colors[i % len(colors)])
                break
        except nx.NetworkXNoPath:
            continue

print(f"Plotting {len(routes)} routes...")
# Plot the routes
output_path = "/home/rahul/.gemini/antigravity-cli/brain/da8328c3-b505-46c3-8883-c0120f93918e/static_routes_preview.png"
fig, ax = ox.plot_graph_routes(G, routes, route_colors=route_colors, route_linewidth=2, node_size=0, 
                               bgcolor='k', edge_color='#333333', save=True, filepath=output_path, 
                               show=False, close=True)

print(f"Plot saved to {output_path}")
