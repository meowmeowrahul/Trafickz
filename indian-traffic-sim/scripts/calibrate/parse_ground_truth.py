import pandas as pd
import numpy as np
import json
import math
import os

CSV_PATH = "/home/rahul/TruTraffic/dataset/Micropscopic Vehicle Trajectories.csv"
SCHEDULE_PATH = "inflow_schedule.json"
TRAJ_PATH = "target_trajectories.json"
METRICS_PATH = "target_metrics.json"

def get_agent_type(type_str):
    type_str = str(type_str).lower()
    if 'motorcycle' in type_str or 'two-wheeler' in type_str: return 0
    if 'auto' in type_str or 'rickshaw' in type_str: return 1
    if 'car' in type_str or 'taxi' in type_str: return 2
    if 'bus' in type_str: return 3
    if 'pedestrian' in type_str or 'ped' in type_str: return 4
    if 'bicycle' in type_str or 'cycle' in type_str: return 5
    if 'truck' in type_str or 'heavy' in type_str: return 6
    return 2 # default Car

def compute_metrics():
    print("Loading dataset for Phase 7...")
    try:
        df = pd.read_csv(CSV_PATH, sep=';', skipinitialspace=True, engine='python', 
                         usecols=['Track ID', 'Type', 'Track Width [m]', 'Track Length [m]', 'x [m]', 'y [m]', 'Speed [km/h]', 'Time [s]', 'Angle [rad]'])
    except Exception as e:
        print(f"Error loading CSV: {e}")
        return

    print(f"Loaded {len(df)} rows.")

    # Sort by time to ensure chronological order
    df = df.sort_values(by=['Track ID', 'Time [s]'])

    schedule = []
    trajectories = {}

    grouped = df.groupby('Track ID')
    
    # We only process a subset of track IDs for DTW to keep GA fast
    # Let's say we process first 200 vehicles
    track_ids = list(grouped.groups.keys())
    # track_ids = track_ids[:500] 

    print("Extracting schedules and 1Hz trajectories...")
    for track_id, group in grouped:
        if len(group) < 5:
            continue
            
        first = group.iloc[0]
        last = group.iloc[-1]
        
        # Schedule
        type_str = first['Type']
        atype = get_agent_type(type_str)
        entry_time = float(first['Time [s]'])
        speed_ms = float(first['Speed [km/h]']) / 3.6
        
        schedule.append({
            "track_id": int(track_id),
            "time": entry_time,
            "type": atype,
            "speed": speed_ms,
            "entry": [float(first['x [m]']), float(first['y [m]'])],
            "exit": [float(last['x [m]']), float(last['y [m]'])]
        })

        # 1Hz Trajectory for DTW
        # The dataset is ~10Hz or 25Hz. We downsample to 1Hz (integer seconds).
        # We can group by int(Time [s]) and take the mean speed
        group['Time_sec'] = group['Time [s]'].astype(int)
        sec_grouped = group.groupby('Time_sec')['Speed [km/h]'].mean() / 3.6 # convert to m/s
        
        # Store as array
        traj_array = [float(v) for v in sec_grouped.values]
        trajectories[str(track_id)] = traj_array
        
    # Sort schedule by time
    schedule.sort(key=lambda x: x["time"])

    with open(SCHEDULE_PATH, 'w') as f:
        json.dump(schedule, f, indent=2)
    print(f"Saved {len(schedule)} vehicles to {SCHEDULE_PATH}")

    with open(TRAJ_PATH, 'w') as f:
        json.dump({"trajectories": trajectories}, f, indent=2)
    print(f"Saved {len(trajectories)} trajectories to {TRAJ_PATH}")

    # Backward compatibility for car dimensions
    cars = df[df['Type'].str.contains('Car', case=False, na=False)]
    car_width = cars['Track Width [m]'].mean() if len(cars) > 0 else 2.0
    car_length = cars['Track Length [m]'].mean() if len(cars) > 0 else 5.0

    metrics = {
        "car_width": float(car_width),
        "car_length": float(car_length)
    }
    with open(METRICS_PATH, 'w') as f:
        json.dump(metrics, f, indent=4)
        
if __name__ == "__main__":
    compute_metrics()
