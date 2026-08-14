import xml.etree.ElementTree as ET
import pyproj

tree = ET.parse('/home/rahul/TruTraffic/indian-traffic-sim/map_pipeline/map_output/network.net.xml')
root = tree.getroot()
loc = root.find('location')

netOffset = list(map(float, loc.attrib['netOffset'].split(',')))
orig = list(map(float, loc.attrib['origBoundary'].split(',')))
proj_str = loc.attrib['projParameter']

# Create transformer from lat/lon to UTM
transformer = pyproj.Transformer.from_crs("epsg:4326", proj_str, always_xy=True)

# Let's say origin is the center of the bounding box
lon = (orig[0] + orig[2]) / 2
lat = (orig[1] + orig[3]) / 2

utm_x, utm_y = transformer.transform(lon, lat)
engine_x = utm_x + netOffset[0]
engine_y = utm_y + netOffset[1]

print(f"Center Lon/Lat: {lon}, {lat}")
print(f"Engine Center X/Y: {engine_x}, {engine_y}")
