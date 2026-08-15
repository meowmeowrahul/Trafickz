import pandas as pd
import json

print("Reading dataset...")
df = pd.read_csv('/home/rahul/TruTraffic/dataset/Micropscopic Vehicle Trajectories.csv', sep=';', skipinitialspace=True, usecols=['Type'])
counts = df['Type'].value_counts()
print(counts)

type_map = {
    'motorcycle': 0, 'two-wheeler': 0,
    'auto': 1, 'rickshaw': 1, 'tuk-tuk': 1,
    'car': 2, 'taxi': 2,
    'bus': 3,
    'pedestrian': 4, 'ped': 4,
    'bicycle': 5, 'cycle': 5,
    'truck': 6, 'heavy': 6,
    'medium': 7
}

dist = [0.0] * 8
for t, count in counts.items():
    t_lower = str(t).lower()
    mapped = 2
    for k, v in type_map.items():
        if k in t_lower:
            mapped = v
            break
    dist[mapped] += count

total = sum(dist)
dist_pct = [d / total for d in dist]
print("\nDistribution Array:")
print(dist_pct)

# Update config.default.json
config_path = '/home/rahul/TruTraffic/indian-traffic-sim/config/config.default.json'
with open(config_path, 'r') as f:
    config = json.load(f)

config['vehicle_distribution'] = dist_pct

with open(config_path, 'w') as f:
    json.dump(config, f, indent=4)
print("\nUpdated config.default.json")
